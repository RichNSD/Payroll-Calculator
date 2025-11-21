// script.js - Enhanced interactive logic with theming, persistence, and PWA support

const STORAGE_KEY = 'payrollCalcState';
const COOKIE_KEY = 'payrollCalcCookie';
const CUSTOM_CONTAINERS = [
    'housingExtras',
    'utilitiesExtras',
    'vehicleExtras',
    'publicTransportExtras',
    'rideShareExtras',
    'miscTravelExtras',
    'additionalExpenses'
];

// State top marginal income tax rates (percent) for 2025.
const stateTaxRates = {
    "Alabama": 4.15,
    "Alaska": 0.00,
    "Arizona": 2.50,
    "Arkansas": 3.90,
    "California": 14.40,
    "Colorado": 4.40,
    "Connecticut": 6.99,
    "Delaware": 7.85,
    "Florida": 0.00,
    "Georgia": 5.39,
    "Hawaii": 11.00,
    "Idaho": 5.70,
    "Illinois": 4.95,
    "Indiana": 5.02,
    "Iowa": 3.80,
    "Kansas": 5.58,
    "Kentucky": 6.20,
    "Louisiana": 3.00,
    "Maine": 7.15,
    "Maryland": 8.95,
    "Massachusetts": 9.00,
    "Michigan": 6.65,
    "Minnesota": 9.85,
    "Mississippi": 4.40,
    "Missouri": 5.70,
    "Montana": 5.90,
    "Nebraska": 5.20,
    "Nevada": 0.00,
    "New Hampshire": 0.00,
    "New Jersey": 11.75,
    "New Mexico": 5.90,
    "New York": 14.78,
    "North Carolina": 4.25,
    "North Dakota": 2.50,
    "Ohio": 6.00,
    "Oklahoma": 4.75,
    "Oregon": 14.69,
    "Pennsylvania": 6.86,
    "Rhode Island": 5.99,
    "South Carolina": 6.20,
    "South Dakota": 0.00,
    "Tennessee": 0.00,
    "Texas": 0.00,
    "Utah": 4.55,
    "Vermont": 8.75,
    "Virginia": 5.75,
    "Washington": 0.00,
    "West Virginia": 4.82,
    "Wisconsin": 7.65,
    "Wyoming": 0.00
};

// Federal tax brackets (2025) for different filing statuses.
const federalBrackets = {
    single: {
        thresholds: [11925, 48475, 103350, 197300, 250525, 626350],
        rates:      [0.10,   0.12,   0.22,    0.24,    0.32,    0.35,    0.37]
    },
    married: {
        thresholds: [23850, 96950, 206700, 394600, 501050, 751600],
        rates:      [0.10,  0.12,  0.22,   0.24,   0.32,   0.35,   0.37]
    },
    head: {
        thresholds: [17000, 64850, 103350, 197300, 250500, 626350],
        rates:      [0.10,  0.12,  0.22,   0.24,   0.32,   0.35,   0.37]
    }
};

// Standard deductions for 2025.
const standardDeduction = {
    single: 15000,
    married: 30000,
    head: 22500
};

// Social Security wage base and tax rates.
const SOCIAL_SECURITY_BASE = 176100;
const SOCIAL_SECURITY_RATE = 0.062;
const MEDICARE_RATE = 0.0145;

let saveTimer = null;

function populateStates() {
    const select = document.getElementById('stateSelect');
    if (!select) return;
    select.innerHTML = '';
    const states = Object.keys(stateTaxRates).sort();
    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        select.appendChild(option);
    });
}

function parseNumber(value) {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isFinite(num) ? num : 0;
}

function getInputNumber(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return parseNumber(el.value);
}

function formatWithCommas(num, decimals = 2) {
    if (!isFinite(num)) num = 0;
    return Number(num).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatCurrency(num) {
    return '$' + formatWithCommas(num, 2);
}

function formatPercent(value) {
    if (!isFinite(value)) return '0%';
    return `${(value * 100).toFixed(1)}%`;
}

function formatInputValue(input) {
    if (!input) return;
    const decimals = input.dataset.format === 'number' ? 2 : 2;
    const numericValue = parseNumber(input.value);
    input.value = numericValue === 0 && input.value.trim() === '' ? '' : formatWithCommas(numericValue, decimals);
}

function formatAllInputs() {
    document.querySelectorAll('[data-format]').forEach(input => formatInputValue(input));
}

function calculateFederalTax(taxableIncome, status) {
    if (taxableIncome <= 0) return 0;
    const { thresholds, rates } = federalBrackets[status];
    let tax = 0;
    let previousThreshold = 0;
    for (let i = 0; i < rates.length; i++) {
        const upper = thresholds[i] !== undefined ? thresholds[i] : Infinity;
        const rate = rates[i];
        if (taxableIncome > upper) {
            tax += (upper - previousThreshold) * rate;
            previousThreshold = upper;
        } else {
            tax += (taxableIncome - previousThreshold) * rate;
            break;
        }
    }
    return tax;
}

function calculateIncome() {
    const salaryRadio = document.getElementById('salaryRadio');
    let annualSalary = 0;
    let totalHours = 0;

    if (salaryRadio && salaryRadio.checked) {
        const annualInput = getInputNumber('annualSalary');
        annualSalary = annualInput;
        const defaultHoursPerWeek = 40;
        totalHours = defaultHoursPerWeek * 52;
    } else {
        const wage = getInputNumber('hourlyWage');
        const hours = getInputNumber('hoursPerWeek');
        const overtime = getInputNumber('overtimeHours');
        const multiplier = getInputNumber('overtimeMultiplier') || 1.5;
        const baseHours = hours > 0 ? hours : 0;
        const overtimeHours = overtime > 0 ? overtime : 0;
        totalHours = (baseHours + overtimeHours * multiplier) * 52;
        annualSalary = (wage * baseHours * 52) + (wage * multiplier * overtimeHours * 52);
    }

    const state = document.getElementById('stateSelect')?.value;
    const status = document.getElementById('filingStatus')?.value || 'single';

    const stdDed = standardDeduction[status] || 0;
    const taxableIncome = Math.max(0, annualSalary - stdDed);
    const federalTax = calculateFederalTax(taxableIncome, status);
    const socialSecurityTax = Math.min(annualSalary, SOCIAL_SECURITY_BASE) * SOCIAL_SECURITY_RATE;
    const medicareTax = annualSalary * MEDICARE_RATE;
    const stateRate = stateTaxRates[state] || 0;
    const stateTax = annualSalary * (stateRate / 100);
    const totalTax = federalTax + socialSecurityTax + medicareTax + stateTax;
    let netAnnual = annualSalary - totalTax;
    if (netAnnual < 0) netAnnual = 0;

    const grossMonthly = annualSalary / 12;
    const grossBiWeekly = annualSalary / 26;
    const grossWeekly = annualSalary / 52;
    const grossHourly = totalHours > 0 ? annualSalary / totalHours : 0;

    const netMonthly = netAnnual / 12;
    const netBiWeekly = netAnnual / 26;
    const netWeekly = netAnnual / 52;
    const netHourly = totalHours > 0 ? netAnnual / totalHours : 0;

    return {
        grossAnnual: annualSalary,
        grossMonthly,
        grossBiWeekly,
        grossWeekly,
        grossHourly,
        netAnnual,
        netMonthly,
        netBiWeekly,
        netWeekly,
        netHourly,
        taxes: {
            federalTax,
            stateTax,
            socialSecurityTax,
            medicareTax,
            totalTax
        },
        effectiveTaxRate: annualSalary > 0 ? totalTax / annualSalary : 0
    };
}

function sumCustomItems(containerId) {
    const container = document.getElementById(containerId);
    let sum = 0;
    if (!container) return 0;
    const rows = container.querySelectorAll('.custom-item-row');
    rows.forEach(row => {
        const numInput = row.querySelector('input[data-format]');
        const val = parseNumber(numInput?.value);
        if (!isNaN(val)) sum += val;
    });
    return sum;
}

function calculateExpenses() {
    const housingAmount = getInputNumber('housingAmount');
    const housingType = document.getElementById('housingType')?.value;
    const propertyTax = housingType === 'mortgage' ? getInputNumber('propertyTax') : 0;
    const housingExtras = sumCustomItems('housingExtras');
    const housingTotal = housingAmount + propertyTax + housingExtras;

    const utilBase = getInputNumber('utilitiesBase');
    const utilitiesTotal = utilBase + sumCustomItems('utilitiesExtras');

    let vehicleTotal = 0;
    if (document.getElementById('vehicleCheckbox')?.checked) {
        const vehiclePayment = getInputNumber('vehiclePayment');
        const fuelCosts = getInputNumber('fuelCosts');
        const insuranceAmount = getInputNumber('autoInsuranceAmount');
        const period = parseNumber(document.getElementById('autoInsurancePeriod')?.value) || 1;
        const insuranceMonthly = period > 0 ? insuranceAmount / period : 0;
        vehicleTotal = vehiclePayment + fuelCosts + insuranceMonthly + sumCustomItems('vehicleExtras');
    }

    const publicTotal = document.getElementById('publicTransportCheckbox')?.checked ? sumCustomItems('publicTransportExtras') : 0;
    const rideShareTotal = document.getElementById('rideShareCheckbox')?.checked ? sumCustomItems('rideShareExtras') : 0;
    const miscTravelTotal = document.getElementById('miscTravelCheckbox')?.checked ? sumCustomItems('miscTravelExtras') : 0;

    const travelTotal = vehicleTotal + publicTotal + rideShareTotal + miscTravelTotal;

    const foodTotal = getInputNumber('foodExpenses');
    const additionalTotal = sumCustomItems('additionalExpenses');

    const total = housingTotal + utilitiesTotal + travelTotal + foodTotal + additionalTotal;

    return {
        housingTotal,
        utilitiesTotal,
        vehicleTotal,
        publicTotal,
        rideShareTotal,
        miscTravelTotal,
        travelTotal,
        foodTotal,
        additionalTotal,
        total
    };
}

function updateExpenseUI(expenses) {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatCurrency(value);
    };
    setText('housingTotal', expenses.housingTotal);
    setText('utilitiesTotal', expenses.utilitiesTotal);
    setText('vehicleTotal', expenses.vehicleTotal);
    setText('publicTransportTotal', expenses.publicTotal);
    setText('rideShareTotal', expenses.rideShareTotal);
    setText('miscTravelTotal', expenses.miscTravelTotal);
    setText('travelTotal', expenses.travelTotal);
    setText('foodTotal', expenses.foodTotal);
    setText('additionalTotal', expenses.additionalTotal);
    setText('totalExpenses', expenses.total);
}

function updateIncomeUI(income) {
    const { taxes } = income;
    const quickSet = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    quickSet('grossAnnual', formatCurrency(income.grossAnnual));
    quickSet('grossMonthly', formatCurrency(income.grossMonthly));
    quickSet('grossBiWeekly', formatCurrency(income.grossBiWeekly));
    quickSet('grossWeekly', formatCurrency(income.grossWeekly));
    quickSet('grossHourly', formatCurrency(income.grossHourly));

    quickSet('netAnnual', formatCurrency(income.netAnnual));
    quickSet('netMonthly', formatCurrency(income.netMonthly));
    quickSet('netMonthlyRow', formatCurrency(income.netMonthly));
    quickSet('netBiWeekly', formatCurrency(income.netBiWeekly));
    quickSet('netWeekly', formatCurrency(income.netWeekly));
    quickSet('netHourly', formatCurrency(income.netHourly));

    quickSet('effectiveTaxRate', `Effective tax: ${formatPercent(income.effectiveTaxRate)}`);
    quickSet('federalTaxAmount', formatCurrency(taxes.federalTax));
    quickSet('stateTaxAmount', formatCurrency(taxes.stateTax));
    quickSet('socialSecurityTaxAmount', formatCurrency(taxes.socialSecurityTax));
    quickSet('medicareTaxAmount', formatCurrency(taxes.medicareTax));
    quickSet('totalTaxAmount', formatCurrency(taxes.totalTax));

    quickSet('calcGrossAnnual', formatCurrency(income.grossAnnual));
    quickSet('calcTotalTax', formatCurrency(taxes.totalTax));
    quickSet('calcNetAnnual', formatCurrency(income.netAnnual));
    quickSet('calcNetMonthly', formatCurrency(income.netMonthly));
}

function recalculate() {
    const income = calculateIncome();
    const expenses = calculateExpenses();

    updateIncomeUI(income);
    updateExpenseUI(expenses);

    const remaining = income.netMonthly - expenses.total;
    const remainingEl = document.getElementById('remainingIncome');
    if (remainingEl) remainingEl.textContent = formatCurrency(remaining);

    const calcExpensesEl = document.getElementById('calcExpenses');
    const calcLeftoverEl = document.getElementById('calcLeftover');
    if (calcExpensesEl) calcExpensesEl.textContent = formatCurrency(expenses.total);
    if (calcLeftoverEl) calcLeftoverEl.textContent = formatCurrency(remaining);

    queueSave();
}

function toggleIncomeInputs() {
    const salaryInputs = document.getElementById('salaryInputs');
    const hourlyInputs = document.getElementById('hourlyInputs');
    if (document.getElementById('salaryRadio')?.checked) {
        salaryInputs?.classList.remove('hidden');
        hourlyInputs?.classList.add('hidden');
    } else {
        salaryInputs?.classList.add('hidden');
        hourlyInputs?.classList.remove('hidden');
    }
    recalculate();
}

function togglePropertyTax() {
    const housingType = document.getElementById('housingType')?.value;
    const propertyLabel = document.getElementById('propertyTaxLabel');
    if (housingType === 'mortgage') {
        propertyLabel?.classList.remove('hidden');
    } else {
        propertyLabel?.classList.add('hidden');
    }
    recalculate();
}

function toggleTravelSections() {
    const toggle = (id, checkboxId) => {
        const section = document.getElementById(id);
        const checked = document.getElementById(checkboxId)?.checked;
        section?.classList.toggle('hidden', !checked);
    };
    toggle('vehicleSection', 'vehicleCheckbox');
    toggle('publicTransportSection', 'publicTransportCheckbox');
    toggle('rideShareSection', 'rideShareCheckbox');
    toggle('miscTravelSection', 'miscTravelCheckbox');
    recalculate();
}

function addCustomItem(containerId, data = { label: '', value: '0' }) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'custom-item-row';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'Item label';
    labelInput.value = data.label || '';

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.inputMode = 'decimal';
    valueInput.dataset.format = 'currency';
    valueInput.value = data.value || '0';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        container.removeChild(row);
        recalculate();
    });

    labelInput.addEventListener('input', () => {
        queueSave();
    });

    valueInput.addEventListener('input', recalculate);
    valueInput.addEventListener('blur', () => {
        formatInputValue(valueInput);
        recalculate();
    });

    row.appendChild(labelInput);
    row.appendChild(valueInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
    formatInputValue(valueInput);
    recalculate();
}

function readCustomRows(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.custom-item-row')).map(row => {
        const inputs = row.querySelectorAll('input');
        return {
            label: inputs[0]?.value || '',
            value: inputs[1]?.value || '0'
        };
    });
}

function restoreCustomItems(state) {
    CUSTOM_CONTAINERS.forEach(containerId => {
        const items = state?.custom?.[containerId] || [];
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = '';
        items.forEach(item => addCustomItem(containerId, item));
    });
}

function setTheme(mode) {
    const body = document.body;
    const toLight = mode === 'light';
    body.classList.toggle('theme-light', toLight);
    body.classList.toggle('theme-dark', !toLight);
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) toggleBtn.textContent = toLight ? 'Switch to Dark' : 'Switch to Light';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', toLight ? '#ffffff' : '#0f1724');
    queueSave();
}

function loadTheme(state) {
    const theme = state?.theme || 'dark';
    setTheme(theme);
}

function updateAutosaveStatus(message = 'Auto-saved') {
    const el = document.getElementById('autosaveStatus');
    if (el) el.textContent = message;
}

function saveState() {
    const state = {
        theme: document.body.classList.contains('theme-light') ? 'light' : 'dark',
        inputs: {},
        custom: {}
    };
    document.querySelectorAll('input, select').forEach(el => {
        if (!el.id) return;
        if (el.type === 'checkbox' || el.type === 'radio') {
            state.inputs[el.id] = el.checked;
        } else {
            state.inputs[el.id] = el.value;
        }
    });
    CUSTOM_CONTAINERS.forEach(id => {
        state.custom[id] = readCustomRows(id);
    });
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    document.cookie = `${COOKIE_KEY}=${btoa(serialized)}; max-age=34128000; path=/`;
    updateAutosaveStatus('Auto-saved');
}

function loadState() {
    let stateData = null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            stateData = JSON.parse(stored);
        } catch (e) {
            stateData = null;
        }
    }
    if (!stateData) {
        const cookie = document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_KEY}=`));
        if (cookie) {
            try {
                stateData = JSON.parse(atob(cookie.split('=')[1]));
            } catch (e) {
                stateData = null;
            }
        }
    }
    if (!stateData) return;

    Object.entries(stateData.inputs || {}).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = !!value;
        } else {
            el.value = value;
        }
    });
    restoreCustomItems(stateData);
    loadTheme(stateData);
    formatAllInputs();
    toggleIncomeInputs();
    togglePropertyTax();
    toggleTravelSections();
    recalculate();
}

function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 250);
    updateAutosaveStatus('Saving…');
}

function clearSavedState() {
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = `${COOKIE_KEY}=; max-age=0; path=/`;
    window.location.reload();
}

function wireInputs() {
    document.getElementById('salaryRadio')?.addEventListener('change', toggleIncomeInputs);
    document.getElementById('hourlyRadio')?.addEventListener('change', toggleIncomeInputs);
    document.getElementById('housingType')?.addEventListener('change', togglePropertyTax);
    document.getElementById('vehicleCheckbox')?.addEventListener('change', toggleTravelSections);
    document.getElementById('publicTransportCheckbox')?.addEventListener('change', toggleTravelSections);
    document.getElementById('rideShareCheckbox')?.addEventListener('change', toggleTravelSections);
    document.getElementById('miscTravelCheckbox')?.addEventListener('change', toggleTravelSections);
    document.getElementById('autoInsurancePeriod')?.addEventListener('change', recalculate);
    document.getElementById('clearData')?.addEventListener('click', clearSavedState);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const nextTheme = document.body.classList.contains('theme-light') ? 'dark' : 'light';
        setTheme(nextTheme);
    });

    document.querySelectorAll('input[data-format], select').forEach(el => {
        if (el.tagName.toLowerCase() === 'select') {
            el.addEventListener('change', recalculate);
            return;
        }
        el.addEventListener('input', recalculate);
        el.addEventListener('blur', () => {
            formatInputValue(el);
            recalculate();
        });
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

document.addEventListener('DOMContentLoaded', () => {
    populateStates();
    wireInputs();
    formatAllInputs();
    toggleIncomeInputs();
    togglePropertyTax();
    toggleTravelSections();
    loadState();
    recalculate();
    registerServiceWorker();
});
