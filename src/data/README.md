# Tax data

All tax numbers live here as JSON, one folder per tax year. The calculator code
never hard-codes a rate, so updating for a new year means editing data, not JavaScript.

```
src/data/
├── index.json          ← which years exist + which one loads by default
├── 2026/
│   ├── federal.json    ← federal brackets, standard deduction, CTC, FICA
│   └── states.json     ← all 50 states + DC
├── 2025/               ← (empty placeholder)
└── 2027/               ← (empty placeholder, fill in once 2027 numbers are published)
```

## Adding a new year

1. Copy `2026/` to `2027/` and update the numbers (sources below).
2. Add the year to `index.json` (`"years": [2026, 2027]`) and bump `defaultYear` when ready.
3. Add the two new JSON files to the `APP_SHELL` list in `/sw.js` and bump `CACHE_VERSION`.
4. Run `npm test`. The data checks will flag missing states, unsorted brackets, wild rates, etc.

The Tax year dropdown in the app enables itself once more than one year is listed.

## Conventions

- **Rates are fractions**: `0.0535` means 5.35%.
- **Filing statuses**: `single`, `married` (filing jointly), `head` (of household), `separate` (married filing separately).
- **Status maps**: almost any value can be either one number for everyone, or an object keyed by status.
  A missing `head` or `separate` key falls back to `single`.

  ```json
  "standardDeduction": 3360
  "standardDeduction": { "single": 12750, "married": 25500, "head": 19125 }
  ```

- **Brackets**: `[[over, rate], ...]`, ascending, starting at `0`. An optional third value is a
  base tax for statutory "$X plus Y% over Z" tables:

  ```json
  "brackets": [[0, 0], [26050, 0.0275, 332]]   // Ohio: $332 + 2.75% over $26,050
  ```

## `states.json` fields

| Field | Meaning |
|---|---|
| `name` | Display name |
| `type` | `"none"`, `"flat"`, or `"graduated"` |
| `confidence` | `"verified"` (matches published guidance) or `"estimated"` (indexed from last year, or sources disagree). Shown as a badge in the UI. |
| `brackets` | Bracket list, or a status map of bracket lists |
| `standardDeduction` | Amount, `"federal"` (use the federal amount; for states that start from federal taxable income), or `{ "amount": ..., "phaseout": ... }` |
| `personalExemption` | `{ "perPerson": amt }` (×2 for joint) **or** `{ "amount": statusMap }` (total per return), plus optional `phaseout` / `maxIncome` |
| `dependentExemption` | `{ "perPerson": amt }` per child, plus optional `phaseout` / `maxIncome` |
| `credits` | List of `{ "label", "amount"?, "perPerson"?, "perDependent"?, "phaseout"?, "maxIncome"? }`. Non-refundable: they can't push tax below 0. |
| `federalTaxDeduction` | For states that let you deduct federal tax (AL, MO, OR). `{}` = deduct all of it; optional `cap`, `percentByIncome: [[upTo, pct], ..., [null, pct]]`, and `phaseout` |
| `payrollTaxes` | Employee-paid programs (SDI, paid leave, etc.): `{ "label", "rate", "wageBase"?, "maxAnnual"? }` |
| `taxesRetirementContributions` | `true` if 401(k) contributions are *not* excluded from state wages (PA) |
| `localTaxNote` | Shown in the UI so people know to enter a city/county rate |
| `notes` | Plain-English notes shown under the state picker |

### Amounts that depend on income

```json
"perPerson": { "byIncome": [[40000, 2400], [80000, 2150], [500000, 1900], [null, 0]] }
```
The first matching `upTo` wins; `null` means "and above".

### Phase-outs

```json
"phaseout": { "start": 40000, "end": 95000 }              // linear from full amount to 0 (or floor)
"phaseout": { "start": 30000, "rate": 1 }                 // lose $1 per $1 over start
"phaseout": { "start": 23000, "rate": 0.05, "floor": 2500 }
"maxIncome": 250000                                        // hard cliff: 0 above this
```
Each of `start`, `end`, `rate`, `floor`, and `maxIncome` can also be a status map.

## Where the 2026 numbers came from

- **Federal:** IRS Rev. Proc. 2025-32 (includes One Big Beautiful Bill Act changes); SSA 2026 wage base ($184,500).
- **States:** state revenue department releases and enacted 2025–2026 legislation (e.g. GA HB 463, SC H.4216,
  WV SB 392, UT SB 60, OK HB 2764, MT HB 337, OH HB 96), cross-checked against payroll and tax-publisher summaries.
- Entries marked `"estimated"` explain why in their `notes`. Re-check them once each state publishes its
  final 2026 forms (usually December–January).
