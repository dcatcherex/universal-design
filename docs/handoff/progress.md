# Implementation progress

Updated: 2026-09-28

## Status

**Tasks 1–10 are implemented and locally verified; M1–M4 are complete against the product acceptance criteria.** The working tree remains dirty on the user's existing `master` checkout, which already contained uncommitted and untracked work before implementation. No files were staged or committed so unrelated work would not be swept into a commit. The diff is ready for primary-agent review.

## Completed tasks

- **Task 1 — Validated model, catalog, fixtures.** Added public Project contracts, Zod validation, all ten fictional catalog entries, and current/proposed example fixtures.
- **Task 2 — Geometry and units.** Added rotated furniture footprints, room bounds, hinged-door sectors, analytic circle/capsule/sector checks, and cm/m conversion with Thai-digit support. Tangency and 1 mm intrusion are covered.
- **Task 3 — Commands and history.** Added validated project commands, proposal isolation, review status, bounded undo/redo, and monotonic revisions.
- **Task 4 — Thai-first 2D workspace.** Implemented project setup, room/opening editor, furniture catalog and inspector, SVG editing with drag/keyboard/numeric controls, family/advisor view mode, current/proposed switching, undo/redo, responsive mobile sheet, and Thai/English locale parity.
- **Task 5 — Local save and project exchange.** Added schema-checked 500 ms local autosave, save state, separate preferences, conflict detection/recovery, corrupt-data raw download, JSON import confirmation and safe project download. Reload and file round-trip preserve both layouts.
- **Task 6 — Synchronized 3D inspection.** Added lazy client-side Three.js loading, procedural furniture meshes, segmented walls/openings, orbit/zoom/reset, near-wall visibility, shared selection, on-demand drawing, PNG capture, and renderer/control/observer/resource cleanup. Failed/lost WebGL returns to 2D without disabling project export.
- **Task 7 — Explainable geometry checks.** Added derived G01–G05 and M01 outcomes, stable result identities, geometry/target/custom/manual evidence origins and limitations, unknown-target `not-evaluated` behavior, route/turn drawing and numeric editors, focus navigation, and project-specific advisor targets. The fictional corridor remains illustrative.
- **Task 8 — Recommendations, costs and advisor review.** Added editable drafts from checks, explicit save, recommendation status/priority/work type, estimates with required source/date and exact satang conversion, accepted/completed known subtotals, missing-component and provisional-budget wording, and self-entered advisor review receipts that become outdated after substantive edits.
- **Task 9 — Reports and exports.** Added `createPlanSvg` from shared millimetre geometry, safe text escaping, a revision-snapshot `ReportData` builder with fresh checks, accessible Thai/English report preview and print styles, active-plan SVG download, fresh 3D PNG download, and explanations when WebGL is unavailable. Project JSON export remains available independently.
- **Task 10 — Release verification and handoff.** Added axe-backed state scans and keyboard/layout checks, integrated project acceptance flow, corrupt/future/oversized/quota/conflict/stale-save recovery flows, a production-server smoke test, optional WebKit smoke configuration, and an A01–A12 verification matrix. Fixed print dialog sizing and a report contrast issue found while inspecting the actual report output.

## Evidence

- M1 2D/reload/file exchange: `docs/handoff/evidence/m1-thai-desktop.png`, `m1-thai-mobile.png` and `tests/e2e/editor.spec.ts`.
- M2 3D/selection/reset/cleanup: `docs/handoff/evidence/m2-thai-3d.png` and `tests/e2e/editor.spec.ts`.
- M3 checks/recommendation/cost/review: `docs/handoff/evidence/m3-thai-checks.png`, `m3-thai-review.png`, unit tests and `tests/e2e/editor.spec.ts`.
- M4 current/proposed 2D, report and mobile: `docs/handoff/evidence/m4-thai-current-2d.png`, `m4-thai-proposed-2d.png`, `m4-thai-report.png`, `m4-thai-report.pdf`, and `m4-thai-mobile.png`.
- `docs/handoff/evidence/m4-final-page-1.png` through `m4-final-page-6.png` are the inspected raster pages from the six-page A4 report PDF. `docs/handoff/verification.md` maps each acceptance criterion to tests, evidence, results and limits.

## Changed files

- `app/`: page, layout, Thai metadata, editor/report/print styles in `globals.css`.
- `components/planner/`: setup/editor, persistence/menu, 3D inspector, checks/overlay/target/recommendation/review/report/export panels and workspace wiring.
- `lib/planner/`: public model/schema/catalog/fixtures, geometry/units, commands/history, localization/storage/project files/preferences, scene building/checks/recommendations, and report/SVG/download exports.
- `tests/planner/`: domain, geometry, units, commands/history, localization, storage/project files/preferences, scene/checks/recommendations and export coverage.
- `tests/e2e/`: editor acceptance flows, axe/accessibility, planner flow, storage recovery, production smoke and opt-in WebKit smoke.
- `package.json`, `pnpm-lock.yaml`, `playwright.config.ts`, `vitest.config.mts`.
- `docs/handoff/README.md`, `docs/handoff/progress.md`, `docs/handoff/verification.md`, and milestone evidence under `docs/handoff/evidence/`.

The checkout also contains pre-existing user-owned paths such as `build_process_sample.md`, `components/`, `components.json`, and `hooks/`; these were not staged or committed. Playwright's generated `test-results/` traces remain for optional local debugging. No blanket cleanup or reset was used.

## Final verification outcomes

- `pnpm lint` — **failed only on two pre-existing starter errors**: `components/ui/carousel.tsx:98` and `hooks/use-mobile.ts:14`, both `react-hooks/set-state-in-effect`.
- `pnpm exec eslint components/planner lib/planner tests/planner tests/e2e playwright.config.ts` — **passed, no warnings**.
- `pnpm exec tsc --noEmit` — **passed**.
- `pnpm test` — **96 passed in 13 files**.
- `pnpm build` — **passed** on Next.js 16.3.6; static `/` and `/_not-found` generated.
- `pnpm test:e2e --project=chromium --workers=1` — **24 passed; one production-only test skipped by design**. Includes six report/editor axe states, both locales at 390×844, 768×1024 and 1440×900, 720 px effective-width zoom check, keyboard and Thai-digit behavior, recovery, WebGL fallback, valid SVG/PNG/JSON, print path, and integrated project flow.
- `$env:PLAYWRIGHT_PRODUCTION='1'; pnpm exec playwright test tests/e2e/production.spec.ts --project=chromium --workers=1` — **1 passed** against the built app; no page errors and SVG export works.
- `$env:PLAYWRIGHT_WEBKIT='1'; pnpm exec playwright test tests/e2e/webkit.smoke.spec.ts --workers=1` — **not run**: the matching Playwright 1.63.0 WebKit executable is absent (`webkit-2359/Playwright.exe`).
- `pdfinfo docs/handoff/evidence/m4-thai-report.pdf` — **six unencrypted A4 pages**; generated from the application's report print path and visually reviewed after rasterization.

The forced WebGL fallback test intentionally logs Three.js renderer initialization errors before asserting 2D/export recovery. Playwright uses port 3100 by default to avoid reusing another local service on port 3000.

## Known limitations

- Thai legal source pages and dimensional thresholds remain unverified; no legal compliance pass/fail logic is implemented.
- Estimates are user-entered and not market-price claims. Review names are self-entered and do not authenticate an advisor or professional credentials.
- Local storage conflict detection is best effort; multi-tab editing is not atomic synchronization. No backend or account system is in scope.
- WebKit was unavailable in this environment. The 720 px viewport check represents the responsive layout width at 200% desktop zoom; native OS/browser zoom controls were not toggled.
- The repository-wide lint errors in the two untouched starter files remain.

## Next task

**None in the assigned 10-task implementation plan.** The exact next step is primary-agent review of the working-tree diff and the linked M1–M4 evidence. No deployment, purchase, or separate chat was initiated.

## 2026-10-21 — v2 direction agreed

The product direction for v2 was agreed with the user and written up as the [v2 specification](../superpowers/specs/2026-10-21-baan-yoo-dee-v2-design.md), with releases R1–R4. **Next task: R1 Task 1** in the [R1 plan](../superpowers/plans/2026-10-21-r1-benchmarks-bathroom.md) (schema v2, migration and persistence). R1 Task 0 (checking the benchmark values against their sources, and collecting regional prices) is for the product owner and runs in parallel. No R1 product code has been written yet.
