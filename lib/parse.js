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
	['data-fs-max-file-size', 'max-file-size']
];

export function parseForm(form) {
	const model = { form, fields: new Map(), groups: [], unique: [] };
	for (const control of form.querySelectorAll('input[name], select[name], textarea[name]')) {
		const name = control.name;
		if (model.fields.has(name)) {
			model.fields.get(name).controls.push(control);
			continue;
		}
		model.fields.set(name, {
			name,
			controls: [control],
			row: control.closest(ROW_SELECTOR),
			label: labelFor(control),
			type: control.getAttribute('data-fs-type'),
			typeParam: control.getAttribute('data-fs-type-param'),
			errorTo: control.getAttribute('data-fs-error-to'),
			rules: rulesFor(control),
			relevance: null
		});
	}
	return model;
}

function rulesFor(control) {
	const rules = [];
	for (const [attribute, kind] of RULE_ATTRIBUTES) {
		const param = control.getAttribute(attribute);
		if (param !== null) rules.push({ kind, param });
	}
	return rules;
}

function labelFor(control) {
	const explicit = control.getAttribute('data-fs-label');
	if (explicit) return explicit;
	const row = control.closest(ROW_SELECTOR);
	const label = (control.id && control.closest('form').querySelector(`label[for="${control.id}"]`)) || row?.querySelector('label');
	return label ? label.textContent.trim() : control.name;
}
