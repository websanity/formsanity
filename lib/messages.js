export const catalog = {
	'required': 'required',
	'type.alpha': 'letters only',
	'type.alphanum': 'letters/numbers only',
	'type.identifier': 'letters, numbers, underscores, or dashes only',
	'type.no-whitespace': 'no whitespace characters',
	'type.email': 'must be an email address',
	'type.email-list': 'must be a list of email addresses',
	'type.ipv4': 'IPv4 address, example: 192.168.1.1',
	'type.ipv6': 'IPv6 address, example: 2001:db8:85a3:8d3:1319:8a2e:370:7348',
	'type.ip': 'either an IPv4 or IPv6 address',
	'type.credit-card': 'must be {networks}',
	'type.cvv': '3 or 4 digit number',
	'type.us-phone': '(###) ###-####',
	'type.international-phone': 'international phone number, example: +44 20 7946 0958',
	'type.ssn': '###-##-####',
	'type.time': 'example: 11:45am',
	'type.duration': 'HH:MM',
	'type.us-dollar': 'must be a dollar value',
	'type.zip': '##### or #####-####',
	'type.native': 'not valid',
	'badinput': 'must be a number',
	'pattern': 'must match the required format',
	'minlength': 'minimum of {n} characters',
	'maxlength': 'maximum of {n} characters',
	'min': 'minimum of {n}',
	'max': 'maximum of {n}',
	'step': 'must be a whole number',
	'equals': 'must be equal to {value}',
	'not-equals': 'must be a different answer',
	'equals-field': 'must be equal to {label}',
	'not-equals-field': 'must be different from {label}',
	'greater-than-field': 'must be greater than {label}',
	'greater-than-field.date': 'must be after {label}',
	'less-than-field': 'must be less than {label}',
	'less-than-field.date': 'must be before {label}',
	'min-digits': 'minimum of {n} digit characters',
	'min-uppercase': 'minimum of {n} uppercase characters',
	'min-lowercase': 'minimum of {n} lowercase characters',
	'group.at-least-one': 'one or more required',
	'group.all-or-none': 'all (or none) required',
	'min-selected': 'select at least {n}',
	'max-selected': 'select at most {n}',
	'file.max-size': 'file must be {size} or smaller',
	'unique': 'already in use',
	'unique-in-page': 'must be unique'
};

export const formMessages = {
	incomplete: 'Please complete the required fields marked *',
	invalid: 'Please fix the highlighted fields',
	processing: 'Processing…',
	error: 'Something went wrong. Please try again.',
	protocol: 'Unexpected response from the server.'
};

export function messageFor(code, params = {}) {
	const template = catalog[code] ?? 'not valid';
	return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}
