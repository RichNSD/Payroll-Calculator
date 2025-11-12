// script.js - Implements the interactive income and expense calculator logic

// State top marginal income tax rates (percent) for 2025.  Values taken from the
// Rich States, Poor States report on top marginal personal income tax rates【754966972375037†L208-L408】.
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

// Federal tax brackets (2025) for different filing statuses.  Thresholds are the upper
// bounds for each bracket. Rates correspond to the marginal tax rates【94520862381921†L244-L250】.
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

// Standard deductions for 2025【94520862381921†L285-L287】.
const standardDeduction = {
    single: 15000,
    married: 30000,
    head: 22500
};

// Social Security wage base and tax rates【477192643144897†L323-L369】.
const SOCIAL_SECURITY_BASE = 176100;
const SOCIAL_SECURITY_RATE = 0.062;
const MEDICARE_RATE = 0.0145;

/**
 * Populate the state drop‑down with U.S. states.
 */
function populateStates() {
    const select = document.getElementById('stateSelect');
    // Sort states alphabetically for usability
    const states = Object.keys(stateTaxRates).sort();
    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        select.appendChild(option);
    });
}

/**
 * Calculate federal tax using marginal brackets.
 * @param {number} taxableIncome Amount of income subject to tax after deductions.
 * @param {string} status Filing status (single, married, head).
 * @returns {number} Federal tax owed.
 */
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

/**
 * Compute gross and net income across different pay periods.
 * @returns {Object} Object containing annual, monthly, biWeekly, weekly, and hourly amounts for gross and net.
 */
function calculateIncome() {
    const salaryRadio = document.getElementById('salaryRadio');
    let annualSalary = 0;
    let totalHours = 0;

    if (salaryRadio.checked) {
        const annualInput = parseFloat(document.getElementById('annualSalary').value);
        annualSalary = isNaN(annualInput) ? 0 : annualInput;
        // Assume standard 40 hour week if salary; still compute hourly breakdown
        const defaultHoursPerWeek = 40;
        totalHours = defaultHoursPerWeek * 52;
    } else {
        // Hourly
        const wage = parseFloat(document.getElementById('hourlyWage').value);
        const hours = parseFloat(document.getElementById('hoursPerWeek').value);
        const overtime = parseFloat(document.getElementById('overtimeHours').value);
        const multiplier = parseFloat(document.getElementById('overtimeMultiplier').value);
        const hourly = isNaN(wage) ? 0 : wage;
        const baseHours = isNaN(hours) ? 0 : hours;
        const overtimeHours = isNaN(overtime) ? 0 : overtime;
        const overtimeMultiplier = isNaN(multiplier) ? 1.5 : multiplier;
        // Total weekly hours
        totalHours = (baseHours + overtimeHours * overtimeMultiplier) * 52;
        // Compute annual salary including overtime
        annualSalary = (hourly * baseHours * 52) + (hourly * overtimeMultiplier * overtimeHours * 52);
    }

    const state = document.getElementById('stateSelect').value;
    const status = document.getElementById('filingStatus').value;

    // Calculate taxes
    const stdDed = standardDeduction[status] || 0;
    const taxableIncome = Math.max(0, annualSalary - stdDed);
    const federalTax = calculateFederalTax(taxableIncome, status);
    const socialSecurityTax = Math.min(annualSalary, SOCIAL_SECURITY_BASE) * SOCIAL_SECURITY_RATE;
    const medicareTax = annualSalary * MEDICARE_RATE;
    const stateRate = stateTaxRates[state] || 0;
    const stateTax = annualSalary * (stateRate / 100);
    let totalTax = federalTax + socialSecurityTax + medicareTax + stateTax;
    let netAnnual = annualSalary - totalTax;
    if (netAnnual < 0) netAnnual = 0;

    // Compute gross amounts
    const grossMonthly = annualSalary / 12;
    const grossBiWeekly = annualSalary / 26;
    const grossWeekly = annualSalary / 52;
    const grossHourly = totalHours > 0 ? annualSalary / totalHours : 0;

    // Compute net amounts
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
        netHourly
    };
}

/**
 * Sum all monthly living expenses from the input fields and custom items.
 * @returns {number} The total monthly expenses.
 */
function calculateExpenses() {
    let total = 0;
    // Housing
    const housingAmount = parseFloat(document.getElementById('housingAmount').value);
    if (!isNaN(housingAmount)) total += housingAmount;
    const housingType = document.getElementById('housingType').value;
    if (housingType === 'mortgage') {
        const propertyTax = parseFloat(document.getElementById('propertyTax').value);
        if (!isNaN(propertyTax)) total += propertyTax;
    }
    total += sumCustomItems('housingExtras');

    // Utilities
    const utilBase = parseFloat(document.getElementById('utilitiesBase').value);
    if (!isNaN(utilBase)) total += utilBase;
    total += sumCustomItems('utilitiesExtras');

    // Travel - Vehicle
    if (document.getElementById('vehicleCheckbox').checked) {
        const vehiclePayment = parseFloat(document.getElementById('vehiclePayment').value);
        if (!isNaN(vehiclePayment)) total += vehiclePayment;
        const insuranceAmount = parseFloat(document.getElementById('autoInsuranceAmount').value);
        const period = parseFloat(document.getElementById('autoInsurancePeriod').value);
        if (!isNaN(insuranceAmount) && !isNaN(period) && period > 0) {
            total += insuranceAmount / period;
        }
        total += sumCustomItems('vehicleExtras');
    }
    // Travel - Public transport
    if (document.getElementById('publicTransportCheckbox').checked) {
        total += sumCustomItems('publicTransportExtras');
    }
    // Travel - Ride share
    if (document.getElementById('rideShareCheckbox').checked) {
        total += sumCustomItems('rideShareExtras');
    }
    // Travel - Miscellaneous
    if (document.getElementById('miscTravelCheckbox').checked) {
        total += sumCustomItems('miscTravelExtras');
    }
    // Food & groceries
    const food = parseFloat(document.getElementById('foodExpenses').value);
    if (!isNaN(food)) total += food;
    // Additional expenses
    total += sumCustomItems('additionalExpenses');
    return total;
}

/**
 * Sum numeric values of custom item rows within a container.
 * @param {string} containerId The id of the container holding custom rows.
 * @returns {number} Sum of values.
 */
function sumCustomItems(containerId) {
    const container = document.getElementById(containerId);
    let sum = 0;
    if (!container) return 0;
    const rows = container.querySelectorAll('.custom-item-row');
    rows.forEach(row => {
        const numInput = row.querySelector('input[type="number"]');
        const val = parseFloat(numInput.value);
        if (!isNaN(val)) sum += val;
    });
    return sum;
}

/**
 * Add a custom expense item row to the specified container.
 * Each row consists of a text input (label), a numeric input (value), and a remove button.
 * @param {string} containerId The id of the container where the row should be added.
 */
function addCustomItem(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'custom-item-row';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'Item label';
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.min = '0';
    valueInput.step = '0.01';
    valueInput.value = '0';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        container.removeChild(row);
        recalculate();
    });
    // Recalculate when values change
    labelInput.addEventListener('input', recalculate);
    valueInput.addEventListener('input', recalculate);
    row.appendChild(labelInput);
    row.appendChild(valueInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
    recalculate();
}

/**
 * Recalculate incomes, expenses, and update the DOM accordingly.
 */
function recalculate() {
    const income = calculateIncome();
    // Update income table
    document.getElementById('grossAnnual').textContent  = formatCurrency(income.grossAnnual);
    document.getElementById('grossMonthly').textContent = formatCurrency(income.grossMonthly);
    document.getElementById('grossBiWeekly').textContent= formatCurrency(income.grossBiWeekly);
    document.getElementById('grossWeekly').textContent  = formatCurrency(income.grossWeekly);
    document.getElementById('grossHourly').textContent  = formatCurrency(income.grossHourly);
    document.getElementById('netAnnual').textContent    = formatCurrency(income.netAnnual);
    document.getElementById('netMonthly').textContent   = formatCurrency(income.netMonthly);
    document.getElementById('netBiWeekly').textContent  = formatCurrency(income.netBiWeekly);
    document.getElementById('netWeekly').textContent    = formatCurrency(income.netWeekly);
    document.getElementById('netHourly').textContent    = formatCurrency(income.netHourly);
    // Calculate expenses and remaining income
    const expenses = calculateExpenses();
    document.getElementById('totalExpenses').textContent = formatCurrency(expenses);
    const remaining = income.netMonthly - expenses;
    document.getElementById('remainingIncome').textContent = formatCurrency(remaining);
}

/**
 * Format a number as currency with two decimal places.
 * @param {number} num The number to format.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(num) {
    if (!isFinite(num)) return '$0.00';
    return '$' + num.toFixed(2);
}

/**
 * Show or hide input groups based on selected income type.
 */
function toggleIncomeInputs() {
    const salaryInputs = document.getElementById('salaryInputs');
    const hourlyInputs = document.getElementById('hourlyInputs');
    if (document.getElementById('salaryRadio').checked) {
        salaryInputs.classList.remove('hidden');
        hourlyInputs.classList.add('hidden');
    } else {
        salaryInputs.classList.add('hidden');
        hourlyInputs.classList.remove('hidden');
    }
    recalculate();
}

/**
 * Toggle visibility of property tax input based on housing type selection.
 */
function togglePropertyTax() {
    const housingType = document.getElementById('housingType').value;
    const propertyLabel = document.getElementById('propertyTaxLabel');
    const propertyInput = document.getElementById('propertyTax');
    if (housingType === 'mortgage') {
        propertyLabel.classList.remove('hidden');
        propertyInput.classList.remove('hidden');
    } else {
        propertyLabel.classList.add('hidden');
        propertyInput.classList.add('hidden');
    }
    recalculate();
}

/**
 * Toggle travel sections when checkboxes are selected/deselected.
 */
function toggleTravelSections() {
    const vehicleSection = document.getElementById('vehicleSection');
    const publicSection  = document.getElementById('publicTransportSection');
    const rideSection    = document.getElementById('rideShareSection');
    const miscSection    = document.getElementById('miscTravelSection');
    vehicleSection.classList.toggle('hidden', !document.getElementById('vehicleCheckbox').checked);
    publicSection.classList.toggle('hidden', !document.getElementById('publicTransportCheckbox').checked);
    rideSection.classList.toggle('hidden', !document.getElementById('rideShareCheckbox').checked);
    miscSection.classList.toggle('hidden', !document.getElementById('miscTravelCheckbox').checked);
    recalculate();
}

// Set up the page once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    populateStates();
    // Set event listeners for income type radios
    document.getElementById('salaryRadio').addEventListener('change', toggleIncomeInputs);
    document.getElementById('hourlyRadio').addEventListener('change', toggleIncomeInputs);
    // Housing type change
    document.getElementById('housingType').addEventListener('change', togglePropertyTax);
    // Travel checkboxes
    document.getElementById('vehicleCheckbox').addEventListener('change', toggleTravelSections);
    document.getElementById('publicTransportCheckbox').addEventListener('change', toggleTravelSections);
    document.getElementById('rideShareCheckbox').addEventListener('change', toggleTravelSections);
    document.getElementById('miscTravelCheckbox').addEventListener('change', toggleTravelSections);
    // Attach recalculate listeners to all inputs and selects
    document.querySelectorAll('input, select').forEach(el => {
        if (el.type !== 'radio' && el.type !== 'button' && el.type !== 'checkbox') {
            el.addEventListener('input', recalculate);
        }
        if (el.tagName.toLowerCase() === 'select' && el.id !== 'autoInsurancePeriod') {
            // For selects (except insurance period which is handled via input event)
            el.addEventListener('change', recalculate);
        }
    });
    // Insurance period also triggers recalc
    document.getElementById('autoInsurancePeriod').addEventListener('change', recalculate);
    // Checkboxes recalc is handled in toggleTravelSections which calls recalculate.
    // Initial display
    toggleIncomeInputs();
    togglePropertyTax();
    toggleTravelSections();
    recalculate();
});