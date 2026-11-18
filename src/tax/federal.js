import { byStatus, progressiveTax, marginalRate } from './helpers.js';

/**
 * Federal overtime deduction (OBBBA, tax years 2025-2028).
 * Only the FLSA premium portion of overtime pay counts, capped and phased
 * out by income.
 */
export function overtimeDeduction(premium, agi, status, rules) {
    if (!rules || premium <= 0) return 0;
    const max = byStatus(rules.max, status) ?? 0;
    const start = byStatus(rules.phaseoutStart, status) ?? Infinity;
    const reduction = agi > start ? ((agi - start) / 1000) * (rules.phaseoutPerThousand ?? 0) : 0;
    return Math.max(0, Math.min(premium, max - reduction));
}

/**
 * Child Tax Credit split into the part that offsets tax and the
 * refundable part (Additional CTC). Both lower what you owe.
 */
export function childTaxCredit({ children, agi, earnedIncome, taxBeforeCredits, status }, rules) {
    if (!rules || children <= 0) return { nonrefundable: 0, refundable: 0, total: 0 };
    const start = byStatus(rules.phaseoutStart, status) ?? Infinity;
    const excessThousands = agi > start ? Math.ceil((agi - start) / 1000) : 0;
    const credit = Math.max(0, children * rules.perChild - excessThousands * rules.phaseoutPerThousand);

    const nonrefundable = Math.min(credit, Math.max(0, taxBeforeCredits));
    const leftover = credit - nonrefundable;
    const earnedLimit = Math.max(0, (earnedIncome - rules.refundableEarnedIncomeFloor) * rules.refundableRate);
    const refundable = Math.min(leftover, children * rules.refundablePerChild, earnedLimit);

    return { nonrefundable, refundable, total: nonrefundable + refundable };
}

/**
 * FICA: Social Security (capped at the wage base), Medicare, and the 0.9%
 * Additional Medicare Tax above the filing-status threshold.
 */
export function ficaTaxes(ficaWages, status, fica) {
    const wages = Math.max(0, ficaWages);
    const socialSecurity = Math.min(wages, fica.socialSecurity.wageBase) * fica.socialSecurity.rate;
    const medicare = wages * fica.medicare.rate;
    const threshold = byStatus(fica.additionalMedicare.threshold, status) ?? Infinity;
    const additionalMedicare = Math.max(0, wages - threshold) * fica.additionalMedicare.rate;
    return { socialSecurity, medicare, additionalMedicare };
}

/**
 * @param {object} input
 * @param {number} input.wages           gross annual wages
 * @param {number} input.pretaxRetirement 401(k)/403(b) deferrals (income-tax free, FICA taxable)
 * @param {number} input.pretaxHealth     Section 125 health/HSA (income-tax and FICA free)
 * @param {number} input.overtimePremium  FLSA overtime premium eligible for the deduction
 * @param {string} input.status           single | married | head | separate
 * @param {number} input.dependents       qualifying children under 17
 * @param {object} federal                contents of src/data/<year>/federal.json
 */
export function calculateFederal(input, federal) {
    const {
        wages = 0,
        pretaxRetirement = 0,
        pretaxHealth = 0,
        overtimePremium = 0,
        status = 'single',
        dependents = 0
    } = input;

    const agi = Math.max(0, wages - pretaxRetirement - pretaxHealth);
    const standardDeduction = byStatus(federal.incomeTax.standardDeduction, status) ?? 0;
    const overtime = overtimeDeduction(overtimePremium, agi, status, federal.overtimeDeduction);
    const taxableIncome = Math.max(0, agi - standardDeduction - overtime);

    const brackets = byStatus(federal.incomeTax.brackets, status);
    const taxBeforeCredits = progressiveTax(taxableIncome, brackets);
    const ctc = childTaxCredit({
        children: dependents,
        agi,
        earnedIncome: wages,
        taxBeforeCredits,
        status
    }, federal.childTaxCredit);

    const incomeTax = taxBeforeCredits - ctc.total; // can go negative (refundable credit)
    const fica = ficaTaxes(wages - pretaxHealth, status, federal.fica);

    return {
        agi,
        standardDeduction,
        overtimeDeduction: overtime,
        taxableIncome,
        taxBeforeCredits,
        childTaxCredit: ctc.total,
        incomeTax,
        marginalRate: marginalRate(taxableIncome, brackets),
        ...fica
    };
}
