const registry = new WeakMap();

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
