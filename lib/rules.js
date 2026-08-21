export function checkRule(rule, field, ctx) {
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
			const file = field.controls[0].files?.[0];
			if (!file || file.size <= parseSize(rule.param)) return null;
			return { verdict: 'invalid', code: 'file.max-size', params: { size: rule.param } };
		}
		default:
			return null;
	}
}

const UNITS = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

export function parseSize(text) {
	const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i.exec(text.trim());
	if (!m) throw new Error(`Bad size "${text}" — use forms like "500KB" or "2MB"`);
	return Number(m[1]) * UNITS[m[2].toLowerCase()];
}
