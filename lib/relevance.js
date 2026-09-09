import { compiledExpression, expressionCtx } from './expression.js';

export function createRelevanceEngine(model, ctx) {
	const addDep = (map, dep, value) => {
		if (!map.has(dep)) map.set(dep, new Set());
		map.get(dep).add(value);
	};
	// Relevance is decided per control. Each member's own expression compiles on its own, and a one-control field is the one-member case.
	const compiled = new Map();
	const dependents = new Map();
	const fieldOf = new Map();
	for (const field of model.fields.values()) {
		field.controls.forEach((control, index) => {
			fieldOf.set(control, field);
			const own = field.relevance[index];
			if (!own) return;
			const c = compiledExpression(own.expr);
			compiled.set(control, c);
			for (const dep of c.deps) addDep(dependents, dep, control);
		});
	}
	const regionDependents = new Map();
	const regions = (model.regions ?? []).map((region, index) => {
		const c = compiledExpression(region.expr);
		for (const dep of c.deps) addDep(regionDependents, dep, index);
		return { ...region, compiled: c, on: true };
	});
	// Which regions contain each control: a control's effective relevance is its own expression AND every containing region's, conjoined.
	const containing = new Map();
	for (const region of regions) {
		for (const control of region.controls) {
			if (!containing.has(control)) containing.set(control, []);
			containing.get(control).push(region);
		}
	}
	const relevant = new Map();

	function isControlRelevant(control) {
		if ((relevant.get(control) ?? true) === false) return false;
		return (containing.get(control) ?? []).every((region) => region.on);
	}

	// A field is relevant while any control of it is.
	function isRelevant(name) {
		const field = model.fields.get(name);
		if (!field) return true;
		return field.controls.some(isControlRelevant);
	}

	const evalCtx = () => expressionCtx(ctx);

	// The box a control's own expression toggles: the field's row for a one-control field, the member's own li inside a set. A region hides its own element, which covers everything inside it, so the box follows the control's own expression alone. Disabling follows the effective state, so a control inside an irrelevant region is disabled no matter what its own expression says.
	function applyControl(control) {
		const field = fieldOf.get(control);
		if (!field) return;
		if (compiled.has(control)) {
			const own = relevant.get(control) ?? true;
			const { mode } = field.relevance[field.controls.indexOf(control)];
			const box = field.row ?? control.closest('li');
			if (mode === 'hidden' && box) {
				box.hidden = !own;
				box.classList.toggle('fs-irrelevant', !own);
			}
		}
		control.disabled = !isControlRelevant(control);
	}

	function applyRegion(region) {
		if (region.mode === 'hidden') region.element.hidden = !region.on;
		region.element.classList.toggle('fs-irrelevant', !region.on);
	}

	// Returns whether any region or control actually toggled, so init can settle relevance and verdicts to a fixed point.
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
			for (const control of region.controls) touched.add(control);
		}
		const names = new Set();
		for (const control of touched) {
			if (compiled.has(control)) {
				const own = Boolean(compiled.get(control).evaluate(evalCtx()));
				if (own !== (relevant.get(control) ?? true)) changed = true;
				relevant.set(control, own);
			}
			applyControl(control);
			names.add(control.name);
		}
		for (const name of names) ctx.onChange(name);
		return changed;
	}

	refresh();
	return { refresh, isRelevant };
}
