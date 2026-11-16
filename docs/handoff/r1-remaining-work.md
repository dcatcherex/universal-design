# R1 remaining work — implementation handoff

Written 2026-11-16 from a fresh audit of the working tree. This document tells the next implementer exactly what is left to finish **R1 (Benchmarks and bathroom)** of บ้านอยู่ดี / Baan Yoo Dee. Where it conflicts with `progress.md`, this document is newer and was checked against the code.

## 0. How to work through this document

**Do one work package per session, in this order.** Do not start the next package in the same session unless the current one is fully checked. Each package is small enough to finish and verify on its own.

| # | Package | Section | Depends on |
|---|---|---|---|
| 1 | Fix the report bug and the four failing browser tests | §4 | — |
| 2 | Price import script and CSV template | §5 | 1 |
| 3 | Wall view SVG download, report evidence, English report check | §6 | 1 |
| 4 | Numeric entry for a fall location; province list note | §8 | 1 |
| 5 | Technical-drawing 2D plan, items 1–3 (walls, doors, symbols) | §11 | 1 |
| 6 | Technical-drawing 2D plan, items 4–7 (dimensions, schedule, labels, palette) | §11 | 5 |
| 7 | Check marks on the plan, wall view, 3D and exports | §12 A | 6 |
| 8 | Summary counts, before and after | §12 C | 1 |
| 9 | Live feedback while moving | §12 B | 7 |
| 10 | Move furniture in the 3D view | §10 | 9 |
| 12 | Needs presets | §13 B | 8 |
| 13 | Walk-through checklist | §13 A | 8 |
| 14 | Fixes and findings sorted by effort | §13 C | 13 |
| 11 | Release verification and the handoff documents. **Runs last, after 14.** | §7 | all others |

This table's order overrides any ordering remark in the sections below (for example the "Step 4" in the title of §7, which now runs last).

**At the start of every session**

1. Read §1 and §2 of this document and the section for your package. Read the spec sections that section names.
2. Run `git status`, `pnpm exec tsc --noEmit` and `pnpm test`. If either command fails before you have changed anything, stop and report it; do not build on a broken state.
3. Read each file you are about to change in full before editing it. Several files have very long lines; edit the smallest piece that works and do not reformat the rest.

**At the end of every package**

1. Run `pnpm exec tsc --noEmit`, `pnpm test`, the scoped eslint command and the browser tests (§3 explains the port).
2. Append a dated entry to `docs/handoff/progress.md`: package number, files changed, each command with its real result, anything left undone.
3. Tell the user what was done and what the next package is. Do not commit unless the user asks.

**Stop and ask the user instead of guessing when**

- A test can only pass by deleting it or loosening what it asserts.
- A change seems to need a new field in the saved project, a new dependency, or a new benchmark value or price.
- The spec and this document disagree on behaviour.
- The same command has failed three times for the same reason.

**About line numbers.** Line numbers here were correct on 2026-11-16 and move as files change. Find the place by searching for the quoted text or name; use the number only as a hint.

**About examples.** Where this document says "for example" before a function or file name, use that name unless it already exists with a different meaning.

## 1. Read first

1. `AGENTS.md` (repo root). This Next.js version differs from older ones; read the relevant guide in `node_modules/next/dist/docs/` before changing any Next-specific code.
2. [v2 specification](../superpowers/specs/2026-10-21-baan-yoo-dee-v2-design.md). Authoritative for behaviour. §14 lists acceptance criteria R1-A01 to R1-A12.
3. [R1 plan](../superpowers/plans/2026-10-21-r1-benchmarks-bathroom.md). Task numbers below refer to it.
4. This document, then `git status`.

## 2. Rules that must hold

- **Benchmarks, never compliance.** Never show "compliant", "safe", "accessible" or "ถูกต้องตามกฎหมาย" as a verdict.
- No definite verdict from a `pending` benchmark value or from a measurement that was not verified on site. Do not mark any seed value `reviewed`.
- No invented prices. Every entry in `prices-2026.10.json` stays `null` until real job data exists.
- "No benchmark value" and "not evaluated" are never shown as a pass or a failure.
- Fall history and body measurements stay out of the report unless the user turns them on.
- R1 is local only: no backend, sign-in, telemetry or deployment. No new runtime dependency without a written reason in `progress.md`.
- Never delete or weaken a test to get a green run. Change an expected value only when the test is wrong, and say why.
- **Nothing is committed.** The whole app (v1 and R1) is uncommitted on top of the commit `10ae31a starter`; about 86 paths are modified or untracked. Do not reset, stash, clean or check out files. Commit only if the user asks.
- **Edit files with the editor tools, not shell string replacement.** The one confirmed bug below came from PowerShell emptying `${...}` inside double-quoted strings during a scripted edit.

## 3. Verified state on 2026-11-16

| Command | Result |
|---|---|
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm test` | Pass: 172 tests in 17 files |
| `pnpm exec eslint components/planner lib/planner tests/planner tests/e2e playwright.config.ts` | Pass, no warnings |
| `pnpm lint` | 2 errors, both in untouched starter files (`components/ui/carousel.tsx:98`, `hooks/use-mobile.ts:14`). Known since v1; leave them. |
| `pnpm build` | Pass |
| Browser tests, Chromium | **27 pass, 4 fail, 1 skipped by design.** All 4 failures are in `tests/e2e/r1-flow.spec.ts` (§4). |
| Production smoke test, WebKit smoke test | Not run since R1 began |

**Running the browser tests.** Next allows one dev server per project folder. If the user already has one running, Playwright cannot start its own on port 3100 and stops with "Process from config.webServer was not able to start". Read the port from `.next/dev/lock` and reuse that server (on 2026-11-16 it was port 3001):

```powershell
$env:PLAYWRIGHT_HOST='localhost'; $env:PLAYWRIGHT_PORT='3001'
pnpm exec playwright test --project=chromium --workers=2
```

Do not stop the user's dev server. If no server is running, plain `pnpm test:e2e --project=chromium --workers=1` works.

### What is already built

Do not rebuild these. Plan Tasks 1 to 8 are implemented with unit tests; Tasks 9 and 10 are mostly implemented.

- **Visual upgrade (not in the R1 plan):** new furniture meshes, wood floor, soft shadows, cutaway 3D view, catalog thumbnails (`lib/planner/scene/thumbnails.ts`, `thumbnail-key.ts`, `components/planner/use-thumbnails.ts`), finish swatches.
- **Task 1–2:** schema v2 in `types.ts` and `schema.ts`, `migrate.ts`, `layout-access.ts`, storage key `baan-yoo-dee.project.v2`, v1 import upgrade, both example projects in `fixtures.ts`.
- **Task 3:** `lib/planner/standards/` with `benchmarks.ts`, `benchmark-keys.ts`, `verdicts.ts`, `schema.ts`, `provinces.ts`, and the data files `benchmarks-th-2026.10-draft.json` and `provinces-th.json`.
- **Task 4:** checks D01, D02, D03, H03 and the G04/G05 benchmark fallback in `checks.ts`; verdict rows in `benchmark-verdicts.tsx`; the benchmark banner and the primary-benchmark control (both inside `checks-panel.tsx`, not separate files); verification method entry in `measure-field.tsx`.
- **Task 5–6:** bathroom catalog entries, `fixtures-catalog.ts`, `fixture-inspector.tsx`, `scene/fixture-mesh.ts`, fixtures and wet areas in `plan-canvas.tsx`, checks B01–B06.
- **Task 7:** `resident-panel.tsx`, fall markers, H01, H02, near-fall tagging and sorting, commands `set-resident` and `set-report-options`.
- **Task 8:** `elevation.ts`, `wall-elevation.tsx`, the Plan / Wall / 3D switch.
- **Task 9 (partly):** `standards/fixes.ts`, `prices.ts`, `fixes-2026.10.json` (16 fixes), `prices-2026.10.json`, the `apply-fix` command, `fix-preview.tsx`.
- **Task 10 (partly):** verdict table, dataset version, disclaimer and fall-history toggle in the report; health-data warning on project download (`project-menu.tsx:38`); fixtures and wet areas in the plan SVG.
- **Locales:** new keys live in `lib/planner/locales/en-r1.ts` and `th-r1.ts`.

Test files differ from the plan's names. The coverage exists, in these places:

| Plan named | Actual location |
|---|---|
| `layout-access.test.ts` | `tests/planner/migrate.test.ts` |
| `verdicts.test.ts` | `tests/planner/benchmarks.test.ts` |
| Schema v2 limits, elevation, fixture geometry, v2 report tests | `tests/planner/fixes.test.ts` |
| D01–D03, H01–H03, B01–B06, near-fall | `tests/planner/bathroom-checks.test.ts` |

## 4. Step 1 — make the browser tests green

Four tests fail. One cause is a real bug; three are wrong expectations in the test file.

### 4.1 Real bug: four blank values in the report

File `components/planner/report-preview.tsx`. Four template strings lost their `${...}` parts. A scan of every planner, lib and test file found no other damaged string.

| Line | Now renders | Must render |
|---|---|---|
| 119 | `` `–  · ` `` | Reach band low and high in cm, then the posture label: `data.residentNeeds.reach.low.valueMm / 10`, `…high.valueMm / 10`, `t(locale, 'unitCm')`, and `t(locale, reach.posture === 'seated' ? 'postureSeated' : 'postureStanding')` |
| 120 | `` ` ×  ` `` | Wheelchair width × length in cm: `wheelchair.width.valueMm / 10`, `wheelchair.length.valueMm / 10`, `t(locale, 'unitCm')` |
| 122 | `` ` · ` `` after the fall's time label | `` ` · ${fall.note}` `` |
| 126 | `` ` · ` `` | `` `${t(locale, BENCHMARK_NAME[data.benchmarks.primary.primary])} · ${data.benchmarks.primary.chosenBy}` `` |

The data shapes are in `lib/planner/exports/report-data.ts` (`ReportData`). `BENCHMARK_NAME` is already imported. The keys `unitCm`, `postureSeated` and `postureStanding` exist.

Exact replacements. In each case replace only the damaged template string, found by searching for the label key at the start of the line:

```tsx
{/* reachBand line: replace `–  · ` with */}
`${data.residentNeeds.reach.low.valueMm / 10}–${data.residentNeeds.reach.high.valueMm / 10} ${t(locale, 'unitCm')} · ${t(locale, data.residentNeeds.reach.posture === 'seated' ? 'postureSeated' : 'postureStanding')}`

{/* wheelchairSize line: replace ` ×  ` with */}
`${data.residentNeeds.wheelchair.width.valueMm / 10} × ${data.residentNeeds.wheelchair.length.valueMm / 10} ${t(locale, 'unitCm')}`

{/* report-falls list item: replace {fall.note ? ` · ` : ''} with */}
{fall.note ? ` · ${fall.note}` : ''}

{/* primaryBenchmark line: replace ` · ` with */}
`${t(locale, BENCHMARK_NAME[data.benchmarks.primary.primary])} · ${data.benchmarks.primary.chosenBy}`
```

Then run `pnpm exec tsc --noEmit`. If TypeScript reports a possibly-null value, the surrounding `? … : '—'` check was changed by mistake; restore it.

Add a regression check so this cannot return unnoticed. In the report browser test (4.2, fourth row), assert that the report contains the wheelchair size entered in the test (`75`), and after choosing a primary benchmark that the report names it.

### 4.2 Wrong expectations in `tests/e2e/r1-flow.spec.ts`

| Test (line) | Problem | Change |
|---|---|---|
| "upgrades a v1 project file…" (43) | Expects `การทบทวนไม่เป็นปัจจุบัน`. The real `reviewOutdated` text in `locales/th.ts:253` is `การทบทวนเป็นข้อมูลเก่า`. | Use the real text. |
| "an advisor chooses the primary benchmark…" (105, 110) | Line 105: `getByLabel('เกณฑ์หลัก', { exact: true })` never matches. The failure snapshot shows the control is present as `combobox "เกณฑ์หลัก"`; the likely reason is that the wrapping `<label>` text includes the option texts. Line 110 repeats the wrong review text. | Line 105: `policy.getByRole('combobox', { name: 'เกณฑ์หลัก', exact: true })`. Line 110: use `การทบทวนเป็นข้อมูลเก่า`. Lines 106–108 have not run yet, so expect to adjust them. |
| "previews and applies a fix…" (132) | Expects `ยังไม่ทราบค่าใช้จ่าย`. The real `unknownCost` text in `locales/th.ts:259` is `ยังไม่ทราบต้นทุน`. | Use the real text. Lines 134–136 (undo) have not run yet. |
| "records the resident, marks a fall…" (269) | Fails because of the bug in 4.1 (the fall note is blank). | Fix 4.1. Lines 270–274 (axe scan on the report, print, PDF) have not run yet. |

After each fix, rerun only that file: `pnpm exec playwright test tests/e2e/r1-flow.spec.ts --project=chromium --workers=1` (with the host and port variables from §3 if needed). If a later assertion fails, decide whether the app or the test is wrong by reading the spec; do not loosen an assertion to pass.

**Done when:** the full Chromium suite reports 31 passed, 1 skipped, 0 failed, and `docs/handoff/evidence/r1-report.pdf` exists.

## 5. Step 2 — finish Task 9: price import script and template

Neither file exists. `scripts/` and `docs/data/` do not exist either.

**`docs/data/price-collection-template.csv`** — header row exactly:

```text
priceKey,region,materialsLow,materialsHigh,labourLow,labourHigh,jobDate,province,note
```

Add two or three example rows clearly marked as examples (for instance `note` = `EXAMPLE — delete this row`). Amounts are whole baht.

**`scripts/import-prices.ts`** — reads a filled CSV and writes a new `lib/planner/standards/data/prices-<version>.json`.

- Put the logic in a pure function in `lib/planner/standards/` (for example `import-prices.ts` exporting `importPrices(csvText, basePrices, version)` returning a `Result`), so it can be unit tested. The script file only reads the file, calls the function and writes the result.
- Validate the output with the existing price schema in `lib/planner/standards/schema.ts`.
- Reject, with the row number in the message: a high value below its low value, a `priceKey` not present in the current price list, and a region outside the `PriceRegion` union.
- For each (`priceKey`, region): with 3 or more jobs, the band is the lowest low and the highest high, converted from baht to integer satang. With fewer than 3, leave that region `null` and report which pairs were skipped and why.
- Set `sampleSize`, `collectedAt` (latest `jobDate`) and `sourceNote` on each entry it fills.
- Never edit `prices-2026.10.json`; always write a new versioned file.
- No new dependency. Parse the CSV by hand (quoted fields with commas must work).
- **How it runs (decided):** the machine has Node 24, which runs `.ts` files directly. Invoke it as `node scripts/import-prices.ts <input.csv> <version>`. For that to work:
  - The pure module `lib/planner/standards/import-prices.ts` must be self-contained: no value imports from other project files and no `@/` alias. `import type` is fine, because Node removes it.
  - The script imports it with the full file name: `import { importPrices } from '../lib/planner/standards/import-prices.ts'`. Add `"allowImportingTsExtensions": true` to `compilerOptions` in `tsconfig.json` so the type checker accepts that.
  - Because the pure module cannot import the Zod price schema, schema validation of the output happens in the unit test, which can import both.
  - Do not use TypeScript features that need compiling (`enum`, `namespace`, constructor parameter properties) in these two files.
- There is no `tsx` or `ts-node`; do not add one.

**Tests** (add to `tests/planner/fixes.test.ts` or a new `tests/planner/import-prices.test.ts`): the three rejections, the 3-job rule, the under-3 skip message, satang conversion, and that the output validates.

**Done when:** tests pass and the template opens correctly in a spreadsheet.

## 6. Step 3 — finish Task 10: wall view download and report evidence

1. **Wall elevation SVG download** (missing). Add a pure `createElevationSvg(model, locale)` beside `createPlanSvg` in `lib/planner/exports/`, built from the `ElevationModel` that `buildElevation` returns, with escaped labels like `plan-svg.ts`. Add a menu item in `components/planner/export-menu.tsx` that downloads the currently selected wall. It is available only in the wall view; otherwise it is disabled with an explanation, as the spec requires for every unavailable action. Add both locale keys. Unit test: fixtures, openings and the height scale are present, and a script-like label is escaped.
2. **Report evidence.** Once §4 is green, `r1-report.pdf` is produced by the test. Rasterise its pages to `docs/handoff/evidence/r1-report-page-N.png` and look at every page: the verdict table header repeats across pages, no Thai text is clipped, and the disclaimer is present. Fix print CSS in `app/globals.css` if not.
3. **English report check.** No browser test opens the R1 report in English. Add one assertion set for English: dataset version, disclaimer text, both benchmark names.

## 7. Step 4 — finish Task 11: release verification

Add these browser tests. Follow the style of the existing spec files.

| Add to | Coverage needed |
|---|---|
| `tests/e2e/recovery.spec.ts` | A corrupt v2 storage entry beside a valid v1 entry offers recovery and leaves the v1 entry byte-identical. A file with `schemaVersion: 3` is refused and the open project stays. (The unit test for the first case already exists at `migrate.test.ts:144`.) |
| `tests/e2e/accessibility.spec.ts` | Axe scans in **both** locales on: checks panel with verdicts, resident panel, wall view, fix preview, R1 report. Today these run in Thai only, inside `r1-flow.spec.ts`. Add 390×844, 768×1024 and 1440×900 checks for the bathroom example with no horizontal overflow. |
| `tests/e2e/r1-flow.spec.ts` | Keyboard-only fix flow: reach a fix button, open the preview, apply, and confirm focus returns sensibly. A measurement verified "on site" by the advisor still shows a "likely" verdict (seed values are pending). Save, reload and file round-trip of a bathroom project with a fixture, a wet area and a fall. |

Then run everything and record real outcomes:

```powershell
pnpm lint
pnpm exec eslint components/planner lib/planner tests/planner tests/e2e playwright.config.ts
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm exec playwright test --project=chromium --workers=1
$env:PLAYWRIGHT_PRODUCTION='1'; pnpm exec playwright test tests/e2e/production.spec.ts --project=chromium --workers=1
```

The production test needs its own port and a finished build; it cannot reuse the dev server.

**Write `docs/handoff/verification-r1.md`:** one row per criterion R1-A01 to R1-A12 with result, evidence (test name or file) and limits, in the format of `verification.md`. List the six unverified facts from spec §13 with their status. Mark a criterion passed only if its command ran and passed in this session. **R1-A11 stays "not passed" until a native Thai speaker has reviewed the copy** (§9).

**Update `docs/handoff/progress.md`:** add a dated R1 section with completed task numbers, changed files, commands and outcomes, limitations, and the next step. Remove the stale line "No R1 product code has been written yet". Update the "Next work" section of `docs/handoff/README.md` to match.

## 8. Known gaps against the spec

The handling of each one is decided below. "Record" means: list it under limitations in `verification-r1.md` (package 11) and change no code.

| Gap | Where | Handling (decided) |
|---|---|---|
| Wet areas are edited as numbers in the room editor; they cannot be drawn or dragged on the plan (plan Task 5 says "draw, edit and remove them in the plan"). | `room-editor.tsx:120–158`, `plan-canvas.tsx:228` | Record as a limitation. The numeric editor meets R1-A06. |
| A fall location is set by clicking the plan only; there is no numeric entry (plan Task 7 asks for one). | `resident-panel.tsx:89–93` | **Implement (package 4).** Two cm fields per fall, X and Y, using the existing `measure-field` number handling. Values outside the room are refused with a message. Add a browser test that sets a fall location by typing only. It is the keyboard-accessible path, so it matters for R1-A11. |
| Focusing a fall marker does not list its nearby results (plan Task 7). | `plan-canvas.tsx` fall marker | Record. Package 7 adds badges that link entities to their results, which covers the need. |
| Province names, codes and regions were written from memory. | `standards/data/provinces-th.json` | Record as needing a human check. Do not edit the list from memory. |
| Department of Older Persons page and section references were written from memory. | `benchmarks-th-2026.10-draft.json`, every `th-dop-home` `clause` | Part of Task 0a (§9). Values stay `pending`, so nothing is presented as verified. |
| Evidence screenshots for v1 (`m1-…` to `m4-…`) were overwritten by later test runs and now show the new visuals. | `docs/handoff/evidence/` | Leave them; note it in `progress.md`. |
| `test-results/` contains failure traces from earlier runs. | repo root | Generated output; do not treat as source. |

## 9. Work only a person can do

Do not attempt or simulate these. List them as open in `verification-r1.md`.

- **Task 0a — benchmark verification.** Check every row of spec §7.2 against the Royal Gazette text and the Department of Older Persons manual, then issue dataset `2026.11` with confirmed values marked `reviewed`. Until then every verdict correctly reads "likely".
- **Task 0b — price collection.** 15–20 completed jobs per region per `priceKey`, using the template from §5.
- **Native Thai review** of `locales/th-r1.ts` and the disclaimer. Record reviewer name and date.
- **Commit decision.** The user has not asked for a commit.

## 10. Approved addition — move furniture in the 3D view

The user asked for this on 2026-11-16. It is not part of the R1 plan or its acceptance criteria. Do it after §4 is green; it does not block §5 to §7.

**This reverses a design decision.** Spec §3 and §9 say the 3D view is for inspection and selection only. The user has now chosen to allow moving floor furniture in 3D. Update the wording in the v2 spec §3 (third-from-last bullet group, "Furniture is placed only in the 2D plan…"), the "Design decisions to preserve" list in `README.md`, and the on-screen hint above the 3D view (Thai: "ใช้ตรวจดูและเลือกสิ่งของ ย้ายตำแหน่งได้ในแผนผัง 2 มิติ", and its English pair).

**Scope**

- In: dragging furniture items across the floor in the 3D view, for the layout that is editable in 2D.
- Out: wall fixtures (grab bars, switches, sockets, shelves, basin) stay read-only in 3D; the wall view edits them. No drag-to-rotate, no vertical movement, no resizing, no adding or deleting in 3D.

**Behaviour**

- Pointer down on a furniture mesh starts a move and selects it. Pointer down on empty space orbits the camera, as now.
- While dragging, the piece follows the pointer on the floor plane and snaps to 50 mm. Camera orbit is disabled for the duration of the drag.
- Release commits once through the same path the 2D plan uses, so it is one undo step and passes the same validation. A position the 2D plan would refuse is refused here too: the piece returns to where it started and the same reason is shown.
- Escape cancels the drag and restores the position.
- A read-only layout (family view of a locked state, or any case where 2D dragging is disabled) does not start a drag.
- Touch: one finger on empty space orbits. A piece must be selected first (tap), and then a one-finger drag that starts on the selected piece moves it.
- The numeric fields and the 2D plan remain the precise way to place things. Say so in the hint text.

**Where to work**

- `components/planner/room-view-3d.tsx`: `OrbitControls` is created near line 130; the `Raycaster`, `onPointerDown` and `onPointerUp` that do selection are near lines 164–184. Add a `pointermove` handler and an `onMoveItem(id, center)` prop. Remove every new listener in the existing cleanup block (near line 219).
- `components/planner/plan-canvas.tsx` lines 108–146: the existing 2D drag (start, clamp, commit, cancel). Reuse its validation and commit path; move shared logic into `lib/planner/` if needed and do not copy it.
- `lib/planner/scene/build-scene.ts`: the millimetre-to-metre mapping on the x/z floor plane. Add the inverse as a pure function (floor point in metres to room millimetres) and unit test it against the forward mapping.
- `components/planner/workspace.tsx`: pass the commit handler to the 3D view.

**Implementation notes**

- Get the floor position by intersecting the pointer ray with the plane y = 0, and keep the offset between the grab point and the item centre so the piece does not jump under the pointer.
- The scene is rebuilt when `layout` changes (the effect depends on it). During a drag, move the existing mesh group directly and request a redraw; commit to the project only on release. Do not commit per frame, and do not let a rebuild interrupt a drag in progress.
- Keep the on-demand drawing and the resource cleanup that v1 criterion A11 depends on. The mount/unmount canvas-count test in `tests/e2e/editor.spec.ts` must still pass.
- Domain code must not import Three.js; the inverse mapping takes and returns plain numbers.

**Tests**

- Unit: the inverse mapping round-trips with the forward mapping; snapping rounds to 50 mm.
- Browser (add to `tests/e2e/editor.spec.ts`): drag a piece in 3D and assert its new `data-x-mm` / `data-y-mm` in the 2D plan and in the inspector fields; undo restores it in one step; a drag to outside the room leaves the position unchanged and shows the reason; dragging on empty space still orbits and moves nothing; a wall fixture cannot be dragged.
- Update the existing test "loads a read-only 3D inspection for the active proposal…" in `editor.spec.ts`: its name and any assertion that 3D cannot change geometry no longer hold. Change only what this decision changes, and say so in `progress.md`.
- Run axe on the 3D view state again. Keyboard users keep the existing 2D arrow-key movement; state this in the hint so the 3D drag is not the only way.

**Done when:** the tests above pass, the spec, README and hint text are updated in both languages, and the change is listed in `progress.md` as a user-approved departure from the original spec.

## 11. Approved addition — technical-drawing style for the 2D plan

The user asked for this on 2026-11-16, with a reference image of an architect-style floor plan (dimension lines, plan symbols, numbered items and an item schedule). Use the reference for layout and drawing conventions only; draw original symbols. It is not part of the R1 acceptance criteria. Do it after §4 is green.

**What does not change:** the data is already exact (integer millimetres). This work makes the plan *show* that precision. No schema change, no new dependency.

**Scope: one room, as R1.** The reference shows several rooms; that is R2. Do not add rooms here. Design every piece below so it works per room and will carry over.

**Build these, in this order**

1. **Walls with thickness.** Draw the four walls as filled bands outside the room rectangle (display thickness 100 mm; a constant, not a measurement, and not stored). Openings cut a real gap in the band. Windows are a thin double line in the gap. The room's inner edge stays at exactly 0 and at the room width and depth, so no coordinate changes.
2. **Door leaf and swing.** Draw the door leaf as a line from the hinge and the swing as a quarter-circle arc, from `getDoorSector` in `geometry.ts`. Hinged-out doors swing outside the room, dashed, as now. Sliding doors show the leaf along the wall with a small arrow.
3. **Plan symbols for items.** Replace the rounded rectangle with a line-drawn top view per catalog entry, drawn inside the item's exact footprint so the outline is still the true width and depth:
   - Round things are round: the water jar is a circle or ellipse (today it is a square in 2D and round in 3D).
   - Toilet: tank rectangle plus bowl ellipse. Squat toilet: pan outline with foot pads. Basin: rounded bowl with a tap dot. Shower seat: square with slats.
   - Sofa and armchair: back and arm outlines. Chair: seat and back. Table: plain outline. Bed (when added): pillows and fold line. Cabinet: outline with a door line.
   - Unknown or custom entries fall back to a plain rectangle with a diagonal.
   - Put the symbol drawings in one pure module, for example `lib/planner/plan-symbols.ts`, returning SVG path data in a unit box that is scaled to the footprint and rotated with the item. Both the on-screen plan and the export must call it (see "Where to work").
4. **Dimension lines.** In blue, with tick ends and the value in metres to two decimals (`1.80 m`), matching the existing caption format:
   - Always: overall room width above the north wall and depth beside the west wall, outside the wall band.
   - Always: along each wall that has openings, the chain of segments (wall, opening, wall).
   - For the **selected item only**: the clear distance from each of its four sides to the nearest wall. This is the number an advisor needs, and showing it for every item at once is unreadable in a small room.
   - A toggle in the plan caption turns dimensions off and on; default on. Remember it in preferences (`preferences.ts`), not in the project.
   - Extend the SVG `viewBox` by a margin for the outside dimensions. Pointer-to-model conversion (`modelPoint`) must still return room millimetres; cover this with a test, because placement, dragging and fall picking all depend on it.
5. **Item numbers and schedule.** Number items in a stable order (by position in the layout's item list). Show the number beside each symbol. Below the plan, an "Item schedule" table: number, label, width × depth in metres. Selecting a row selects the item and the reverse. Wall fixtures get their own short list under it with height above floor.
6. **Room label, area, scale bar, north arrow.** Room type label and area in m² (width × depth for the rectangle) at the room centre, moved aside when an item covers it. A 1 m scale bar at bottom left. A north arrow at top right; "north" is the plan's top edge by the existing wall-naming convention, so label it as plan north.
7. **Palette.** White sheet, dark grey walls, black symbol lines, blue dimensions and numbers. Keep the existing meanings: selection, changed-by-fix highlight, routes, turning circles, wet areas and fall markers must stay distinguishable by shape or pattern, not colour alone. Check contrast against WCAG 2.2 AA.

**Where to work**

- `components/planner/plan-canvas.tsx`: the interactive plan. The SVG starts near line 193; floor, grid and wet areas near 226–231.
- `lib/planner/exports/plan-svg.ts`: the exported and printed plan. **It draws the plan separately from the canvas.** Do not write the new drawing twice. Move the shared static parts (walls, openings, symbols, dimensions, numbers, scale bar) into pure functions under `lib/planner/` that return geometry or path data, and call them from both.
- `app/globals.css` near lines 330–346: plan styles. Sizes use the `--k` scale variable so line weights stay constant on screen; follow that pattern for new strokes and text.
- `components/planner/report-preview.tsx`: the report shows the plans. Add the item schedule to each plan section and check the printed pages.
- Locale keys go in both `en-r1.ts` and `th-r1.ts`.

**Keep working**

- Every existing browser test reads `data-item-id`, `data-x-mm`, `data-y-mm`, `data-overlay-id`, `data-wet-zone-id`, `.plan-fixture`, `.fall-marker` and the `aria-label` starting "แผนผังห้อง". Keep these attributes on the same logical elements.
- Dragging, keyboard movement (10 mm, Shift 50 mm), placement preview, overlay drawing and fall picking must behave as before.
- At 390 px width the plan must stay readable: hide the per-wall chains below a width threshold and keep the overall dimensions.

**Tests**

- Unit: each symbol stays inside its unit box; dimension chains for a wall with one and two openings sum to the wall length; clear distances for a rotated item; schedule order and values; the exported SVG contains dimensions, numbers and escaped labels.
- Browser: dimension text for the bathroom example reads `2.00 m` and `1.80 m`; selecting the toilet shows four clearances that match its position; the toggle hides them and survives a reload; schedule row and plan selection stay in sync; a click-to-place after the `viewBox` margin lands at the expected millimetres; axe scan in both locales; no horizontal overflow at 390 px.
- Replace the evidence images `r1-bathroom-2d.png` and the report PDF after the change, and look at them.

**Done when:** the tests pass, the on-screen plan and the exported SVG match each other, and `progress.md` records this as a user-approved addition.

### Related decision: 3D objects stay code-drawn

Agreed with the user on 2026-11-16: new 3D objects are built from simple shapes in `lib/planner/scene/furniture-mesh.ts`, like the existing ones. Do not add model-file loading (GLB) or user model upload yet. When adding a catalog entry, add its 3D mesh, its 2D plan symbol (item 3 above) and its thumbnail together, and extend the scene test that checks every catalog part stays inside its declared width, depth and height. The user has not yet listed which new objects are needed; ask before adding any.

## 12. Approved addition — show check results where the user is working

The user approved these three on 2026-11-16. They are display work on checks that already exist: **no new rule, no new benchmark value, no schema change.** Do them after §4 is green. Part A touches the same plan drawing as §11, so do §11 first or together with it.

All three read the same source: `evaluateLayout(project, layoutId)` in `lib/planner/checks.ts`, already computed once per change in `components/planner/workspace.tsx:71` as `checkResults`. Each `CheckResult` has `entityIds`, `status`, `nearFall`, `verdicts` and `ruleId` (`lib/planner/types.ts:194`). Do not compute checks a second way.

**Wording rules for all three (spec §3 and §7).** Use only the existing status words: "needs attention", "likely does not meet", "not evaluated", "meets / likely meets". Never "compliant", "safe", "accessible", "pass", "fail", or a score that reads as a grade. "Not evaluated" and "no benchmark value" are never counted or coloured as a problem or as a success.

### A. Mark problems on the plan and in 3D

- Add a pure function, for example `getEntityStatuses(results): Map<entityId, { status, nearFall, resultIds }>` in `lib/planner/checks.ts`. For an entity in several results the worst status wins: `attention`, then `not-evaluated`, then `clear`.
- **2D plan** (`plan-canvas.tsx`): an entity with `attention` gets a distinct outline **and** a small warning badge at its corner; `not-evaluated` gets a dashed outline and a "?" badge; `clear` gets no mark. Shape and pattern carry the meaning, not colour alone. This applies to items, openings, wall fixtures, routes and turning areas. It must stay distinguishable from the existing `selected` and `changed` (fix preview) styles, and from the fall marker.
- A badge is a button: activating it opens the Checks tab and scrolls to that entity's first result. This is the reverse of the existing `selectCheckLocation`. Give it an accessible name such as "Toilet: 2 points need attention".
- Results with no entity (room-level ones such as B05 floor) show as a badge in the plan caption, not on an object.
- **3D view** (`room-view-3d.tsx`, meshes built in `lib/planner/scene/`): tint or outline the meshes of `attention` entities. 3D is a secondary view, so a visual mark is enough there; the 2D badges and the list are the accessible path.
- **Wall view** (`wall-elevation.tsx`): same marks on fixtures and openings.
- A "show check marks" toggle in the plan caption, default on, stored in preferences with the dimension toggle from §11.
- Export: the plan SVG and the report plans show the same marks, with a legend line.

### B. Live feedback while moving things

- While an item is being dragged or moved by keyboard in the 2D plan (and in 3D once §10 exists), and while a fixture is dragged in the wall view, recompute the checks against a **preview copy** of the layout with the entity at its transient position. Do not commit, and do not add history entries, until release — the existing single-commit behaviour stays.
- Put the preview evaluation in a pure helper, for example `evaluateWithMove(project, layoutId, entityId, position)`, which builds the changed layout and calls `evaluateLayout`. Unit test that the input project is unchanged.
- Show the result in two places during the move: the marks from part A update on the moved entity and on anything it now affects (a blocked route, a door swing), and a small status chip follows the dragged entity with the count and the first message, for example "1 point needs attention: blocks the walking route". When nothing needs attention the chip says so in plain words, not "OK" or "safe".
- An `aria-live="polite"` region announces a change of status (not every pixel): only when the set of attention results for the moved entity changes.
- Performance: evaluate at most once per animation frame, and skip when the snapped position has not changed. Rooms are limited to 100 items and 60 fixtures; measure on the example before adding any caching.
- An out-of-bounds position keeps its existing refusal message and takes priority over the chip.

### C. Summary of results, before and after

- Add a pure function, for example `summarizeChecks(results): { attention, likelyAttention, notEvaluated, clear, total, nearFall }` in `lib/planner/checks.ts`. "Likely" follows the verdicts; a result counts once, by its overall `status`.
- **Checks tab header:** one line of counts with icons and text, for example "5 need attention · 1 not evaluated · 8 meet or likely meet". Clicking a count filters the list to that group.
- **Before → after:** when a Proposed layout exists, show both layouts' counts side by side ("Current 5 → Proposed 2 need attention") in the Checks tab and in the editor toolbar next to the Current/Proposed switch. Compute Proposed with the same function on `evaluateLayout(project, 'proposed')`.
- **Report:** add the same before/after line at the top of the checks section, and list which results changed status between the two layouts. Match results by rule and entity IDs; result IDs include the layout, so do not compare IDs directly.
- No percentage, no score, no "X% universal design". State counts only, and keep the benchmark banner ("values pending review") visible beside them.

**Tests**

- Unit: worst-status merge for an entity in several results; summary counts on the bathroom example (it has D01, D03, B01, B02, B03 needing attention and B05 not evaluated); before/after change list after applying the "rehang outward" fix; the preview helper leaves its input unchanged and reports a blocked route when a solid item is moved into the corridor of the living-room example.
- Browser: the bathroom example shows a badge on the door and the toilet and none on the water jar unless it sits in the wet area; activating the toilet badge opens its result; dragging the living-room example's blocking item out of the corridor changes the chip and the route mark before release, and Escape restores both; counts in the header match the number of result rows; after applying a fix the toolbar shows the lower Proposed count; the toggle hides the marks and survives a reload; axe scans in both locales; the live region announces a status change.
- Keep every existing `data-*` attribute and `data-check-status` value the current tests read.

**Done when:** the tests pass, the marks and counts in the exported plan and report match the screen, and `progress.md` records this as a user-approved addition.

**Deliberately left out** (discussed with the user, not approved): drawing required clear-space zones in front of the toilet and basin or beside doors. That needs benchmark values looked up and verified first (Task 0a), so do not add it here. Lighting, contrast, bed height, stairs and ramps belong to R2.

## 13. Approved addition — walk-through checklist, needs presets, and fixes sorted by effort

The user approved these three on 2026-11-16. They help families who cannot measure precisely. None needs a new benchmark value or price. These are packages 12, 13 and 14 (see the end of this section); do them after package 8.

**Schema rule for all three.** New saved data is added as **optional fields with defaults**, so `schemaVersion` stays 2 (spec §6 versioning rule). The schema fills the default when the field is missing, and a project saved before this change must still open. Add a unit test for exactly that: a v2 project without the new fields validates and gets the defaults.

### A. Guided walk-through checklist

Hazards that are not geometry: loose rugs, cables across walkways, night lighting, clutter, a phone within reach. The user answers questions; nothing is measured.

**Content must not be invented.** Questions come from published home fall-risk checklists, and every question cites its source.

- Create `lib/planner/standards/data/checklist-2026.11-draft.json`, validated by a Zod schema in `standards/schema.ts` and loaded like the benchmark data:

  ```text
  ChecklistDataset = { datasetVersion, sources: ChecklistSource[], questions: ChecklistQuestion[] }
  ChecklistSource  = { id, title, publisher, url, licenceNote }
  ChecklistQuestion= { id, area: 'floors' | 'lighting' | 'bathroom' | 'furniture' | 'emergency' | 'entrance',
                       roomTypes: RoomType[],            // which room types show it
                       text: {th,en}, why: {th,en},       // the question, and why it matters
                       hazardAnswer: 'yes' | 'no',        // which answer means a hazard
                       advice: {th,en},                   // what to do about it
                       effort: 'no-cost' | 'small-job' | 'building-work',   // used by part C
                       sourceId, sourceRef: string,       // page or item in the source
                       review: { status: 'pending' | 'reviewed', reviewer?, reviewedAt? } }
  ```

- **Sources to draw from:** the US CDC STEADI home fall prevention checklist ("Check for Safety") and the Department of Older Persons manual already cited in the benchmark data. Before writing any question, open the source and confirm it exists, what it says, and that its licence allows adaptation; write what you found in `licenceNote`. If you cannot open a source in this session, **stop and ask the user** — do not write questions from memory.
- Seed with 15–25 questions that fit the two existing room types. Every seed question is `pending`. The Thai text is a translation that needs the native review in §9.
- **Saved answers** (optional field with default `[]`):

  ```text
  Project.checklist?: { questionId: string, answer: 'yes' | 'no' | 'unsure' | 'not-applicable', note: string, answeredAt: string }[]
  ```

  Add a command `set-checklist-answer { questionId, answer, note }`. It is a substantive edit: it increments `revision` and makes a review outdated, like other content changes. Answers to questions no longer in the dataset are kept and ignored.
- **Screen:** a new inspector tab "Walk-through" (เดินสำรวจบ้าน). Questions are grouped by area, one at a time on a phone, with large Yes / No / Not sure / Does not apply buttons (44 px targets), an optional note, and a progress line ("7 of 18 answered"). Each question shows its "why" text and its source.
- **Results:** a hazard answer becomes a finding with its advice. "Not sure" becomes "get this checked". Unanswered questions are "not answered" and never counted as fine. Findings are listed in the walk-through tab and in the report under their own heading, separate from the benchmark checks, with the dataset version and the note that the questions are pending review.
- Findings are **not** `CheckResult`s and have no verdicts: they are a person's answer, not a measurement. Do not mix them into `evaluateLayout`. They do appear in the summary counts of §12 C as a separate line ("Walk-through: 3 hazards noted, 4 not answered").
- A finding can create a recommendation draft through the existing `createRecommendationDraft` path, pre-filled with the advice text.
- Not health data: answers describe the home. They are included in the report by default.

### B. Needs presets

Today the setup has three mobility aids as free text, stored in the display language (`project-setup.tsx`, `aidsOptions`), and matched back by `canonicalMobilityAids` in `standards/benchmarks.ts`. Only "wheelchair" changes any check.

- **Saved data** (optional field with default `[]`), language-independent:

  ```text
  ResidentProfile.needs?: ('cane' | 'walker' | 'wheelchair' | 'weak-grip' | 'difficulty-standing-up' | 'unsteady-balance')[]
  ```

  Keep `household.mobilityAids` as it is and keep reading it. Add one pure function `getResidentNeeds(project)` that merges the new field with `canonicalMobilityAids(household.mobilityAids)`, and make every check that asks "does the resident use a wheelchair" call it.
- **Do not add vision, memory or continence options.** Spec §11 says those are not collected. The user suggested "poor eyesight"; it is left out for this reason and listed as an open question for the user below.
- This is health information. Put the control in the Resident panel beside the existing fields, with the same explanation that it stays on this device, and include it in `hasHealthData` so the export warning covers it.
- **What a need changes — never a number.** A need does three things only:

  | Need | Checks marked "relevant to this resident" and sorted higher | Prompt shown when data is missing |
  |---|---|---|
  | wheelchair | H02, H03, D01, D03, G04, G05, B04 | "Record the wheelchair width to check doors"; "Draw a turning area in the bathroom" |
  | walker | D01, D03, G04 | "Draw the main walking route to check its width" |
  | cane | D03, B05 | — |
  | weak-grip | D02 (handle type), B03 (grab bar diameter) | "Record the door handle type" |
  | difficulty-standing-up | B02 (seat height), B03 | "Record the toilet seat height" |
  | unsteady-balance | B03, B05, D03 | "Record whether the floor is slip-resistant" |

  Sorting order in the checks list becomes: near a fall, then relevant to a need, then the existing status order. A relevant result shows a text tag naming the need.
- Do **not** invent default sizes (no "standard wheelchair width"), do not change any benchmark value, and do not create new rules. If a need seems to require a new measurement or value, stop and ask the user.
- Prompts are shown at the top of the Checks tab as a short "to complete this check" list; each one focuses the field it asks for.
- The walk-through (part A) may filter by need later; do not build that now.

### C. Fixes and findings sorted by effort

Families act first on what costs nothing. Group every suggested action into three tiers.

- **Tier is derived, not stored.** One pure function, for example `getEffortTier(fix)` in `standards/fixes.ts`:

  | Tier | Label (EN / TH) | Rule |
  |---|---|---|
  | `no-cost` | Do today, no cost / ทำได้วันนี้ ไม่มีค่าใช้จ่าย | `workType` is `rearrange` |
  | `small-job` | Small job / งานขนาดเล็ก | `workType` is `purchase`, or `building-work` with `needsProfessional: false` |
  | `building-work` | Building work, get a professional / งานก่อสร้าง ควรให้ช่างหรือผู้เชี่ยวชาญทำ | `needsProfessional: true`, or `workType` is `site-review` |

  Check the 16 fixes in `fixes-2026.10.json` against this table before coding. If a fix lands in a tier that is plainly wrong (for example installing a grab bar, which needs a sound wall fixing), do not bend the rule: add an optional `effort` field to the fix data schema that overrides the derived tier, set it on that fix in a **new** data file version, and say so in `progress.md`. Never edit the released `fixes-2026.10.json`.
- Walk-through findings carry their own `effort` from the checklist data (part A).
- **Screen:** a new view in the "Fixes & recommendations" tab called "What to do first". Three headed groups in the order above. Each row: the action, the check or finding it answers, a "near a recorded fall" marker when applicable, the price range or "No default price yet", and the Preview button for fixes. Within a group, near-fall rows come first.
- A row disappears from the list once its fix is applied to Proposed or its recommendation is marked completed.
- **Report:** the same three groups, as a one-page "Action list" before the detailed checks.
- Wording: the tier describes effort, not safety or importance. Do not label any tier "low priority". The building-work tier always shows the "consult a licensed professional" note from spec §7.4.

### Tests

- Unit: the checklist dataset validates, every question has a source and a `sourceRef`, and all seed questions are `pending`; a hazard answer, an unsure answer and no answer each produce the right outcome; `set-checklist-answer` increments the revision and outdates a review; an old v2 project without `checklist` or `needs` opens with defaults; `getResidentNeeds` returns wheelchair for both the old free-text aid (Thai and English) and the new field; the relevance table above, one case per need; no need changes any verdict or status; `getEffortTier` for every fix in the data file; rows leave the action list when applied.
- Browser: answer the walk-through on a 390 px screen using the keyboard only; a hazard answer appears in the action list under its tier and in the report; choosing "weak grip" moves the door handle check up with its tag and shows the prompt; the export warning appears when only a need is set; axe scans in both locales on the walk-through tab and the action list.

### Work packages

| # | Package | Depends on |
|---|---|---|
| 12 | Needs presets (part B) | 8 |
| 13 | Walk-through checklist (part A). Starts with confirming the sources. | 8 |
| 14 | Fixes and findings sorted by effort (part C) | 13 |

Package 11 (release verification, §7) stays last: run it after package 14.

### Decisions made by the user

- **Eyesight — decided by the user on 2026-11-16. Do not ask again.** The app does not record the resident's eyesight. There is no "poor eyesight" need, field or setting, and spec §11 ("vision, cognition and continence data are not collected") stands unchanged. Poor eyesight is covered through the home instead:
  - "Lighting and visibility" is a full area of the walk-through checklist (§13 A), shown for **every** home and every room type, never hidden behind a setting. Use the `lighting` area value for it.
  - Its questions come from the source passages listed below: light at doors, stairs and places used often; a light within reach of the bed; a lit path from bed to bathroom; no bare bulb in view; no reflective surfaces; contrasting colour on step and table edges; a visible mark on glass doors.
  - A family may still mention eyesight in the existing free-text notes of the household brief. Do not add a prompt that asks for it.
  - Reconsider only if the user reports that pilot advisors need it. That would be a deliberate spec change with consent handling, not something to add on your own.
- **Checklist sources — decided by the user on 2026-11-16. Do not ask again.** The two sources are accepted: the CDC "Check for Safety" checklist and the Department of Older Persons manual. Use only these two for the seed questions. What the user accepted is the choice of sources; it is not a statement about reuse rights. Still record in each `licenceNote` what the source itself says about reuse, keep every question `pending`, and list "permission to adapt the two sources confirmed" as an open item for a person in `verification-r1.md` (§9).

### What the two sources say about eyesight (read on 2026-11-16)

Both files were downloaded and their text extracted on this date. Re-open them before writing question text; the Thai extraction dropped some tone marks, so copy wording from the PDF itself, not from here.

- **Department of Older Persons manual**, https://www.dop.go.th/download/knowledge/th1614910224-611_0.pdf, 49 PDF pages. Printed page 5 (PDF page 11), heading "1. ความเสื่อมถอยทางสายตา" (declining eyesight), lists the symptoms (long-sightedness, cataract, blurred sight, needing more light, slow adjustment to light levels, glare, blue/purple/green seen as one colour) and these home measures:
  - More light, especially at doors, stairs, places used often, and signs.
  - Do not leave the bare bulb in view, because it dazzles.
  - Do not use reflective materials.
  - Use large symbols on buttons.
  - Avoid blue, purple and green.
  - Use contrasting colour, for example on stair edges and table edges.

  Elsewhere: enough light on walkways (PDF p. 13); a visible mark or colour strip on glass doors (PDF p. 26); bedroom near the bathroom with enough light (PDF p. 44). The manual gives **no numbers** for light level or contrast. No copyright or licence statement was found in it; the publisher is the Ministry of Social Development and Human Security. Ask the user to confirm permission to adapt before release.
- **CDC "Check for Safety" (2017)**, https://www.cdc.gov/steadi/pdf/steadi-brochure-checkforsafety-508.pdf. The extracted checklist does not mention eyesight or eye checks. Its lighting items: a light and a switch at both the top and bottom of stairs (switches that glow are suggested); replace a burnt-out stair bulb; a lamp within easy reach of the bed; a nightlight on the path from bed to bathroom. No numbers. No licence statement was found in the extracted text; confirm reuse terms on the CDC site.

Consequence for §13 A: lighting and visibility items are yes/no walk-through questions only. Do not create a measured check or a benchmark value for light or contrast, because neither source gives one.

## 14. After R1

The next release is R2 (whole home: several rooms and floors, the night route from bed to toilet, bedroom type). It has no plan yet. Writing the R2 plan is the next step once `verification-r1.md` is complete; do not start R2 code before that. Two ideas raised with the user on 2026-11-15 are not in any plan and need the user's go-ahead: drawing routes, turning circles and flagged items inside the 3D view, and a wheelchair or walker figure sized from the resident profile.

## 15. Definition of done for this handoff

- [ ] Chromium suite: 0 failures, including the new tests from §6, §7, §10, §11, §12 and §13.
- [ ] The walk-through checklist, needs presets and the action list by effort work as §13 describes, with every checklist question citing a source that was opened and confirmed.
- [ ] Check results are marked on the plan, update while moving, and are summarised before and after, as §12 describes.
- [ ] The 2D plan and its export show walls, symbols, dimensions, numbers and the item schedule as §11 describes.
- [ ] Furniture can be moved in the 3D view as §10 describes, and the spec, README and hint text say so.
- [ ] `pnpm test`, `tsc`, scoped eslint and `pnpm build` pass; counts recorded.
- [ ] Production smoke test run and recorded.
- [ ] `scripts/import-prices.ts`, its tests and the CSV template exist.
- [ ] Wall elevation SVG download works and is tested.
- [ ] `r1-report.pdf` and page images saved and inspected.
- [ ] Every row of §8 is implemented or recorded as a limitation.
- [ ] `verification-r1.md` written; `progress.md` and `README.md` updated.
- [ ] Final message to the user lists changed files, commands with real outcomes, what was not done, and the open items in §9.
