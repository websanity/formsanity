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
	const optionDependents = new Map();
	const options = (model.options ?? []).map((entry, index) => {
		const c = compiledExpression(entry.expr);
		for (const dep of c.deps) addDep(optionDependents, dep, index);
		return { ...entry, compiled: c, on: true };
	});
	const optionsOf = new Map();
	for (const entry of options) {
		if (!optionsOf.has(entry.select)) optionsOf.set(entry.select, []);
		optionsOf.get(entry.select).push(entry);
	}
	const relevant = new Map();

	function isControlRelevant(control) {
		if ((relevant.get(control) ?? true) === false) return false;
		return (containing.get(control) ?? []).every((region) => region.on);
	}

	// A select whose every option is conditional and off has nothing to choose. It is an irrelevant field, and it stays in place, disabled.
	function hasChoice(control) {
		const entries = optionsOf.get(control);
		return !(entries && entries.length === entries[0].total && entries.every((entry) => !entry.on));
	}

	// A field is relevant while any control of it is, and a select only while it has a choice.
	function isRelevant(name) {
		const field = model.fields.get(name);
		if (!field) return true;
		return field.controls.some(isControlRelevant) && hasChoice(field.controls[0]);
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
		control.disabled = !isControlRelevant(control) || !hasChoice(control);
	}

	function applyRegion(region) {
		if (region.mode === 'hidden') region.element.hidden = !region.on;
		region.element.classList.toggle('fs-irrelevant', !region.on);
	}

	// An irrelevant option leaves its select in hidden mode, because the platform cannot hide an option everywhere: iOS Safari shows a hidden option in its picker. It goes back in document order when it returns, before the first option still in place with a higher original index.
	function applyOption(entry) {
		const { option, parent } = entry;
		if (entry.mode === 'disabled') {
			option.disabled = !entry.on;
			return;
		}
		if (entry.on && !option.isConnected) {
			const index = model.optionIndex.get(option);
			const successor = [...parent.children].find((other) => model.optionIndex.get(other) > index) ?? null;
			parent.insertBefore(option, successor);
		} else if (!entry.on && option.isConnected) {
			option.remove();
		}
	}

	// A single select cannot show "nothing chosen" while a disabled option is selected, and a detached option cannot stay selected at all, so the selection falls back to the first relevant option.
	function settleSelect(select) {
		if (select.multiple) return;
		const chosen = select.selectedOptions[0];
		if (chosen && !chosen.disabled) return;
		const first = [...select.options].find((option) => !option.disabled);
		select.value = first ? first.value : '';
	}

	// A fallback dispatches change, which re-enters refresh through the form's listener. Only the outermost pass settles and dispatches: an inner pass queues its selects, and the outermost drains the queue in rounds until nothing moves. The cap guards a cyclic model, as the init loop's cap does.
	const pending = new Map();
	let depth = 0;
	let draining = false;

	function drainFallbacks() {
		draining = true;
		for (let round = 0; round < 10 && pending.size > 0; round++) {
			const batch = [...pending];
			pending.clear();
			for (const [select, before] of batch) {
				settleSelect(select);
				if (select.value !== before) select.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}
		pending.clear();
		draining = false;
	}

	// Returns whether any region, option, or control actually toggled, so init can settle relevance and verdicts to a fixed point. A select whose selection fell back queues here; the outermost pass drains the queue.
	function refresh(changedName) {
		depth += 1;
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
		const hitOptions = changedName
			? [...(optionDependents.get(changedName) ?? [])].map((index) => options[index])
			: options;
		const selects = new Map();
		for (const entry of hitOptions) {
			if (!selects.has(entry.select)) selects.set(entry.select, entry.select.value);
			const on = Boolean(entry.compiled.evaluate(evalCtx()));
			if (on !== entry.on) changed = true;
			entry.on = on;
			applyOption(entry);
			touched.add(entry.select);
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
		for (const [select, before] of selects) {
			if (!pending.has(select)) pending.set(select, before);
		}
		depth -= 1;
		if (depth === 0 && !draining) drainFallbacks();
		return changed;
	}

	refresh();
	return { refresh, isRelevant };
}
