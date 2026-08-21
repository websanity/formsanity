import { nativeVerdict, nativeCode, validateType } from './validators.js';
import { messageFor } from './messages.js';
import { showBubble, clearBubble } from './errors.js';
import { checkRule, checkGroups } from './rules.js';

export const RANK = { invalid: 0, incomplete: 1, valid: 2 };

export function createFieldController(field, ctx) {
	const state = { shown: false };
	const controller = { field, verdict: 'valid', code: null, params: {}, refresh, present };

	function compute(trigger) {
		const control = field.controls[0];
		let verdict = 'valid';
		let code = null;
		let params = {};
		const nv = nativeVerdict(control.validity);
		if (nv !== 'valid') {
			verdict = nv;
			code = nativeCode(control.validity);
			params = { n: control.getAttribute(code === 'minlength' ? 'minlength' : code === 'maxlength' ? 'maxlength' : code) ?? '' };
		}
		if (verdict !== 'invalid' && field.type && control.value !== '') {
			const tv = validateType(field.type, control.value, field.typeParam);
			if (RANK[tv] < RANK[verdict]) { verdict = tv; code = `type.${field.type}`; params = { networks: field.typeParam?.replace(/\|/g, ', ') ?? '' }; }
		}
		for (const rule of field.rules) {
			const r = checkRule(rule, field, ctx, trigger);
			if (r && RANK[r.verdict] < RANK[verdict]) { verdict = r.verdict; code = r.code; params = r.params; }
		}
		const group = checkGroups(ctx.model, ctx).get(field.name);
		if (group && RANK[group.verdict] < RANK[verdict]) { verdict = group.verdict; code = group.code; params = group.params; }
		return { verdict, code, params };
	}

	function refresh(trigger) {
		if (!ctx.isRelevant(field.name)) {
			controller.verdict = 'valid';
			controller.code = null;
			controller.params = {};
			ctx.applyRowState(field, 'valid');
			clearBubble(field);
			state.shown = false;
			ctx.onChange(field.name);
			return;
		}
		const previousVerdict = controller.verdict;
		const { verdict, code, params } = compute(trigger);
		controller.verdict = verdict;
		controller.code = code;
		controller.params = params;
		ctx.applyRowState(field, verdict);
		const isErrorWorthy = verdict === 'invalid' || (verdict === 'incomplete' && code !== 'required');
		if (verdict === 'valid' || (code === 'required' && !state.shown)) {
			clearBubble(field);
			if (verdict === 'valid') state.shown = false;
		} else if (verdict === 'invalid' || state.shown || (trigger === 'blur' && isErrorWorthy)) {
			present();
		}
		if (verdict !== previousVerdict && (verdict === 'valid' || verdict === 'invalid')) {
			const eventName = verdict === 'valid' ? 'fs:field-valid' : 'fs:field-invalid';
			field.controls[0].dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: { name: field.name, verdict, code } }));
		}
		ctx.onChange(field.name);
	}

	function present() {
		state.shown = true;
		showBubble(field, messageFor(controller.code, controller.params));
	}

	return controller;
}
