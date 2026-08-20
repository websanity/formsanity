import { parseForm } from './parse.js';
import { createFieldController } from './fields.js';

export function init(root = document) {
	return [...root.querySelectorAll('form[data-fs-form]')].map(setup);
}

function setup(form) {
	form.setAttribute('novalidate', '');
	form.classList.add('fs-form');
	const model = parseForm(form);
	const controllers = new Map();
	const ctx = { model, valueOf, typeOf, labelOf, onChange };

	for (const field of model.fields.values()) {
		controllers.set(field.name, createFieldController(field, ctx));
	}
	for (const controller of controllers.values()) {
		controller.refresh();
	}

	form.addEventListener('input', (event) => refreshFor(event.target, 'input'));
	form.addEventListener('change', (event) => refreshFor(event.target, 'input'));
	form.addEventListener('focusout', (event) => refreshFor(event.target, 'blur'), true);

	function refreshFor(target, trigger) {
		const name = target?.name;
		if (!name || !controllers.has(name)) return;
		controllers.get(name).refresh(trigger);
	}

	function valueOf(name) {
		const field = model.fields.get(name);
		if (!field) return '';
		const [first] = field.controls;
		if (first.type === 'checkbox' || first.type === 'radio') {
			return field.controls.filter((control) => control.checked).map((control) => control.value).join(',');
		}
		return first.value;
	}

	function typeOf(name) {
		const field = model.fields.get(name);
		if (!field) return null;
		const [first] = field.controls;
		return first.type === 'date' ? 'date' : field.type;
	}

	function labelOf(name) {
		return model.fields.get(name)?.label ?? name;
	}

	function onChange() {}

	form.dispatchEvent(new CustomEvent('fs:init', { bubbles: true, detail: { model } }));
	return { form, model, controllers };
}
