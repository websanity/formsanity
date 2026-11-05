const registry = new WeakMap();
const handlers = new WeakMap();

export function addPreSubmitHook(form, fn) {
	if (!registry.has(form)) registry.set(form, []);
	registry.get(form).push(fn);
}

export async function runHooks(form, payload) {
	for (const fn of registry.get(form) ?? []) {
		Object.assign(payload, (await fn({ form, payload })) ?? {});
	}
	return payload;
}

// A form holds at most one submit handler: a later call replaces the earlier one, and null or undefined removes it, so the form posts to its action again.
export function setSubmitHandler(form, fn) {
	if (fn) handlers.set(form, fn);
	else handlers.delete(form);
}

export function submitHandlerOf(form) {
	return handlers.get(form) ?? null;
}
