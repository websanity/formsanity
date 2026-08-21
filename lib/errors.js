let bubbleSeq = 0;

function bubbleHost(field) {
	const control = field.controls[0];
	const fallback = field.row ?? control.closest('fieldset');
	if (!field.errorTo) return fallback;
	return control.closest('form')?.querySelector(field.errorTo) ?? fallback;
}

export function showBubble(field, message) {
	const control = field.controls[0];
	const host = bubbleHost(field);
	let bubble = host?.querySelector('.fs-error');
	if (!bubble) {
		bubble = document.createElement('p');
		bubble.className = 'fs-error';
		bubble.id = `fs-error-${bubbleSeq += 1}`;
		(host ?? control.parentElement).append(bubble);
	}
	bubble.textContent = message;
	control.setAttribute('aria-invalid', 'true');
	control.setAttribute('aria-describedby', bubble.id);
}

export function clearBubble(field) {
	bubbleHost(field)?.querySelector('.fs-error')?.remove();
	for (const control of field.controls) {
		control.removeAttribute('aria-invalid');
		control.removeAttribute('aria-describedby');
	}
}

export function applyRowState(field, verdict) {
	const row = field.row ?? field.controls[0].closest('fieldset');
	if (!row) return;
	row.classList.toggle('fs-valid', verdict === 'valid');
	row.classList.toggle('fs-incomplete', verdict === 'incomplete');
	row.classList.toggle('fs-invalid', verdict === 'invalid');
}

export function renderStatus(region, { incompleteCount, invalidCount, messages }) {
	if (!region) return;
	let incompleteEl = region.querySelector('.fs-status-incomplete');
	if (!incompleteEl) {
		incompleteEl = document.createElement('p');
		incompleteEl.className = 'fs-status-incomplete';
		region.append(incompleteEl);
	}
	incompleteEl.textContent = messages.incomplete;
	incompleteEl.hidden = incompleteCount === 0;

	let invalidEl = region.querySelector('.fs-status-invalid');
	if (!invalidEl) {
		invalidEl = document.createElement('p');
		invalidEl.className = 'fs-status-invalid';
		region.append(invalidEl);
	}
	invalidEl.textContent = messages.invalid;
	invalidEl.hidden = invalidCount === 0;
}

export function ensureStatusRegion(form) {
	let region = form.querySelector('.fs-status');
	if (!region) {
		region = document.createElement('div');
		region.className = 'fs-status';
		region.setAttribute('aria-live', 'polite');
		const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
		(submit ?? form.lastElementChild).before(region);
	}
	return region;
}
