import { compileExpression } from './expression.js';

export function createRelevanceEngine(model, ctx) {
	const compiled = new Map();
	const dependents = new Map();
	for (const field of model.fields.values()) {
		if (!field.relevance) continue;
		const c = compileExpression(field.relevance.expr);
		compiled.set(field.name, c);
		for (const dep of c.deps) {
			if (!dependents.has(dep)) dependents.set(dep, new Set());
			dependents.get(dep).add(field.name);
		}
	}
	const relevant = new Map();

	function apply(field, isRelevant) {
		relevant.set(field.name, isRelevant);
		const mode = field.relevance.mode;
		if (mode === 'hidden' && field.row) {
			field.row.hidden = !isRelevant;
			field.row.classList.toggle('fs-irrelevant', !isRelevant);
		}
		for (const control of field.controls) control.disabled = !isRelevant;
	}

	function refresh(changedName) {
		const names = changedName ? dependents.get(changedName) ?? [] : compiled.keys();
		for (const name of names) {
			const field = model.fields.get(name);
			apply(field, compiled.get(name).evaluate({ get: ctx.valueOf, typeOf: ctx.typeOf, valid: ctx.isFieldValid }));
			ctx.onChange(name);
		}
	}

	refresh();
	return { refresh, isRelevant: (name) => relevant.get(name) ?? true };
}
