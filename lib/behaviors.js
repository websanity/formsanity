// Presentation-layer behaviors: copy-to mirroring, amount totals, generated
// date options, password reveal, and maxlength counters. These are DOM
// conveniences, not validation — they read/write control values directly and
// dispatch a bubbling 'input' event after any programmatic value change so
// the rest of the engine (validation, dependents, other behaviors, the gate)
// reacts exactly as if the user had typed.

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function attachBehaviors(form, model, _ctx) {
	wireCopyTo(form, model);
	wireAmounts(form);
	wireDateOptions(form);
	wireReveal(form);
	wireCounters(form);
}

function dispatchInput(el) {
	el.dispatchEvent(new CustomEvent('input', { bubbles: true }));
}

// data-fs-copy-to="target-name": mirrors a source control's value onto the
// named target field whenever the source receives input.
function wireCopyTo(form, model) {
	const sources = [...form.querySelectorAll('[data-fs-copy-to]')];
	if (!sources.length) return;
	form.addEventListener('input', (event) => {
		if (!sources.includes(event.target)) return;
		const target = model.fields.get(event.target.getAttribute('data-fs-copy-to'))?.controls[0];
		if (!target) return;
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

function wireAmounts(form) {
	const amountEls = [...form.querySelectorAll('[data-fs-amount]')];
	const totalEls = [...form.querySelectorAll('[data-fs-amount-total]')];
	if (!amountEls.length || !totalEls.length) return;

	function recompute() {
		const sum = amountEls.reduce((total, el) => total + parseAmount(el.value), 0);
		const text = sum.toFixed(2);
		for (const totalEl of totalEls) {
			if (totalEl.matches('input, select, textarea')) {
				totalEl.value = text;
				dispatchInput(totalEl);
			} else {
				totalEl.textContent = text;
			}
		}
	}

	form.addEventListener('input', (event) => {
		if (amountEls.includes(event.target)) recompute();
	});
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

// data-fs-reveal on a password input: appends a toggle button that flips the
// control between password/text and reflects its state via label + aria-pressed.
function wireReveal(form) {
	for (const input of form.querySelectorAll('input[data-fs-reveal]')) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'fs-reveal';
		button.setAttribute('aria-pressed', 'false');
		button.textContent = 'Show';
		input.after(button);
		button.addEventListener('click', () => {
			const revealed = input.type === 'text';
			input.type = revealed ? 'password' : 'text';
			button.textContent = revealed ? 'Show' : 'Hide';
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
