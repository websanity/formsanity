import { ORDERED_TYPES } from './validators.js';
import { formatTimeOfDay } from './messages.js';
import { compileExpression } from './expression.js';

// Constraint expressions compile once per distinct source, not per refresh.
const constraintCache = new Map();
function compiledConstraint(src) {
	if (!constraintCache.has(src)) constraintCache.set(src, compileExpression(src));
	return constraintCache.get(src);
}

export function checkRule(rule, field, ctx, trigger) {
	const value = ctx.valueOf(field.name);
	switch (rule.kind) {
		case 'min-digits':
		case 'min-uppercase':
		case 'min-lowercase': {
			if (value === '') return null;
			const classes = { 'min-digits': /\d/g, 'min-uppercase': /[A-Z]/g, 'min-lowercase': /[a-z]/g };
			const count = (value.match(classes[rule.kind]) ?? []).length;
			if (count >= Number(rule.param)) return null;
			return { verdict: 'incomplete', code: rule.kind, params: { n: rule.param } };
		}
		case 'max-file-size': {
			// Every selected file counts, not just the first: a [multiple] input
			// whose second file blows the cap is just as unacceptable as one
			// whose first does.
			const files = field.controls[0].files;
			if (!files?.length) return null;
			const limit = parseSize(rule.param);
			if (![...files].some((file) => file.size > limit)) return null;
			return { verdict: 'invalid', code: 'file.max-size', params: { size: rule.param } };
		}
		case 'constraint': {
			if (value === '') return null;
			const compiled = compiledConstraint(rule.param);
			// A constraint judges answers, not absence: while any referenced
			// field is unanswered there is nothing to judge yet, and the
			// grammar's empty-is-false polarity must not flag this field for
			// a question nobody has answered.
			for (const dep of compiled.deps) {
				if (dep !== field.name && ctx.valueOf(dep) === '') return null;
			}
			const verdict = compiled.verdict({ get: ctx.valueOf, typeOf: ctx.typeOf });
			if (verdict === 'satisfied') return null;
			// A dead-end (only == can prove one: neither value a prefix of
			// the other) is invalid and presents immediately — the confirm
			// field flags the moment it diverges from its target.
			return { verdict: verdict === 'dead-end' ? 'invalid' : 'incomplete', code: 'constraint', params: { message: rule.message } };
		}
		case 'min-time':
		case 'max-time': {
			if (value === '') return null;
			// The time-of-day component of a datetime-local value; zero-padded
			// HH:MM compares correctly as a string.
			const t = value.slice(11, 16);
			if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return null;
			const min = field.rules.find((r) => r.kind === 'min-time')?.param;
			const max = field.rules.find((r) => r.kind === 'max-time')?.param;
			if (min !== undefined && max !== undefined && min > max) {
				// A reversed window wraps midnight, as native time bounds do.
				// One rule speaks for the pair so the violation reports once,
				// and it is incomplete: the value can still climb into the
				// evening window.
				if (rule.kind === 'max-time') return null;
				if (t >= min || t <= max) return null;
				return { verdict: 'incomplete', code: 'min-time', params: { n: formatTimeOfDay(min) } };
			}
			if (rule.kind === 'min-time' && t < rule.param) {
				return { verdict: 'incomplete', code: 'min-time', params: { n: formatTimeOfDay(rule.param) } };
			}
			if (rule.kind === 'max-time' && t > rule.param) {
				return { verdict: 'invalid', code: 'max-time', params: { n: formatTimeOfDay(rule.param) } };
			}
			return null;
		}
		case 'accept': {
			const files = field.controls[0].files;
			if (!files?.length) return null;
			const tokens = rule.param.split(',').map((token) => token.trim().toLowerCase()).filter(Boolean);
			const admitted = (file) => tokens.some((token) => {
				if (token.startsWith('.')) return file.name.toLowerCase().endsWith(token);
				if (token.endsWith('/*')) return (file.type ?? '').toLowerCase().startsWith(token.slice(0, -1));
				return (file.type ?? '').toLowerCase() === token;
			});
			if ([...files].every(admitted)) return null;
			return { verdict: 'invalid', code: 'file.accept', params: {} };
		}
		case 'min-value':
		case 'max-value': {
			const order = ORDERED_TYPES[field.type];
			if (!order) return null;
			const current = order(value);
			const limit = order(rule.param);
			if (current === null || limit === null) return null;
			if (rule.kind === 'min-value' && current < limit) {
				return { verdict: 'incomplete', code: 'min', params: { n: rule.param } };
			}
			if (rule.kind === 'max-value' && current > limit) {
				return { verdict: 'invalid', code: 'max', params: { n: rule.param } };
			}
			return null;
		}
		case 'min-selected':
		case 'max-selected': {
			const [first] = field.controls;
			const selected = first.matches('select[multiple]')
				? first.selectedOptions.length
				: field.controls.filter((control) => control.checked).length;
			const n = Number(rule.param);
			if (rule.kind === 'min-selected' && selected < n) {
				return { verdict: 'incomplete', code: 'min-selected', params: { n: rule.param } };
			}
			if (rule.kind === 'max-selected' && selected > n) {
				return { verdict: 'invalid', code: 'max-selected', params: { n: rule.param } };
			}
			return null;
		}
		case 'group-unique-values': {
			// Only checked on blur: while either field is still being typed, a transient
			// match shouldn't flag as an error — only a completed, deliberate duplicate should.
			if (trigger !== 'blur' || value === '') return null;
			for (const other of ctx.model.fields.values()) {
				if (other.name === field.name) continue;
				if (!other.rules.some((r) => r.kind === 'group-unique-values' && r.param === rule.param)) continue;
				if (ctx.valueOf(other.name) === value) {
					return { verdict: 'invalid', code: 'group.unique-values', params: {} };
				}
			}
			return null;
		}
		default:
			return null;
	}
}

export function checkGroups(model, ctx) {
	const results = new Map();
	for (const group of model.groups) {
		const anyFilled = group.members.some((name) => ctx.valueOf(name) !== '');
		if (group.kind === 'at-least-one') {
			if (anyFilled) continue;
			for (const name of group.members) {
				results.set(name, { verdict: 'incomplete', code: 'group.at-least-one', params: {} });
			}
		} else if (group.kind === 'all-or-none') {
			if (!anyFilled) continue;
			for (const name of group.members) {
				if (ctx.valueOf(name) === '') {
					results.set(name, { verdict: 'incomplete', code: 'group.all-or-none', params: {} });
				}
			}
		}
	}
	return results;
}

const UNITS = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

export function parseSize(text) {
	const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i.exec(text.trim());
	if (!m) throw new Error(`Bad size "${text}" — use forms like "500KB" or "2MB"`);
	return Number(m[1]) * UNITS[m[2].toLowerCase()];
}
