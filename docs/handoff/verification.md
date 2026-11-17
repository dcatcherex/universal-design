# Release verification — Thailand Home Adaptation Planner

Updated: 2026-09-28

## Acceptance criteria

| ID | Result | Evidence | Limits / notes |
|---|---|---|---|
| A01 | Pass | `tests/e2e/editor.spec.ts` new-project and setup flows; `accessibility.spec.ts` Thai/English welcome and editor at 390, 768, 1440 CSS px | Local-only projects; no sign-in or accounts are in scope. |
| A02 | Pass | `editor.spec.ts` numeric, keyboard, drag and 3D selection flows; `planner-flow.spec.ts` asserts current/proposed centers in exported JSON; `m4-thai-current-2d.png`, `m4-thai-proposed-2d.png`, `m2-thai-3d.png` | 3D is inspection and selection; geometry writes use the shared project model. |
| A03 | Pass | `editor.spec.ts` proposal isolation, undo, and review invalidation after recommendation edit; unit history/command tests | Revision is monotonic across undo/redo. |
| A04 | Pass | `tests/planner/checks.test.ts`, geometry tests, and `editor.spec.ts` known conflict and unknown target/overlay behavior | Only specified geometry checks are evaluated. No unverified legal threshold is encoded. |
| A05 | Pass | `editor.spec.ts` check explanation/focus and recommendation flow, advisor targets/evidence/review; `m3-thai-checks.png`, `m3-thai-review.png` | Advisor mode and reviewer name are local self-entered values, not authentication or credential verification. |
| A06 | Pass | `tests/planner/recommendations.test.ts`; `editor.spec.ts` known subtotal, missing component and provisional estimate behavior; `planner-flow.spec.ts` round-trip | THB figures are user-entered estimates, not asserted market prices. Unknown components remain unknown. |
| A07 | Pass | `editor.spec.ts` reload/JSON round-trip; `recovery.spec.ts` future-version and over-2-MiB import leaves active project intact; project-file/storage unit tests | Import is schema validated and requires replacement confirmation when work exists. |
| A08 | Pass | `recovery.spec.ts` corrupt raw recovery, quota failure, observed storage conflict and pending-save cancellation; `tests/planner/storage.test.ts` | Cross-tab conflict detection is best effort, not atomic locking or synchronized concurrent editing. |
| A09 | Pass | `editor.spec.ts` parses downloaded SVG as XML and checks PNG signature and print invocation; `planner-flow.spec.ts` creates the PDF from the report print path; rendered PDF and `m4-thai-report.png` | PNG is offered when WebGL capture is available. Report labels geometric checks and measurement confidence, not legal compliance or real-world safety. |
| A10 | Pass in Chromium | `accessibility.spec.ts`: axe scans, keyboard/Escape/focus return, Thai-digit editing, 390×844, 768×1024, 1440×1024 both locales, and 720px layout-width check for 200% zoom | The 720px case models the reduced CSS layout width at 200%; native OS/browser zoom was not manually toggled. WebKit execution is unavailable as noted below. |
| A11 | Pass in Chromium | `editor.spec.ts` repeated 3D mount/unmount canvas counts, PNG, and forced WebGL failure while JSON/report stay usable; `m2-thai-3d.png` | Forced-failure test intentionally logs Three.js renderer errors before the UI fallback assertion. WebKit execution is unavailable as noted below. |
| A12 | Pass | Fictional 6×5 m starter project and checks in `editor.spec.ts`; `m4-thai-current-2d.png`, `m4-thai-proposed-2d.png`, `m3-thai-checks.png` | The corridor illustration is fictional and labelled; no legal threshold or market price is presented as fact. |

## Reproduction commands

Playwright defaults to port 3100 (`PLAYWRIGHT_PORT` overrides it) so it does not reuse unrelated applications on port 3000. The production smoke test uses the production server rather than the development server.

| Command | Outcome |
|---|---|
| `pnpm lint` | Failed only on pre-existing starter issues in `components/ui/carousel.tsx:98` and `hooks/use-mobile.ts:14` (`react-hooks/set-state-in-effect`). |
| `pnpm exec eslint components/planner lib/planner tests/planner tests/e2e playwright.config.ts` | Passed, no warnings. |
| `pnpm exec tsc --noEmit` | Passed. |
| `pnpm test` | Passed: 96 tests in 13 files. |
| `pnpm build` | Passed: Next.js 16.3.6 production build and static prerender completed. |
| `pnpm test:e2e --project=chromium --workers=1` | Passed: 24 tests; one production-only test skipped by design. Includes axe scans, recovery and acceptance flows. |
| `$env:PLAYWRIGHT_PRODUCTION='1'; pnpm exec playwright test tests/e2e/production.spec.ts --project=chromium --workers=1` | Passed: built app opened, no page errors, SVG export worked. |
| `$env:PLAYWRIGHT_WEBKIT='1'; pnpm exec playwright test tests/e2e/webkit.smoke.spec.ts --workers=1` | Not run: Playwright 1.63.0 WebKit executable is not installed (`webkit-2359/Playwright.exe`). |
| `pdfinfo docs/handoff/evidence/m4-thai-report.pdf` | Passed inspection: six unencrypted A4 pages, rendered from the app's print action and visually reviewed. |

## Visual evidence

- Current/proposed 2D: `evidence/m4-thai-current-2d.png`, `evidence/m4-thai-proposed-2d.png`
- 3D: `evidence/m2-thai-3d.png`
- Thai report preview and rendered A4 PDF: `evidence/m4-thai-report.png`, `evidence/m4-thai-report.pdf`
- Mobile editor: `evidence/m4-thai-mobile.png`
- Earlier milestone checks/review: `evidence/m3-thai-checks.png`, `evidence/m3-thai-review.png`

The report PDF is six A4 pages. Chromium rendered each page from the application's print action, and all six rendered pages (`evidence/m4-final-page-1.png` through `m4-final-page-6.png`) were visually inspected.

## Environment limitations

## Open before release

- **Checklist source adaptation rights (Package 13):** The CDC PDF contains no licence statement, although a GPO/DPLA catalog record describes the U.S. government work as public domain under 17 U.S.C. 105. The DOP manual has no located public adaptation licence. A human must confirm permission to adapt both sources before the checklist dataset is released. Until then, `checklist-2026.11-draft.json` remains draft content and every question remains pending review.

- Only the Chromium browser binary matching Playwright 1.63.0 is installed. A WebKit project is available behind `PLAYWRIGHT_WEBKIT=1`, but the matching WebKit browser is absent; WebKit is not claimed as tested.
- The full `pnpm lint` command reports two existing issues in starter UI files (`components/ui/carousel.tsx:98` and `hooks/use-mobile.ts:14`, `react-hooks/set-state-in-effect`). Planner code, tests and Playwright configuration pass the scoped ESLint command in the final record.
- Thai legal sources and dimensional thresholds remain unverified and are intentionally not represented as compliance rules.
