const ROW_SELECTOR = 'li, [data-fs-field], .block';

const RULE_ATTRIBUTES = [
	['data-fs-equals', 'equals'],
	['data-fs-not-equals', 'not-equals'],
	['data-fs-equals-field', 'equals-field'],
	['data-fs-not-equals-field', 'not-equals-field'],
	['data-fs-greater-than-field', 'greater-than-field'],
	['data-fs-less-than-field', 'less-than-field'],
	['data-fs-min-digits', 'min-digits'],
	['data-fs-min-uppercase', 'min-uppercase'],
	['data-fs-min-lowercase', 'min-lowercase'],
	['data-fs-max-file-size', 'max-file-size'],
	['data-fs-unique-in-page', 'unique-in-page']
];

// These may live on any control of a multi-control field (e.g. any checkbox in a set),
// not just the first — so they're scanned across the whole controls array.
const MULTI_CONTROL_RULE_ATTRIBUTES = [
	['data-fs-min-selected', 'min-selected'],
	['data-fs-max-selected', 'max-selected']
];

const GROUP_ATTRIBUTES = [
	['data-fs-group-at-least-one', 'at-least-one'],
	['data-fs-group-all-or-none', 'all-or-none']
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
	// accept is the one native constraint ValidityState never reports — the
	// browser only uses it to filter the picker — so it becomes an explicit
	// rule here.
	if (first.type === 'file' && first.getAttribute('accept')) {
		rules.push({ kind: 'accept', param: first.getAttribute('accept') });
	}
	// min/max on an fs-typed control: native attributes extended to the
	// ordered fs types. checkRule no-ops where the type defines no order.
	if (first.hasAttribute('data-fs-type')) {
		for (const [attribute, kind] of [['min', 'min-value'], ['max', 'max-value']]) {
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
