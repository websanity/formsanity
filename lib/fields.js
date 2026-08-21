import { nativeVerdict, nativeCode, validateType } from './validators.js';
import { messageFor } from './messages.js';
import { showBubble, clearBubble } from './errors.js';
import { checkRule, checkGroups } from './rules.js';

export const RANK = { invalid: 0, incomplete: 1, valid: 2 };

// Codes that mean "not answered yet" rather than "answered wrong". The
// asterisk indicator and the status line carry these; they never bubble on
// their own — only a submit attempt reveals them as messages.
export const REQUIREDNESS = new Set(['required', 'group.at-least-one', 'group.all-or-none', 'min-selected']);

// A time input displays in the user's locale — 12- or 24-hour is the OS's
// choice, not the author's — so a bound quoted in its bubble must speak the
// same presentation. The raw attribute value is always 24-hour and would
// contradict the field's own face.
function nativeBoundParam(control, code) {
	const attr = code === 'minlength' ? 'minlength' : code === 'maxlength' ? 'maxlength' : code;
	const raw = control.getAttribute(attr) ?? '';
	if (control.type === 'time' && (code === 'min' || code === 'max') && raw !== '') {
		const [hours, minutes] = raw.split(':').map(Number);
		return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(1970, 0, 1, hours, minutes));
	}
	return raw;
}

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
			params = { n: nativeBoundParam(control, code) };
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
			controller.missing = false;
			ctx.applyRowState(field, 'valid', false);
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
		// Missing means an unanswered obligation — the asterisk's meaning.
		// A wrong answer is not missing: it gets the bubble, never the mark.
		controller.missing = verdict !== 'valid' && REQUIREDNESS.has(code);
		ctx.applyRowState(field, verdict, controller.missing);
		const isErrorWorthy = verdict === 'invalid' || (verdict === 'incomplete' && !REQUIREDNESS.has(code));
		if (verdict === 'valid' || (REQUIREDNESS.has(code) && !state.shown)) {
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
