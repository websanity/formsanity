export function checkRule(rule, field, ctx, trigger) {
	const value = ctx.valueOf(field.name);
	switch (rule.kind) {
		case 'equals':
		case 'equals-field': {
			const target = rule.kind === 'equals' ? rule.param : ctx.valueOf(rule.param);
			if (value === target) return null;
			if (value === '') return null;
			const verdict = target.startsWith(value) ? 'incomplete' : 'invalid';
			const params = rule.kind === 'equals' ? { value: rule.param } : { label: ctx.labelOf(rule.param) };
			return { verdict, code: rule.kind, params };
		}
		case 'not-equals':
		case 'not-equals-field': {
			const target = rule.kind === 'not-equals' ? rule.param : ctx.valueOf(rule.param);
			if (value === '' || value !== target) return null;
			return { verdict: 'incomplete', code: rule.kind, params: { label: rule.kind === 'not-equals-field' ? ctx.labelOf(rule.param) : '' } };
		}
		case 'greater-than-field':
		case 'less-than-field': {
			const other = ctx.valueOf(rule.param);
			if (value === '' || other === '') return null;
			const dates = ctx.typeOf(field.name) === 'date' || ctx.typeOf(rule.param) === 'date';
			const [a, b] = dates ? [Date.parse(value), Date.parse(other)] : [Number(value), Number(other)];
			if (Number.isNaN(a) || Number.isNaN(b)) return null;
			const ok = rule.kind === 'greater-than-field' ? a > b : a < b;
			if (ok) return null;
			const code = dates ? `${rule.kind}.date` : rule.kind;
			return { verdict: 'incomplete', code, params: { label: ctx.labelOf(rule.param) } };
		}
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
		case 'min-selected':
		case 'max-selected': {
			const selected = field.controls.filter((control) => control.checked).length;
			const n = Number(rule.param);
			if (rule.kind === 'min-selected' && selected < n) {
				return { verdict: 'incomplete', code: 'min-selected', params: { n: rule.param } };
			}
			if (rule.kind === 'max-selected' && selected > n) {
				return { verdict: 'invalid', code: 'max-selected', params: { n: rule.param } };
			}
			return null;
		}
		case 'unique-in-page': {
			// Only checked on blur: while either field is still being typed, a transient
			// match shouldn't flag as an error — only a completed, deliberate duplicate should.
			if (trigger !== 'blur' || value === '') return null;
			for (const other of ctx.model.fields.values()) {
				if (other.name === field.name) continue;
				if (!other.rules.some((r) => r.kind === 'unique-in-page' && r.param === rule.param)) continue;
				if (ctx.valueOf(other.name) === value) {
					return { verdict: 'invalid', code: 'unique-in-page', params: {} };
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
