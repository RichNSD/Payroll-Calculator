// "Add custom item" rows inside each expense category.

import { byId } from './dom.js';
import { parseNumber, formatInputValue } from './format.js';

export const CUSTOM_CONTAINERS = [
    'housingExtras',
    'utilitiesExtras',
    'vehicleExtras',
    'publicTransportExtras',
    'rideShareExtras',
    'miscTravelExtras',
    'additionalExpenses'
];

/**
 * Append a row to a container. Input/remove events bubble up to the
 * container listeners wired in app.js, so rows need no handlers of their own.
 */
export function addCustomItem(containerId, { label = '', value = '0' } = {}) {
    const container = byId(containerId);
    const template = byId('customItemTemplate');
    if (!container || !template) return null;

    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('.custom-label').value = label;
    const valueInput = row.querySelector('.custom-value');
    valueInput.value = value;
    formatInputValue(valueInput);
    container.appendChild(row);
    return row;
}

/** Monthly amounts of every row in a container. */
export function customValues(containerId) {
    const container = byId(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.custom-value'), input => parseNumber(input.value));
}

/** Label + raw value pairs for persistence. */
export function readCustomRows(containerId) {
    const container = byId(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.custom-item-row'), row => ({
        label: row.querySelector('.custom-label').value,
        value: row.querySelector('.custom-value').value
    }));
}

export function restoreCustomItems(saved = {}) {
    CUSTOM_CONTAINERS.forEach(containerId => {
        const container = byId(containerId);
        if (!container) return;
        container.replaceChildren();
        (saved[containerId] || []).forEach(item => addCustomItem(containerId, item));
    });
}
