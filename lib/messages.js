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
	'constraint': 'not an allowed answer',
	'min-time': 'no earlier than {n} each day',
	'max-time': 'no later than {n} each day',
	'min-digits': 'minimum of {n} digit characters',
	'min-uppercase': 'minimum of {n} uppercase characters',
	'min-lowercase': 'minimum of {n} lowercase characters',
	'group.required-any': 'one or more required',
	'group.required-together': 'all (or none) required',
	'min-selected': 'select at least {n}',
	'max-selected': 'select at most {n}',
	'file.max-size': 'file must be {size} or smaller',
	'file.accept': 'incorrect file type',
	'unique': 'already in use',
	'group.unique-values': 'must be unique',
	'relevance': 'not applicable'
};

// Format hints for the format-shaped types, applied as placeholders when the author wrote none. Types whose catalog message is a description rather than a shape have no hint on purpose.
export const hints = {
	'cvv': '###',
	'us-phone': '(###) ###-####',
	'international-phone': '+44 20 7946 0958',
	'ssn': '###-##-####',
	'duration': 'HH:MM',
	'us-dollar': '###.##',
	'zip': '##### or #####-####'
};

export const formMessages = {
	incomplete: 'Please complete the required fields',
	invalid: 'Please fix the highlighted fields',
	processing: 'Processing…',
	error: 'Something went wrong. Please try again.',
	protocol: 'Unexpected response from the server.'
};

// A time-of-day bound quoted in a message speaks the user's locale — the same presentation the temporal inputs themselves render — never the raw 24-hour attribute value.
export function formatTimeOfDay(raw) {
	const [hours, minutes] = raw.split(':').map(Number);
	return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(1970, 0, 1, hours, minutes));
}

export function messageFor(code, params = {}) {
	// An author-supplied message (data-fs-constraint-message) wins over the catalog: the catalog cannot know what an arbitrary expression means.
	if (params.message) return params.message;
	const template = catalog[code] ?? 'not valid';
	return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}
