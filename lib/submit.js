import { showBubble, clearBubble } from './errors.js';
import { messageFor, formMessages } from './messages.js';
import { runHooks } from './hooks.js';

const UNIQUE_DEBOUNCE_MS = 300;
const RESULT_CLASSES = ['fs-processing', 'fs-success', 'fs-error'];

// attachSubmit(form, state): intercepts the form's submit event and drives it
// through validation, pre-submit hooks, gathering, the fetch, and envelope
// interpretation. `state` is the same shape updateFormState consumes:
// { model, controllers, relevance, region }.
//
// Re-entrancy: `inFlight` blocks a second submit event from starting a second
// request while one is still in flight (two rapid clicks/Enter presses fire
// two synchronous 'submit' events before any async work from the first one
// resolves). The submit control is also disabled for the duration as a
// visible/behavioral backstop, independent of the data-fs-no-gate completeness
// gate — both are cleared in the same finally regardless of how submit(...)
// exits.
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
		// A hook rejected the submission before anything was sent — no
		// envelope exists, so fs:error is not dispatched for this case.
		setRegionState(region, 'fs-error', formMessages.error);
		return;
	}

	form.dispatchEvent(new CustomEvent('fs:submit', { bubbles: true, detail: { payload } }));

	const hasFiles = !!form.querySelector('input[type="file"]');
	let envelope = null;
	try {
		const response = hasFiles
			? await fetch(form.action || window.location.href, { method: 'POST', body: toFormData(payload) })
			: await fetch(form.action || window.location.href, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
		envelope = await response.json().catch(() => null);
	} catch {
		envelope = null;
	}

	setRegionState(region, null, '');
	handleEnvelope(form, state, envelope);
}

function validateAll(state) {
	let allValid = true;
	let firstInvalid = null;
	for (const controller of state.controllers.values()) {
		if (!isGathered(controller.field, state.relevance)) continue;
		if (controller.verdict === 'valid') continue;
		allValid = false;
		controller.present();
		if (!firstInvalid) firstInvalid = controller.field.controls[0];
	}
	firstInvalid?.focus();
	return allValid;
}

// isGathered(field, relevance): true when gather() will include this field in
// the submission payload — relevant, and not author-disabled via its first
// control. Anything driving validation or the gate off the same universe
// gather() submits (updateFormState's counts, validateAll's checks) MUST use
// this predicate rather than reimplementing it, so a server-prefilled
// disabled field with an out-of-range value can never wedge the gate for a
// field that never actually submits.
export function isGathered(field, relevance) {
	if (!relevance.isRelevant(field.name)) return false;
	return !field.controls[0].disabled;
}

function gather(model, relevance) {
	const payload = {};
	for (const field of model.fields.values()) {
		if (!isGathered(field, relevance)) continue;
		payload[field.name] = valueOf(field);
	}
	return payload;
}

function valueOf(field) {
	const [first] = field.controls;
	if (first.matches('select[multiple]')) {
		return [...first.selectedOptions].map((option) => option.value);
	}
	if (first.type === 'checkbox' || first.type === 'radio') {
		return field.controls.filter((control) => control.checked).map((control) => control.value);
	}
	if (first.type === 'file') return [...first.files];
	return first.value;
}

function toFormData(payload) {
	const data = new FormData();
	for (const [name, value] of Object.entries(payload)) {
		const values = Array.isArray(value) ? value : [value];
		for (const item of values) data.append(name, item ?? '');
	}
	return data;
}

function handleEnvelope(form, state, envelope) {
	if (!envelope || envelope.formsanity !== 2) {
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

function applyFieldErrors(state, errors) {
	const formLevel = [];
	for (const error of errors) {
		const field = error.field ? state.model.fields.get(error.field) : null;
		const message = error.message ?? messageFor(error.code);
		if (field) showBubble(field, message);
		else formLevel.push(message);
	}
	setFormLevelErrors(state.region, formLevel);
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

// attachUnique(field, url, controller): wires the data-fs-unique sub-protocol
// for a single field. On blur, once the field's own verdict is already valid
// and its value is non-empty, debounces 300ms then POSTs {field, value} to
// `url`. unique: false presents an invalid/'unique' bubble; a 429 (rate
// limited) or network failure clears any such bubble and backs off silently
// since the authoritative check happens again at submission.
//
// Stale-response guard: `sequence` increments on every check() invocation: a
// slow, older request that resolves after a newer one has already landed is
// detected (its captured requestId no longer matches the latest sequence)
// and its result is discarded rather than overwriting the newer state.
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
		let response;
		try {
			response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ field: field.name, value })
			});
		} catch {
			if (requestId === sequence) clearBubble(field);
			return;
		}
		if (requestId !== sequence) return;
		if (response.status === 429) {
			clearBubble(field);
			return;
		}
		const data = await response.json().catch(() => null);
		if (requestId !== sequence) return;
		if (data?.unique === false) showBubble(field, messageFor('unique'));
		else clearBubble(field);
	}
}
