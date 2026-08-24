let bubbleSeq = 0;

function bubbleHost(field) {
	const control = field.controls[0];
	const fallback = field.row ?? control.closest('fieldset');
	if (!field.errorTo) return fallback;
	return control.closest('form')?.querySelector(field.errorTo) ?? fallback;
}

// A row may host more than one field (a compound field pair sharing one
// label), so bubbles are tagged with their owning field name — otherwise a
// sibling field's showBubble/clearBubble would find and stomp this field's
// bubble via a bare '.fs-error' lookup on the shared host.
function bubbleSelector(field) {
	return `.fs-error[data-fs-field="${field.name}"]`;
}

// aria-describedby is a token list a field may share with author-supplied
// hints (e.g. a static "we'll never share this" note). addDescribedBy and
// removeDescribedBy add/remove only this bubble's own id so an author's other
// tokens survive an error show/clear cycle intact.
function addDescribedBy(control, id) {
	const tokens = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
	if (!tokens.includes(id)) tokens.push(id);
	control.setAttribute('aria-describedby', tokens.join(' '));
}

function removeDescribedBy(control, id) {
	const tokens = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((token) => token !== id);
	if (tokens.length) control.setAttribute('aria-describedby', tokens.join(' '));
	else control.removeAttribute('aria-describedby');
}

export function showBubble(field, message) {
	const host = bubbleHost(field);
	let bubble = host?.querySelector(bubbleSelector(field));
	if (!bubble) {
		bubble = document.createElement('p');
		bubble.className = 'fs-error';
		bubble.dataset.fsField = field.name;
		bubble.id = `fs-error-${bubbleSeq += 1}`;
		// On the field's own row the bubble sits immediately below its
		// control, above any author hint. Other hosts — an errorTo target,
		// a choice group's fieldset — take it at the end.
		if (host && host === field.row) {
			const control = field.controls[field.controls.length - 1];
			// Climb out of whatever wrappers hold the control — the caps box, a compound group, a wrapping label — so the bubble lands in the row itself. Inside a label its text would join the control's accessible name and clicking it would activate the control; inside a compound it would become a flex column beside the inputs.
			let anchor = control;
			while (anchor.parentElement !== host && anchor.parentElement.matches('.fs-caps, .compound, label')) {
				anchor = anchor.parentElement;
			}
			anchor.after(bubble);
		} else {
			(host ?? field.controls[0].parentElement).append(bubble);
		}
	}
	bubble.textContent = message;
	for (const control of field.controls) {
		control.setAttribute('aria-invalid', 'true');
		addDescribedBy(control, bubble.id);
	}
}

export function clearBubble(field) {
	const bubble = bubbleHost(field)?.querySelector(bubbleSelector(field));
	for (const control of field.controls) {
		control.removeAttribute('aria-invalid');
		if (bubble) removeDescribedBy(control, bubble.id);
	}
	bubble?.remove();
}

export function applyRowState(field, verdict, missing = false) {
	const row = field.row ?? field.controls[0].closest('fieldset');
	if (!row) return;
	row.classList.toggle('fs-valid', verdict === 'valid');
	row.classList.toggle('fs-incomplete', verdict === 'incomplete');
	row.classList.toggle('fs-invalid', verdict === 'invalid');
	row.classList.toggle('fs-missing', missing);
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
