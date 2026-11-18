// Number parsing/formatting shared by the UI.

/** Turn user-typed text like "$75,000.50" into a number (0 if not a number). */
export function parseNumber(value) {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

export function formatCurrency(num) {
    return currencyFormatter.format(Number.isFinite(num) ? num : 0);
}

export function formatPercent(value, digits = 1) {
    if (!Number.isFinite(value)) return '0%';
    return `${(value * 100).toFixed(digits)}%`;
}

/** Rates in the data files are fractions; show 0.0535 as "5.35%". */
export function formatRate(rate) {
    if (!Number.isFinite(rate)) return '0%';
    return `${parseFloat((rate * 100).toFixed(3))}%`;
}

/**
 * Pretty-print an input in place on blur.
 * data-format="currency" → "1,234.50"; data-format="number" → "40" / "1.5"
 */
export function formatInputValue(input) {
    if (!input || input.value.trim() === '') return;
    const value = parseNumber(input.value);
    const isCurrency = input.dataset.format === 'currency';
    input.value = value.toLocaleString('en-US', {
        minimumFractionDigits: isCurrency ? 2 : 0,
        maximumFractionDigits: 2
    });
}
