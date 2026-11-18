// Writes calculation results into the page.

import { byId, setText, setHidden, el } from './dom.js';
import { formatCurrency, formatPercent, formatRate } from './format.js';

const STATUS_LABELS = {
    single: 'single',
    married: 'married filing jointly',
    separate: 'married filing separately',
    head: 'head of household'
};

export function populateYears(years, selected) {
    const select = byId('taxYear');
    if (!select) return;
    select.replaceChildren(...years.map(year => {
        const option = el('option', { text: String(year) });
        option.value = String(year);
        return option;
    }));
    select.value = String(selected);
    select.disabled = years.length < 2;
}

export function populateStates(states, selected) {
    const select = byId('stateSelect');
    if (!select) return;
    const entries = Object.entries(states).sort(([, a], [, b]) => a.name.localeCompare(b.name));
    select.replaceChildren(...entries.map(([abbr, state]) => {
        const option = el('option', { text: state.name });
        option.value = abbr;
        return option;
    }));
    if (selected && states[selected]) select.value = selected;
}

function pillRow(label, amount, { className, note } = {}) {
    const row = el('div', { className: `pill-row${className ? ` ${className}` : ''}` });
    const dt = el('dt', { text: label });
    if (note) dt.appendChild(el('span', { className: 'row-note', text: note }));
    row.append(dt, el('dd', { text: formatCurrency(amount) }));
    return row;
}

export function renderIncome(result) {
    const { taxes, pretax } = result;

    setText('grossAnnual', formatCurrency(result.grossAnnual));
    setText('netAnnual', formatCurrency(result.netAnnual));
    setText('netMonthly', formatCurrency(result.netMonthly));
    setText('effectiveTaxRate', `Effective tax rate: ${formatPercent(result.effectiveTaxRate)}`);

    byId('incomeTableBody')?.replaceChildren(...result.periods.map(period => {
        const tr = el('tr');
        tr.append(
            el('td', { text: period.label }),
            el('td', { text: formatCurrency(period.gross) }),
            el('td', { text: formatCurrency(period.net) })
        );
        return tr;
    }));

    const rows = [];
    let federalNote;
    if (result.federal.childTaxCredit > 0) {
        federalNote = `after ${formatCurrency(result.federal.childTaxCredit)} child tax credit`;
    } else if (result.federal.taxableIncome > 0) {
        federalNote = `${formatRate(result.federal.marginalRate)} bracket`;
    }
    rows.push(pillRow('Federal income tax', taxes.federalIncome, { note: federalNote }));
    const stateNote = result.state.taxableIncome > 0 ? `${formatRate(result.state.marginalRate)} bracket` : undefined;
    rows.push(pillRow('State income tax', taxes.stateIncome, { note: stateNote }));
    if (taxes.local > 0) rows.push(pillRow('Local income tax', taxes.local));
    rows.push(pillRow('Social Security', taxes.socialSecurity, { note: '6.2%' }));
    rows.push(pillRow('Medicare', taxes.medicare,
        { note: taxes.additionalMedicare > 0 ? '1.45% + 0.9% additional' : '1.45%' }));
    taxes.statePayrollItems.forEach(item => rows.push(pillRow(item.label, item.amount, { note: formatRate(item.rate) })));
    rows.push(pillRow('Total annual taxes', taxes.total, { className: 'total' }));
    if (pretax.total > 0) rows.push(pillRow('Pre-tax deductions', pretax.total, { className: 'muted', note: '401(k), health, HSA' }));

    byId('deductionList')?.replaceChildren(...rows);

    setText('calcGrossAnnual', formatCurrency(result.grossAnnual));
    setText('calcPretax', formatCurrency(pretax.total));
    setText('calcTotalTax', formatCurrency(taxes.total));
    setText('calcNetAnnual', formatCurrency(result.netAnnual));
    setText('calcNetMonthly', formatCurrency(result.netMonthly));
}

export function renderExpenses(expenses) {
    const map = {
        housingTotal: expenses.housingTotal,
        utilitiesTotal: expenses.utilitiesTotal,
        vehicleTotal: expenses.vehicleTotal,
        publicTransportTotal: expenses.publicTotal,
        rideShareTotal: expenses.rideShareTotal,
        miscTravelTotal: expenses.miscTravelTotal,
        travelTotal: expenses.travelTotal,
        foodTotal: expenses.foodTotal,
        additionalTotal: expenses.additionalTotal,
        totalExpenses: expenses.total,
        calcExpenses: expenses.total
    };
    Object.entries(map).forEach(([id, value]) => setText(id, formatCurrency(value)));
}

export function renderLeftover(amount) {
    const text = formatCurrency(amount);
    setText('remainingIncome', text);
    setText('calcLeftover', text);
    byId('remainingIncome')?.classList.toggle('negative', amount < 0);
    byId('remainingIncome')?.classList.toggle('positive', amount >= 0);
}

export function renderStateInfo(state, status, year) {
    if (!state) return;
    setText('stateInfoTitle', `${state.name} · ${year} · ${STATUS_LABELS[status] || status}`);

    const badge = byId('stateConfidence');
    if (badge) {
        const estimated = state.confidence === 'estimated';
        badge.textContent = estimated ? 'Some figures estimated' : 'Verified';
        badge.classList.toggle('badge-warn', estimated);
        badge.title = estimated
            ? 'Some figures here are inflation-indexed estimates or come from sources that disagree. See the notes.'
            : 'Figures match published state guidance.';
    }

    const notes = [];
    if (state.type === 'none') notes.push('No state income tax on wages.');
    (state.notes || []).forEach(note => notes.push(note));
    if (state.localTaxNote) notes.push(`Local taxes: ${state.localTaxNote} Add a rate under "Pre-tax deductions & local tax".`);
    byId('stateNotes')?.replaceChildren(...notes.map(text => el('li', { text })));
}

export function renderDataInfo(taxData) {
    setText('dataYearLabel', String(taxData.year));
    setText('dataReviewed', taxData.federal.lastReviewed || '—');
}

export function showError(message) {
    const box = byId('loadError');
    if (!box) return;
    box.textContent = message;
    setHidden(box, !message);
}
