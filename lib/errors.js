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
