// Gross pay + take-home math. Pure functions: no DOM access.

import { calculateFederal } from './tax/federal.js';
import { calculateState } from './tax/state.js';

export const WEEKS_PER_YEAR = 52;
export const DEFAULT_SALARY_HOURS = 40;
export const FLSA_OVERTIME_MULTIPLIER = 1.5;

export const PAY_PERIODS = [
    { key: 'monthly', label: 'Monthly', perYear: 12 },
    { key: 'semiMonthly', label: 'Semi-monthly', perYear: 24 },
    { key: 'biWeekly', label: 'Bi-weekly', perYear: 26 },
    { key: 'weekly', label: 'Weekly', perYear: 52 }
];

/**
 * Work out annual gross pay from the income inputs.
 * Returns the FLSA overtime premium separately because the federal
 * overtime deduction only applies to that "extra half".
 */
export function grossPay({ payType, annualSalary, hourlyWage, hoursPerWeek, overtimeHours, overtimeMultiplier }) {
    if (payType === 'salary') {
        return {
            gross: Math.max(0, annualSalary),
            hoursWorked: DEFAULT_SALARY_HOURS * WEEKS_PER_YEAR,
            overtimePremium: 0
        };
    }

    const wage = Math.max(0, hourlyWage);
    const regular = Math.max(0, hoursPerWeek);
    const overtime = Math.max(0, overtimeHours);
    const multiplier = overtimeMultiplier > 0 ? overtimeMultiplier : FLSA_OVERTIME_MULTIPLIER;

    const gross = (wage * regular + wage * multiplier * overtime) * WEEKS_PER_YEAR;
    // Only the FLSA-required premium (up to 0.5x) qualifies; double-time's extra doesn't.
    const premiumRate = Math.min(Math.max(multiplier - 1, 0), FLSA_OVERTIME_MULTIPLIER - 1);
    const overtimePremium = wage * premiumRate * overtime * WEEKS_PER_YEAR;

    return {
        gross,
        hoursWorked: (regular + overtime) * WEEKS_PER_YEAR,
        overtimePremium
    };
}

/**
 * Full paycheck estimate.
 * @param {object} inputs   values read from the form (see app.js readInputs)
 * @param {object} taxData  { federal, states } for the selected year
 */
export function calculateIncome(inputs, taxData) {
    const { gross, hoursWorked, overtimePremium } = grossPay(inputs);
    const status = inputs.filingStatus || 'single';
    const dependents = Math.max(0, Math.floor(inputs.dependents || 0));

    // Pre-tax deductions can't exceed pay.
    const pretaxHealth = Math.min(Math.max(0, inputs.pretaxHealth || 0), gross);
    const pretaxRetirement = Math.min(Math.max(0, inputs.pretaxRetirement || 0), gross - pretaxHealth);

    const taxInput = { wages: gross, pretaxRetirement, pretaxHealth, overtimePremium, status, dependents };
    const federal = calculateFederal(taxInput, taxData.federal);
    const stateData = taxData.states?.[inputs.state];
    const state = calculateState(taxInput, stateData, federal);

    const localRate = Math.max(0, inputs.localTaxRate || 0) / 100;
    // Simplification: most local wage taxes are a flat % of (roughly) taxable wages.
    const localTax = Math.max(0, gross - pretaxHealth - pretaxRetirement) * localRate;

    const taxes = {
        federalIncome: federal.incomeTax,
        stateIncome: state.incomeTax,
        local: localTax,
        socialSecurity: federal.socialSecurity,
        medicare: federal.medicare + federal.additionalMedicare,
        additionalMedicare: federal.additionalMedicare,
        statePayroll: state.payrollTotal,
        statePayrollItems: state.payrollTaxes
    };
    taxes.total = taxes.federalIncome + taxes.stateIncome + taxes.local
        + taxes.socialSecurity + taxes.medicare + taxes.statePayroll;

    const pretaxTotal = pretaxHealth + pretaxRetirement;
    const netAnnual = gross - pretaxTotal - taxes.total;

    const periods = PAY_PERIODS.map(period => ({
        ...period,
        gross: gross / period.perYear,
        net: netAnnual / period.perYear
    }));
    periods.push({
        key: 'hourly',
        label: 'Hourly',
        perYear: hoursWorked,
        gross: hoursWorked > 0 ? gross / hoursWorked : 0,
        net: hoursWorked > 0 ? netAnnual / hoursWorked : 0
    });

    return {
        grossAnnual: gross,
        netAnnual,
        netMonthly: netAnnual / 12,
        pretax: { health: pretaxHealth, retirement: pretaxRetirement, total: pretaxTotal },
        taxes,
        periods,
        federal,
        state,
        effectiveTaxRate: gross > 0 ? taxes.total / gross : 0
    };
}
