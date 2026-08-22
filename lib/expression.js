import { clockSeconds, ORDERED_TYPES } from './validators.js';

export function parseExpression(src) {
	const tokens = tokenize(src);
	let pos = 0;
	const peek = () => tokens[pos];
	const eat = (type) => {
		const t = tokens[pos];
		if (!t || t.type !== type) {
			throw new SyntaxError(`Expected ${type} at position ${t ? t.at : src.length} in "${src}"`);
		}
		pos += 1;
		return t;
	};
	function or() {
		let node = and();
		while (peek()?.type === '||') { eat('||'); node = { kind: 'or', left: node, right: and() }; }
		return node;
	}
	function and() {
		let node = unary();
		while (peek()?.type === '&&') { eat('&&'); node = { kind: 'and', left: node, right: unary() }; }
		return node;
	}
	function unary() {
		if (peek()?.type === '!') { eat('!'); return { kind: 'not', operand: unary() }; }
		return primary();
	}
	function primary() {
		const left = operand();
		const t = peek();
		if (t && ['==', '!=', '<=', '>=', '<', '>'].includes(t.type)) {
			eat(t.type);
			return { kind: 'cmp', op: t.type, left, right: operand() };
		}
		return left;
	}
	function operand() {
		const t = peek();
		if (!t) throw new SyntaxError(`Unexpected end of expression in "${src}"`);
		if (t.type === '(') { eat('('); const node = or(); eat(')'); return node; }
		if (t.type === 'name') { eat('name'); return { kind: 'name', name: t.value }; }
		if (t.type === 'string') { eat('string'); return { kind: 'string', value: t.value }; }
		if (t.type === 'number') { eat('number'); return { kind: 'number', value: t.value }; }
		throw new SyntaxError(`Unexpected ${t.type} at position ${t.at} in "${src}"`);
	}
	const node = or();
	if (pos < tokens.length) throw new SyntaxError(`Trailing input at position ${tokens[pos].at} in "${src}"`);
	return node;
}

function tokenize(src) {
	const out = [];
	let i = 0;
	while (i < src.length) {
		const ch = src[i];
		if (/\s/.test(ch)) { i += 1; continue; }
		const two = src.slice(i, i + 2);
		if (two === '==' && src[i + 2] === '=') throw new SyntaxError(`Unknown operator === at position ${i}`);
		if (['&&', '||', '==', '!=', '<=', '>='].includes(two)) { out.push({ type: two, at: i }); i += 2; continue; }
		if ('!<>()'.includes(ch)) { out.push({ type: ch, at: i }); i += 1; continue; }
		if (ch === "'") {
			let value = '';
			let j = i + 1;
			for (;;) {
				if (j >= src.length) throw new SyntaxError(`Unterminated string at position ${i}`);
				if (src[j] === "'" && src[j + 1] === "'") { value += "'"; j += 2; continue; }
				if (src[j] === "'") break;
				value += src[j];
				j += 1;
			}
			out.push({ type: 'string', value, at: i });
			i = j + 1;
			continue;
		}
		const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
		if (num) { out.push({ type: 'number', value: Number(num[0]), at: i }); i += num[0].length; continue; }
		const name = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i));
		if (name) { out.push({ type: 'name', value: name[0], at: i }); i += name[0].length; continue; }
		throw new SyntaxError(`Unexpected character "${ch}" at position ${i}`);
	}
	return out;
}

export function dependencies(node, acc = new Set()) {
	if (node.kind === 'name') acc.add(node.name);
	for (const key of ['left', 'right', 'operand']) {
		if (node[key]) dependencies(node[key], acc);
	}
	return [...acc];
}

export function evaluate(node, ctx) {
	switch (node.kind) {
		case 'or': return evaluate(node.left, ctx) || evaluate(node.right, ctx);
		case 'and': return evaluate(node.left, ctx) && evaluate(node.right, ctx);
		case 'not': return !evaluate(node.operand, ctx);
		case 'cmp': return compare(node, ctx);
		default: return truthy(resolve(node, ctx).value);
	}
}

function resolve(node, ctx) {
	if (node.kind === 'name') return { value: String(ctx.get(node.name) ?? ''), type: ctx.typeOf(node.name) };
	if (node.kind === 'number') return { value: String(node.value), type: null };
	if (node.kind === 'string') return { value: node.value, type: null };
	return { value: evaluate(node, ctx) ? 'true' : '', type: null };
}

function compare(node, ctx) {
	const l = resolve(node.left, ctx);
	const r = resolve(node.right, ctx);
	if (node.op === '==') return l.value === r.value;
	if (node.op === '!=') return l.value !== r.value;
	if (l.value.trim() === '' || r.value.trim() === '') return false;
	// The same type-precedence chain the cross-field rules use: calendar
	// types chronologically, native time as time of day, ordered fs types in
	// their own order, numeric otherwise. A literal operand takes the other
	// side's reading.
	const chrono = [l.type, r.type].some((t) => t === 'date' || t === 'datetime-local');
	const clock = !chrono && [l.type, r.type].includes('time');
	const ordered = ORDERED_TYPES[l.type] ?? ORDERED_TYPES[r.type];
	let a, b;
	if (chrono) [a, b] = [Date.parse(l.value), Date.parse(r.value)];
	else if (clock) [a, b] = [clockSeconds(l.value), clockSeconds(r.value)];
	else if (ordered) [a, b] = [ordered(l.value), ordered(r.value)];
	else [a, b] = [Number(l.value), Number(r.value)];
	if (a === null || b === null || Number.isNaN(a) || Number.isNaN(b)) return false;
	switch (node.op) {
		case '<': return a < b;
		case '<=': return a <= b;
		case '>': return a > b;
		case '>=': return a >= b;
	}
}

function truthy(value) {
	return value !== '';
}

export function compileExpression(src) {
	const node = parseExpression(src);
	return { node, deps: dependencies(node), evaluate: (ctx) => evaluate(node, ctx) };
}
