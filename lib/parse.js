const ROW_SELECTOR = 'li, [data-fs-field], .block';

const RULE_ATTRIBUTES = [
	['data-fs-min-digits', 'min-digits'],
	['data-fs-min-uppercase', 'min-uppercase'],
	['data-fs-min-lowercase', 'min-lowercase'],
	['data-fs-max-file-size', 'max-file-size'],
	['data-fs-group-unique-values', 'group-unique-values']
];

// These may live on any control of a multi-control field (e.g. any checkbox in a set),
// not just the first — so they're scanned across the whole controls array.
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
			row: isSet ? null : first.closest(ROW_SELECTOR),
			label: labelFor(first),
			type: first.getAttribute('data-fs-type'),
			typeParam: first.getAttribute('data-fs-type-param'),
			errorTo: first.getAttribute('data-fs-error-to'),
			rules: rulesFor(controls),
			relevance: relevanceFor(controls)
		});
	}
	model.groups = groupsFrom(model.fields);
	// Relevance regions: data-fs-relevant on anything that is not a control.
	// One expression governs every field inside the element; an element with
	// no fields in it is pure conditional content.
	model.regions = [...form.querySelectorAll('[data-fs-relevant]')]
		.filter((element) => !element.matches('input, select, textarea'))
		.map((element) => ({
			element,
			expr: element.getAttribute('data-fs-relevant'),
			mode: element.getAttribute('data-fs-irrelevant') ?? 'hidden',
			members: [...model.fields.values()].filter((field) => element.contains(field.controls[0])).map((field) => field.name)
		}));
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
	// One constraint expression per field; authors combine clauses with &&.
	const constraint = first.getAttribute('data-fs-constraint');
	if (constraint !== null) {
		rules.push({ kind: 'constraint', param: constraint, message: first.getAttribute('data-fs-constraint-message') ?? undefined });
	}
	// A daily time window constrains the time-of-day component of a
	// datetime-local value; native min/max keep the linear span.
	if (first.type === 'datetime-local') {
		for (const [attribute, kind] of [['data-fs-min-time', 'min-time'], ['data-fs-max-time', 'max-time']]) {
			const param = first.getAttribute(attribute);
			if (param !== null) rules.push({ kind, param });
		}
	}
	// accept is the one native constraint ValidityState never reports — the
	// browser only uses it to filter the picker — so it becomes an explicit
	// rule here.
	if (first.type === 'file' && first.getAttribute('accept')) {
		rules.push({ kind: 'accept', param: first.getAttribute('accept') });
	}
	// Bounds on an fs-typed control. Native min/max are not conforming HTML
	// on type="text", so the ordered fs types carry their own attributes;
	// checkRule no-ops where the type defines no order.
	if (first.hasAttribute('data-fs-type')) {
		for (const [attribute, kind] of [['data-fs-min', 'min-value'], ['data-fs-max', 'max-value']]) {
			const param = first.getAttribute(attribute);
			if (param !== null) rules.push({ kind, param });
		}
	}
	return rules;
}

// May sit on any control of the field (e.g. any checkbox in a set); first with the attribute wins.
function relevanceFor(controls) {
	const relevantControl = controls.find((c) => c.hasAttribute('data-fs-relevant'));
	if (!relevantControl) return null;
	const modeControl = controls.find((c) => c.hasAttribute('data-fs-irrelevant'));
	return {
		expr: relevantControl.getAttribute('data-fs-relevant'),
		mode: modeControl?.getAttribute('data-fs-irrelevant') ?? 'hidden'
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
