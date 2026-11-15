# Thailand Home Adaptation Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for sequential implementation, or superpowers:subagent-driven-development if the user explicitly selects delegated execution. Steps use checkbox syntax for tracking. The requested handoff target is GPT-6 Lunar High; this document does not launch or message another agent.

**Goal:** Deliver a Thai-first living-room adaptation planner that families can hand to advisors as a reopenable file and an understandable report.

**Architecture:** One validated Project document drives pure geometry/check functions, an SVG editor, a lazy Three.js inspector, local persistence and exports. React context/reducer owns document/history; transient view state is separate. No backend is needed.

**Tech stack:** Existing Next.js App Router, React, TypeScript, Tailwind, Base UI-based shadcn components; add Zod, Three.js, Vitest and Playwright at their consuming tasks.

**Spec:** [Product and technical specification](../specs/2026-09-28-thailand-home-adaptation-design.md). Read the entire specification before Task 1; it is authoritative for product behavior. [Handoff entry point](../../handoff/README.md) contains the copyable assignment and progress format.

## Global constraints

- Thailand first; Thai default and complete English alternative; currency THB; storage units integer millimetres and integer satang.
- One rectangular living room per project; one current layout and one proposed layout; schemaVersion is 1.
- All views, checks, history, and exports derive from one validated Project document.
- Furniture placement changes occur in 2D or numeric forms; 3D provides inspection and selection.
- Accessibility targets remain unset until an advisor explicitly enters a project-specific value and rationale; do not ship invented Thai statutory thresholds.
- Existing unrelated working-tree changes must be preserved; read AGENTS.md and installed Next.js documentation before implementation.
- No backend, authentication, paid API, external model download, telemetry, or deployment is required for this release.
- Every visible action must function or explain why it is unavailable; no decorative save, review, export, or analysis buttons.

## Review focus

1. Unset targets and estimated inputs must never become an unqualified accessibility pass — Task 7 fixtures.
2. Rotated furniture, wall-specific door hinges and corridor corners must produce consistent 2D/3D/check results — Tasks 2, 6 and 7 fixtures.
3. Invalid imports, quota failures and concurrent tabs must preserve unsaved work — Task 5 storage tests and Task 10 browser flows.
4. Undo, baseline edits and changed estimates must not leave stale advisor reviews marked current — Tasks 3 and 8 tests.
5. Thai labels, numeric conversion, keyboard controls and touch sheets must remain usable without a mouse — Tasks 4 and 10 tests.

## File ownership and dependency graph

Repository-relative paths below are intentional: the handoff may be opened in another checkout. Use the user's existing checkout unless they request isolation. Inspect git status at the start. The current app is a starter; do not assume the planner already exists.

| Owner | Files / responsibility |
|---|---|
| Task 1 | `lib/planner/types.ts`, `schema.ts`, `catalog.ts`, `fixtures.ts`; model/validation/example |
| Task 2 | `lib/planner/geometry.ts`, `units.ts`; coordinates, dimensions and shape math |
| Task 3 | `lib/planner/commands.ts`, `history.ts`; domain mutations and history |
| Task 4 | `components/planner/planner-app.tsx`, `planner-provider.tsx`, `workspace.tsx`, `project-setup.tsx`, `catalog-panel.tsx`, `plan-canvas.tsx`, `item-inspector.tsx`, `room-editor.tsx`, `editor-toolbar.tsx`; client UI; `lib/planner/i18n.ts`, `locales/th.ts`, `locales/en.ts`; locale dictionaries; app page/layout/styles |
| Task 5 | `lib/planner/storage.ts`, `project-files.ts`; `components/planner/use-project-persistence.ts`, `project-menu.tsx`; persistence and file handoff |
| Task 6 | `lib/planner/scene/build-scene.ts`, `furniture-mesh.ts`, `camera.ts`; `components/planner/room-view-3d.tsx`; 3D lifecycle |
| Task 7 | `lib/planner/checks.ts`; `components/planner/checks-panel.tsx`, `overlay-editor.tsx`, `advisor-targets.tsx`; explicit geometry checks |
| Task 8 | `lib/planner/recommendations.ts`; `components/planner/recommendations-panel.tsx`, `recommendation-editor.tsx`, `review-panel.tsx`; costs/notes/review |
| Task 9 | `lib/planner/exports/plan-svg.ts`, `report-data.ts`; `components/planner/report-preview.tsx`, `export-menu.tsx`; printable report and exports |
| Task 10 | `tests/e2e/*.spec.ts`, `playwright.config.ts`, `docs/handoff/verification.md`; integrated release checks |

Tests live in `tests/planner/<module>.test.ts`. Tasks may add cohesive helpers within their directory when needed, but keep public interfaces stable. Do not place all behavior inside app/page.tsx or a giant client component.

Dependency order: **1 → 2 → 3 → 4 → 5 [M1] → 6 [M2] → 7 → 8 [M3] → 9 → 10 [M4]**. Tasks 6–9 integrate through provider interfaces from Task 4. A single agent should execute sequentially. If multiple agents are later explicitly assigned, only one integrates shared types, provider, package.json and lockfile changes; agree file ownership before work.

## Contract conventions

- Types in the spec are exported from `types.ts`. Add `LayoutId = 'current' | 'proposed'`, `Locale = 'th' | 'en'`, `Result<T> = {ok:true;value:T} | {ok:false;error:{code:string;messageKey:string;paths:string[]}}`.
- Public helpers are pure unless they explicitly consume a storage/browser/Three.js interface. Pass `now: string` to domain operations for deterministic tests.
- `ProjectCommand` is a discriminated union: `replace-layout {layoutId,layout}`, `create-proposal`, `reset-proposal`, `set-title {title}`, `set-household {household}`, `set-targets {targets}`, `upsert-recommendation {recommendation}`, `delete-recommendation {id}`, `record-review {reviewerName}`. Definitions use the corresponding spec types; property `type` contains the command name.
- `applyCommand(project: Project, command: ProjectCommand, now: string): Result<Project>` validates the result and increments revision for substantive changes. `record-review` changes only review/updatedAt and does not increment revision. Equivalent no-op values do not create history entries or revisions.
- `RectMm = {minX,minY,maxX,maxY}`; `DoorSector = {hinge:PointMm;radiusMm:number;startAngleDeg:number;sweepDeg:90|-90}`. Angles use SVG coordinates: 0 east, 90 south.
- `CheckResult` matches spec section 7. Define `evidence: {confidence: Measurement['confidence']; origin:'geometry'|'project-target'|'custom-overlay'|'manual'; limitationKey:string}`. Use the weakest relevant measurement confidence; manually assessed conditions use estimated. Results for missing overlays use empty entityIds and stable summary IDs.
- Test fixtures must construct real Project objects through `fixtures.ts`, not hide incomplete shapes behind TypeScript casts.

## Task 1 — Validated project model and fictional example

**Files:** create model/schema/catalog/fixtures files in ownership table; create `vitest.config.ts`, `tests/planner/schema.test.ts`; modify package.json and lockfile only for required setup.

**Consumes:** spec sections 3, 6, 8. **Produces:** exported spec types; `projectSchema`; `validateProject(input: unknown): Result<Project>`; `createEmptyProject(id: string, now: string): Project`; `createExampleProject(now: string, locale?: Locale): Project` (locale defaults to Thai); `CATALOG: readonly CatalogEntry[]` where entries contain id, bilingual label, default dimensions, obstruction and mesh kind.

- [ ] Inspect working-tree changes and installed Next docs. Read `01-app/02-guides/testing/vitest.md`. Add `zod` and dev `vitest`, and a `test` script running `vitest run`; preserve existing scripts and dependencies.
- [ ] Add schema tests for valid 6000×5000mm room, negative/nonfinite values, 101 furniture items, duplicate IDs within a layout, intentionally shared IDs across layouts, overlapping wall openings, missing verifier identity and invalid cost range. Expected invalid values return `ok:false` with a useful field path.
- [ ] Run `pnpm test -- tests/planner/schema.test.ts`; confirm tests fail because the requested behavior is absent, not because the runner is misconfigured.
- [ ] Implement spec types, schema and validation with strict version/size bounds. Normalize unknown catalog IDs to a custom visual fallback at rendering time; preserve the original ID in project data. `createEmptyProject` starts with a 6000×5000×2700mm estimated room, empty brief, null budget/targets, revision 0 and proposed null.
- [ ] Add all ten catalog entries from spec section 8. Create the example with a 6000×5000×2700mm room, north inward door at offset 300mm, width 900mm, height 2100mm, start hinge; south window at offset 2400mm, width 1200mm, height 1200mm, sill 900mm. Use zero threshold and estimated confidence. Add sofa at (3000,4200), coffee table at (3000,500), and a route from (500,500) to (5500,500), explicit width 1000mm labelled "Example corridor — illustrative width" in the active locale. The proposed table is at (3000,1800), with other geometry unchanged. Targets and prices stay null. This width is a fictional overlay input, not an accessibility recommendation.
- [ ] Rerun schema tests and `pnpm exec tsc --noEmit`; both pass. Review the diff and checkpoint only these task changes; preserve pre-existing package/lock changes.

## Task 2 — Shared geometry and unit conversion

**Files:** create geometry.ts, units.ts, `tests/planner/geometry.test.ts`, `tests/planner/units.test.ts`.

**Consumes:** FurnitureItem, Room, Opening, PointMm. **Produces:** `getFootprint(item): RectMm`; `rectanglesOverlap(a,b): boolean`; `isWithinRoom(rect,room): boolean`; `getDoorSector(opening,room): DoorSector | null`; `sectorIntersectsRect(sector,rect): boolean`; `capsuleIntersectsRect(a:PointMm,b:PointMm,radiusMm:number,rect:RectMm): boolean`; `circleIntersectsRect(center:PointMm,radiusMm:number,rect:RectMm): boolean`; `parseLength(text:string,unit:'cm'|'m'): Result<number>`; `formatLength(mm:number,unit:'cm'|'m',locale:Locale): string`.

- [ ] Write independent expected-value fixtures: item center (1000,1000), size 800×400, rotation 90 yields `{minX:800,minY:600,maxX:1200,maxY:1400}`. Two rectangles touching at x=1000 do not overlap; a 1mm intrusion does. Add each wall/hinge combination, an arc-only door collision, an obstacle just outside the sector, and circle/capsule tangency versus 1mm intrusion.
- [ ] Add unit tests: `parseLength('90','cm')` gives 900; `parseLength('๙๐','cm')` gives 900; `parseLength('1.25','m')` gives 1250; empty, NaN-like text and `'1,200'` reject. Assert format/parse round-trip within 1mm for permitted precision.
- [ ] Run `pnpm test -- tests/planner/geometry.test.ts tests/planner/units.test.ts`; observe the expected red tests.
- [ ] Implement analytical rectangle/sector/capsule/circle geometry and unit boundaries. Define an epsilon of 0.001mm for floating-point comparisons only; it must not change stored integer measurements. Sliding openings return null sectors. Derive wall/hinge directions from the spec's offset convention.
- [ ] Rerun both suites and typecheck. Verify the 1mm intrusion cases are detected. Checkpoint the task.

## Task 3 — Commands, history and independent proposals

**Files:** create commands.ts, history.ts, `tests/planner/commands.test.ts`, `tests/planner/history.test.ts`.

**Consumes:** Project, ProjectCommand, validateProject. **Produces:** applyCommand; `HistoryState = {present:Project;past:Project[];future:Project[]}`; `createHistory(project): HistoryState`; `commitCommand(state,command,now): Result<HistoryState>`; `undo(state,now): HistoryState`; `redo(state,now): HistoryState`; `getReviewStatus(project): 'not-reviewed'|'reviewed'|'outdated'`.

- [ ] Write tests showing create-proposal deep-copies current with matching IDs; changing proposed table x leaves current unchanged; current correction leaves existing proposed unchanged; reset-proposal replaces proposed only; invalid opening changes leave the old state intact.
- [ ] Write tests for 50-entry cap, undo→new edit clearing redo, one drag represented by one command, noop edits not adding history, review at revision N becoming outdated after edit/undo, and record-review not adding an undo entry. Undo/redo must preserve the most recent review receipt and use a new revision, not restore a previous reviewed status.
- [ ] Run the two suites and observe relevant failures.
- [ ] Implement validated commands/history. `replace-layout` clears stale recommendation entity references for deleted objects. A duplicate ID or missing proposed layout returns an explicit Result error. Keep UI current-layout unlocking outside this pure reducer, but require an explicit create/reset proposal command.
- [ ] Run suites and typecheck; checkpoint. Domain code must not import React, storage or Three.js.

## Task 4 — Thai-first 2D workspace

**Files:** create Task 4 UI/locale files, `tests/planner/i18n.test.ts`; modify app/page.tsx, app/layout.tsx, app/globals.css; introduce `playwright.config.ts` and `tests/e2e/editor.spec.ts` for this milestone.

**Consumes:** contracts from Tasks 1–3. **Produces:** `PlannerProvider({children})`; `usePlanner()` exposing `project`, `activeLayoutId`, `activeLayout`, `locale`, `mode`, `selectionId`, `commit(command): Result<Project>`, `undo()`, `redo()`, `replaceProject(project)`, `setActiveLayout(id)`, `setSelection(id|null)`, `setLocale(locale)`, `setMode(mode)`; `PlannerApp`; `PlanCanvas({layout,locale,selectionId,onSelect,onCommitLayout})`. Provider also exposes view state/actions as typed properties, without putting it into Project.

- [ ] Read installed Next server/client and lazy-loading guides; inspect actual Base UI component interfaces. Add dev `@playwright/test`, `test:e2e` script (`playwright test`), and browser setup following installed Next Playwright guide. Configure a local dev server at 127.0.0.1:3000 and an explicit Chromium test project.
- [ ] Write locale-key parity test. Write browser test that opens the example, selects table via accessible item list, enters position in centimetres, rotates it, undoes, creates/edits a separate proposal in a new project and confirms current remains unchanged. Include an out-of-bounds drag cancellation, door edit error and Escape cancelling placement.
- [ ] Run `pnpm test -- tests/planner/i18n.test.ts` and `pnpm exec playwright test tests/e2e/editor.spec.ts --project=chromium`; record the intended initial failures.
- [ ] Build the shell, setup, brief/room forms (including the explicit household concern choices), catalog, item list, SVG editing and inspector. Provide labelled form errors and focus restoration. Drag uses a transient preview and a single commit at pointer-up; invalid placement stays uncommitted with a reason. Collisions may be committed for later analysis; room-boundary-invalid movement may not. Room resizing may leave furniture out of bounds for repair, but cannot invalidate wall openings.
- [ ] Implement typed complete Thai/English dictionaries, Thai-capable fonts, numeric units, 44px controls, keyboard movement and editable furniture dimensions. Updating a measured dimension resets that field's confidence to estimated unless the user explicitly records a new measurement/verification. Preserve other fields' confidence. Bind visible controls to behavior; 3D/report/check tabs can say "Available in the next milestone" until their tasks land.
- [ ] Run both tests, lint and typecheck; manually inspect 1440px and 390px and keyboard placement. Checkpoint. M1 still needs Task 5 before completion.

## Task 5 — Reliable local saving and project exchange (M1)

**Files:** create Task 5 files; `tests/planner/storage.test.ts`, `tests/planner/project-files.test.ts`; extend provider to load/save through hook; extend editor E2E with reload/file flow.

**Consumes:** validated Project and provider replaceProject. **Produces:** `encodeProject(project): string`; `decodeProject(text:string): Result<Project>`; `StoragePort = Pick<Storage,'getItem'|'setItem'>`; `SavedEnvelope = {storageVersion:1;writeToken:string;project:Project}`; `loadProject(storage:StoragePort): Result<SavedEnvelope|null>`; `saveProject(storage,project,expectedToken:string|null,newToken:string): Result<SavedEnvelope>`; useProjectPersistence hook with hydration, save state, conflict and recovery actions.

- [ ] Write round-trip tests preserving IDs, both layouts, costs, targets and review. Test malformed JSON, future version, 2MiB limit, duplicate IDs, unknown catalogId fallback, and invalid costs. Ensure rejected import leaves the provider's project unchanged.
- [ ] Write fake-storage tests for quota exception, unavailable storage, malformed envelope, first save, token conflict, and late save result from a formerly open project. Expected: failure/conflict never claims saved and does not overwrite existing stored content. Successful saves issue a unique token; compare it to the currently stored token before writing.
- [ ] Run the targeted suites and observe failures.
- [ ] Implement size check using UTF-8 bytes, schema parse, filename sanitization, download and import replacement confirmation. Store the wrapper envelope under the spec project key; raw file export remains Project only. Preserve raw corrupt storage for recovery. Hydrate before enabling the 500ms autosave timer. Flush latest committed work on explicit Save; clear timers when replacing projects. On storage events, pause autosave and expose conflict UI. Acknowledge that localStorage lacks atomic cross-tab transactions: this release detects observed conflicts, and the UI asks users to edit in one tab. Never claim multi-user synchronization.
- [ ] Store locale/camera/view preferences separately and validate them. Integrate save status and reload/download recovery actions. Add beforeunload protection only while unsaved changes or failed saves exist.
- [ ] Run suites and the editor reload/import/export E2E; lint/typecheck. Demonstrate saved M1: reopen example, modify proposal, reload, verify current unchanged, download and reopen JSON. Checkpoint.

## Task 6 — Synchronized 3D inspection (M2)

**Files:** create Task 6 files and `tests/planner/scene.test.ts`; extend workspace/toolbar; extend browser editor test with 3D smoke flow.

**Consumes:** Layout and getFootprint; provider selection and view state. **Produces:** `buildRoomScene(layout:Layout): THREE.Group`; `buildFurnitureMesh(item:FurnitureItem): THREE.Group`; `toWorldPosition(point:PointMm,heightMm:number): {x:number;y:number;z:number}`; `RoomView3D({layout,selectionId,onSelect,onReady,onUnavailable})`; `SceneHandle = {capturePng():Promise<Blob>;resetCamera():void}` delivered by onReady.

- [ ] Add runtime `three`, dev `@types/three`; inspect installed-version Three.js documentation for controls/rendering/disposal. Keep dynamic import with ssr:false in a client file, as local Next docs require.
- [ ] Write scene tests: center (1000,2000) maps to world (1,0,2); item box extents match width/depth at 0/90 degrees; all ten catalog mesh bounds stay within configured footprints/heights; doorway/window geometry leaves openings at expected walls. Tests may inspect geometry without a GPU.
- [ ] Run scene tests and confirm the expected initial failures.
- [ ] Build procedural furniture, segmented walls/openings, floor and lighting. Add orbit, zoom, reset, hide-near-walls and click selection. Make 3D read-only for object movement. Use on-demand render and the same document identity/selection. Capture PNG by rendering immediately before capture; surface capture errors. Dispose all owned resources and event handlers on unmount.
- [ ] Add browser verification for switching between 2D and 3D after movement, camera reset and selection. Simulate renderer initialization failure and confirm fallback still allows 2D editing and JSON download. Repeated mount/unmount should leave a single canvas at most and no active rendering work after unmount.
- [ ] Run scene tests, browser flow, lint/typecheck and production build. Visually inspect furniture and openings against 2D; save evidence under docs/handoff/evidence. Checkpoint M2.

## Task 7 — Explainable checks and advisor overlays

**Files:** create checks.ts, checks-panel.tsx, overlay-editor.tsx, advisor-targets.tsx and `tests/planner/checks.test.ts`; extend SVG overlay rendering and provider wiring.

**Consumes:** spec CheckResult, ProjectTarget and geometry functions. **Produces:** `evaluateLayout(project:Project,layoutId:LayoutId): CheckResult[]`; `ChecksPanel({results,onSelectEntities,onCreateRecommendation})`; OverlayEditor commits updated Layout through replace-layout; AdvisorTargets commits set-targets.

- [ ] Write fixtures for G01–G05 and M01: example route blocked in current and clear in proposed; no overlays => not-evaluated summary; null width + null target => not-evaluated; inherited target width and explicit override yield correct origin labels; estimated input stays qualified. An unrelated open route must not cancel another blocked route.
- [ ] Add corner cases: round corridor join catches obstacle beyond segment rectangle, corridor extends out of room, turning circle touches wall vs 1mm outside, rug ignored as solid but emits manual reminder, threshold needs manual review, sliding door has no swing conflict. Door checks cover all wall/hinge combinations.
- [ ] Run `pnpm test -- tests/planner/checks.test.ts`; confirm failures, then implement derived checks with stable result IDs and no global safety score. Furniture collision results should not duplicate unordered pairs. Evaluate hidden overlays too; visibility only affects display/export.
- [ ] Implement draw/edit/remove routes and turning areas with keyboard/numeric alternatives. Null geometry targets render explanatory dashed indicators. Add advisor target form requiring rationale and name. Any source URL remains an optional attribution, not legal approval. Show geometry origins and limitations in the inspector and report data.
- [ ] Wire selecting a result to the correct layout/entity, with a visible marker and text focus. Empty entity results focus the relevant overlay-creation instructions. Trigger checks on committed edits, memoize by affected project/layout state, and retain explicit not-evaluated entries.
- [ ] Run suites, typecheck and editor/check browser flow. Confirm demo width is visibly illustrative and production targets remain unset. Checkpoint.

## Task 8 — Recommendations, estimates and advisor review (M3)

**Files:** create Task 8 files; `tests/planner/recommendations.test.ts`; extend commands/provider UI as needed without changing public contracts.

**Consumes:** Project/Recommendation/CostRange and getReviewStatus. **Produces:** `summarizeCosts(recommendations:Recommendation[]): {lowSatang:number;highSatang:number;missingComponents:number;includedCount:number}`; `buildRecommendationDraft(result:CheckResult,locale:Locale): Pick<Recommendation,'title'|'reason'|'action'>`; UI forms that commit existing commands.

- [ ] Write cost test with accepted recommendation materials 10000–20000 satang and unknown labour: subtotal 10000–20000, missingComponents 1; a proposed/deferred recommendation is excluded. Explicit zero is known. Assert adding one completed known estimate produces exact integer totals without floating-point drift.
- [ ] Test rejecting high<low, negative values and missing estimate source/date; deleting an entity preserves written recommendation with cleared entityId. Review tests: change estimate or resident preference after review => outdated; language/camera change => still reviewed. `record-review` requires nonempty name, records the current revision and does not claim verified identity.
- [ ] Run focused suites and confirm failures. Implement recommendation create/edit/status/priority, source/date inputs, cost summary and budget comparison. Budget null has no overspend warning; incomplete costs show a provisional comparison. Clearly separate proposed estimates from accepted work.
- [ ] Implement create-from-check as a draft requiring user edits/save; it does not silently create or accept work. Add optional preview/apply action only for a deterministic user-selected move; the ordinary numeric/drag editor satisfies first-release change exploration, so no automatic layout generator is needed.
- [ ] Add advisor review panel with self-entered reviewer, date, covered revision and current/outdated status. Mode switch is a UI affordance; family users can still read all recommendations. Preserve resident preferences in reports and review UI.
- [ ] Run suites and browser flow: family records concern → advisor adds recommendation/estimate → reviews → edit makes review outdated. Checkpoint M3.

## Task 9 — Before/after report and image exports

**Files:** create Task 9 files, `tests/planner/exports.test.ts`; add print styles to app/globals.css; integrate export menu with project-menu.

**Consumes:** Project, evaluateLayout, summarizeCosts, SceneHandle. **Produces:** `createPlanSvg(layout:Layout,options:{locale:Locale;layoutLabel:string;showOverlays:boolean}): string`; `buildReportData(project:Project,locale:Locale): ReportData`; ReportData explicitly contains project revision, brief, both plans, checks, recommendation/cost summaries and review status; `ReportPreview({data,onClose})`.

- [ ] Write export tests asserting saved dimensions/rotations match SVG coordinates, labels are escaped, script-like user text remains text, report uses fresh results after layout change, missing proposed layout is explicitly labelled, and unknown prices remain unknown. Assert report includes review revision and confidence.
- [ ] Run export suite and observe failures, then implement SVG generation from shared geometry. Use a shared render-model helper if needed; avoid maintaining a second footprint algorithm for export. Download valid SVG with UTF-8 Thai labels. Use browser Blob URLs and revoke after use.
- [ ] Build report preview/print layout with stacked current/proposed plans, readable Thai labels, repeating table headers and sensible page breaks. Include optional fresh 3D snapshot, with omission note on failure. Print uses window.print only after fonts/images/content are ready; browser handles Save as PDF. It must work entirely without WebGL.
- [ ] Connect active-view PNG download to SceneHandle.capturePng; disabled state explains unavailable 3D. Changes in selected layout/revision invalidate previously captured report images. Snapshot export data at invocation to keep a report internally consistent.
- [ ] Run export suite and browser export flow. Inspect a printed PDF or print-preview artifact in Thai with long notes and multiple pages; verify text does not clip. Inspect SVG and PNG against the editor. Checkpoint.

## Task 10 — Release verification and handoff (M4)

**Files:** create/extend `tests/e2e/planner-flow.spec.ts`, `recovery.spec.ts`, `accessibility.spec.ts`, `docs/handoff/verification.md`; fix only defects revealed by these checks.

**Consumes:** completed M1–M3 and Task 9. **Produces:** verified release and reproducible evidence, not additional product scope.

- [ ] Add dev `@axe-core/playwright`. Extend Playwright config for Chromium and a WebKit smoke project where the environment supports it; document unavailable browser execution honestly. Tests must run against the actual app; geometry unit tests remain independent of screenshots.
- [ ] Write acceptance flow: new Thai project → edit current → create proposal → modify item numerically and by keyboard → compare 2D/3D → set custom target/draw overlay → inspect checks → add estimate/review → save/reload → export/import → report. Assert underlying dimensions through visible forms and exported JSON, not only toast messages.
- [ ] Add recovery tests for corrupt startup, oversize/future-version import, quota error, storage conflict event, stale pending save after project replacement, and unavailable WebGL. Verify local work remains downloadable. Record multi-tab concurrency as best-effort conflict detection, not atomic locking.
- [ ] Run accessibility scans and manually exercise keyboard navigation, focus restoration, accessible item-list alternative, Escape cancellation, 200% zoom, reduced motion, Thai digit input and text editing without intercepted arrow keys. Check 390×844, 768×1024 and 1440×900 viewports in both languages. Automated scans cannot substitute for these manual checks.
- [ ] Run `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`. Resolve relevant failures; do not label a skipped/blocked command as passed. Check a production-served app for hydration errors, console exceptions and export functionality.
- [ ] Reconcile A01–A12 against the implementation in verification.md: criterion, evidence/test, result and limitation. Include screenshots of current/proposed 2D, 3D, Thai report and mobile layout. Check git diff for unrelated changes and assets sourced from the reference.
- [ ] Checkpoint final changes and report exact tested commit or working-tree state, commands/results, remaining issues and next recommended scope. Deployment and PR creation are separate user decisions. Leave the app and document paths clear for the primary agent to review.

## Completion and progress rules

Each task ends with changed-file review, focused verification and a checkpoint. If committing in this checkout, stage only task-owned hunks/files; shared existing modifications must not be swept into a commit. If the task's ownership cannot be separated safely, leave the changes uncommitted and explain that in the handoff. Never use a blanket reset or cleanup to manufacture a clean tree.

After each milestone, update `docs/handoff/progress.md` with completed task IDs, changed files, tests and results, known limitations, and exact next task. At a context limit, stop at a coherent boundary and update this file; do not call an unfinished milestone complete.

All acceptance criteria map to tasks: A01→1/4; A02→2/4/6; A03→3; A04→2/7; A05→7/8; A06→8; A07→1/5; A08→5/10; A09→9; A10→4/10; A11→6/10; A12→1/7. Product code has not been written as part of this planning request.
