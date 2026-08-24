import { compiledExpression, expressionCtx } from './expression.js';

export function createRelevanceEngine(model, ctx) {
	const addDep = (map, dep, value) => {
		if (!map.has(dep)) map.set(dep, new Set());
		map.get(dep).add(value);
	};
	const compiled = new Map();
	const dependents = new Map();
	for (const field of model.fields.values()) {
		if (!field.relevance) continue;
		const c = compiledExpression(field.relevance.expr);
		compiled.set(field.name, c);
		for (const dep of c.deps) addDep(dependents, dep, field.name);
	}
	const regionDependents = new Map();
	const regions = (model.regions ?? []).map((region, index) => {
		const c = compiledExpression(region.expr);
		for (const dep of c.deps) addDep(regionDependents, dep, index);
		return { ...region, compiled: c, on: true };
	});
	// Which regions contain each field: a field's effective relevance is its own expression AND every containing region's, conjoined.
	const containing = new Map();
	for (const region of regions) {
		for (const name of region.members) {
			if (!containing.has(name)) containing.set(name, []);
			containing.get(name).push(region);
		}
	}
	const relevant = new Map();

	function isRelevant(name) {
		if ((relevant.get(name) ?? true) === false) return false;
		return (containing.get(name) ?? []).every((region) => region.on);
	}

	const evalCtx = () => expressionCtx(ctx);

	// The row toggles on the field's own expression alone; a region hides or grays its own element, which covers everything inside it. Disabling follows the effective state, so a control inside an irrelevant region is disabled no matter what its own expression says.
	function applyField(field) {
		if (field.relevance) {
			const own = relevant.get(field.name) ?? true;
			if (field.relevance.mode === 'hidden' && field.row) {
				field.row.hidden = !own;
				field.row.classList.toggle('fs-irrelevant', !own);
			}
		}
		const effective = isRelevant(field.name);
		for (const control of field.controls) control.disabled = !effective;
	}

	function applyRegion(region) {
		if (region.mode === 'hidden') region.element.hidden = !region.on;
		region.element.classList.toggle('fs-irrelevant', !region.on);
	}

	// Returns whether any region or field actually toggled, so init can settle relevance and verdicts to a fixed point.
	function refresh(changedName) {
		let changed = false;
		const touched = new Set(changedName ? dependents.get(changedName) ?? [] : compiled.keys());
		const hitRegions = changedName
			? [...(regionDependents.get(changedName) ?? [])].map((index) => regions[index])
			: regions;
		for (const region of hitRegions) {
			const on = Boolean(region.compiled.evaluate(evalCtx()));
			if (on !== region.on) changed = true;
			region.on = on;
			applyRegion(region);
			for (const member of region.members) touched.add(member);
		}
		for (const name of touched) {
			if (compiled.has(name)) {
				const own = Boolean(compiled.get(name).evaluate(evalCtx()));
				if (own !== (relevant.get(name) ?? true)) changed = true;
				relevant.set(name, own);
			}
			applyField(model.fields.get(name));
			ctx.onChange(name);
		}
		return changed;
	}

	refresh();
	return { refresh, isRelevant };
}
