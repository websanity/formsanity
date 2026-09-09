// The answer a field holds, read the way a native submission reads it: a checked member or a selected option counts only while it is enabled. Relevance disables every irrelevant member, so a partly relevant set reads its relevant members alone, and an author-disabled member is out of play the same way.
export function fieldValues(field) {
	const [first] = field.controls;
	if (first.matches('select[multiple]')) {
		return [...first.selectedOptions].filter((option) => !option.disabled).map((option) => option.value);
	}
	if (first.type === 'checkbox' || first.type === 'radio') {
		return field.controls.filter((control) => control.checked && !control.disabled).map((control) => control.value);
	}
	if (first.type === 'file') return [...first.files];
	return first.value;
}

// The same answer as one string, the form that an expression or a rule compares: a set or a list joins its values with commas, and every other control is its value.
export function fieldValue(field) {
	const [first] = field.controls;
	if (first.matches('select[multiple]') || first.type === 'checkbox' || first.type === 'radio') {
		return fieldValues(field).join(',');
	}
	return first.value;
}
