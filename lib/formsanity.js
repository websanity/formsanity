import { parseForm } from './parse.js';
import { createFieldController, RANK } from './fields.js';
import { createRelevanceEngine } from './relevance.js';
import { compileExpression } from './expression.js';
import { ensureStatusRegion, renderStatus, applyRowState } from './errors.js';
import { formMessages } from './messages.js';
import { attachBehaviors } from './behaviors.js';
import { attachSubmit, attachUnique, isGathered } from './submit.js';
import { canonicalize } from './validators.js';

export { addPreSubmitHook } from './hooks.js';

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
	const ctx = { model, valueOf, typeOf, labelOf, onChange, applyRowState: applyAggregateRowState };
	const relevance = createRelevanceEngine(model, ctx);
	ctx.isRelevant = relevance.isRelevant;
	const dependents = buildDependents();
	const rowFields = buildRowFields();

	for (const field of model.fields.values()) {
		controllers.set(field.name, createFieldController(field, ctx));
	}
	for (const controller of controllers.values()) {
		controller.refresh();
	}
	updateFormState({ controllers: [...controllers.values()], form, relevance, region });

	form.addEventListener('input', (event) => refreshFor(event.target, 'input'));
	// change fires only on a commit (blur or Enter), never per keystroke, so
	// it is the moment a valid value gets rewritten to its canonical format —
	// before the refresh, so bounds and dependent fields read the rewritten
	// value.
	form.addEventListener('change', (event) => {
		canonicalizeControl(event.target);
		refreshFor(event.target, 'input');
	});
	form.addEventListener('focusout', (event) => refreshFor(event.target, 'blur'), true);

	// Registered after the delegated listeners above so any init-time
	// programmatic dispatches from behaviors (e.g. an amount total that is a
	// real form control) reach the engine's own input handling immediately,
	// not just on the user's next interaction.
	attachBehaviors(form, model, ctx);
	attachSubmit(form, { model, controllers, relevance, region });
	for (const control of form.querySelectorAll('[data-fs-unique]')) {
		const field = model.fields.get(control.name);
		if (field) attachUnique(field, control.getAttribute('data-fs-unique'), controllers.get(field.name));
	}

	function refreshFor(target, trigger) {
		const name = target?.name;
		if (!name || !controllers.has(name)) return;
		relevance.refresh(name);
		controllers.get(name).refresh(trigger);
		for (const dependent of dependents.get(name) ?? []) {
			controllers.get(dependent)?.refresh(trigger);
		}
	}

	function canonicalizeControl(control) {
		const field = model.fields.get(control?.name);
		if (!field?.type || field.controls[0] !== control) return;
		const canon = canonicalize(field.type, control.value, field.typeParam);
		if (canon !== null && canon !== control.value) control.value = canon;
	}

	function valueOf(name) {
		const field = model.fields.get(name);
		if (!field) return '';
		const [first] = field.controls;
		if (first.matches('select[multiple]')) {
			return [...first.selectedOptions].map((option) => option.value).join(',');
		}
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

	// A compound field pairs two fields on one shared row (e.g. two inputs
	// under one aria-labelledby label). Each field's own refresh only knows
	// its own verdict, so naively calling applyRowState per-field is "last
	// writer wins" — a sibling settling back to valid would blank out the
	// row's still-invalid state. This index lets applyAggregateRowState look
	// across the whole row and keep the worst verdict displayed.
	function buildRowFields() {
		const map = new Map();
		for (const field of model.fields.values()) {
			if (!field.row) continue;
			if (!map.has(field.row)) map.set(field.row, []);
			map.get(field.row).push(field.name);
		}
		return map;
	}

	function applyAggregateRowState(field, verdict, missing) {
		const siblings = field.row ? rowFields.get(field.row) : null;
		if (!siblings || siblings.length < 2) { applyRowState(field, verdict, missing); return; }
		let worst = verdict;
		let anyMissing = missing;
		for (const name of siblings) {
			if (name === field.name) continue;
			const sibling = controllers.get(name);
			if (!sibling) continue;
			if (RANK[sibling.verdict] < RANK[worst]) worst = sibling.verdict;
			anyMissing = anyMissing || sibling.missing;
		}
		applyRowState(field, worst, anyMissing);
	}

	form.dispatchEvent(new CustomEvent('fs:init', { bubbles: true, detail: { model } }));
	return { form, model, controllers };
}

function updateFormState(state) {
	const { controllers, form, relevance, region } = state;
	// v1's split: the missing line counts unanswered obligations, the
	// invalid line counts wrong answers — including a format left half
	// typed, which is a wrong answer, not an unanswered question.
	let missing = 0;
	let wrong = 0;
	for (const c of controllers) {
		if (!isGathered(c.field, relevance)) continue;
		if (c.verdict === 'valid') continue;
		if (c.missing) missing += 1;
		else wrong += 1;
	}
	const allValid = missing === 0 && wrong === 0;
	if (!form.hasAttribute('data-fs-no-gate')) {
		const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
		if (submit) submit.disabled = !allValid;
	}
	renderStatus(region, {
		incompleteCount: missing,
		invalidCount: wrong,
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
