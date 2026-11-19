# Payroll Calculator
A simple, dynamic calculator for your payroll and monthly expenses.

[View Online](https//richnsd.github.io/payroll-calculator)

Enter a salary or hourly wage, pick your state and filing status, and see your take-home pay for every pay period. Then list your monthly bills to see what's left over. Everything auto-saves to your device, and the app works offline once it's installed as a PWA.

> [!NOTE]
> **2.0 overhaul complete.** Version 1 was vibe-coded in two ChatGPT prompts and never looked at again. Among other things, it charged every state's *top* tax rate on your *entire* salary: a single Californian making $75k got billed $10,800 in state tax instead of about $2,665. 🫩 This version was rebuilt from the ground up with Claude. See [`CHANGELOG.md`](CHANGELOG.md) for the full list of changes.

## What it calculates

| | |
|---|---|
| **Federal income tax** | 2026 brackets and standard deduction, Child Tax Credit (incl. the refundable part), and the new "no tax on overtime" deduction for hourly workers |
| **FICA** | Social Security (capped at the $184,500 wage base), Medicare, and the 0.9% Additional Medicare Tax |
| **State income tax** | All 50 states + DC, with real brackets, standard deductions, exemptions, credits, and quirks (Alabama's federal tax deduction, Ohio's base-tax table, Wisconsin's sliding deduction, etc.) |
| **State payroll programs** | SDI and paid-leave deductions such as CA SDI, NY PFL, NJ TDI/FLI, WA PFML + WA Cares, and MA/OR/CO/CT/MN/ME/DE/RI programs |
| **Local tax** | Optional city/county rate (NYC, Maryland counties, Ohio cities, PA EIT…) |
| **Pre-tax deductions** | 401(k)/403(b) and health/HSA/FSA, each handled correctly for FICA and state tax |
| **Expenses** | Housing, utilities, travel, food, and unlimited custom line items |

It's an **estimate**, not tax advice: it assumes the standard deduction and doesn't model itemizing or every phase-out. States whose 2026 numbers are partly estimated show a yellow "Some figures estimated" badge with an explanation.

## Running it

The app is plain HTML, CSS, and JavaScript modules with no build step. Browsers won't load modules or JSON from `file://`, though, so double-clicking `index.html` won't work. Serve the folder instead:

```bash
npm start            # = python3 -m http.server 8080, then open http://localhost:8080
```

Any static host (GitHub Pages, Netlify, etc.) works as-is.

## Running the tests

```bash
npm test
```

This uses Node's built-in test runner (Node 18+, no `npm install` needed). The tests cover the tax engine with hand-checked examples and sanity-check every state in every data file.

## Project layout

```
index.html                 Page markup
styles/main.css            Styles (dark/light theme tokens at the top)
sw.js                      Service worker (offline support; not the auto-save)
manifest.webmanifest       PWA install info
assets/                    Icons
src/
├── app.js                 Entry point: wires the form to the calculators
├── income.js              Gross pay → taxes → take-home for each pay period
├── expenses.js            Monthly expense totals
├── storage.js             Auto-save (localStorage)
├── dataLoader.js          Loads the JSON tax data for a year
├── tax/
│   ├── helpers.js         Brackets, phase-outs, filing-status lookups
│   ├── federal.js         Federal income tax, CTC, overtime deduction, FICA
│   └── state.js           Generic state engine driven entirely by states.json
├── ui/                    DOM helpers, formatting, rendering, custom expense rows
└── data/                  Tax data by year; see src/data/README.md
tests/                     node:test suite
```

The calculation modules (`income.js`, `expenses.js`, `src/tax/*`) never touch the DOM, which is what makes them testable.

## Updating tax numbers each year

All rates live in `src/data/<year>/*.json`. No code changes are needed. [`src/data/README.md`](src/data/README.md) has the field reference and a step-by-step checklist for adding a new year.

## Roadmap ideas
- [ ] Fill in `src/data/2027/` once the IRS and states publish 2027 numbers
- [ ] Re-verify the "estimated" states once final 2026 forms come out
- [ ] Optional itemized deductions
- [ ] Separate wages per spouse for married filing jointly (for the Social Security cap)

## License
MIT
