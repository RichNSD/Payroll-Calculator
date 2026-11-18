// Entry point: loads tax data, reads the form, and keeps the page in sync.
//
// The math lives in pure modules (income.js, expenses.js, tax/*), so this
// file just wires events to them.

import { loadManifest, loadTaxYear } from './dataLoader.js';
import { calculateIncome } from './income.js';
import { calculateExpenses } from './expenses.js';
import { loadState, saveState, clearState, loadTheme, saveTheme } from './storage.js';
import { byId, isChecked, setHidden, setText } from './ui/dom.js';
import { parseNumber, formatInputValue } from './ui/format.js';
import { CUSTOM_CONTAINERS, addCustomItem, customValues, readCustomRows, restoreCustomItems } from './ui/customItems.js';
import {
    populateYears,
    populateStates,
    renderIncome,
    renderExpenses,
    renderLeftover,
    renderStateInfo,
    renderDataInfo,
    showError
} from './ui/render.js';

const FALLBACK_MANIFEST = { defaultYear: 2026, years: [2026] };
const SAVE_DELAY_MS = 300;

const app = {
    taxData: null,
    restoring: false,
    saveTimer: null
};

const num = id => parseNumber(byId(id)?.value);

// ---------------------------------------------------------------- reading the form

function readIncomeInputs() {
    return {
        payType: isChecked('salaryRadio') ? 'salary' : 'hourly',
        annualSalary: num('annualSalary'),
        hourlyWage: num('hourlyWage'),
        hoursPerWeek: num('hoursPerWeek'),
        overtimeHours: num('overtimeHours'),
        overtimeMultiplier: num('overtimeMultiplier'),
        state: byId('stateSelect')?.value,
        filingStatus: byId('filingStatus')?.value || 'single',
        dependents: num('dependents'),
        pretaxRetirement: num('pretaxRetirement'),
        pretaxHealth: num('pretaxHealth'),
        localTaxRate: num('localTaxRate')
    };
}

function readExpenseInputs() {
    const group = (checkboxId, containerId) => ({ enabled: isChecked(checkboxId), extras: customValues(containerId) });
    return {
        housingAmount: num('housingAmount'),
        housingType: byId('housingType')?.value,
        propertyTax: num('propertyTax'),
        housingExtras: customValues('housingExtras'),
        utilitiesBase: num('utilitiesBase'),
        utilitiesExtras: customValues('utilitiesExtras'),
        vehicle: {
            enabled: isChecked('vehicleCheckbox'),
            payment: num('vehiclePayment'),
            fuel: num('fuelCosts'),
            insurance: num('autoInsuranceAmount'),
            insurancePeriodMonths: num('autoInsurancePeriod') || 1,
            extras: customValues('vehicleExtras')
        },
        publicTransport: group('publicTransportCheckbox', 'publicTransportExtras'),
        rideShare: group('rideShareCheckbox', 'rideShareExtras'),
        miscTravel: group('miscTravelCheckbox', 'miscTravelExtras'),
        food: num('foodExpenses'),
        additional: customValues('additionalExpenses')
    };
}

// ---------------------------------------------------------------- updating the page

function syncVisibility() {
    const salary = isChecked('salaryRadio');
    setHidden('salaryInputs', !salary);
    setHidden('hourlyInputs', salary);
    setHidden('propertyTaxLabel', byId('housingType')?.value !== 'mortgage');
    setHidden('marriedHint', byId('filingStatus')?.value !== 'married');
    document.querySelectorAll('[data-toggles]').forEach(box => setHidden(box.dataset.toggles, !box.checked));
}

function recalculate() {
    if (!app.taxData) return;
    const inputs = readIncomeInputs();
    const income = calculateIncome(inputs, app.taxData);
    const expenses = calculateExpenses(readExpenseInputs());

    renderIncome(income);
    renderExpenses(expenses);
    renderLeftover(income.netMonthly - expenses.total);
    renderStateInfo(app.taxData.states[inputs.state], inputs.filingStatus, app.taxData.year);
    queueSave();
}

// ---------------------------------------------------------------- theme

function applyTheme(theme) {
    const light = theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    setText('themeToggle', light ? 'Switch to dark' : 'Switch to light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f7f9fb' : '#0f1724');
    saveTheme(light ? 'light' : 'dark');
}

// ---------------------------------------------------------------- persistence

function collectState() {
    const inputs = {};
    document.querySelectorAll('main input[id], main select[id]').forEach(field => {
        inputs[field.id] = field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.value;
    });
    const custom = {};
    CUSTOM_CONTAINERS.forEach(id => { custom[id] = readCustomRows(id); });
    return { inputs, custom };
}

function queueSave() {
    if (app.restoring) return;
    clearTimeout(app.saveTimer);
    setText('autosaveStatus', 'Saving…');
    app.saveTimer = setTimeout(() => {
        const ok = saveState(collectState());
        setText('autosaveStatus', ok ? 'Auto-saved' : 'Not saved (storage blocked)');
    }, SAVE_DELAY_MS);
}

/** Older saves stored the full state name ("Ohio"); map it to the new abbreviation. */
function normalizeStateValue(value, states) {
    if (!value || states[value]) return value;
    return Object.keys(states).find(abbr => states[abbr].name === value) || value;
}

function applySavedInputs(saved) {
    if (!saved?.inputs) return;
    Object.entries(saved.inputs).forEach(([id, value]) => {
        if (id === 'taxYear') return; // handled during year load
        const field = byId(id);
        if (!field) return;
        if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = Boolean(value);
        } else if (id === 'stateSelect') {
            field.value = normalizeStateValue(value, app.taxData.states);
        } else {
            field.value = value;
        }
    });
    if (byId('stateSelect') && !byId('stateSelect').value) byId('stateSelect').selectedIndex = 0;
    restoreCustomItems(saved.custom);
    document.querySelectorAll('main [data-format]').forEach(formatInputValue);
}

// ---------------------------------------------------------------- data loading

async function loadYear(year) {
    const previousState = byId('stateSelect')?.value;
    try {
        app.taxData = await loadTaxYear(year);
        showError('');
    } catch (error) {
        showError(`Couldn't load the ${year} tax data. If you opened index.html straight from disk, run a local server instead (see README). ${error.message}`);
        return false;
    }
    populateStates(app.taxData.states, previousState);
    renderDataInfo(app.taxData);
    return true;
}

// ---------------------------------------------------------------- events

function wireEvents() {
    const main = document.querySelector('main');

    main.addEventListener('input', recalculate);

    main.addEventListener('change', async event => {
        if (event.target.id === 'taxYear') {
            await loadYear(Number(event.target.value));
        }
        syncVisibility();
        recalculate();
    });

    // Pretty-print numbers when a field loses focus.
    main.addEventListener('focusout', event => {
        if (event.target.matches?.('input[data-format]')) {
            formatInputValue(event.target);
            queueSave();
        }
    });

    main.addEventListener('click', event => {
        const addButton = event.target.closest('[data-add-item]');
        if (addButton) {
            addCustomItem(addButton.dataset.addItem)?.querySelector('.custom-label')?.focus();
            recalculate();
            return;
        }
        const removeButton = event.target.closest('.remove-btn');
        if (removeButton) {
            removeButton.closest('.custom-item-row')?.remove();
            recalculate();
        }
    });

    byId('themeToggle')?.addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });

    byId('clearData')?.addEventListener('click', () => {
        if (!window.confirm('Clear all saved numbers and start over?')) return;
        clearTimeout(app.saveTimer);
        app.restoring = true; // block the pending save from re-writing data
        clearState();
        window.location.reload();
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
    }
}

// ---------------------------------------------------------------- boot

async function init() {
    const saved = loadState();
    // Saves from v1 kept the theme inside the main state object.
    applyTheme(loadTheme() || saved?.theme || document.documentElement.dataset.theme);

    let manifest = FALLBACK_MANIFEST;
    try {
        manifest = await loadManifest();
    } catch {
        /* fall back to the built-in default year */
    }

    const savedYear = Number(saved?.inputs?.taxYear);
    const year = manifest.years.includes(savedYear) ? savedYear : manifest.defaultYear;
    populateYears(manifest.years, year);

    wireEvents();
    if (!(await loadYear(year))) return;

    app.restoring = true;
    applySavedInputs(saved);
    syncVisibility();
    recalculate();
    app.restoring = false;
    setText('autosaveStatus', saved ? 'Auto-saved' : 'Ready');

    registerServiceWorker();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
