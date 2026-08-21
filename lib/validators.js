export function validateType(type, value, param) {
	if (value === '') return 'valid';
	const def = types[type];
	if (!def) throw new Error(`Unknown data-fs-type "${type}"`);
	if (typeof def === 'function') return def(value, param);
	if (def.full.test(value)) return 'valid';
	return def.prefix.test(value) ? 'incomplete' : 'invalid';
}

export function luhn(digits) {
	let sum = 0;
	let double = false;
	for (let i = digits.length - 1; i >= 0; i -= 1) {
		let d = Number(digits[i]);
		if (double) { d *= 2; if (d > 9) d -= 9; }
		sum += d;
		double = !double;
	}
	return sum % 10 === 0;
}

function ipv4(value) {
	if (!/^[\d.]+$/.test(value)) return 'invalid';
	const parts = value.split('.');
	if (parts.length > 4) return 'invalid';
	for (const p of parts.slice(0, -1)) {
		if (p === '' || p.length > 3 || Number(p) > 255) return 'invalid';
	}
	const last = parts[parts.length - 1];
	if (last.length > 3 || (last !== '' && Number(last) > 255)) return 'invalid';
	return parts.length === 4 && last !== '' ? 'valid' : 'incomplete';
}

function ipv6(value) {
	if (!/^[0-9A-Fa-f:]+$/.test(value)) return 'invalid';
	if ((value.match(/::/g) ?? []).length > 1) return 'invalid';
	const groups = value.replace('::', ':x:').split(':').filter((g) => g !== '');
	if (groups.some((g) => g !== 'x' && g.length > 4)) return 'invalid';
	const count = groups.filter((g) => g !== 'x').length;
	if (count > 8) return 'invalid';
	const complete = value.includes('::') ? count <= 7 : count === 8;
	if (complete && !value.endsWith(':')) return 'valid';
	return 'incomplete';
}

const RANK = { invalid: 0, incomplete: 1, valid: 2 };

function ip(value) {
	const a = ipv4(value);
	const b = ipv6(value);
	return RANK[a] >= RANK[b] ? a : b;
}

function emailList(value) {
	const items = value.split(/[\s,]+/).filter((s) => s !== '');
	let worst = 'valid';
	items.forEach((item, i) => {
		let v = validateType('email', item);
		if (v === 'incomplete' && i < items.length - 1) v = 'invalid';
		if (RANK[v] < RANK[worst]) worst = v;
	});
	return worst;
}

const NETWORKS = {
	Visa: { iin: /^4/, lengths: [13, 16, 19] },
	MasterCard: { iin: /^(5[1-5]|2[2-7])/, lengths: [16] },
	Amex: { iin: /^3[47]/, lengths: [15] },
	Discover: { iin: /^6(011|5)/, lengths: [16, 17, 18, 19] }
};

function creditCard(value, param = 'Visa|MasterCard|Amex|Discover') {
	const digits = value.replace(/[ -]/g, '');
	if (!/^\d*$/.test(digits)) return 'invalid';
	const allowed = param.split('|').map((n) => NETWORKS[n]).filter(Boolean);
	const candidates = allowed.filter((n) => n.iin.test(digits) || digits.length < 2);
	if (candidates.length === 0) return 'invalid';
	const maxLen = Math.max(...candidates.flatMap((n) => n.lengths));
	if (digits.length > maxLen) return 'invalid';
	const done = candidates.some((n) => n.lengths.includes(digits.length));
	if (!done) return 'incomplete';
	return luhn(digits) ? 'valid' : 'invalid';
}

const US_PHONE_CHARS = /^[\d() .-]*$/;
const US_PHONE_FULL = /^\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}$/;

function usPhone(value) {
	if (!US_PHONE_CHARS.test(value)) return 'invalid';
	const digits = value.replace(/\D/g, '');
	if (digits.length > 10) return 'invalid';
	if (digits.length === 10 && US_PHONE_FULL.test(value)) return 'valid';
	return 'incomplete';
}

const INTL_PHONE_CHARS = /^\+[\d() .-]*$/;

function internationalPhone(value) {
	if (!INTL_PHONE_CHARS.test(value)) return 'invalid';
	const digits = value.slice(1).replace(/\D/g, '');
	if (digits.length > 15) return 'invalid';
	return digits.length >= 7 ? 'valid' : 'incomplete';
}

export const types = {
	alpha: { full: /^[A-Za-z]+$/, prefix: /^[A-Za-z]*$/ },
	alphanum: { full: /^[A-Za-z0-9]+$/, prefix: /^[A-Za-z0-9]*$/ },
	identifier: { full: /^[A-Za-z0-9_-]+$/, prefix: /^[A-Za-z0-9_-]*$/ },
	'no-whitespace': { full: /^\S+$/, prefix: /^\S*$/ },
	email: { full: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, prefix: /^[^\s@]+(@[^\s@]*)?$/ },
	cvv: { full: /^\d{3,4}$/, prefix: /^\d{0,4}$/ },
	ssn: { full: /^\d{3}-\d{2}-\d{4}$/, prefix: /^\d{0,3}(-\d{0,2}(-\d{0,4})?)?$/ },
	duration: { full: /^\d{1,3}:[0-5]\d$/, prefix: /^\d{0,3}(:([0-5]\d?)?)?$/ },
	'us-dollar': { full: /^\$?(\d+|\d{1,3}(,\d{3})+)(\.\d{2})?$/, prefix: /^\$?\d{0,3}(,\d{0,3})*(\.\d{0,2})?$/ },
	zip: { full: /^\d{5}(-\d{4})?$/, prefix: /^\d{0,5}(-\d{0,4})?$/ },
	ipv4,
	ipv6,
	ip,
	'email-list': emailList,
	'credit-card': creditCard,
	'us-phone': usPhone,
	'international-phone': internationalPhone
};

export function nativeVerdict(v) {
	if (v.valid) return 'valid';
	if (v.badInput || v.rangeOverflow || v.stepMismatch || v.tooLong) return 'invalid';
	return 'incomplete';
}

const NATIVE_CODES = [
	['valueMissing', 'required'], ['badInput', 'badinput'], ['typeMismatch', 'type.native'],
	['patternMismatch', 'pattern'], ['tooShort', 'minlength'], ['tooLong', 'maxlength'],
	['rangeUnderflow', 'min'], ['rangeOverflow', 'max'], ['stepMismatch', 'step']
];

export function nativeCode(v) {
	if (v.valid) return null;
	for (const [flag, code] of NATIVE_CODES) {
		if (v[flag]) return code;
	}
	return null;
}
