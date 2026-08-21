import { parseForm } from './parse.js';
import { createFieldController } from './fields.js';
import { createRelevanceEngine } from './relevance.js';
import { compileExpression } from './expression.js';

export function init(root = document) {
	return [...root.querySelectorAll('form[data-fs-form]')].map(setup);
}

function setup(form) {
	form.setAttribute('novalidate', '');
	form.classList.add('fs-form');
	const model = parseForm(form);
	const controllers = new Map();
	const ctx = { model, valueOf, typeOf, labelOf, onChange };
	const relevance = createRelevanceEngine(model, ctx);
	ctx.isRelevant = relevance.isRelevant;
	const dependents = buildDependents();

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
		relevance.refresh(name);
		controllers.get(name).refresh(trigger);
		for (const dependent of dependents.get(name) ?? []) {
			controllers.get(dependent)?.refresh(trigger);
		}
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

	function buildDependents() {
		const map = new Map();
		const fieldRefKinds = new Set(['equals-field', 'not-equals-field', 'greater-than-field', 'less-than-field']);
		for (const field of model.fields.values()) {
			for (const rule of field.rules) {
				if (!fieldRefKinds.has(rule.kind)) continue;
				if (!map.has(rule.param)) map.set(rule.param, new Set());
				map.get(rule.param).add(field.name);
			}
		}
		const addMutual = (names) => {
			for (const name of names) {
				for (const other of names) {
					if (other === name) continue;
					if (!map.has(name)) map.set(name, new Set());
					map.get(name).add(other);
				}
			}
		};
		for (const group of model.groups) addMutual(group.members);
		for (const field of model.fields.values()) {
			if (!field.relevance) continue;
			for (const dep of compileExpression(field.relevance.expr).deps) {
				if (!map.has(dep)) map.set(dep, new Set());
				map.get(dep).add(field.name);
			}
		}
		const uniqueGroups = new Map();
		for (const field of model.fields.values()) {
			for (const rule of field.rules) {
				if (rule.kind !== 'unique-in-page') continue;
				if (!uniqueGroups.has(rule.param)) uniqueGroups.set(rule.param, []);
				uniqueGroups.get(rule.param).push(field.name);
			}
		}
		for (const members of uniqueGroups.values()) addMutual(members);
		return map;
	}

	form.dispatchEvent(new CustomEvent('fs:init', { bubbles: true, detail: { model } }));
	return { form, model, controllers };
}
