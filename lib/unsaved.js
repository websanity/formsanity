// data-fs-warn-unsaved: the browser asks for confirmation before the page is left while a form holds answers the person changed and has not submitted. A form is unsaved from the person's first edit until an accepted submission or a reset. One unsaved form is enough to warn.

const unsaved = new Set();

// The page listens for beforeunload only while some form is unsaved, because a registered listener keeps a page out of the back/forward cache in some browsers.
function warn(event) {
	for (const form of unsaved) {
		if (!form.isConnected) unsaved.delete(form);
	}
	if (unsaved.size === 0) {
		window.removeEventListener('beforeunload', warn);
		return;
	}
	event.preventDefault();
	// Older engines read the request to confirm from returnValue.
	event.returnValue = true;
}

function mark(form, on) {
	if (on) unsaved.add(form);
	else unsaved.delete(form);
	if (unsaved.size > 0) window.addEventListener('beforeunload', warn);
	else window.removeEventListener('beforeunload', warn);
}

// An edit is the person's when the browser fired its event. The engine dispatches events of its own for the values it writes, such as a total or a copied value, and those are untrusted. A deselection is the one edit of the person that reaches the form as an engine event, so the engine vouches for it here.
const vouched = new WeakSet();
export function byPerson(event) {
	vouched.add(event);
	return event;
}

export function attachUnsaved(form) {
	if (!form.hasAttribute('data-fs-warn-unsaved')) return;
	const edited = (event) => {
		if (event.isTrusted || vouched.has(event)) mark(form, true);
	};
	form.addEventListener('input', edited);
	form.addEventListener('change', edited);
	// fs:accepted fires before the client follows a redirect, so the redirect itself is never held.
	form.addEventListener('fs:accepted', () => mark(form, false));
	// The reset event fires before the browser restores the authored answers, and a canceled reset restores nothing.
	form.addEventListener('reset', (event) => setTimeout(() => {
		if (!event.defaultPrevented) mark(form, false);
	}));
}
