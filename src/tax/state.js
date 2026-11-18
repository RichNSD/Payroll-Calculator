import {
    byStatus,
    resolveAmount,
    applyLimits,
    progressiveTax,
    marginalRate,
    filerCount
} from './helpers.js';

function standardDeduction(rule, ctx, federalStandardDeduction) {
    if (rule === undefined || rule === null) return 0;
    if (rule === 'federal') return federalStandardDeduction;
    // Rule object: { amount, phaseout? }. Anything else is a plain amount.
    if (typeof rule === 'object' && 'amount' in rule) {
        return applyLimits(resolveAmount(rule.amount, ctx), rule, ctx);
    }
    return resolveAmount(rule, ctx);
}

function personalExemption(rule, ctx) {
    if (!rule) return 0;
    const base = rule.amount !== undefined
        ? resolveAmount(rule.amount, ctx)
        : resolveAmount(rule.perPerson, ctx) * filerCount(ctx.status);
    return applyLimits(base, rule, ctx);
}

function dependentExemption(rule, ctx, dependents) {
    if (!rule || dependents <= 0) return 0;
    return applyLimits(resolveAmount(rule.perPerson, ctx) * dependents, rule, ctx);
}

function federalTaxDeduction(rule, ctx, federalIncomeTax) {
    if (!rule || federalIncomeTax <= 0) return 0;
    let amount = federalIncomeTax;
    if (Array.isArray(rule.percentByIncome)) {
        const tier = rule.percentByIncome.find(([upTo]) => upTo === null || ctx.income <= upTo);
        amount *= tier ? tier[1] : 0;
    }
    const cap = byStatus(rule.cap, ctx.status);
    if (typeof cap === 'number') amount = Math.min(amount, cap);
    return applyLimits(amount, rule, ctx);
}

function credits(list, ctx, dependents) {
    if (!Array.isArray(list)) return 0;
    return list.reduce((sum, credit) => {
        const base = resolveAmount(credit.amount, ctx)
            + resolveAmount(credit.perPerson, ctx) * filerCount(ctx.status)
            + resolveAmount(credit.perDependent, ctx) * dependents;
        return sum + applyLimits(base, credit, ctx);
    }, 0);
}

/** Employee-paid state payroll programs (SDI, paid family leave, etc.). */
export function statePayrollTaxes(list, wages) {
    if (!Array.isArray(list)) return [];
    return list.map(item => {
        const taxable = Math.min(Math.max(0, wages), item.wageBase ?? Infinity);
        let amount = taxable * item.rate;
        if (typeof item.maxAnnual === 'number') amount = Math.min(amount, item.maxAnnual);
        return { label: item.label, rate: item.rate, amount };
    });
}

/**
 * @param {object} input  same shape as calculateFederal's input
 * @param {object} state  one entry from states.json (may be undefined)
 * @param {object} federalResult  { standardDeduction, incomeTax } from calculateFederal
 */
export function calculateState(input, state, federalResult = {}) {
    const {
        wages = 0,
        pretaxRetirement = 0,
        pretaxHealth = 0,
        status = 'single',
        dependents = 0
    } = input;

    const empty = {
        income: 0,
        standardDeduction: 0,
        exemptions: 0,
        federalTaxDeduction: 0,
        taxableIncome: 0,
        taxBeforeCredits: 0,
        credits: 0,
        incomeTax: 0,
        marginalRate: 0,
        payrollTaxes: [],
        payrollTotal: 0
    };
    if (!state) return empty;

    const payrollTaxes = statePayrollTaxes(state.payrollTaxes, wages - pretaxHealth);
    const payrollTotal = payrollTaxes.reduce((sum, item) => sum + item.amount, 0);

    if (state.type === 'none' || !state.brackets) {
        return { ...empty, payrollTaxes, payrollTotal };
    }

    const retirementExcluded = state.taxesRetirementContributions ? 0 : pretaxRetirement;
    const income = Math.max(0, wages - pretaxHealth - retirementExcluded);
    const ctx = { status, income };

    const stdDed = standardDeduction(state.standardDeduction, ctx, federalResult.standardDeduction ?? 0);
    const exemptions = personalExemption(state.personalExemption, ctx)
        + dependentExemption(state.dependentExemption, ctx, dependents);
    const fedDeduction = federalTaxDeduction(state.federalTaxDeduction, ctx, federalResult.incomeTax ?? 0);

    const taxableIncome = Math.max(0, income - stdDed - exemptions - fedDeduction);
    const brackets = byStatus(state.brackets, status);
    const taxBeforeCredits = progressiveTax(taxableIncome, brackets);
    const creditTotal = Math.min(taxBeforeCredits, credits(state.credits, ctx, dependents));

    return {
        income,
        standardDeduction: stdDed,
        exemptions,
        federalTaxDeduction: fedDeduction,
        taxableIncome,
        taxBeforeCredits,
        credits: creditTotal,
        incomeTax: taxBeforeCredits - creditTotal,
        marginalRate: marginalRate(taxableIncome, brackets),
        payrollTaxes,
        payrollTotal
    };
}
