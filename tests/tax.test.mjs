// Run with: npm test   (uses Node's built-in test runner, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

import { progressiveTax, applyLimits, byStatus, resolveAmount, FILING_STATUSES } from '../src/tax/helpers.js';
import { calculateFederal } from '../src/tax/federal.js';
import { calculateState } from '../src/tax/state.js';
import { calculateIncome, grossPay } from '../src/income.js';
import { calculateExpenses } from '../src/expenses.js';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = readJson('../src/data/index.json');
const federal2026 = readJson('../src/data/2026/federal.json');
const states2026 = readJson('../src/data/2026/states.json').states;
const taxData = { federal: federal2026, states: states2026 };

const close = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 0.01, `${msg ?? ''} expected ${expected}, got ${actual}`);

test('progressiveTax handles plain and base-tax brackets', () => {
    close(progressiveTax(15000, [[0, 0.1], [10000, 0.2]]), 2000);
    close(progressiveTax(0, [[0, 0.1]]), 0);
    // Ohio-style "$332 plus 2.75% of the excess over $26,050"
    close(progressiveTax(57850, [[0, 0], [26050, 0.0275, 332]]), 332 + 0.0275 * 31800);
});

test('applyLimits: linear end, per-dollar rate, floor and cliff', () => {
    const ctx = income => ({ status: 'single', income });
    close(applyLimits(15000, { phaseout: { start: 40000, end: 95000 } }, ctx(67500)), 7500);
    close(applyLimits(15000, { phaseout: { start: 30000, rate: 1 } }, ctx(35000)), 10000);
    close(applyLimits(3000, { phaseout: { start: 23000, rate: 0.05, floor: 2500 } }, ctx(50000)), 2500);
    close(applyLimits(2925, { maxIncome: 250000 }, ctx(250001)), 0);
});

test('byStatus / resolveAmount fall back to single', () => {
    assert.equal(byStatus({ single: 1, married: 2 }, 'head'), 1);
    assert.equal(resolveAmount({ byIncome: [[40000, 2400], [null, 1900]] }, { status: 'single', income: 90000 }), 1900);
});

test('federal 2026: single $75k', () => {
    const r = calculateFederal({ wages: 75000, status: 'single' }, federal2026);
    close(r.taxableIncome, 58900);
    close(r.incomeTax, 7670);
    close(r.socialSecurity, 4650);
    close(r.medicare, 1087.5);
    close(r.additionalMedicare, 0);
});

test('federal 2026: Social Security caps at the wage base, Additional Medicare kicks in', () => {
    const r = calculateFederal({ wages: 300000, status: 'single' }, federal2026);
    close(r.socialSecurity, 184500 * 0.062);
    close(r.additionalMedicare, 100000 * 0.009);
});

test('federal 2026: child tax credit can be partly refundable', () => {
    const r = calculateFederal({ wages: 60000, status: 'married', dependents: 2 }, federal2026);
    close(r.taxBeforeCredits, 2840);
    close(r.childTaxCredit, 4400);
    close(r.incomeTax, -1560);
});

test('federal 2026: pre-tax deductions', () => {
    const r = calculateFederal({ wages: 80000, pretaxRetirement: 5000, pretaxHealth: 3000, status: 'single' }, federal2026);
    close(r.agi, 72000);
    close(r.socialSecurity, 77000 * 0.062, '401k is FICA-taxable, Sec. 125 is not');
});

test('hourly pay + overtime premium', () => {
    const pay = grossPay({ payType: 'hourly', hourlyWage: 30, hoursPerWeek: 40, overtimeHours: 10, overtimeMultiplier: 1.5 });
    close(pay.gross, 85800);
    close(pay.overtimePremium, 7800);
    const r = calculateFederal({ wages: pay.gross, overtimePremium: pay.overtimePremium, status: 'single' }, federal2026);
    close(r.overtimeDeduction, 7800);
});

test('California single $75k (brackets + exemption credit + SDI)', () => {
    const fed = calculateFederal({ wages: 75000, status: 'single' }, federal2026);
    const r = calculateState({ wages: 75000, status: 'single' }, states2026.CA, fed);
    close(r.taxableIncome, 69100);
    close(r.incomeTax, 2823.12 - 158);
    close(r.payrollTotal, 975);
});

test('Ohio uses income-tiered exemptions and the $332 base', () => {
    const r = calculateState({ wages: 60000, status: 'single' }, states2026.OH, {});
    close(r.taxableIncome, 57850);
    close(r.incomeTax, 332 + 0.0275 * 31800);
});

test('Missouri deducts part of federal tax; Alabama deducts all of it', () => {
    const fed = calculateFederal({ wages: 75000, status: 'single' }, federal2026);
    const mo = calculateState({ wages: 75000, status: 'single' }, states2026.MO, fed);
    close(mo.federalTaxDeduction, 7670 * 0.15);
    const al = calculateState({ wages: 75000, status: 'single' }, states2026.AL, fed);
    close(al.federalTaxDeduction, 7670);
});

test('No-income-tax states still apply payroll programs', () => {
    const tx = calculateState({ wages: 75000, status: 'single' }, states2026.TX, {});
    assert.equal(tx.incomeTax, 0);
    const wa = calculateState({ wages: 75000, status: 'single' }, states2026.WA, {});
    assert.equal(wa.incomeTax, 0);
    close(wa.payrollTotal, 75000 * (0.00807 + 0.0058));
});

test('Pennsylvania taxes 401(k) contributions', () => {
    const r = calculateState({ wages: 60000, pretaxRetirement: 6000, status: 'single' }, states2026.PA, {});
    close(r.incomeTax, 60000 * 0.0307);
});

test('calculateIncome wires everything together', () => {
    const r = calculateIncome({
        payType: 'salary', annualSalary: 75000, filingStatus: 'single', state: 'TX', dependents: 0
    }, taxData);
    close(r.taxes.total, 7670 + 4650 + 1087.5);
    close(r.netAnnual, 75000 - 13407.5);
    assert.equal(r.periods.find(p => p.key === 'biWeekly').perYear, 26);
});

test('expenses: mortgage property tax, insurance period, disabled travel groups', () => {
    const e = calculateExpenses({
        housingAmount: 1500, housingType: 'mortgage', propertyTax: 300, housingExtras: [50],
        utilitiesBase: 200, utilitiesExtras: [],
        vehicle: { enabled: true, payment: 400, fuel: 100, insurance: 600, insurancePeriodMonths: 6, extras: [] },
        publicTransport: { enabled: false, extras: [999] },
        food: 500, additional: [25, 25]
    });
    close(e.housingTotal, 1850);
    close(e.vehicleTotal, 600);
    close(e.publicTotal, 0);
    close(e.total, 1850 + 200 + 600 + 500 + 50);
});

// ---- Data file sanity checks ------------------------------------------------

const yearDirs = readdirSync(new URL('../src/data/', import.meta.url), { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(new URL(`../src/data/${d.name}/states.json`, import.meta.url)))
    .map(d => Number(d.name));

test('manifest lists exactly the years that have data', () => {
    assert.deepEqual([...manifest.years].sort(), [...yearDirs].sort());
    assert.ok(manifest.years.includes(manifest.defaultYear));
});

for (const year of yearDirs) {
    const states = readJson(`../src/data/${year}/states.json`).states;
    const federal = readJson(`../src/data/${year}/federal.json`);

    test(`${year}: has all 50 states + DC`, () => {
        assert.equal(Object.keys(states).length, 51);
    });

    test(`${year}: every bracket table starts at 0, ascends, and uses sane rates`, () => {
        const tables = [['federal', federal.incomeTax.brackets]];
        for (const [abbr, s] of Object.entries(states)) {
            if (s.type !== 'none') {
                assert.ok(s.brackets, `${abbr} needs brackets`);
                tables.push([abbr, s.brackets]);
            }
            assert.ok(['verified', 'estimated'].includes(s.confidence), `${abbr} confidence`);
        }
        for (const [label, spec] of tables) {
            for (const status of FILING_STATUSES) {
                const brackets = byStatus(spec, status);
                assert.ok(Array.isArray(brackets), `${label}/${status}`);
                assert.equal(brackets[0][0], 0, `${label}/${status} first bracket`);
                brackets.forEach(([over, rate], i) => {
                    assert.ok(rate >= 0 && rate < 0.4, `${label}/${status} rate ${rate}`);
                    if (i > 0) assert.ok(over > brackets[i - 1][0], `${label}/${status} ascending at ${over}`);
                });
            }
        }
    });

    test(`${year}: every state produces finite, non-negative results`, () => {
        const td = { federal, states };
        for (const abbr of Object.keys(states)) {
            for (const status of FILING_STATUSES) {
                for (const wages of [0, 15000, 52000, 98000, 250000, 1500000]) {
                    const r = calculateIncome({ payType: 'salary', annualSalary: wages, filingStatus: status, state: abbr, dependents: 2 }, td);
                    assert.ok(Number.isFinite(r.netAnnual), `${abbr}/${status}/${wages}`);
                    assert.ok(r.taxes.stateIncome >= 0, `${abbr}/${status}/${wages} state tax`);
                    assert.ok(r.taxes.stateIncome < wages * 0.15 + 1, `${abbr}/${status}/${wages} state tax too high`);
                }
            }
        }
    });
}
