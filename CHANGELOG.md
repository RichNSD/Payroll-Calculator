# Changelog

## 2.0.0 (2026-11-18)

The big untangling. `src/script.js` is gone, replaced by small ES modules and a data-driven tax engine.

### Tax accuracy
- **State income tax was badly wrong.** v1 multiplied your entire gross pay by each state's *top* marginal rate, and some of those "rates" even folded in city taxes (NY 14.78%, OR 14.69%). The new engine applies real brackets, standard deductions, exemptions, and credits for all 50 states + DC.
- Updated everything to the **2026 tax year**:
  - Federal brackets and standard deduction ($16,100 / $32,200 / $24,150) per IRS Rev. Proc. 2025-32
  - Social Security wage base of $184,500
  - State changes for 2026 including GA (4.99%), IN (2.95%), KY (3.5%), MS (4.0%), NC (3.99%), NE (4.55%), OH (flat 2.75%), OK (4.5%), MT (5.65%), UT (4.45%), WV (−5%), AR (3.7%), NY (lower-bracket cuts), SC's new 1.99%/5.21% system, and Maine's new millionaire surcharge
- Added: Additional Medicare Tax (0.9%), Child Tax Credit (incl. refundable portion), the federal "no tax on overtime" deduction, the married-filing-separately status, and employee-paid state payroll programs (SDI, paid family leave, WA Cares, etc.).
- Added inputs for children, 401(k)/403(b) and health/HSA pre-tax deductions, and a local/city tax rate.
- Each state shows notes about what's modeled, plus a badge when some figures are estimates.

### Structure
- Tax data now lives in `src/data/<year>/federal.json` and `states.json` (schema documented in `src/data/README.md`).
- Code split into `src/tax/*` (pure calculation), `income.js`, `expenses.js`, `storage.js`, `dataLoader.js`, `ui/*`, and `app.js`.
- Added a `node:test` suite (`npm test`) with worked examples plus sanity checks across every state, filing status, and income level.

### Bug fixes
- **Offline mode was broken:** the service worker had been renamed to `autosave.js` (it's not the auto-save; that's localStorage) but was still registered as `sw.js`, and its cache list pointed at files that had moved. It's back to `sw.js` with correct paths, and it fetches tax data network-first so updates aren't stuck in the cache.
- Manifest icon paths now point at `assets/`.
- Auto-save no longer mirrors your whole budget into a cookie. That broke on emoji in item labels (`btoa` crash) and could exceed the 4KB cookie limit. Old saves (and the old cookie) are migrated automatically.
- Auto-save now survives private browsing / blocked storage and tells you when it can't save.
- The hourly "net per hour" now divides by hours actually worked instead of an overtime-weighted figure.
- "Reset data" asks before wiping everything.
- Inline `onclick` handlers replaced with event delegation.

### HTML & CSS
- Same look and theme, cleaned up: theme set before first paint (no flash), defaults to your system's light/dark preference, focus-visible outlines, reduced-motion support, proper labels/fieldsets for screen readers, and tidier mobile layouts.
- Two-column desktop layout, no mid-number wrapping in the stat cards, semi-monthly pay period, and a summary that shows pre-tax deductions.
- Google Fonts loaded via `<link>` + preconnect instead of a render-blocking CSS `@import`.

## 1.x
- Original ChatGPT version. We don't talk about it. 🫠
