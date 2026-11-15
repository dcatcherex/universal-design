# R1 — Benchmarks and Bathroom: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for sequential implementation, or superpowers:subagent-driven-development if the user explicitly selects delegated execution. Steps use checkbox syntax for tracking. This document does not launch or message another agent.

**Goal:**
- Turn the shipped v1 living-room planner into a benchmark-aware, bathroom-capable, resident-aware local tool.
- An advisor can verify measurements against two cited benchmarks and apply suggested fixes.
- A family can see "likely" problems and when to get them checked.

**Architecture:**
- The v1 architecture is unchanged: one validated Project document, pure domain functions, a reducer and history, an SVG plan, lazy Three.js, local persistence.
- Additions:
  - Schema v2 with a multi-room-ready layout, limited to one room.
  - Versioned JSON data under `lib/planner/standards/`.
  - A verdict engine.
  - Fixtures and a wall elevation view.
  - A resident profile.
  - A fix and price library.

**Tech stack:** as installed (Next.js 16 App Router, React, TypeScript, Tailwind, Base UI shadcn, Zod, Three.js, Vitest, Playwright, axe). No new runtime dependency is expected. If one becomes necessary, stop and justify it in progress.md.

**Spec:** [Baan Yoo Dee v2 specification](../specs/2026-10-21-baan-yoo-dee-v2-design.md). Read all of it before Task 1; it is authoritative. Product behaviour not changed by v2 still follows [v1](../specs/2026-09-28-thailand-home-adaptation-design.md).

## Global constraints

- Everything in spec §3. In particular: **benchmarks, never compliance**, and no definite verdict without on-site verification and a `reviewed` benchmark value.
- R1 is local only: no backend, auth, telemetry or deployment.
- Exactly one floor and one room per layout. The model is multi-room-ready, the validation is not.
- No invented prices. Price entries are null until real data is collected.
- Preserve unrelated working-tree changes. Read `AGENTS.md` and the relevant installed Next docs before the first UI task.
- All 96 existing unit tests and 24 E2E tests must keep passing, updated only where v2 changes a contract. Never delete a test to get a green run.

## Review focus

1. Migration must not lose or change v1 geometry, costs or recommendations, and must not delete the v1 storage entry (Task 1).
2. No code path may produce a definite verdict from a `pending` value or from a non-on-site measurement (Task 3 tests).
3. "No benchmark value" and "not evaluated" must never show as failures or passes (Tasks 3, 4, 6).
4. `apply-fix` must be one atomic, undoable command, and never apply without a preview (Task 9).
5. Health data (falls, body measurements) is excluded from the report by default and warned about on export (Tasks 7, 10).

## Task 0 — Data work (not code; runs in parallel; owner: product owner)

**0a. Benchmark verification.**
- Open the 2548 Gazette text, the 2564 amendment Gazette PDF (https://data.yotathai.org/d/cgj5dv.pdf, or the official ratchakitcha.soc.go.th copy) and the Department of Older Persons manual (https://www.dop.go.th/download/knowledge/th1614910224-611_0.pdf).
- For each row in spec §7.2, confirm the value, unit, clause and applicability.
- Write a new dataset version `2026.11` that marks confirmed values `reviewed` with reviewer and date, and corrects any mismatch.
- Record errors found in the Department of Older Persons manual in the value `note`.

**0b. Price collection.**
- Using the CSV template from Task 9 (`priceKey, region, materialsLow, materialsHigh, labourLow, labourHigh, jobDate, province, note`), collect 15–20 real completed jobs per region for each seed fix's `priceKey`, starting with the pilot region.
- Produce a new prices data version with the import script from Task 9.

Neither 0a nor 0b blocks R1 code. With seed data the app correctly shows "likely" verdicts and "No default price yet".

## File ownership

| Owner | Files / responsibility |
|---|---|
| Task 1 | `lib/planner/types.ts`, `schema.ts`, new `migrate.ts`, `fixtures.ts`, `storage.ts`, `project-files.ts`; `tests/planner/migrate.test.ts`; schema/storage/project-files test updates |
| Task 2 | `geometry.ts`, `checks.ts`, `commands.ts`, `scene/*`, `exports/*`, `components/planner/*` adapted to `RoomSpace`; new `lib/planner/layout-access.ts` |
| Task 3 | `lib/planner/standards/{benchmarks.ts,verdicts.ts,schema.ts}`, `standards/data/benchmarks-th-2026.10-draft.json`, `standards/data/provinces-th.json`; tests |
| Task 4 | `checks.ts` (D01–D03, H03, G04/G05 fallback); `components/planner/checks-panel.tsx`, new `benchmark-verdicts.tsx`, `benchmark-banner.tsx`, `benchmark-policy.tsx`; measurement verification UI in `item-inspector.tsx`, `room-editor.tsx` |
| Task 5 | `catalog.ts`, new `fixtures-catalog.ts`; `geometry.ts` fixture helpers; `scene/furniture-mesh.ts`, new `scene/fixture-mesh.ts`; `plan-canvas.tsx`, `catalog-panel.tsx`, new `fixture-inspector.tsx`, `project-setup.tsx`, `room-editor.tsx` |
| Task 6 | `checks.ts` (B01–B06) and tests |
| Task 7 | `types.ts` resident additions (already defined in Task 1), new `components/planner/resident-panel.tsx`, `fall-marker` rendering in `plan-canvas.tsx`; `checks.ts` (H01, H02, nearFall) |
| Task 8 | New `components/planner/wall-elevation.tsx`, `lib/planner/elevation.ts`; `workspace.tsx`, `editor-toolbar.tsx` view switch |
| Task 9 | `standards/{fixes.ts,prices.ts}`, `standards/data/fixes-2026.10.json`, `prices-2026.10.json`, `scripts/import-prices.ts`, `docs/data/price-collection-template.csv`; `commands.ts` `apply-fix`; new `fix-preview.tsx`; `recommendations-panel.tsx` |
| Task 10 | `exports/report-data.ts`, `exports/plan-svg.ts`, `report-preview.tsx`, `export-menu.tsx`, `project-menu.tsx` |
| Task 11 | `tests/e2e/*`, `docs/handoff/verification-r1.md`, `docs/handoff/progress.md` |

Locale keys: each task adds its own keys to both `locales/en.ts` and `locales/th.ts`, and the parity test must pass at every checkpoint.

**Dependency order:**
1. Task 1, then Task 2.
2. Task 3 (can start after Task 1), then Task 4.
3. Task 5, then Task 6.
4. Task 7 (needs Task 4 and Task 5).
5. Task 8 (needs Task 5).
6. Task 9 (needs Task 4 and Task 6).
7. Task 10, then Task 11.

A single agent should work through them in numeric order.

## Contract conventions

- Keep `Result<T>`, the `now: string` injection and the pure-domain rule from v1.
- `RuleId` becomes `'G01'|'G02'|'G03'|'G04'|'G05'|'M01'|'D01'|'D02'|'D03'|'H01'|'H02'|'H03'|'B01'|'B02'|'B03'|'B04'|'B05'|'B06'`.
- `BenchmarkId = 'th-public-building' | 'th-dop-home'`. `BenchmarkKey` is a string-literal union generated from the keys in spec §7.2. Define it in `standards/benchmarks.ts` and assert in a test that every dataset key belongs to it.
- New `ProjectCommand` members:
  - `set-resident {resident}`
  - `set-benchmark-policy {primary: BenchmarkId | null, chosenBy: string}` (null clears the policy)
  - `set-report-options {includeFallHistory}`
  - `apply-fix {fixId, params}`
- `replace-layout` stays the path for geometry, fixture and wet-zone edits.
- Coordinates: helpers `toFloorPoint(room, p)` and `toRoomPoint(room, p)` in `layout-access.ts`. In R1 both are the identity because the origin is `{0,0}`. Use them anyway, and test them with a non-zero origin.

## Task 1 — Schema v2, migration and persistence

**Files:** see ownership. **Consumes:** spec §6. **Produces:**
- v2 types and `projectSchema` (v2).
- `validateProject(input): Result<Project>`, which accepts v2 only.
- `migrateProject(input: unknown): Result<Project>`, which accepts v1 or v2 and returns v2.
- `createEmptyProject(id, now, roomType?)`.
- `createExampleProject(now, locale?)` (living room) and `createBathroomExampleProject(now, locale?)`.
- Storage key `baan-yoo-dee.project.v2`.

- [ ] Inspect `git status`. Read spec §6 in full.
- [ ] Write `tests/planner/migrate.test.ts`:
  - A v1 example and a v1 project with costs, targets, recommendations, a review and a verified measurement migrate to v2.
  - Geometry is identical (compare item centres and sizes, opening offsets, route points).
  - Recommendations and costs are unchanged.
  - Review status is outdated.
  - The verified measurement gets method `unspecified`.
  - Province "เชียงใหม่" maps to its code, while an unmatched free text keeps `provinceCode: null` and preserves the text.
  - Migrating a v2 document is the identity.
  - A v3 or unknown version gives an error result.
- [ ] Extend `schema.test.ts`:
  - Reject two rooms, two floors, a verified measurement without a method, a fixture beyond its wall or above room height, more than 60 fixtures, more than 20 falls, and a fall pointing at a room ID not in Current.
  - Accept a hinged-out door, a lever handle and a null handle.
- [ ] Run the focused tests and confirm they fail for the intended reasons.
- [ ] Implement the types, the schema (with defaults for additive fields per the spec's versioning rule) and the migration, following spec §6.6 exactly.
- [ ] Storage:
  - On load, read the v2 key. If it's missing and the v1 key exists, migrate in memory and show a one-time "Upgraded from an earlier version" notice. Never write to or delete the v1 key.
  - Autosave writes only the v2 key.
- [ ] Project files: import runs `migrateProject`; export writes v2.
- [ ] Update the fixtures; add the bathroom example (spec R1-A12):
  - Bathroom 2000 × 1800 × 2500 mm.
  - Door on the north wall: offset 200, width 700, hinged-in, threshold 30 mm, knob handle at 950.
  - Seated toilet at (1500, 1400), rotation 180, seat height 380.
  - Water jar near the west wall.
  - Wet zone on the west half; floor `tile` / `unknown`.
  - No grab bars.
  - Every value is estimated and labelled fictional.
  - It must show a likely-failing D01, D03, B01, B02 seat height and B03, and a not-evaluated B05.
- [ ] Run all unit tests and `pnpm exec tsc --noEmit`. Other modules will fail to typecheck until Task 2. If so, finish Task 2 before checkpointing, and record that the two tasks were checkpointed together.

## Task 2 — Adapt existing modules to RoomSpace (no behaviour change)

**Produces:** `layout-access.ts` with `getPrimaryFloor`, `getPrimaryRoom`, `toFloorPoint`, `toRoomPoint`, and `withPrimaryRoom(layout, updater)`, which returns a new Layout. Every existing feature then works on the v2 shape.

- [ ] Add `tests/planner/layout-access.test.ts`, including a non-zero origin case for the point conversions.
- [ ] Refactor geometry, checks G01–G05/M01, commands, scene, SVG export, report data and every planner component to read the room through the accessors.
  - Routes and turning areas come from the floor.
  - Checks convert between floor and room points explicitly.
  - Result IDs gain a room segment, so update the stable-ID expectations once and keep them stable after that.
- [ ] Update the existing unit and E2E tests only where the data shape changed. Behaviour assertions (positions, statuses, costs, exports) must be unchanged.
- [ ] Run `pnpm test`, `pnpm exec tsc --noEmit`, the scoped eslint command from v1 progress.md, `pnpm build` and `pnpm test:e2e --project=chromium --workers=1`. All must pass at the v1 counts or higher. Checkpoint Tasks 1 and 2.

## Task 3 — Benchmark dataset and verdict engine

**Files:** see ownership. **Produces:**
- `BENCHMARKS: BenchmarkDataset`, loaded and validated at import.
- `getBenchmarkValues(key, context: {roomType, mobilityAids}): Record<BenchmarkId, BenchmarkValue | null>`.
- `evaluateVerdict(input: {key, measured: Measurement | Measurement[] | string, context, primary: BenchmarkId | null}): {verdicts: BenchmarkVerdict[]; status: CheckResult['status']}`. Strings are for `allowed-values` keys.
- `strictestValue(key, context)`, used later by fixes.
- `PROVINCES` with `getRegion(provinceCode): PriceRegion`.

- [ ] Write `benchmarks-th-2026.10-draft.json` containing exactly the rows in spec §7.2, every value `pending`, and both sources with applicability text. Write `provinces-th.json` covering all 77 provinces (Bangkok included) with Thai and English names and a price region. Cite the source in the file header.
- [ ] Write `tests/planner/benchmarks.test.ts`:
  - The dataset validates.
  - Every key belongs to the `BenchmarkKey` union.
  - Each (key, benchmark) pair appears at most once.
  - Every value has a clause or a `notApplicableReason`.
  - 77 provinces; every region is used.
- [ ] Write `tests/planner/verdicts.test.ts`:
  - The definiteness matrix for `pending` vs `reviewed` crossed with `on-site` / `photo` / `unspecified` / `measured` / `estimated` (spec R1-A04). Use a test-only dataset for the `reviewed` cases, and never mark the seed values `reviewed`.
  - Min, max and range boundaries: equal to the bound meets; 1 mm beyond does not.
  - `allowed-values` (door operation, toilet type).
  - `appliesWhen` filtering (socket height only for wheelchair).
  - A not-applicable reason gives `no-value`.
  - Overall status with and without a primary benchmark (spec §7.3), including one benchmark with no value plus the other meets, which gives `clear`.
  - When several measurements are compared, the verdict is definite only if all of them are on-site verified.
- [ ] Run the tests (they should fail), implement, run again, typecheck. Checkpoint.

## Task 4 — Door, threshold and route checks with two-benchmark UI

**Produces:**
- Checks D01, D02, D03 and H03.
- G04 and G05 fall back to the benchmark.
- M01 no longer flags thresholds.
- `CheckResult` gains `verdicts`, `basis`, `nearFall` (always false until Task 7) and `roomId`.
- UI: two-benchmark verdict display, benchmark banner, benchmark policy control (advisor mode), and verification method entry.

- [ ] Extend `checks.test.ts`:
  - Example door at 900: D01 likely-meets for both benchmarks.
  - Door at 870: likely-meets public-building, likely-does-not-meet home recommendation. Status is attention without a primary benchmark; with primary `th-public-building` it is clear.
  - Threshold 15: likely-does-not-meet public (13) and likely-meets home (20).
  - Knob handle: does not meet the handle type; a null handle is not-evaluated.
  - H03 with a 650 wheelchair: a 700 door is clear, a 640 door needs attention, and the result is labelled "physical fit".
  - A route with no width and no target falls back to the home value 800, origin `benchmark`. The public-building verdict is `no-value` with its reason.
  - Precedence: an overlay width beats the project target, which beats the benchmark.
- [ ] Implement the checks. Keep M01 for rugs and lighting/reach concerns only, and update the M01 tests to match.
- [ ] Add the `set-benchmark-policy` command and tests: it increments revision, makes the review outdated, and clearing works.
- [ ] Verification UI: when a user selects "advisor-verified" for any measurement, they must also choose the method (on site / from photo) and may add a note. Show the method in the inspector and in the evidence text.
- [ ] Checks panel for each result:
  - Verdict rows, one per benchmark: name, clause, value, measured value, outcome, and a pending badge.
  - A "Get this checked" chip on likely-does-not-meet verdicts and on any verdict that uses a pending value.
  - The disclaimer in the footer (spec §7.4).
  - The benchmark banner in the workspace showing the dataset version and the pending count.
  - Use text plus an icon for outcomes, never colour alone.
- [ ] E2E: open the example, see D01 with two verdicts, set the primary benchmark in advisor mode, and see the status change and the review become outdated. Run axe on the checks panel in both locales.
- [ ] Run unit tests, typecheck, scoped lint and the E2E. Checkpoint.

## Task 5 — Bathroom room type, catalog and fixtures

**Produces:**
- `RoomType` choice at setup.
- Catalog category `bathroom`:
  - `toilet-seated` 400×650×780, seat height 420.
  - `toilet-squat` 450×600×150, no seat height.
  - `shower-seat` 450×450×480, seat height 480.
  - `water-jar` 600×600×700.
  - `bath-cabinet` 600×350×800.
  - All are fictional defaults.
- `FIXTURE_CATALOG` with defaults per `FixtureKind`.
- Geometry: `getFixtureSpan(fixture, room)` (wall segment and projection footprint) and `fixtureFitsWall`.
- Wet zones: draw, edit and remove them in the plan.
- Floor surface fields in the room editor.
- Rendering: fixtures in the plan (wall-attached symbols with labels) and in 3D (simple meshes at their heights).

- [ ] Tests:
  - Geometry: the fixture span on each wall at offset/length boundaries; a fixture beyond its wall is rejected.
  - Scene: each fixture kind's mesh is centred on its wall position, at its reference height and with its projection.
  - Catalog: the new entries validate, and `seatHeight` exists only where expected.
- [ ] Implement.
  - Setup gets a room type select, and the bathroom default size is 2000×1800×2500.
  - The catalog panel filters by room type: living shows the v1 categories, bathroom shows the bathroom category plus custom.
  - Toilets show a seat-height field in the item inspector.
  - New `fixture-inspector.tsx` edits wall, offset, reference height, length, projection and diameter, with the meaning of the reference height shown for each kind.
  - Fixtures can be added from the plan by choosing a wall. Wall-view adding comes in Task 8.
- [ ] Door editor: add operation `hinged-out` (the plan shows the leaf swinging outward, dashed) and the handle type and height fields.
- [ ] E2E: create a bathroom project, add a seated toilet, add a horizontal grab bar on the east wall at 680, and check its position in the plan and in 3D, the same way v1 checks furniture.
- [ ] Run unit tests, typecheck, lint, E2E and build. Visually inspect the bathroom example in the plan and in 3D; save evidence as `docs/handoff/evidence/r1-bathroom-2d.png` and `r1-bathroom-3d.png`. Checkpoint.

## Task 6 — Bathroom checks B01–B06

- [ ] Tests, using the bathroom example and variants:
  - B01: hinged-in gives likely-does-not-meet; sliding and hinged-out give likely-meets.
  - B02: seat height 380 likely-does-not-meet public (400–450) and `no-value` for home; seated meets the home type value; squat does not meet type, with `no-value` for seat height.
  - B03:
    - No bar within 500 mm: attention, outcome "missing".
    - A bar at 680 with projection past the bowl of 270: likely-meets.
    - A bar at 720: likely-does-not-meet.
    - The diameter is skipped when null.
    - The bar must be on a side wall that is parallel to the toilet's depth axis. Rotation is handled by geometry, so test 0° and 90°.
  - B04: a basin rim at 850 does not meet; knee clearance null is not-evaluated.
  - B05: unknown gives not-evaluated plus "Get this checked"; not-slip-resistant gives does-not-meet.
  - B06: a water jar inside the wet zone needs manual review; a shower seat inside it doesn't.
  - Living rooms produce no B results.
  - The bathroom turning area falls back to 1500.
- [ ] Implement. B03 uses the toilet's rotated footprint. "Projection past bowl" means how far the grab bar extends beyond the toilet's front edge along the wall direction; document the formula in a code comment with a diagram reference in the test.
- [ ] Run unit tests and typecheck. Checkpoint.

## Task 7 — Resident profile, fall markers and reach checks

**Produces:**
- `resident-panel.tsx`: standing height, reach band with posture, stronger hand, wheelchair size, and the falls list.
- Placing a fall on the plan (click mode plus a numeric alternative).
- Fall markers in the plan.
- Checks H01 and H02, and `nearFall` tagging and sorting.
- The `set-resident` and `set-report-options` commands.

- [ ] Tests:
  - H01: a switch at 1300 with a seated reach band of 400–1200 needs attention (basis `resident`); no band gives no H01 results.
  - H02: only when mobility aids include a wheelchair; a socket at 300 likely-does-not-meet the home value of 800–900; the public-building verdict is `no-value`.
  - nearFall: a fall at (1500, 1200) tags the toilet B02 and B03 results within 1000 mm, but not a door 1.5 m away. A fall with a room but no point tags every result in that room. Sorting puts nearFall results first.
  - Deleting a room entity referenced by a fall clears the fall's location, but not the record.
- [ ] Implement.
  - The panel explains why each field helps and that it is health information stored only on this device.
  - Fall markers are a distinct shape (not colour alone), and focusing one lists its nearby results.
  - The results list shows a "near a recorded fall" marker.
- [ ] E2E: record a fall in the bathroom example near the toilet, and see B02 and B03 move to the top with the marker. Run axe on the resident panel.
- [ ] Run unit tests, typecheck, lint and E2E. Checkpoint.

## Task 8 — Wall elevation view

**Produces:**
- `lib/planner/elevation.ts`: `buildElevation(room, wall, resident, selectedFixture, context)`. It returns an `ElevationModel` with the wall length, the room height, openings, fixtures, the silhouettes of furniture within 300 mm of the wall, the reach band and the benchmark bands.
- `wall-elevation.tsx`: SVG render, fixture selection, drag (offset + height) with a single commit, keyboard 10/50 mm, Escape cancels, and adding a fixture to this wall.
- A Plan / Wall / 3D view switch, and a wall selector.

- [ ] Tests for `buildElevation`:
  - The east wall's x axis runs north to south, following the spec direction convention.
  - A sofa 200 mm from the wall is included; one 400 mm away isn't.
  - Selecting a horizontal grab bar gives bands of 650–700 for public-building and none for home.
  - The reach band appears only when recorded.
- [ ] Implement the view, matching the plan's visual language.
  - Label each band with its benchmark name and clause.
  - Show the height scale in centimetres.
  - Furniture silhouettes are not interactive.
  - Switches and sockets can't overlap an opening; a rejected position shows its reason.
- [ ] E2E: open the bathroom example, switch to the east wall, add a horizontal grab bar, move it with the keyboard to 680, check the plan symbol and the inspector values, then undo to restore. Check 390 px usability: the wall view fills the canvas and the wall selector is reachable.
- [ ] Run unit tests, typecheck, lint, E2E and build. Save evidence as `r1-wall-elevation.png`. Checkpoint.

## Task 9 — Fix library, price list and apply-fix

**Produces:**
- `FIXES` and `PRICES`, loaded and validated.
- `getFixesForResult(result, project)`.
- `previewFix(project, fixId, params, now): Result<{project; changedIds: string[]; newResults: CheckResult[]}>`.
- The `apply-fix` command.
- `fix-preview.tsx`.
- `scripts/import-prices.ts` (CSV to a new prices JSON version, plus validation).
- `docs/data/price-collection-template.csv`.

- [ ] Write `fixes-2026.10.json` with the seed fixes from spec §10. Each has a `priceKey`, grant categories (older-persons-home for general safety works; disability-home for bathroom, ramps, grab rails and levelling) and `needsProfessional` (widening a door: true). Write `prices-2026.10.json` with an entry for every `priceKey`, `national: null`, empty regions, and a sourceNote explaining that collection is pending.
- [ ] Tests:
  - Every fix's `ruleIds` and `priceKey` resolve.
  - Preview of "rehang outward" on the bathroom example:
    - Changes only the door in the preview copy.
    - Leaves the input project unchanged.
    - B01 becomes likely-meets in `newResults`.
  - "Install horizontal grab bar" places a bar beside the toilet at the strictest benchmark midpoint (680 when no primary benchmark is set and only public-building has a value). Its position follows from the toilet's footprint and the nearest side wall.
  - "Move item" requires a position parameter and rejects an out-of-bounds one.
  - `apply-fix`:
    - Creates Proposed when it is missing.
    - Is one history entry, so undo restores both the layout and the recommendations.
    - The recommendation has `fixId`, `ruleId`, status `proposed`, and `materials`/`labour` null when there's no price data.
  - With a test price dataset, the region value is preferred over the national one, and sourceNote/collectedAt are copied.
  - `import-prices` rejects high below low, unknown keys and unknown regions, and computes the low/high band per region from at least 3 jobs; with fewer jobs it leaves the region null and says so.
- [ ] Implement.
  - Each check result lists its fixes. Preview opens `fix-preview.tsx`: the changed entities are highlighted in the plan (and in the wall view where relevant), with a before → after list of check outcomes, the value used and its source, the price or "No default price yet", grant categories, and a "consult a licensed professional" note when needed.
  - Apply commits. Cancel discards.
  - Move-item uses a pick-position step with numeric entry.
- [ ] E2E: open the bathroom example, use the fix "rehang outward", preview, apply, check that B01 changes and a recommendation exists, undo, and check both are gone.
- [ ] Run unit tests, typecheck, lint and E2E. Checkpoint.

## Task 10 — Report, exports and privacy notices

- [ ] Tests (`exports.test.ts`):
  - Report data includes a per-check verdict table (both benchmarks, clause, value, measured value, outcome, definite or likely), the dataset version, the disclaimer in the locale, the room type, the fixtures list and the resident needs.
  - Fall history appears only when `includeFallHistory` is true.
  - The plan SVG draws fixtures and wet zones with escaped labels.
  - The review receipt records `benchmarkDatasetVersion`; a dataset version mismatch makes it outdated.
- [ ] Implement:
  - Report sections and print CSS for the verdict table (repeating headers, no clipped Thai).
  - The include-fall-history toggle in the report preview, which commits `set-report-options`.
  - An export dialog warning when the resident profile contains body or fall data.
  - Wall elevation SVG download for the selected wall.
- [ ] E2E: export a project with fall data and see the warning; print the report for the bathroom example; check that the verdict table and disclaimer text are present in both languages. Inspect a printed PDF and save it as `docs/handoff/evidence/r1-report.pdf` with page PNGs.
- [ ] Run unit tests, typecheck, lint, E2E and build. Checkpoint.

## Task 11 — R1 release verification and handoff

- [ ] Write `tests/e2e/r1-flow.spec.ts`:
  - Load a v1 file and see the upgrade notice.
  - Start a new bathroom project. Room type can't be changed on an existing project in R1.
  - Capture the door, toilet and floor; record the resident and a fall.
  - Check the verdicts.
  - Advisor: verify on site, set the primary benchmark.
  - Apply two fixes, review, save, reload, export, import and print the report.
  - Assert the values through the forms and the exported JSON.
- [ ] Recovery: a corrupt v2 entry alongside a valid v1 entry offers recovery without touching v1; an oversized v2 import, a future v3 import.
- [ ] Accessibility: axe on the checks, resident, wall view, fix preview and report in both locales; keyboard-only for the wall view and fix flows; 390×844, 768×1024 and 1440×900; reduced motion.
- [ ] **Native Thai review** of every new key and of the disclaimer. Record the reviewer's name and date in verification-r1.md. If no reviewer is available, record R1-A11 as not passed rather than skipping it.
- [ ] Run `pnpm lint` (noting the two known starter errors), the scoped eslint command, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, `pnpm test:e2e --project=chromium --workers=1`, and the production smoke test.
- [ ] Write `docs/handoff/verification-r1.md` mapping R1-A01–A12 to evidence, results and limits, and listing the spec §13 unverified facts with their current status. Update `progress.md`: completed task IDs, changed files, commands and outcomes, limitations, and the exact next step (R2 planning).

## Completion and progress rules

Same as v1:
- Each task ends with a review of changed files, focused verification and a checkpoint.
- Stage only files the task owns. Never blanket reset.
- Update `docs/handoff/progress.md` after Tasks 2, 4, 6, 8 and 11, and before stopping at any context limit.
- Never mark a criterion passed if its command was skipped or blocked.

**Acceptance mapping:**

| Criterion | Tasks |
|---|---|
| R1-A01 | 1 |
| R1-A02 | 1, 5 |
| R1-A03 | 3, 4 |
| R1-A04 | 3 |
| R1-A05 | 4 |
| R1-A06 | 5, 6 |
| R1-A07 | 5, 8 |
| R1-A08 | 7, 10 |
| R1-A09 | 9 |
| R1-A10 | 10 |
| R1-A11 | 11 |
| R1-A12 | 1, 3, 9 |
