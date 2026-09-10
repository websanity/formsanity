import { types } from './validators.js';

const ROW_SELECTOR = 'li, [data-fs-field], .fs-stacked';

// An unknown data-fs-type is reported once and dropped, leaving the field untyped — an author typo costs that type's validation instead of throwing mid-refresh and taking the form's init with it.
function knownType(control) {
	const type = control.getAttribute('data-fs-type');
	if (type !== null && !(type in types)) {
		console.error(`FormSanity: unknown data-fs-type ${JSON.stringify(type)} on "${control.name}" is ignored`);
		return null;
	}
	return type;
}

const RULE_ATTRIBUTES = [
	['data-fs-min-digits', 'min-digits'],
	['data-fs-min-uppercase', 'min-uppercase'],
	['data-fs-min-lowercase', 'min-lowercase'],
	['data-fs-max-file-size', 'max-file-size'],
	['data-fs-group-unique-values', 'group-unique-values']
];

// These may live on any control of a multi-control field (e.g. any checkbox in a set), not just the first — so they're scanned across the whole controls array.
const MULTI_CONTROL_RULE_ATTRIBUTES = [
	['data-fs-min-selected', 'min-selected'],
	['data-fs-max-selected', 'max-selected']
];

const GROUP_ATTRIBUTES = [
	['data-fs-group-required-any', 'required-any'],
	['data-fs-group-required-together', 'required-together']
];

export function parseForm(form) {
	const model = { form, fields: new Map(), groups: [], unique: [] };
	const controlsByName = new Map();
	for (const control of form.querySelectorAll('input[name], select[name], textarea[name]')) {
		if (!controlsByName.has(control.name)) controlsByName.set(control.name, []);
		controlsByName.get(control.name).push(control);
	}
	for (const [name, controls] of controlsByName) {
		const [first] = controls;
		const isSet = controls.length > 1 && (first.type === 'checkbox' || first.type === 'radio');
		model.fields.set(name, {
			name,
			controls,
			set: isSet,
			row: isSet ? null : first.closest(ROW_SELECTOR),
			label: labelFor(first),
			type: knownType(first),
			typeParam: first.getAttribute('data-fs-type-param'),
			errorTo: first.getAttribute('data-fs-error-to'),
			rules: rulesFor(controls),
			relevance: controls.map(relevanceOf)
		});
	}
	model.groups = groupsFrom(model.fields);
	// Relevance regions: data-fs-relevant on anything that is neither a control nor an option. One expression governs every control inside the element; an element with no controls in it is pure conditional content.
	model.regions = [...form.querySelectorAll('[data-fs-relevant]')]
		.filter((element) => !element.matches('input, select, textarea, option'))
		.map((element) => {
			const controls = [...model.fields.values()].flatMap((field) => field.controls.filter((control) => element.contains(control)));
			return {
				element,
				expr: element.getAttribute('data-fs-relevant'),
				mode: element.getAttribute('data-fs-irrelevant') ?? 'hidden',
				controls,
				members: [...new Set(controls.map((control) => control.name))]
			};
		});
	// A conditional option is recorded with its select, its parent, and its share of a per-select index of every option, so a detached option can go back exactly where it came from. The total lets the engine tell a select with nothing left to choose.
	model.options = [];
	model.optionIndex = new Map();
	for (const select of form.querySelectorAll('select:has(option[data-fs-relevant])')) {
		const all = [...select.options];
		all.forEach((option, index) => model.optionIndex.set(option, index));
		for (const option of select.querySelectorAll('option[data-fs-relevant]')) {
			model.options.push({
				option,
				select,
				parent: option.parentNode,
				expr: option.getAttribute('data-fs-relevant'),
				mode: option.getAttribute('data-fs-irrelevant') ?? 'hidden',
				total: all.length
			});
		}
	}
	return model;
}

function rulesFor(controls) {
	const [first] = controls;
	const rules = [];
	for (const [attribute, kind] of RULE_ATTRIBUTES) {
		const param = first.getAttribute(attribute);
		if (param !== null) rules.push({ kind, param });
	}
	for (const [attribute, kind] of MULTI_CONTROL_RULE_ATTRIBUTES) {
		const control = controls.find((c) => c.hasAttribute(attribute));
		if (control) rules.push({ kind, param: control.getAttribute(attribute) });
	}
	// Conditional requiredness sits on any member of a set, like the selection counts. Native required wins: if any control of the field carries it, the field is always required, so the expression would be dead, and the author is told once.
	const conditional = controls.find((c) => c.hasAttribute('data-fs-required'));
	if (conditional) {
		if (controls.some((c) => c.required)) {
			console.error(`FormSanity: data-fs-required on "${first.name}" is ignored because the field carries required`);
		} else {
			rules.push({ kind: 'required', param: conditional.getAttribute('data-fs-required') });
		}
	}
	// One constraint expression per field; authors combine clauses with &&.
	const constraint = first.getAttribute('data-fs-constraint');
	if (constraint !== null) {
		rules.push({ kind: 'constraint', param: constraint, message: first.getAttribute('data-fs-constraint-message') ?? undefined });
	}
	// A daily time window constrains the time-of-day component of a datetime-local value; native min/max keep the linear span.
	if (first.type === 'datetime-local') {
		for (const [attribute, kind] of [['data-fs-min-time', 'min-time'], ['data-fs-max-time', 'max-time']]) {
			const param = first.getAttribute(attribute);
			if (param !== null) rules.push({ kind, param });
		}
	}
	// accept is the one native constraint ValidityState never reports — the browser only uses it to filter the picker — so it becomes an explicit rule here.
	if (first.type === 'file' && first.getAttribute('accept')) {
		rules.push({ kind: 'accept', param: first.getAttribute('accept') });
	}
	// Bounds on an fs-typed control. Native min/max are not conforming HTML on type="text", so the ordered fs types carry their own attributes; checkRule no-ops where the type defines no order.
	if (first.hasAttribute('data-fs-type')) {
		for (const [attribute, kind] of [['data-fs-min', 'min-value'], ['data-fs-max', 'max-value']]) {
			const param = first.getAttribute(attribute);
			if (param !== null) rules.push({ kind, param });
		}
	}
	return rules;
}

// Relevance is read per control: each member of a set decides for itself, and a one-control field is the one-member case.
function relevanceOf(control) {
	if (!control.hasAttribute('data-fs-relevant')) return null;
	return {
		expr: control.getAttribute('data-fs-relevant'),
		mode: control.getAttribute('data-fs-irrelevant') ?? 'hidden'
	};
}

function groupsFrom(fields) {
	const groups = new Map();
	for (const field of fields.values()) {
		for (const [attribute, kind] of GROUP_ATTRIBUTES) {
			const name = field.controls.map((c) => c.getAttribute(attribute)).find((v) => v !== null);
			if (name == null) continue;
			const key = `${kind}:${name}`;
			if (!groups.has(key)) groups.set(key, { kind, name, members: [] });
			groups.get(key).members.push(field.name);
		}
	}
	return [...groups.values()];
}

function labelFor(control) {
	const explicit = control.getAttribute('data-fs-label');
	if (explicit) return explicit;
	const row = control.closest(ROW_SELECTOR);
	const label = (control.id && control.closest('form').querySelector(`label[for="${control.id}"]`)) || row?.querySelector('label');
	return label ? label.textContent.trim() : control.name;
}
