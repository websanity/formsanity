import { showBubble, clearBubble } from './errors.js';
import { messageFor, formMessages } from './messages.js';
import { runHooks } from './hooks.js';

const UNIQUE_DEBOUNCE_MS = 300;
const RESULT_CLASSES = ['fs-processing', 'fs-success', 'fs-error'];

// attachSubmit(form, state): intercepts the form's submit event and drives it
// through validation, pre-submit hooks, gathering, the fetch, and envelope
// interpretation. `state` is the same shape updateFormState consumes:
// { model, controllers, relevance, region }.
export function attachSubmit(form, state) {
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		submit(form, state);
	});
}

async function submit(form, state) {
	const { region } = state;
	if (!validateAll(state)) return;

	clearFormLevelErrors(region);
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
		if (!state.relevance.isRelevant(controller.field.name)) continue;
		if (controller.verdict === 'valid') continue;
		allValid = false;
		controller.present();
		if (!firstInvalid) firstInvalid = controller.field.controls[0];
	}
	firstInvalid?.focus();
	return allValid;
}

function gather(model, relevance) {
	const payload = {};
	for (const field of model.fields.values()) {
		if (!relevance.isRelevant(field.name)) continue;
		if (field.controls[0].disabled) continue;
		payload[field.name] = valueOf(field);
	}
	return payload;
}

function valueOf(field) {
	const [first] = field.controls;
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
export function attachUnique(field, url, controller) {
	const control = field.controls[0];
	let timer = null;

	control.addEventListener('focusout', () => {
		clearTimeout(timer);
		const value = control.value;
		if (!value || controller.verdict !== 'valid') return;
		timer = setTimeout(() => check(value), UNIQUE_DEBOUNCE_MS);
	});

	async function check(value) {
		if (control.value !== value) return;
		let response;
		try {
			response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ field: field.name, value })
			});
		} catch {
			clearBubble(field);
			return;
		}
		if (response.status === 429) {
			clearBubble(field);
			return;
		}
		const data = await response.json().catch(() => null);
		if (data?.unique === false) showBubble(field, messageFor('unique'));
		else clearBubble(field);
	}
}
