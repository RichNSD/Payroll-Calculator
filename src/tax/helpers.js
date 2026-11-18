// Shared building blocks for reading the tax data files.
// Everything in src/tax is pure (no DOM), so it can be unit tested in Node.

export const FILING_STATUSES = ['single', 'married', 'head', 'separate'];

const STATUS_FALLBACK = { head: 'single', separate: 'single', married: 'single', single: 'single' };

function isStatusMap(value) {
    return value !== null
        && typeof value === 'object'
        && !Array.isArray(value)
        && FILING_STATUSES.some(key => key in value);
}

/**
 * Pick the value for a filing status.
 * Data files can give either one value for everyone, or a map keyed by status.
 * Missing `head` / `separate` entries fall back to `single`.
 */
export function byStatus(value, status) {
    if (!isStatusMap(value)) return value;
    if (status in value) return value[status];
    return value[STATUS_FALLBACK[status]];
}

/**
 * Resolve an "amount" field: a number, a status map, or
 * `{ byIncome: [[upTo, amount], ..., [null, amount]] }`.
 */
export function resolveAmount(spec, { status, income = 0 }) {
    if (spec === undefined || spec === null) return 0;
    const value = byStatus(spec, status);
    if (typeof value === 'number') return value;
    if (value && Array.isArray(value.byIncome)) {
        for (const [upTo, amount] of value.byIncome) {
            if (upTo === null || income <= upTo) return amount;
        }
        return 0;
    }
    return 0;
}

/**
 * Apply an optional phase-out and/or hard income cliff to an amount.
 *
 * phaseout: { start, end?, rate?, floor? } (each may be a status map)
 *   - with `end`: shrinks linearly from the full amount at `start` to `floor` at `end`
 *   - with `rate`: loses `rate` dollars per dollar of income over `start`, down to `floor`
 * maxIncome: amount drops to 0 once income exceeds this
 */
export function applyLimits(amount, rule, { status, income = 0 }) {
    if (!rule || amount <= 0) return Math.max(0, amount);

    const maxIncome = byStatus(rule.maxIncome, status);
    if (typeof maxIncome === 'number' && income > maxIncome) return 0;

    const phaseout = rule.phaseout;
    if (!phaseout) return amount;

    const start = byStatus(phaseout.start, status) ?? 0;
    const floor = byStatus(phaseout.floor, status) ?? 0;
    if (income <= start) return amount;

    const end = byStatus(phaseout.end, status);
    let reduced;
    if (typeof end === 'number' && end > start) {
        const fraction = Math.min(1, (income - start) / (end - start));
        reduced = amount - (amount - floor) * fraction;
    } else {
        const rate = byStatus(phaseout.rate, status) ?? 0;
        reduced = amount - (income - start) * rate;
    }
    return Math.max(floor, reduced, 0);
}

/**
 * Progressive (bracketed) tax.
 * brackets: [[over, rate], [over, rate, baseTax?], ...] sorted ascending.
 * When a bracket has a `baseTax`, tax within that bracket is
 * baseTax + rate * (income - over), which reproduces statutory tables
 * (e.g. Ohio's "$332 plus 2.75% of the excess over $26,050").
 */
export function progressiveTax(income, brackets) {
    if (!Array.isArray(brackets) || income <= 0) return 0;
    let tax = 0;
    for (let i = 0; i < brackets.length; i++) {
        const [over, rate, baseTax] = brackets[i];
        if (income <= over) break;
        const next = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
        if (typeof baseTax === 'number') tax = baseTax;
        tax += (Math.min(income, next) - over) * rate;
    }
    return tax;
}

/** Highest rate that applies to the given income (useful for display). */
export function marginalRate(income, brackets) {
    if (!Array.isArray(brackets) || brackets.length === 0) return 0;
    let rate = brackets[0][1];
    for (const [over, r] of brackets) {
        if (income > over) rate = r;
    }
    return rate;
}

/** Number of filers covered by a return (for per-person exemptions/credits). */
export function filerCount(status) {
    return status === 'married' ? 2 : 1;
}
