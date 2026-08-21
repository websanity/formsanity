import { parseForm } from './parse.js';
import { createFieldController } from './fields.js';
import { createRelevanceEngine } from './relevance.js';
import { compileExpression } from './expression.js';
import { ensureStatusRegion, renderStatus } from './errors.js';
import { formMessages } from './messages.js';
import { attachBehaviors } from './behaviors.js';

export function init(root = document) {
	return [...root.querySelectorAll('form[data-fs-form]')].map(setup);
}

function setup(form) {
	form.setAttribute('novalidate', '');
	form.classList.add('fs-form');
	const model = parseForm(form);
	const controllers = new Map();
	const region = ensureStatusRegion(form);
	let scheduled = false;
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
	updateFormState({ controllers: [...controllers.values()], form, relevance, region });
	attachBehaviors(form, model, ctx);

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

	function onChange() {
		if (scheduled) return;
		scheduled = true;
		queueMicrotask(() => {
			scheduled = false;
			updateFormState({ controllers: [...controllers.values()], form, relevance, region });
		});
	}

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

function updateFormState(state) {
	const { controllers, form, relevance, region } = state;
	let incomplete = 0;
	let invalid = 0;
	for (const c of controllers) {
		if (!relevance.isRelevant(c.field.name)) continue;
		if (c.verdict === 'incomplete') incomplete += 1;
		if (c.verdict === 'invalid') invalid += 1;
	}
	const allValid = incomplete === 0 && invalid === 0;
	if (!form.hasAttribute('data-fs-no-gate')) {
		const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
		if (submit) submit.disabled = !allValid;
	}
	renderStatus(region, {
		incompleteCount: incomplete,
		invalidCount: invalid,
		messages: {
			incomplete: form.getAttribute('data-fs-message-incomplete') ?? formMessages.incomplete,
			invalid: form.getAttribute('data-fs-message-invalid') ?? formMessages.invalid
		}
	});
	for (const el of form.querySelectorAll('[data-fs-when-valid]')) {
		const verb = el.getAttribute('data-fs-when-valid');
		if (verb === 'hide') el.hidden = allValid;
		if (verb === 'show') el.hidden = !allValid;
		if (verb === 'enable') el.disabled = !allValid;
	}
	form.classList.toggle('fs-all-valid', allValid);
}
