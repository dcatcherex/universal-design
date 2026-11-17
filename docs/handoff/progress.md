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

## 2026-10-21 — v2 direction agreed

The product direction for v2 was agreed with the user and written up as the [v2 specification](../superpowers/specs/2026-10-21-baan-yoo-dee-v2-design.md), with releases R1–R4. R1 packages 1–10 and 12–14 are implemented; Package 11 is the remaining final release-verification task. R1 Task 0 source and price verification remains an owner task.

## Next task

**Package 11: final R1 verification and handoff.** Record only checks run in the current session and retain the open human-verification items.

## 2026-11-16 — Package 1: report bug and browser tests

- Fixed the report's reach band, wheelchair size, fall note, and chosen primary benchmark display. Added browser assertions for the wheelchair size and the selected benchmark in the report.
- Corrected three stale Thai expectations and selected the benchmark control by its combobox role. The report axe scan then exposed nested banner/contentinfo landmarks; changed the report cover and limitations wrappers to non-landmark elements without weakening the scan.
- Verification:
  - Initial `git status --short` — clean.
  - Initial `pnpm exec tsc --noEmit` — passed.
  - Initial `pnpm test` — 172 passed in 17 files.
  - `pnpm exec playwright test tests/e2e/r1-flow.spec.ts --project=chromium --workers=1` — passed, 7 tests.
  - `pnpm exec playwright test --project=chromium --workers=2` (reused the existing server on port 3001) — passed, 31 tests; 1 production-only test skipped by design.
  - Final `pnpm exec tsc --noEmit` — passed.
  - Final `pnpm test` — 172 passed in 17 files.
  - `pnpm exec eslint components/planner lib/planner tests/planner tests/e2e playwright.config.ts` — passed, no output.
  - `git diff --check` — passed.
- `docs/handoff/evidence/r1-report.pdf` was generated by the browser flow. The Playwright runs also regenerated `m1-thai-mobile.png`, `m4-thai-current-2d.png`, and `m4-thai-report.pdf`, updated `test-results/.last-run.json`, and removed the prior tracked failure traces under `test-results/`. The worktree was clean at the start; these test-run side effects were left in place because the handoff says not to check out files.
- Package 1 is complete. Next: Package 2, price import script and CSV template.

## 2026-11-16 — Package 2: price import script and CSV template

- Added `lib/planner/standards/import-prices.ts`, a pure CSV parser/importer. It handles quoted fields and escaped quotes, validates row data with row-numbered errors, skips marked example rows, aggregates each priceKey/region only when at least three jobs contribute to a cost range, converts baht to satang, and reports skipped pairs. It preserves the input list and records sample size, latest contributing job date, and provenance notes.
- Added `scripts/import-prices.ts`, using Node's built-in file APIs and the required `.ts` import. It reads the CSV and unchanged `prices-2026.10.json`, writes a new version file without overwriting an existing file, and prints skipped-pair messages.
- Added `docs/data/price-collection-template.csv` with the required nine-column header and two clearly marked, blank-price example rows. Prices are intentionally blank to avoid inventing market data.
- Added `allowImportingTsExtensions` to `tsconfig.json` and six focused tests in `tests/planner/import-prices.test.ts`, including schema validation and immutability of the base price list.
- Verification:
  - Initial `pnpm exec tsc --noEmit` — passed.
  - Initial `pnpm test` — 172 passed in 17 files.
  - Final `pnpm exec tsc --noEmit` — passed.
  - Final `pnpm test` — 178 passed in 18 files.
  - `pnpm exec eslint components/planner lib/planner tests/planner tests/e2e scripts/import-prices.ts playwright.config.ts` — passed with no warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` with the existing port 3001 server — 31 passed; 1 production-only test skipped by design.
  - Node CLI integration with temporary test-only input — wrote and verified the expected versioned satang bands; removed its temporary CSV and generated JSON afterward. Node emitted its `MODULE_TYPELESS_PACKAGE_JSON` performance warning; no package-wide module-mode change was made.
  - Running `node scripts/import-prices.ts` against the example-only template correctly reported that no completed-job rows were present and wrote no output file.
  - PowerShell `Import-Csv` — confirmed the template has the exact nine columns and two marked example rows.
  - `git diff --check` — passed. `prices-2026.10.json` remains unchanged; no real price data was imported.
- The Chromium run regenerated `m4-thai-current-2d.png`, `m4-thai-proposed-2d.png`, and `m4-thai-report.pdf`, updated `test-results/.last-run.json`, and left the prior tracked failure traces removed by Playwright. These test-run artifacts remain as-is under the handoff's no-checkout rule.
- Package 2 is complete. Next: Package 3, wall view SVG download, report evidence, and English report check.

## 2026-11-16 — Package 3: wall SVG and report evidence

- Added `lib/planner/exports/elevation-svg.ts`, a pure exporter over `ElevationModel`. It exports the selected wall's openings, fixtures, nearby furniture silhouettes, reach and benchmark bands, and centimetre height scale. Labels are XML-escaped and wall overlays are clipped to the wall bounds.
- Added an export-menu item in `components/planner/export-menu.tsx` and connected it in `components/planner/workspace.tsx`. The selected-wall SVG action is enabled only in wall view; elsewhere it is disabled and explains why. Added English and Thai menu strings in `lib/planner/locales/en.ts` and `lib/planner/locales/th.ts`.
- Added unit coverage in `tests/planner/exports.test.ts` for fixture/opening geometry, the height scale, and escaping a script-like label. Added browser coverage in `tests/e2e/r1-flow.spec.ts` for availability, the selected-wall download, and English report version, disclaimer, and both benchmark names.
- Regenerated `docs/handoff/evidence/r1-report.pdf`, rasterized all six pages at 150 DPI to `docs/handoff/evidence/r1-report-page-1.png` through `r1-report-page-6.png`, and visually inspected every page. The verdict table header repeats where the table continues (pages 2–3), Thai text is not clipped, and the disclaimer is present on page 6. No print CSS change was needed.
- Verification:
  - Initial `pnpm exec tsc --noEmit` — passed.
  - Initial `pnpm test` — 178 passed in 18 files.
  - `pnpm exec vitest run tests/planner/exports.test.ts` — 5 passed.
  - `pnpm exec playwright test tests/e2e/r1-flow.spec.ts --project=chromium --workers=1` — 9 passed.
  - Final `pnpm exec tsc --noEmit` — passed.
  - Final `pnpm test` — 179 passed in 18 files.
  - `pnpm exec eslint components/planner/export-menu.tsx components/planner/workspace.tsx lib/planner/exports/elevation-svg.ts lib/planner/locales/en.ts lib/planner/locales/th.ts tests/planner/exports.test.ts tests/e2e/r1-flow.spec.ts` — passed with no warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` using the existing server on port 3001 — 33 passed; 1 production-only test skipped by design.
  - `git diff --check` — passed.
- The final Chromium run regenerated M1/M3/M4 evidence, updated `test-results/.last-run.json`, and left earlier tracked failure traces removed by Playwright. These test-run artifacts remain as-is under the handoff's no-checkout rule.
- Package 3 is complete. Next: Package 4, numeric entry for a fall location and the province-list note.

## 2026-11-16 — Package 4: numeric fall location

- Added X and Y coordinate fields in centimetres to each fall record in `components/planner/resident-panel.tsx`. They use the existing `parseLength` / `formatLength` handling, allow incomplete coordinate drafts without saving half a point, and commit only when both values are valid and within the current room. Invalid and out-of-room values are rejected with localized alerts.
- Added matching English and Thai field labels and validation messages in `lib/planner/locales/en-r1.ts` and `lib/planner/locales/th-r1.ts`.
- Added `tests/e2e/r1-flow.spec.ts` coverage that sets a location by typing only, confirms the plan marker is created, and verifies an out-of-bounds coordinate leaves the saved point unchanged.
- The province names, codes and regions in `lib/planner/standards/data/provinces-th.json` were not changed; the handoff records them as needing human verification, and no corrections were guessed.
- Verification:
  - Baseline `pnpm exec tsc --noEmit` — passed.
  - Baseline `pnpm test` — 179 passed in 18 files.
  - `pnpm exec playwright test tests/e2e/r1-flow.spec.ts --project=chromium --workers=1` — initial run had one expectation mismatch: the existing formatter displays the pair as `150, 120 ซม.`. The assertion was corrected to match that output; rerun passed all 10 tests.
  - Final `pnpm exec tsc --noEmit` — passed.
  - Final `pnpm test` — 179 passed in 18 files.
  - `pnpm exec eslint components/planner/resident-panel.tsx lib/planner/locales/en-r1.ts lib/planner/locales/th-r1.ts tests/e2e/r1-flow.spec.ts` — passed with no warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` using the existing server on port 3001 — 34 passed; 1 production-only test skipped by design.
  - `git diff --check` — passed.
- The Chromium run regenerated M1/M3/M4 evidence and updated `test-results/.last-run.json`; existing test-result trace changes remain as-is under the handoff's no-checkout rule.
- Package 4 is complete. Next: Package 5, technical-drawing 2D plan items 1–3.

## 2026-11-16 — Package 5: technical plan walls, doors and symbols

- Added the pure shared drawing module `lib/planner/plan-drawing.ts`. It creates 100 mm exterior wall bands with real gaps at openings, wall-oriented window double lines, hinged door leaves and swing arcs from `getDoorSector`, sliding-door leaves/arrows, and normalized top-view symbol marks.
- Replaced the rounded furniture blocks in `components/planner/plan-canvas.tsx` with exact footprint outlines and catalog-specific plan symbols. The shared symbols include round water jars, tank-and-bowl seated toilets, squat-toilet pans and foot pads, basin bowls/tap dots, slatted shower seats, seating/table/cabinet outlines, a bed symbol for future catalog use, and a plain diagonal-marked fallback. Fixture basins and the exported plan use the same symbol implementation.
- Updated `lib/planner/exports/plan-svg.ts` to call the shared wall/opening and symbol geometry. Its expanded viewBox keeps the room's 0-to-width/depth coordinates unchanged. Updated `modelPoint` to use the SVG screen transform so placement, drag, overlay, and fall picking continue to map to room coordinates; made the transparent footprint retain its pointer hit area.
- Added unit tests for wall gaps and vertical-wall openings, hinged/sliding/window geometry, normalized catalog symbol bounds, basin/bed/unknown symbols, and exported walls/symbols. Added browser coverage for the rendered bathroom plan and a click-to-place coordinate assertion through the wall-margin viewBox. Updated the existing SVG test to expect the expanded viewBox.
- Regenerated `docs/handoff/evidence/r1-bathroom-2d.png` and `docs/handoff/evidence/r1-report.pdf`. Rasterized the final six-page report at 150 DPI to `r1-report-page-1.png` through `r1-report-page-6.png` and visually inspected every page. The bathroom plan shows exterior wall thickness, the true opening gap, door leaf/swing arc, and top-view fixture/furniture symbols; report text and tables remain unclipped.
- Verification:
  - Baseline `pnpm exec tsc --noEmit` — passed.
  - Baseline `pnpm test` — 179 passed in 18 files.
  - Final `pnpm exec tsc --noEmit` — passed.
  - Final `pnpm test` — 181 passed in 18 files.
  - Scoped ESLint on the changed TypeScript/TSX files — passed with no warnings. `app/globals.css` is not covered by the configured ESLint.
  - `pnpm exec playwright test --project=chromium --workers=2` with the existing server on port 3001 — 36 passed; 1 production-only test skipped by design. This includes the wall-margin placement/drag checks, axe checks, and evidence/report flows.
  - `git diff --check` — passed.
- No dependency or project-data/schema changes were added for Package 5. This package covers approved technical-drawing items 1–3 only; dimensions and their preference toggle, clearance annotations, item numbering/schedule, room metrics, scale bar and north arrow remain for a later package.
- Playwright also regenerated existing M1/M3/M4 evidence and `r1-bathroom-3d.png`, updated `test-results/.last-run.json`, and removed earlier tracked failure traces under `test-results/`. These generated artifacts were left as-is; nothing was staged or committed.
- Package 5 is complete. Next: continue the approved technical drawing addition with dimensions, clearances, and the persisted dimensions toggle.

## 2026-11-16 — Package 6: technical plan dimensions and clearances

- Added `lib/planner/plan-dimensions.ts`, a pure shared geometry module for overall room width/depth dimensions, complete per-wall opening chains, and the selected furniture item's nearest-wall clearances. Lengths are rounded to two decimal metres and dimension marks include blue tick ends. Opening chains for walls with one and two openings are tested to sum to the wall length; rotated-item clearances are tested in millimetres.
- Extended the plan viewBox margin to 360 mm without changing room coordinates. The canvas, plan SVG export, and report plan use the same dimension geometry. Pointer mapping still uses the SVG screen transform; updated placement/drag regression coverage verifies the enlarged margin.
- Added a caption toggle, default on, stored in device preferences rather than project data. Older preference records load with dimensions enabled. Exported SVGs and report plans follow the preference and selected item; dimensions can be turned off without changing the project revision. Per-wall chains hide below 480 px while overall dimensions remain visible.
- Adjusted item-label placement slightly inward so labels remain clear of the bathroom's south wall and dimension annotations.
- Verification:
  - Baseline typecheck passed; baseline unit suite had 181 tests.
  - Final `pnpm exec tsc --noEmit` — passed.
  - Final `pnpm test` — 183 passed in 18 files.
  - Scoped ESLint on changed TypeScript/TSX files — passed without warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` — 37 passed; 1 production-only test skipped by design. Includes both locale accessibility scans, bathroom dimension values and selected toilet clearances, persisted toggle/reload, and no horizontal overflow at 390 px.
  - The quota-failure recovery test reproduced intermittently (1/3 isolated runs) because the autosave effect retried the same failed project after setting the error state. The persistence hook now records that project identity, leaves its error state stable, and still retries after project changes or an explicit save. Tightened the recovery test's download menu-item locator to exact matching. The focused test then passed 3/3 consecutive runs, and the complete Chromium suite passed.
  - `pnpm build` — passed on Next.js 16.3.6. `git diff --check` — passed.
- Regenerated `docs/handoff/evidence/r1-bathroom-2d.png` and `r1-report.pdf`; rasterized the six-page A4 report at 150 DPI to `r1-report-page-1.png` through `r1-report-page-6.png`. Inspected the plan and every page: the dimensions/chains are visible, the plan labels and report text/tables are not clipped.
- Playwright also regenerated existing M1/M3/M4 evidence, `r1-bathroom-3d.png`, and `test-results/.last-run.json`; it removed prior tracked failure traces under `test-results/`. Generated artifacts were left as-is. Nothing was staged or committed.
- Package 6 is complete. Next: technical-drawing item 5, stable item numbering and the synchronized item schedule.

## 2026-11-17 - Technical-drawing item 5: item numbers and schedule

- Added `lib/planner/plan-schedule.ts`, a pure schedule builder that numbers furniture in the room's existing item-list order and formats width, depth, and wall-fixture mounting height in metres. The numbers remain derived display data and do not change the project schema.
- Added `components/planner/plan-schedule.tsx` for the plan and both report plan sections. The item table selects the matching plan item, and the existing plan selection highlights the matching row. Wall fixtures appear in a separate short list with wall, height above floor, and measurement confidence; selecting a fixture highlights it on the plan.
- Added each item number beside its symbol in the interactive plan and exported SVG, using the same schedule builder for both. Added English and Thai schedule headers, fixture-height labels, and empty-state text.
- Added unit coverage for item-list ordering, metre values, and fixture heights, plus browser coverage for row-to-plan and plan-to-row selection, bilingual schedule accessibility, fixture selection/height, report schedules, and exported item numbers.
- Refreshed `docs/handoff/evidence/r1-bathroom-2d.png` and `docs/handoff/evidence/r1-report.pdf`; rasterized and inspected all six report pages. The bathroom plan and report show the numbered symbols and readable schedule; report content remains unclipped.
- Verification:
  - `pnpm exec tsc --noEmit` - passed.
  - `pnpm test` - 184 passed in 18 files.
  - Scoped ESLint - passed with no warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` - 38 passed; 1 production-only test skipped by design.
  - `pnpm build` - passed on Next.js 16.3.6. `git diff --check` - passed.
- Playwright regenerated existing M1/M3/M4 evidence, `r1-bathroom-3d.png`, `m4-thai-report.png`, the report PDF and page images, and `test-results/.last-run.json`; prior tracked failure traces remain removed. Generated artifacts were left as-is under the handoff's no-checkout rule. Nothing was staged or committed.
- This user-approved technical-drawing item 5 addition is complete. Next: item 6, room label, area, scale bar, and plan-north arrow.

## 2026-11-17 - Technical-drawing item 6: room annotations

- Added `lib/planner/plan-annotations.ts` as the shared pure geometry source for the interactive plan and SVG/report exports. It places the localized room type and rectangular room area in square metres at the room centre, searching nearby positions when the label bounds collide with furniture.
- Added a 1 m scale bar at the lower-left of the room and a top-right arrow explicitly labeled as plan north. The scale bar, arrow, and room label render in both the interactive plan and exported SVG; English and Thai labels are provided.
- Added unit coverage for area calculation, centre placement, furniture avoidance, scale length, and north-arrow orientation. Browser coverage checks Thai annotation labels, SVG markers, and axe scans in Thai and English; existing 390 px overflow coverage also passes.
- Refreshed `docs/handoff/evidence/r1-bathroom-2d.png` and `docs/handoff/evidence/r1-report.pdf`; rasterized and inspected all six report pages. The room label, area, scale bar, and plan-north arrow are legible, and report text remains unclipped.
- Verification:
  - `pnpm exec tsc --noEmit` - passed.
  - `pnpm test` - 185 passed in 18 files.
  - Scoped ESLint - passed with no warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` - 38 passed; 1 production-only test skipped by design.
  - `pnpm build` - passed on Next.js 16.3.6. `git diff --check` - passed.
- Playwright refreshed existing M1/M3/M4 evidence, the bathroom 2D/3D images, the report PDF/page images, and `test-results/.last-run.json`; prior tracked failure traces remain removed. Generated artifacts were left as-is under the handoff's no-checkout rule. Nothing was staged or committed.
- This user-approved technical-drawing item 6 addition is complete. Next: item 7, palette and WCAG 2.2 AA contrast review.

## 2026-11-17 - Technical-drawing item 7: palette and contrast

- Added `lib/planner/plan-palette.ts` as the semantic palette source for white sheets, warm-white room floors, dark grey walls, near-black symbols, blue dimensions/item numbers, and the selection, changed, route, turning, wet-area and fall states. The exported SVG and interactive plan now use matching palette values.
- Kept state meanings legible without color alone: selection uses a heavier outline; changed items use a dashed rust outline; routes use a dashed centerline; turning areas use dashed circles; wet areas use diagonal hatching and a dashed boundary; and fall locations remain a triangle with an exclamation mark. Added the turning-circle cue to the canvas legend.
- Added unit contrast checks for the semantic palette against the sheet and room floor. Every graphical token is at least 3:1; the measured minimum is 6.10:1 on the floor. Text-role tokens are checked against the 4.5:1 AA threshold. Browser/export coverage verifies wall, dimension and wet-area colors, export hatch/dash treatments, selection styling, and route/turning patterns.
- Corrected report printing so Tailwind's translated dialog is reset in the utilities layer under print media. The report test now explicitly switches to print media before capturing `r1-report.pdf`.
- Refreshed `docs/handoff/evidence/r1-bathroom-2d.png` and the six-page `r1-report.pdf`; rasterized pages 1–6 and inspected every page. The bathroom plan retains readable blue dimensions/numbers, dark walls and symbols, and the wet-area hatch. Report plan and tables remain unclipped.
- Verification:
  - `pnpm exec tsc --noEmit` - passed.
  - `pnpm test` - 186 passed in 18 files.
  - Scoped ESLint on changed TypeScript/TSX files - passed without warnings.
  - Chromium Playwright - 38 passed; 1 production-only test skipped by design. One initial full run had a transient dimensions-toggle reload failure; the isolated test and 10-run repetitions at one and two workers passed, and the subsequent complete suite passed.
  - `pnpm build` - passed on Next.js 16.3.6. `git diff --check` - passed.
- Playwright regenerated existing evidence and `test-results/.last-run.json`, and removed prior tracked failure traces under `test-results/`; generated artifacts remain in the worktree. Nothing was staged or committed.
- Technical-drawing item 7 is complete. Next: consult `docs/handoff/r1-remaining-work.md` and `progress.md` for the next package.

## 2026-11-17 - Package 7: synchronized check marks

- Added `getEntityStatuses` to derive one status per affected entity from the active layout's current `CheckResult[]`. Multiple results aggregate deterministically: attention takes display priority over not evaluated, clear remains unmarked, and the aggregate retains result IDs, counts, and near-fall state. No check state is persisted in the project.
- Added accessible, localized `!` attention and `?` not-evaluated markers to the plan, wall elevation, plan SVG, elevation SVG, and report plans. Solid/dashed outlines and text legends preserve meaning in monochrome; room-level checks remain in the plan caption/legend rather than being attached to unrelated objects.
- Added attention tint and not-evaluated wireframe treatment with a localized legend to the read-only 3D view. Activating a marker opens the Checks tab and scrolls to its associated result. The default-on mark toggle is persisted in device preferences and does not modify the project.
- Added unit and browser regressions for status aggregation, exports, marker navigation, wet-area-dependent water-jar marking, the persisted toggle, wall/3D views, report legends, and Thai/English axe scans.
- Verification:
  - `pnpm exec tsc --noEmit` - passed.
  - `pnpm test` - 190 passed in 19 files.
  - Scoped ESLint on changed TypeScript/TSX files - passed without warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` - 39 passed; 1 production-only test skipped by design. The first full run exposed an ambiguous turning-circle locator after adding a status outline; the test now scopes to the actual turning-area circle, and the complete rerun passed.
  - `pnpm build` - passed on Next.js 16.3.6. `git diff --check` - passed.
- Playwright refreshed bathroom plan, wall, 3D, report, and existing M1/M3/M4 evidence and updated `test-results/.last-run.json`; prior tracked failure traces were removed by Playwright. Generated artifacts were left as-is. Nothing was staged or committed.
- Package 7 is complete. Next: Package 8, before/after summary counts.

## 2026-11-17 - Package 8: before/after summary counts

- Added `summarizeChecks` in `lib/planner/checks.ts`. It counts each overall `CheckResult` once, separates attention, likely attention, not evaluated and clear, reports the total, and counts near-fall results without treating not-evaluated or missing benchmark values as success.
- Added bilingual count controls to the Checks panel. Each count filters the result list by its group; icons and labels carry meaning without color. The header also compares Current and Proposed attention counts when a proposal exists.
- Evaluated Current and Proposed once in the workspace and passed the derived summaries to the toolbar. The toolbar shows the same Current-to-Proposed attention count beside the layout switch; no summary values are persisted.
- Added a report summary before the plan sections and a status-change list matched by rule and sorted entity IDs, not layout-specific result IDs. The rehang-outward fix is covered as an attention-to-clear change.
- Added unit coverage for result-level counting, likely verdicts, near-fall counts, layout-independent matching, the bathroom example counts, and the rehang-outward change. Browser coverage verifies that summary counts match result rows, count controls filter, Proposed attention drops after applying the fix, report changes agree, and the toolbar fits at 390 px.
- Refreshed `docs/handoff/evidence/r1-report.pdf` and rasterized the six pages to `r1-report-page-1.png` through `r1-report-page-6.png`. Inspected the page contact sheet and the first/last pages; summary counts are legible and the report remains unclipped.
- Verification:
  - Baseline `pnpm exec tsc --noEmit` and `pnpm test` - passed; 190 unit tests.
  - Final `pnpm exec tsc --noEmit` - passed.
  - Final `pnpm test` - 192 passed in 19 files.
  - Scoped ESLint on changed TypeScript/TSX files - passed without warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` - 39 passed; 1 production-only test skipped by design. The focused before/after browser test also passed.
  - `pnpm build` - passed on Next.js 16.3.6. `git diff --check` - passed.
- Playwright refreshed existing evidence and `test-results/.last-run.json`; prior tracked failure traces remain removed. Generated artifacts were left in place. Nothing was staged or committed.
- Package 8 is complete. Next: Package 9, live feedback while moving.

## 2026-11-17 - Package 9: live feedback while moving

- Added pure `evaluateWithMove(project, layoutId, entityId, position)` in `lib/planner/checks.ts`. It copies the active layout, moves either furniture or a wall fixture, then calls the canonical `evaluateLayout`; it does not mutate the project or create history. Fixture measurements in the preview are downgraded to estimated, matching the eventual wall-view commit.
- Added `useMoveCheckPreview` to coalesce preview evaluations to at most one per animation frame and skip unchanged snapped positions. It derives all entity marks from the preview results and updates an attention chip beside the moving entity. Its polite live region announces only when that entity's set of attention results changes. No caching was needed.
- Wired transient feedback to pointer and held-key furniture moves in the 2D plan, and pointer drags in the wall elevation. Keyboard movement commits once on key release. Escape clears the transient layout and feedback; invalid positions suppress the chip in favor of the existing refusal message.
- Deferred selecting a plan item until pointer release so opening its inspector cannot reflow the canvas under an active pointer drag. The browser regression drags an initially unselected item directly.
- Added unit coverage showing that preview evaluation leaves the input project unchanged and reports the corridor blocked when the living-room coffee table is moved into it. Browser coverage verifies route and item marks update before release, the chip and live region change, Escape restores the item and route with no history entry, held-key movement previews then commits, and wall-fixture feedback updates while dragging.
- Measured `evaluateWithMove` on the living-room example at 10.5 ms for 100 previews (about 0.105 ms each); retained no additional cache. Captured and inspected `docs/handoff/evidence/r1-live-move.png`.
- Verification:
  - Baseline `pnpm exec tsc --noEmit` and `pnpm test` - passed; 192 unit tests.
  - Final `pnpm exec tsc --noEmit` - passed.
  - Final `pnpm test` - 193 passed in 19 files.
  - Scoped ESLint on changed TypeScript/TSX files - passed without warnings.
  - `pnpm exec playwright test --project=chromium --workers=2` - 40 passed; 1 production-only test skipped by design. Focused furniture and wall-fixture movement tests also passed.
  - `pnpm build` - passed on Next.js 16.3.6. `git diff --check` - passed.
- Playwright refreshed existing evidence and `test-results/.last-run.json`; prior tracked failure traces remain removed. Generated artifacts were left in place. Nothing was staged or committed.
- Package 9 is complete. Next: Package 10, move furniture in 3D.

## 2026-11-17 - Package 10: move furniture in 3D

- Added a pure inverse floor-coordinate mapping from world metres to room millimetres and round-trip coverage against the existing forward mapping. Added a shared 50 mm snap helper.
- Extracted the common floor-item move builder and room-bounds validation; both the 2D plan and 3D view now use it before committing through `replace-layout`, preserving one-step undo and the same out-of-bounds refusal.
- Added 3D furniture hit testing and floor-plane dragging with a grab offset, temporary mesh movement, 50 mm snapping, and commit only on pointer release. Layout scene rebuilds are deferred while a drag is active and applied after it ends. Escape and pointer cancellation restore the starting point. Camera orbit remains active on empty space; wall fixtures remain selectable but cannot be moved. Read-only layouts do not start a move.
- Updated the existing 3D test name, added browser coverage for valid and invalid drags, inspector and plan values, one-step undo, Escape, empty-space orbit, wall-fixture immobility, and locked Current; added an axe scan for the 3D state.
- Updated the v2 global and wall-elevation wording, the handoff design-decision list, and the Thai/English 3D hint. The hint retains 2D keyboard movement and directs precise placement to the plan or numeric fields.
- Verification:
  - `pnpm exec tsc --noEmit` - passed.
  - `pnpm test` - 196 passed in 20 files.
  - Scoped ESLint on changed TypeScript/TSX files - passed without warnings.
  - Focused Package 10 browser and axe tests - 3 passed.
  - Full Chromium suite - 43 passed; 1 production-only test skipped by design.
  - `git diff --check` - passed.
  - `pnpm build` - not run while the existing user-owned Next.js dev server was active, to avoid competing for its `.next` output.
- Playwright refreshed existing evidence images and `test-results/.last-run.json`; generated output and pre-existing unrelated worktree changes were left in place. Nothing was staged or committed.
- Package 10 is complete. Next: Package 12, needs presets.

## 2026-11-17 - Package 12: needs presets

- Added the optional language-independent `ResidentProfile.needs` values with schema validation and a `[]` default for older v2 files. `getResidentNeeds(project)` merges these values with the existing Thai/English mobility-aid labels without changing the household data.
- The existing wheelchair-dependent H02 check now uses the merged needs. Check results receive derived need-relevance tags and sort after near-fall results but before the existing status order; statuses and benchmark verdicts remain unchanged.
- Added the six localized need choices in the Resident panel, kept the local-only health-information note, and included needs in the project-export warning and printable report.
- Added missing-data prompts for the listed wheelchair, walker, weak-grip, standing-up and balance cases. Prompt actions navigate to and focus their existing fields or drawing controls; no dimensions, benchmark values or rules are added.
- Updated the v2 specification and handoff design decisions. Thai copy is translated but still needs the native-speaker review required by R1-A11.
- Verification: `pnpm test` - 202 passed in 21 files; `pnpm exec tsc --noEmit` - passed; scoped ESLint - passed without warnings; `git diff --check` - passed. Focused need/accessibility browser tests passed (2), and the full Chromium suite passed with 45 tests and 1 production-only test skipped when run with one worker. The initial two-worker run had timeouts under the active development server; the serial rerun passed.
- `pnpm build` was not run because the existing user-owned Next.js development server was active. No files were staged or committed.
- Package 12 is complete. Next: Package 13, walk-through checklist. Package 11 remains pending until Package 14 and final release verification.

## 2026-11-17 - Package 13: walk-through checklist

- Opened and reviewed the CDC STEADI “Check For Safety” PDF content and the official DOP catalog page/manual citation. No licence statement was found in the CDC PDF; a GPO/DPLA catalog record describes it as public domain under 17 U.S.C. 105. No DOP adaptation licence was located. The user's selection “Confirm DOP rights” requested verification; it did not establish reuse permission. Permission to adapt either source remains an open human verification item before release, recorded in the dataset `licenceNote` fields and `verification.md`.
- Added the `2026.11-draft` checklist dataset with 18 sourced questions for the two supported room types. Every question is pending review, with Thai translations awaiting the native-speaker review in R1-A11. Added Zod validation for dataset shape, sources, question references, unique IDs and reviewed-state metadata.
- Added optional `Project.checklist` answers with an empty default for old projects and a `set-checklist-answer` command. Answers are revisioned edits that make reviews outdated; removed-question answers remain stored and are ignored by current findings.
- Added a Walk-through inspector tab with area grouping, one question at a time, rationale and source link, 44 px answer controls, notes, progress, findings, distinct “get this checked” results, and recommendation drafts using the shared recommendation-draft flow.
- Derived walk-through findings separately from `CheckResult`; they do not enter `evaluateLayout`. Added a separate Walk-through count line in the Checks summary, plus a report section with dataset version, pending-review note, citations, answers, and advice. Answers are included in reports by default and do not count as resident health data.
- Verification: `pnpm test` - 207 passed in 22 files; `pnpm exec tsc --noEmit` - passed; scoped ESLint - passed; `git diff --check` - passed. Full Chromium suite - 47 passed, 1 production-only test skipped. Focused Thai/English axe checks and 390 px keyboard/target-size test passed.
- `pnpm build` was not run because the existing user-owned Next.js development server was active. Playwright refreshed its generated state and removed prior failure traces; no files were staged or committed.
- Package 13 is complete. Next: Package 14, fixes and findings sorted by effort. Package 11 remains pending until Package 14 and final release verification.

## 2026-11-17 - Package 14: actions sorted by effort

- Audited all 16 fixes against the effort rules. Added `getEffortTier` and a new `fixes-2026.11-draft.json`; the two grab-bar installations explicitly override to `building-work` because they need secure wall anchoring. The released `fixes-2026.10.json` remains unchanged.
- Added the “What to do first” action list to Fixes & recommendations and the printable report. It groups fixes, active recommendations, and walk-through findings into the three effort tiers; near-fall rows sort first within each tier.
- Rows show the related check/finding, the default or user-entered material/labour ranges (unknown amounts remain unknown), a near-fall marker when applicable, and Preview for fixes. Applied fixes and completed recommendations/findings leave the list. Finding recommendations retain a question link so they use the checklist's effort tier and are not duplicated.
- Building-work groups display the licensed-professional note. The report includes the same grouped action list before detailed checks.
- Checklist reuse rights remain unconfirmed for both sources; `verification.md` records this as an open pre-release item. The checklist remains draft and all questions remain pending.
- Verification: `pnpm test` - 212 passed in 23 files; `pnpm exec tsc --noEmit` - passed; scoped ESLint - passed; full serial Chromium suite - 48 passed, 1 production-only test skipped. Focused action-list, Thai/English axe, and keyboard/phone-width browser tests passed.
- `pnpm build` was not run because the existing user-owned Next.js development server was active. No files were staged or committed.
- Package 14 is implemented. Next: Package 11, final R1 verification and handoff; record source rights and native Thai review as open unless resolved.

## 2026-11-17 - Package 11: final R1 verification

- Added release-browser coverage for a corrupt v2 entry beside a valid v1 entry (including exact-byte preservation), keyboard-only fix preview/apply and focus return, an on-site verified measurement remaining likely with pending seed data, and a bathroom project with fixture, wet zone and fall data through save, reload, export and import.
- Added Thai and English axe scans for checks, resident, wall, fix preview and report, plus bathroom overflow checks at 390x844, 768x1024 and 1440x900. The existing future-schema import test also confirms the open project stays unchanged. Added `docs/handoff/verification-r1.md` with R1-A01 through R1-A12, the six unverified facts and the open human/source gates.
- Updated the README and removed obsolete “No R1 product code has been written yet” / stale next-task wording from this log.
- Verification: `pnpm exec tsc --noEmit` passed; `pnpm test` passed 212 tests in 23 files; scoped ESLint passed; full serial Chromium suite passed 54 tests with the production-only smoke skipped by design; focused Package 11 browser tests passed; `git diff --check` passed.
- Repository-wide `pnpm lint` still fails on two untouched starter files (`components/ui/carousel.tsx` and `hooks/use-mobile.ts`, both `react-hooks/set-state-in-effect`). `pnpm build` and production smoke were not run because the user-owned dev server PID 41184 owns the workspace `.next` output. WebKit was not run because its executable is missing.
- Visually reviewed all six pages in `docs/handoff/evidence/r1-report.pdf`; no page content is clipped, though the plan's embedded legend on page 2 is small/compressed. Checklist adaptation rights, benchmark/legal-source facts, real-job prices, and native Thai review remain open; R1 is not cleared for release.
- Changed for this package: `tests/e2e/accessibility.spec.ts`, `tests/e2e/recovery.spec.ts`, `tests/e2e/r1-flow.spec.ts`, `docs/handoff/verification-r1.md`, `docs/handoff/README.md`, and this log. Playwright refreshed generated evidence/results; no files were staged or committed.

## 2026-11-17 - Architecture refactor R-B: shared plan scene

- Added `buildPlanScene` as the shared rendering model for the plan canvas and SVG export. It supplies room scale/viewBox, walls, wet zones, overlays, opening geometry, item/fixture footprints, check-marker positions, dimensions, annotations, and the plan schedule.
- Updated the canvas and SVG adapters to consume scene primitives while leaving interaction state and handlers in the canvas. The schedule component accepts the scene's existing schedule instead of rebuilding it.
- Extended `ElevationModel` with ticks, separate preserved canvas/export geometry for benchmark bands and silhouettes, and shared check-outline/badge geometry. The documented canvas/SVG differences (band clipping, label placement, and final wall tick) remain explicit in Open decisions.
- Added focused PlanScene tests and updated the elevation geometry assertion for the new derived geometry. Verification: `pnpm test` passed 217 tests in 24 files; `pnpm exec tsc --noEmit` passed; scoped ESLint passed; `git diff --check` passed.
- Chromium E2E is not verified: the default Playwright port attempted to start a second Next server while the user-owned PID 41184 was already serving port 3000. Retrying against port 3000 started 55 tests, but several timed out; a focused editor test also stayed on the welcome page after clicking the example button and could not find its room heading. The run was stopped rather than terminating the user's server. Investigate against a user-approved isolated server before returning to R-A.
- No build or commit was run. Next: diagnose the Chromium E2E failures and finish R-B verification; then return to R-A.
