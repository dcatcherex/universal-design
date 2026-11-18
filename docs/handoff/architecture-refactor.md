# Architecture refactor handoff: deepening the planner modules

This plan has four packages, numbered R-A to R-D, plus one optional package, R-E. Each package moves logic that is currently copied across several callers into one **deep module**: a module that hides a lot of behaviour behind a small interface. Do the packages in order. Each one is a separate commit and leaves the app working.

Read first:
1. Repository `AGENTS.md` and the installed Next.js guides for anything you touch in `app/` or components.
2. [v2 specification](../superpowers/specs/2026-10-21-baan-yoo-dee-v2-design.md), for domain terms such as Project, Layout, RoomSpace, CheckResult, Benchmark and Fix.
3. The files listed under the package you are working on. Line numbers are from commit `aa3b070` and will drift as you edit.

## Ground rules

- **Behaviour is preserved.** Every package is a refactor except for the bugs it names under "Fixes". When you find a disagreement that this document does not settle, leave both behaviours in place. Add it under "Open decisions" at the end of this file and carry on.
- **Test through the new interface.** Write tests against the new module's interface, not against its private helpers. When a new test makes an old test of a helper redundant, delete the old one; don't keep both.
- **Run the checks.** Run `pnpm test`, `pnpm lint` and `npx tsc --noEmit` before every commit. Run `pnpm test:e2e` after packages R-B and R-C, because they change what the editor renders and how dragging works.
- **Record progress.** At the end of each package, add a dated entry to [progress](progress.md) with the commit hash and the tests you added.
- **Vocabulary.** A *seam* is the place where a module's interface lives. An *adapter* is a concrete implementation that plugs into a seam. Use these words, and the domain names from the spec, in new names and comments.

---

## R-A · Derive the benchmark context in one place (fixes a bug)

**Why.** `BenchmarkContext` (`lib/planner/standards/benchmarks.ts:16`) is assembled by hand at six call sites from two different sources:

| Site | Source of `mobilityAids` |
|---|---|
| `lib/planner/checks.ts:504` (`evaluateLayout`) | `getResidentNeeds(project)` ✅ |
| `components/planner/checks-panel.tsx:81` | `getResidentNeeds(project)` ✅ |
| `lib/planner/standards/fixes.ts:115` (`resolveBenchmark`) | `project.household.mobilityAids` ❌ |
| `components/planner/workspace.tsx:126` (wall SVG export) | `project.household.mobilityAids` ❌ |
| `components/planner/workspace.tsx:390` → `wall-elevation.tsx:45` | `project.household.mobilityAids` ❌ |
| `components/planner/report-preview.tsx:53` (clause column) | `data.brief.mobilityAids` ❌ |

`getResidentNeeds` (`lib/planner/resident-needs.ts`) merges `resident.needs` with the legacy `household.mobilityAids`. Take a resident who has `wheelchair` in `resident.needs` but nothing in `household.mobilityAids`. The check verdicts treat them as a wheelchair user. The fix target heights, the elevation benchmark bands and the report clause column do not.

**Fixes.** All six sites must derive the context in the same way.

**Steps.**
1. Write the failing test first, in `tests/planner/benchmark-context.test.ts`. Use a project with `resident.needs = ['wheelchair']` and `household.mobilityAids = []`. Assert that the benchmark value `previewFix` uses for a grab-bar or seat-height fix matches the value behind the matching verdict from `evaluateLayout`. Then assert the same for the `benchmarkBands` that `buildElevation` returns. The test must fail on the current code.
2. Add `benchmarkContextFor(project: Project, room: RoomSpace): BenchmarkContext`. Put it in `lib/planner/resident-needs.ts` or in a new `lib/planner/standards/context.ts`; watch for import cycles with `benchmarks.ts`.
3. Change `buildElevation` so that it takes the `Project` (or the result of `benchmarkContextFor`) instead of a hand-built context. Its callers must stop passing `mobilityAids`. Remove the `mobilityAids` prop from `WallElevation`.
4. Route `resolveBenchmark` in `fixes.ts`, the wall export in `workspace.tsx` and `checks-panel.tsx` through `benchmarkContextFor`. Have `evaluateLayout` call it too, so there is a single source of truth.
5. For the report, `ReportPlan` / `buildReportData` (`lib/planner/exports/report-data.ts`) should carry the context, or the benchmark values themselves, derived from the project. Then `PlanSection` no longer rebuilds them from `brief.mobilityAids`. Keep `brief.mobilityAids` only as a displayed field.
6. Update the existing tests that build a context by hand (`tests/planner/fixes.test.ts:249–265`, `tests/planner/exports.test.ts:237`).

**Done when.**
- `grep -rn "mobilityAids:" lib components` finds no context construction outside `benchmarkContextFor`.
- The new test from step 1 passes.
- The full test suite passes.

---

## R-B · One plan drawing model, two renderers

**Why.** `components/planner/plan-canvas.tsx` (JSX on screen) and `lib/planner/exports/plan-svg.ts` (an SVG string for the export, the report and the fix preview) both call `buildPlanAnnotations`, `buildPlanDrawing`, `buildPlanDimensions` and `buildPlanSchedule`. After that, each file works out the same things independently:
- scale (canvas 123, svg 68)
- opening check boxes and badge points (canvas 276–286, svg 111–118)
- check outlines for items, fixtures, routes and turning areas
- wet-zone hatch, room label, scale bar and north arrow
- furniture symbols (`SymbolMarks` vs `symbolMarkup`)

The check badge exists three times: `components/planner/check-mark-badge.tsx`, `checkBadge` (plan-svg 39) and `checkMark` (elevation-svg 17).

The two copies have already drifted apart. **Do not resolve these yourself.** List them under Open decisions:
- A turning area with no diameter is drawn with radius `400/2` on the canvas (385, 389) but `800/2` in the SVG (127, 142).
- Route fill opacity is `.18` on the canvas (373) but `.16` in the SVG (126).
- The item badge is positioned in world coordinates on the canvas (65–66) but in a rotated local group in the SVG (88).
- When a route has no width, the canvas shows `t('checkNotEvaluated')`, while the SVG hard-codes inline Thai/English text.

**Target shape.**
- A pure function `buildPlanScene(layout, options) → PlanScene` in `lib/planner/plan-scene.ts`.
- `options` covers locale, check statuses, room check results, selection, move preview, `showDimensions`, `showOverlays` and `showCheckMarks`.
- `PlanScene` is the scale plus an ordered list of drawable primitives (kind, geometry, style token, optional label, `entityId`, check status, badge point).
- Two adapters print it: the canvas as JSX (and it keeps all pointer and keyboard interaction), and `createPlanSvg` as a string. Neither adapter computes geometry, defaults or styling.
- The badge is defined once, as a primitive or a shared description, and each adapter prints it.

**Steps.**
1. Before changing anything, add the decisions from the drift list above to Open decisions.
2. Write `tests/planner/plan-scene.test.ts`, covering selection, check marks on and off, dimensions on and off, overlays, the bathroom example and a turning area with no diameter.
3. Build `buildPlanScene` by moving logic out of `plan-svg.ts`, which is the simpler of the two. Make `createPlanSvg` print the scene. `tests/planner/exports.test.ts` must stay green without changing its assertions. Change an assertion only for a drift item listed under Open decisions, and say so in the commit message.
4. Make `plan-canvas.tsx` print the same scene. Interaction code (drag, keyboard, Escape, chips) stays in the component; R-C handles it.
5. Fold `plan-annotations.ts`, `plan-drawing.ts` and `plan-dimensions.ts` into the new module wherever they no longer have callers of their own. `plan-schedule.ts` is also used by `components/planner/plan-schedule.tsx`, so keep it as a module and have the scene use it.
6. Apply the same pattern to the wall elevation:
   - Extend `ElevationModel` (`lib/planner/elevation.ts`) to cover ticks, band labels, silhouette clamping and check outlines. Today these are duplicated between `components/planner/wall-elevation.tsx` (149–200) and `lib/planner/exports/elevation-svg.ts`.
   - The SVG clamps bands with `bounded()` and the component does not. The two also order the band label differently. List both under Open decisions.

**Done when.**
- `plan-svg.ts` and `elevation-svg.ts` contain only string printing: no `Math.max`/`Math.min` on geometry and no `?? <number>` defaults.
- Every drift item is either listed under Open decisions or resolved, with the owner's decision recorded.
- The unit and e2e test suites pass.

---

## R-C · One entity move module for furniture and fixtures

**Why.** The rules for moving an entity are defined in several places:
- Furniture: `moveFurnitureInLayout` (`lib/planner/furniture-movement.ts`), which bounds-checks and returns a `Result`.
- Placing a new item on the canvas: an inline bounds check (`plan-canvas.tsx` ~335) instead of `isFurnitureWithinRoom`.
- Fixtures: `tryCommit` inside `components/planner/wall-elevation.tsx:78–87`. It rounds the values, resets both measurements to `confidence: 'estimated'` and rejects positions that `fixturePositionProblem` flags. It has no unit test.
- The preview: `evaluateWithMove` (`lib/planner/checks.ts:529–546`) re-implements both moves. It does not bounds-check, and it does not round fixture values.
- Fixes: the `move-item` effect in `lib/planner/standards/fixes.ts` (~166–172) repeats the footprint bounds check.

The interaction code is also copied between `plan-canvas.tsx` and `wall-elevation.tsx`: the `useMoveCheckPreview` wiring, `chipPoint`, the Escape-to-cancel handler, arrow-key stepping (10 mm, or 50 mm with Shift) and the move-check chip JSX. Snapping differs on purpose: a 50 mm grid in the plan and a 10 mm grid in the elevation. Keep each view's grid as a parameter.

**Target shape.**
- `moveEntity(layout: Layout, entityId: string, position: MovePosition) → { ok: true; layout } | { ok: false; reason: 'not-found' | 'out-of-bounds' | 'outside-wall' | 'over-opening' }` in `lib/planner/entity-movement.ts`. It replaces `furniture-movement.ts`; keep `snapToGridMm` there.
- Every move path calls `moveEntity`: canvas commit, elevation commit, `evaluateWithMove` and the fix `move-item` effect.
- In `evaluateWithMove`, an invalid position should still produce a preview, so that the chip can say why the move is blocked. Decide whether that means "evaluate unchanged plus a reason" or "evaluate the raw position", and record your choice under Open decisions.
- A `useEntityDrag` hook in `components/planner/` holds pointer capture, the Escape and arrow-key logic, chip placement and the `useMoveCheckPreview` wiring. Each view supplies the coordinate mapping (`modelPoint`) and the grid size.

**Steps.**
1. Tests first, in `tests/planner/entity-movement.test.ts`:
   - furniture: in bounds, out of bounds, not found;
   - fixture: valid move, outside the wall, over an opening, and the confidence reset to `estimated`;
   - `evaluateWithMove` with a fixture `{ offsetMm, heightMm }` move. Only item moves are tested today (`checks.test.ts:20`).
2. Implement `moveEntity`, then switch the four callers to it one at a time.
3. Extract `useEntityDrag` and adopt it in both views. Keep the move-check chip text in one place; it is currently also built in `use-move-check-preview.ts:62–64`.

**Done when.**
- `grep -n "confidence: 'estimated'" components` finds no fixture-move code.
- The only implementation of a move is in `entity-movement.ts`.
- `tests/e2e/r1-flow.spec.ts` (the live move-preview flow) and `tests/e2e/editor.spec.ts` pass.

---

## R-D · A layout check view, and shared toilet geometry

**Why.** `evaluateLayout` is already deep inside: one entry point runs ten `evaluate*` passes. Its output is shallow, though. Five consumers each recombine `getEntityStatuses(results)` with `results.filter(r => r.entityIds.length === 0)` for the room-level results: `workspace.tsx:82–83`, `plan-canvas.tsx:116–117`, `wall-elevation.tsx:39`, `report-preview.tsx:50–51` and `createPlanSvg` (164–165).

Separately, `placeToiletBar` (`fixes.ts:121`) says in its comment that it "Mirrors `findToiletBar` in checks.ts". It re-implements the toilet facing and axis logic (`toiletFacing`, `checks.ts:284–291`) by hand.

**Steps.**
1. Write a test: for every toilet rotation (0, 90, 180 and 270), apply the grab-bar fix through `previewFix`, then run `evaluateLayout` on the result. The bar that was placed must be the one the check finds. Today only the example orientation is tested (`fixes.test.ts:59, 73`).
2. Move the toilet facing and axis geometry into one module, for example `lib/planner/toilet-geometry.ts`. Make `checks.ts` and `fixes.ts` both import it.
3. Add `getLayoutCheckView(project, layoutId) → { results, byEntity, roomLevel, summary }`. `results` is sorted by `sortCheckResults` and `summary` is built by `summarizeChecks`. Replace the five places that recombine results by hand. Pass the view into `createPlanSvg` / `buildPlanScene` instead of the two separate options.

**Done when.**
- The rotation test passes.
- `grep -rn "entityIds.length === 0" components lib` finds only `checks.ts`.

---

## R-E (optional, do it opportunistically) · Inline Thai/English strings

There are `locale === 'th' ? … : …` literals in 14 component files and 7 lib files. Confidence labels alone are written four times: `plan-svg.ts:26`, `report-preview.tsx:25`, `checks-panel.tsx:25` and `plan-schedule.tsx:42`.

Whenever a package above touches one of these files, move its literals into `lib/planner/locales/en-r1.ts` and `th-r1.ts` and use `t(locale, key)`. The key-parity test in `tests/planner/i18n.test.ts` then covers them.

`en-r1`/`th-r1` are spread into `en`/`th` on purpose; leave that split in place. Native Thai review is still an open release blocker (see [R1 verification](verification-r1.md)), so do not reword any Thai text.

---

## Not in scope

- `use-project-persistence.ts` calls `window.localStorage` directly in six places. There is only one storage adapter, so a seam there would be hypothetical. Leave it.
- `room-view-3d.tsx` has no move-check preview. Also, `markSceneEntities` tags wall fixtures as `userData.itemId` (`lib/planner/scene/fixture-mesh.ts:23`). Note this for a later 3D package; R-C's `moveEntity` makes adding it cheap.

## Open decisions

Record each one as: date · package · the question · the options · the decision (or "awaiting product owner").

- 2026-11-17 · R-B · What should the default radius be for a turning area with no diameter: 400/2 (canvas) or 800/2 (SVG export)? · Awaiting product owner.
- 2026-11-17 · R-B · What route fill opacity should the shared plan use: `.18` (canvas) or `.16` (SVG export)? · Awaiting product owner.
- 2026-11-17 · R-B · Where should an item check badge be anchored: in world coordinates (canvas) or in a rotated local group (SVG export)? · Awaiting product owner.
- 2026-11-17 · R-B · What label should a route with no width show: the localized `checkNotEvaluated` message (canvas) or the existing localized "Width not set" text (SVG export)? · Awaiting product owner.
- 2026-11-17 · R-B · Should elevation benchmark bands be clamped to the wall height (SVG export) or allowed to extend beyond it (canvas)? · Awaiting product owner.
- 2026-11-17 · R-B · Where should elevation benchmark-band labels sit: above each band (SVG export) or at the band's maximum height (canvas)? · Awaiting product owner.
- 2026-11-17 · R-B · Should the elevation height scale add a final tick at a non-500 mm wall height (SVG export) or stop at the last 500 mm interval (canvas)? · Awaiting product owner.
- 2026-11-17 · R-B · Should R-B run before R-A? · The user asked to start the architecture refactor and return to R-A afterward; R-A remains pending.
- 2026-11-17 · R-C · What should `evaluateWithMove` do with a position a commit would reject: evaluate the raw position, or evaluate unchanged plus a block reason? · Decision: evaluate the raw position. It preserves the existing chip behaviour (checks describe the spot under the pointer), and the views already surface the block separately — the plan via `previewOutside`, the wall view via `previewProblem`.
- 2026-11-17 · R-C · Should pointer dragging track the pointer (plan) or preserve the grab delta (wall view)? · Both behaviours kept: the plan snaps the pointer position as the item centre, the wall view keeps the offset between the grab point and the fixture. Exposed as the view-supplied `positionFromDrag` in `useEntityDrag`.
- 2026-11-17 · R-C · Should arrow keys preview then commit on key-up (plan) or commit each step (wall view)? · Both kept as the `keyboard` parameter of `useEntityDrag`; selection timing likewise stays per-view via `selectOnStart`.
- 2026-11-17 - R-D - Should a toilet grab bar that reaches the wall end keep its full length by sliding back, or be shortened at the far end? - Kept the existing clamp semantics (shortened; the offset clamp only fixes the rounding overflow). With the example toilet at rotation 0/270 the wall ends before the benchmark `projectionPastBowl` reach, so B03 stays attention but still attributes the placed bar. Awaiting product owner on full-length placement.
- 2026-11-17 - R-D - Should a move preview go through `getLayoutCheckView(project, layoutId)`? - No: preview results are transient and not persisted. Views call `checkViewFromResults(preview.results)` directly; `getLayoutCheckView` is the persisted-project entry point that delegates to it.
