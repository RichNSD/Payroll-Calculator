// Tiny DOM helpers so the rest of the UI code stays readable.

export const byId = id => document.getElementById(id);

export function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text;
}

export function setHidden(idOrEl, hidden) {
    const el = typeof idOrEl === 'string' ? byId(idOrEl) : idOrEl;
    el?.classList.toggle('hidden', hidden);
}

export function isChecked(id) {
    return Boolean(byId(id)?.checked);
}

/** Create an element with optional class and text in one go. */
export function el(tag, { className, text } = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
