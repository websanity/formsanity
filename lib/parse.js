const ROW_SELECTOR = 'li, [data-fs-field], .block';

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
			errorTo: control.getAttribute('data-fs-error-to'),
			rules: [],
			relevance: null
		});
	}
	return model;
}

function labelFor(control) {
	const explicit = control.getAttribute('data-fs-label');
	if (explicit) return explicit;
	const row = control.closest(ROW_SELECTOR);
	const label = (control.id && control.closest('form').querySelector(`label[for="${control.id}"]`)) || row?.querySelector('label');
	return label ? label.textContent.trim() : control.name;
}
