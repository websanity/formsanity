import { showBubble, clearBubble } from './errors.js';
import { messageFor, formMessages } from './messages.js';
import { runHooks, submitHandlerOf } from './hooks.js';
import { fieldValues } from './values.js';

const UNIQUE_DEBOUNCE_MS = 300;
const RESULT_CLASSES = ['fs-processing', 'fs-success', 'fs-error'];

// attachSubmit(form, state): intercepts the form's submit event and drives it through validation, pre-submit hooks, gathering, the fetch or the form's submit handler, and envelope interpretation. `state` is the same shape updateFormState consumes: { model, controllers, relevance, region }.
//
// Re-entrancy: `inFlight` blocks a second submit event from starting a second request while one is still in flight (two rapid clicks/Enter presses fire two synchronous 'submit' events before any async work from the first one resolves). The submit control is also disabled for the duration as a visible/behavioral backstop, independent of the data-fs-no-gate completeness gate — both are cleared in the same finally regardless of how submit(...) exits.
export function attachSubmit(form, state) {
	let inFlight = false;
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		if (inFlight) return;
		clearFormLevelErrors(state.region);
		if (!validateAll(state)) return;
		inFlight = true;
		const submitControl = findSubmitControl(form);
		if (submitControl) submitControl.disabled = true;
		submit(form, state).finally(() => {
			inFlight = false;
			if (submitControl) submitControl.disabled = false;
			// A rejection may have marked fields invalid while the control was locked for the flight; the recount closes the gate again if so.
			state.recount?.();
		});
	});
}

function findSubmitControl(form) {
	return form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
}

async function submit(form, state) {
	const { region } = state;
	setRegionState(region, 'fs-processing', formMessages.processing);

	const payload = gather(state.model, state.relevance);
	try {
		await runHooks(form, payload);
	} catch {
		// A hook rejected the submission before anything was sent — no envelope exists, so fs:error is not dispatched for this case.
		setRegionState(region, 'fs-error', formMessages.error);
		return;
	}

	form.dispatchEvent(new CustomEvent('fs:submit', { bubbles: true, detail: { payload } }));

	// A submit handler answers in place of the request, and what it returns meets the same envelope checks as a response body: a thrown error reads as a request that never completed.
	const handler = submitHandlerOf(form);
	const envelope = handler ? await answerFrom(handler, form, payload) : await post(form, payload, state.model).catch(() => null);

	setRegionState(region, null, '');
	handleEnvelope(form, state, envelope);
}

// A handler is site code, so its failures go to the console: the person sees only the generic failure line, and the author needs the reason.
async function answerFrom(handler, form, payload) {
	try {
		const envelope = (await handler({ form, payload })) ?? null;
		if (envelope === null) console.error('FormSanity: the submit handler returned no envelope, so the submission reads as a protocol error. A handler returns an envelope on every path.');
		else if (!isReadable(envelope)) console.error('FormSanity: the submit handler returned a value that is not a version-2 envelope, so the submission reads as a protocol error.', envelope);
		return envelope;
	} catch (error) {
		console.error('FormSanity: the submit handler threw, so the submission reads as a request that never completed.', error);
		return null;
	}
}

// isReadable(envelope): true for an object that carries formsanity: 2 and, on an invalid envelope, errors that are absent or an array of objects. Anything else is a protocol error.
function isReadable(envelope) {
	if (!envelope || envelope.formsanity !== 2) return false;
	if (envelope.status !== 'invalid' || envelope.errors == null) return true;
	return Array.isArray(envelope.errors) && envelope.errors.every((error) => error !== null && typeof error === 'object');
}

async function post(form, payload, model) {
	const target = form.action || window.location.href;
	const response = form.querySelector('input[type="file"]')
		? await fetch(target, { method: 'POST', body: toFormData(payload, model) })
		: await fetch(target, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
	return response.json().catch(() => null);
}

function validateAll(state) {
	let allValid = true;
	let firstInvalid = null;
	for (const controller of state.controllers.values()) {
		if (!isGathered(controller.field, state.relevance)) continue;
		if (controller.verdict === 'valid') continue;
		allValid = false;
		// Requiredness never bubbles, even here: the asterisk and the status line are its whole voice. Only wrong answers present.
		if (!controller.missing) controller.present();
		// The first control of a partly relevant set can be a disabled member, which cannot take focus, so focus goes to the first enabled control.
		if (!firstInvalid) firstInvalid = controller.field.controls.find((control) => !control.disabled) ?? controller.field.controls[0];
	}
	firstInvalid?.focus();
	return allValid;
}

// isGathered(field, relevance): true when gather() will include this field in the submission payload — relevant, and with some control enabled. Anything driving validation or the gate off the same universe gather() submits (updateFormState's counts, validateAll's checks) MUST use this predicate rather than reimplementing it, so a server-prefilled disabled field with an out-of-range value can never wedge the gate for a field that never actually submits.
export function isGathered(field, relevance) {
	if (!relevance.isRelevant(field.name)) return false;
	return field.controls.some((control) => !control.disabled);
}

function gather(model, relevance) {
	const payload = {};
	for (const field of model.fields.values()) {
		if (!isGathered(field, relevance)) continue;
		payload[field.name] = fieldValues(field);
	}
	return payload;
}

// An array-valued field's parts carry the [] suffix, so the form parsers of PHP and Ruby collect them as an array instead of keeping the last one. The field decides: a checkbox or radio field of any member count, a select[multiple], or a file input with multiple. A key the model does not know, such as a hook-injected extra, is suffixed when its value is an array. An empty array produces no part, and a server reads the absent key as no answer.
function toFormData(payload, model) {
	const data = new FormData();
	for (const [name, value] of Object.entries(payload)) {
		const first = model.fields.get(name)?.controls[0];
		const arrayValued = first
			? first.type === 'checkbox' || first.type === 'radio' || first.matches('select[multiple]') || (first.type === 'file' && first.multiple)
			: Array.isArray(value);
		const values = Array.isArray(value) ? value : [value];
		for (const item of values) data.append(arrayValued ? `${name}[]` : name, item ?? '');
	}
	return data;
}

function handleEnvelope(form, state, envelope) {
	if (!isReadable(envelope)) {
		setRegionState(state.region, 'fs-error', formMessages.protocol);
		form.dispatchEvent(new CustomEvent('fs:error', { bubbles: true, detail: { envelope } }));
		return;
	}

	if (envelope.status === 'invalid') {
		applyFieldErrors(state, envelope.errors ?? []);
		form.dispatchEvent(new CustomEvent('fs:rejected', { bubbles: true, detail: { envelope } }));
		return;
	}

	if (envelope.status === 'accepted') {
		form.dispatchEvent(new CustomEvent('fs:accepted', { bubbles: true, detail: { envelope } }));
		if (envelope.redirect) {
			window.location.assign(envelope.redirect);
			return;
		}
		setRegionState(state.region, 'fs-success', envelope.message ?? '');
		return;
	}

	setRegionState(state.region, 'fs-error', envelope.message ?? formMessages.error);
	form.dispatchEvent(new CustomEvent('fs:error', { bubbles: true, detail: { envelope } }));
}

// An error lands on its field only when the person can edit that field, because an edit is what ends the verdict. Every other error is form-level: one with no field, one that names a field the form does not hold, and one for a field the person cannot edit. Editability is read as the envelope lands, before the fields settle around the new verdicts.
function applyFieldErrors(state, errors) {
	const formLevel = [];
	const landed = [];
	for (const error of errors) {
		const field = error.field ? state.model.fields.get(error.field) : null;
		const message = error.message ?? messageFor(error.code);
		const controller = field && isEditable(field, state.relevance) ? state.controllers.get(field.name) : null;
		if (controller) {
			controller.rejectFromServer(error.code, message);
			landed.push(field.name);
		} else formLevel.push(message);
	}
	setFormLevelErrors(state.region, formLevel);
	state.settle?.(landed);
}

// isEditable(field, relevance): true when the person can change the field's answer — it is relevant, and one of its controls is neither disabled, nor readonly, nor type="hidden". willValidate is the platform's own reading of exactly those three bars.
function isEditable(field, relevance) {
	return relevance.isRelevant(field.name) && field.controls.some((control) => control.willValidate);
}

function setRegionState(region, cls, text) {
	if (!region) return;
	region.classList.remove(...RESULT_CLASSES);
	if (cls) region.classList.add(cls);
	let message = region.querySelector('.fs-status-message');
	if (!message) {
		message = document.createElement('p');
		message.className = 'fs-status-message';
		region.append(message);
	}
	message.textContent = text ?? '';
	message.hidden = !text;
}

function clearFormLevelErrors(region) {
	if (!region) return;
	for (const el of region.querySelectorAll('.fs-status-error')) el.remove();
}

function setFormLevelErrors(region, lines) {
	if (!region) return;
	clearFormLevelErrors(region);
	for (const line of lines) {
		const el = document.createElement('p');
		el.className = 'fs-status-error';
		el.textContent = line;
		region.append(el);
	}
}

// attachUnique(field, url, controller): wires the data-fs-unique sub-protocol for a single field. On blur, once the field's own verdict is already valid and its value is non-empty, debounces 300ms then POSTs {field, value} to `url`. unique: false presents an invalid/'unique' bubble; a 429 (rate limited) or network failure clears any such bubble and backs off silently since the authoritative check happens again at submission.
//
// Stale-response guard: `sequence` increments on every check() invocation: a slow, older request that resolves after a newer one has already landed is detected (its captured requestId no longer matches the latest sequence) and its result is discarded rather than overwriting the newer state.
export function attachUnique(field, url, controller) {
	const control = field.controls[0];
	let timer = null;
	let sequence = 0;

	control.addEventListener('focusout', () => {
		clearTimeout(timer);
		const value = control.value;
		if (!value || controller.verdict !== 'valid') return;
		timer = setTimeout(() => check(value), UNIQUE_DEBOUNCE_MS);
	});

	async function check(value) {
		const requestId = ++sequence;
		// The answer of a check owns the bubble only while the field is valid by its own verdict. A verdict that arrived during the flight, a rejection from the server included, has a message of its own on show.
		const isCurrent = () => requestId === sequence && controller.verdict === 'valid';
		let response;
		try {
			response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ field: field.name, value })
			});
		} catch {
			if (isCurrent()) clearBubble(field);
			return;
		}
		if (!isCurrent()) return;
		if (response.status === 429) {
			clearBubble(field);
			return;
		}
		const data = await response.json().catch(() => null);
		if (!isCurrent()) return;
		if (data?.unique === false) showBubble(field, messageFor('unique'));
		else clearBubble(field);
	}
}
