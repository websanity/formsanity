// Presentation-layer behaviors: copy-to mirroring, amount totals, generated
// date options, password reveal, and maxlength counters. These are DOM
// conveniences, not validation — they read/write control values directly and
// dispatch a bubbling 'input' event after any programmatic value change so
// the rest of the engine (validation, dependents, other behaviors, the gate)
// reacts exactly as if the user had typed.

import { hints } from './messages.js';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A typed control with no authored placeholder gets its type's format hint.
// The author's own placeholder always wins.
function wireHints(form) {
	for (const control of form.querySelectorAll('[data-fs-type]:not([placeholder])')) {
		const hint = hints[control.getAttribute('data-fs-type')];
		if (hint) control.setAttribute('placeholder', hint);
	}
}

export function attachBehaviors(form, model, _ctx) {
	wireHints(form);
	wireCopyTo(form, model);
	wireAmounts(form);
	wireDateOptions(form);
	wireCaps(form);
	wireReveal(form);
	wireCounters(form);
	wireDeselect(form);
	wireSegmented(form);
}

// Radio-button groups render as one segmented control while they fit on a
// line, and fall apart into separated pills when they cannot. CSS has no
// wrap detection, so a ResizeObserver measures the group IN the segmented
// state — inside the callback, before paint, so nothing flashes — and
// mirrors the verdict as an fs-wrapped class.
function wireSegmented(form) {
	for (const fieldset of form.querySelectorAll('fieldset.toggle-list.buttons')) {
		if (!fieldset.querySelector('input[type="radio"]')) continue;
		fieldset.classList.add('fs-segmented');
		const list = fieldset.querySelector('ul');
		const reflect = () => {
			fieldset.classList.remove('fs-wrapped');
			fieldset.classList.toggle('fs-wrapped', list.scrollWidth > list.clientWidth);
		};
		new ResizeObserver(reflect).observe(list);
		reflect();
	}
}

function dispatchInput(el) {
	el.dispatchEvent(new CustomEvent('input', { bubbles: true }));
}

// data-fs-copy-to="target-name": mirrors a source control's value onto the
// named target field whenever the source receives input.
//
// Guarded against cycles (A copies to B, B copies to A, or a field copying
// to itself): once the target already holds the value being written, the
// write + dispatch is skipped. A chain (A -> B -> C) still propagates in
// full since each hop's value genuinely changes; a cycle collapses to one
// hop instead of recursing to stack exhaustion.
function wireCopyTo(form, model) {
	const sources = [...form.querySelectorAll('[data-fs-copy-to]')];
	if (!sources.length) return;
	form.addEventListener('input', (event) => {
		if (!sources.includes(event.target)) return;
		const target = model.fields.get(event.target.getAttribute('data-fs-copy-to'))?.controls[0];
		if (!target) return;
		if (target.value === event.target.value) return;
		target.value = event.target.value;
		dispatchInput(target);
	});
}

// data-fs-amount / data-fs-amount-total: sums every amount-marked control in
// the form into every total target, on input and once at init.
function parseAmount(value) {
	const n = Number((value ?? '').replace(/[$,]/g, ''));
	return Number.isNaN(n) ? 0 : n;
}

// A term counts only while it is actually in play, and it reads its value the
// same way an expression reads a field's: an unchecked checkbox or radio is
// '', so the alternatives in a priced choice set don't all sum at once. A
// disabled control is out too — relevance disables every control of an
// irrelevant field, and such a field is neither validated nor submitted, so
// letting it keep contributing would put money in the total that the server
// never sees.
function termValue(el) {
	if (el.disabled) return '';
	if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? el.value : '';
	return el.value;
}

function wireAmounts(form) {
	const amountEls = [...form.querySelectorAll('[data-fs-amount]')];
	const totalEls = [...form.querySelectorAll('[data-fs-amount-total]')];
	if (!amountEls.length || !totalEls.length) return;

	function recompute() {
		const sum = amountEls.reduce((total, el) => total + parseAmount(termValue(el)), 0);
		const text = sum.toFixed(2);
		for (const totalEl of totalEls) {
			if (totalEl.matches('input, select, textarea')) {
				// Only write on a real change. A total that is itself a form
				// control dispatches input, which re-enters recompute through
				// the listener below; the equality check is what stops that
				// from recursing forever.
				if (totalEl.value === text) continue;
				totalEl.value = text;
				dispatchInput(totalEl);
			} else {
				totalEl.textContent = text;
			}
		}
	}

	// Any input in the form, not just a term's own: a term stops counting when
	// the field driving its relevance changes, and that event belongs to some
	// other control entirely. The engine's own relevance listener is registered
	// first, so the disabled states this reads are already up to date.
	form.addEventListener('input', recompute);
	recompute();
}

// data-fs-year-options="from,to" / data-fs-month-options="from,to": generate
// <option>s once at init, appended after any existing static options.
//
// Years: offsets are whole years relative to the current year (from <= to),
// value and label both the plain 4-digit year — e.g. "0,5" from 2026 yields
// 2026..2031.
//
// Months: offsets are whole months relative to the current calendar month
// (from <= to), NOT relative to the current year. Each option's value is the
// resulting calendar month number (1-12); when the offset run crosses a year
// boundary the values simply wrap and keep counting calendar months (a
// select doesn't otherwise carry a year), so "0,11" always yields exactly
// the 12 calendar months starting at the current month, in order, once each.
// Label text is "MM - Mon", e.g. "08 - Aug".
function parseOffsets(value) {
	const [from, to] = value.split(',').map((part) => parseInt(part.trim(), 10));
	return { from, to };
}

function wireDateOptions(form) {
	for (const select of form.querySelectorAll('select[data-fs-year-options]')) addYearOptions(select);
	for (const select of form.querySelectorAll('select[data-fs-month-options]')) addMonthOptions(select);
}

function addYearOptions(select) {
	const { from, to } = parseOffsets(select.getAttribute('data-fs-year-options'));
	const currentYear = new Date().getFullYear();
	for (let offset = from; offset <= to; offset += 1) {
		const year = currentYear + offset;
		const option = document.createElement('option');
		option.value = String(year);
		option.textContent = String(year);
		select.append(option);
	}
}

function addMonthOptions(select) {
	const { from, to } = parseOffsets(select.getAttribute('data-fs-month-options'));
	const currentMonthIndex = new Date().getMonth();
	for (let offset = from; offset <= to; offset += 1) {
		const monthIndex = (((currentMonthIndex + offset) % 12) + 12) % 12;
		const monthNumber = monthIndex + 1;
		const option = document.createElement('option');
		option.value = String(monthNumber);
		option.textContent = `${String(monthNumber).padStart(2, '0')} - ${MONTH_ABBR[monthIndex]}`;
		select.append(option);
	}
}

// Deselection: clicking a checked radio unchecks it, and clicking the only
// selected item in a multi-select list clears the list. Both give an answer
// a way back to "unanswered" that the native controls lack.
function wireDeselect(form) {
	// The radio's checked state is captured BEFORE the default action runs
	// (pointerdown, or keydown for Space), because label activation ends in
	// a synthesized click on the input after the state has already changed.
	// Only the input's own click consumes the capture — a label's bubbling
	// click would otherwise toggle once per event.
	let pending = null;
	const resolveRadio = (el) =>
		el.matches?.('input[type="radio"]') ? el : (el.closest?.('label')?.querySelector('input[type="radio"]') ?? null);
	form.addEventListener('pointerdown', (event) => {
		const radio = resolveRadio(event.target);
		pending = radio ? { radio, wasChecked: radio.checked } : null;
	});
	form.addEventListener('keydown', (event) => {
		if (event.key === ' ' && event.target.matches?.('input[type="radio"]')) {
			pending = { radio: event.target, wasChecked: event.target.checked };
		}
	});
	form.addEventListener('click', (event) => {
		if (!event.target.matches?.('input[type="radio"]')) return;
		if (pending?.radio === event.target && pending.wasChecked) {
			event.target.checked = false;
			dispatchInput(event.target);
			event.target.dispatchEvent(new Event('change', { bubbles: true }));
		}
		pending = null;
	});
	form.addEventListener('pointerdown', (event) => {
		if (event.ctrlKey || event.metaKey || event.shiftKey) return;
		const option = event.target.closest?.('option');
		const select = option?.closest('select[multiple]');
		if (!select || select.selectedOptions.length !== 1 || select.selectedOptions[0] !== option) return;
		event.preventDefault();
		option.selected = false;
		select.focus();
		dispatchInput(select);
		select.dispatchEvent(new Event('change', { bubbles: true }));
	});
}

// data-fs-prefix / data-fs-suffix: caps fused to a control's box, informational
// bookends like a currency mark or a unit. The control is wrapped so the caps
// share its border; wrapping preserves element identity, so nothing that holds
// a reference to the control notices. Runs before wireReveal so a reveal
// button lands inside the wrapper as an interactive suffix cap.
function wireCaps(form) {
	for (const control of form.querySelectorAll('[data-fs-prefix], [data-fs-suffix], input[data-fs-reveal], input[type="file"], input[type="date"], input[type="time"], input[type="datetime-local"]')) {
		const wrapper = document.createElement('span');
		wrapper.className = 'fs-caps';
		control.before(wrapper);
		const cap = (className, text) => {
			const span = document.createElement('span');
			span.className = className;
			span.textContent = text;
			wrapper.append(span);
			return span;
		};
		const prefix = control.getAttribute('data-fs-prefix');
		if (prefix) cap('fs-prefix', prefix);
		wrapper.append(control);
		const suffix = control.getAttribute('data-fs-suffix');
		if (suffix) {
			cap('fs-suffix', suffix);
		} else if (control.matches('input[type="file"]')) {
			// The cap is a decorative stand-in for the hidden native button —
			// the input itself remains the accessible control — so it is
			// hidden from assistive tech and forwards its clicks.
			const chooser = cap('fs-suffix', 'Choose file…');
			chooser.setAttribute('aria-hidden', 'true');
			chooser.addEventListener('click', () => control.click());
		} else if (control.matches('input[type="date"], input[type="time"], input[type="datetime-local"]')) {
			// A glyph cap that opens the native picker. Where the engine has
			// no popup for the type (Firefox time), showPicker throws and the
			// cap falls back to focusing the control.
			const picker = cap('fs-suffix', '');
			picker.classList.add(`fs-picker-${control.type}`);
			picker.setAttribute('aria-hidden', 'true');
			picker.addEventListener('click', () => {
				try {
					control.showPicker();
				} catch {
					control.focus();
				}
			});
		}
		if (control.matches('input[type="file"]')) {
			// fs-has-file lets the stylesheet gray the browser's "No file
			// chosen" text like a placeholder while chosen filenames keep
			// normal ink — the text node has no styling hook of its own.
			const reflect = () => wrapper.classList.toggle('fs-has-file', control.files.length > 0);
			control.addEventListener('change', reflect);
			reflect();
		}
	}
}

// data-fs-reveal on a password input: appends a toggle button that flips the
// control between password/text and reflects its state via label + aria-pressed.
function wireReveal(form) {
	for (const input of form.querySelectorAll('input[data-fs-reveal]')) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'fs-reveal';
		button.setAttribute('aria-pressed', 'false');
		button.setAttribute('aria-label', 'Show password');
		input.after(button);
		button.addEventListener('click', () => {
			const revealed = input.type === 'text';
			input.type = revealed ? 'password' : 'text';
			button.setAttribute('aria-label', revealed ? 'Show password' : 'Hide password');
			button.setAttribute('aria-pressed', String(!revealed));
		});
	}
}

// Any [maxlength] control gets a live "N characters remaining" counter,
// inserted immediately after the control and updated on input.
function wireCounters(form) {
	for (const control of form.querySelectorAll('[maxlength]')) {
		const counter = document.createElement('small');
		counter.className = 'fs-counter';
		control.after(counter);
		const update = () => {
			const max = Number(control.getAttribute('maxlength'));
			const remaining = Math.max(0, max - control.value.length);
			counter.textContent = `${remaining} characters remaining`;
		};
		control.addEventListener('input', update);
		update();
	}
}
