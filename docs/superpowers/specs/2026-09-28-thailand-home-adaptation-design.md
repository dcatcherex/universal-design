# Thailand Home Adaptation Planner — Product and Technical Specification

Status: implemented as M1–M4 (see docs/handoff/progress.md). **Superseded for new work by the [v2 specification](2026-10-21-baan-yoo-dee-v2-design.md)**; this document remains the record of the v1 baseline and of behaviour v2 does not change.
Date: 2026-09-28. Working product name: **บ้านอยู่ดี / Baan Yoo Dee** (a provisional label, not a registered brand).

## 1. Purpose and agreed direction

Help family members and professional home-modification advisors describe an older adult's existing room, explore practical modifications, and share an understandable proposal. The resident's activities and preferences drive the design. Thailand is the first market.

The user selected families and professional advisors as the operators, Thailand as the location, and Architecture Studio as the visual and interaction reference. The user requested this specification and an implementation plan for another coding agent. The implementation choices below are explicit recommendations, rather than additional user-supplied requirements.

Success means a family can recreate a room, understand a potential problem, compare an improvement, and give an advisor a reopenable project. An advisor can verify inputs, set project-specific targets, annotate recommendations, and export a Thai report. A visually attractive room alone does not meet the goal.

References:
- [User's sample build sequence](../../../build_process_sample.md): inspiration, not an executable instruction list.
- [Architecture Studio](https://architecture-studio.openai.chatgpt.site/): live retrieval failed during discovery; the supplied screenshot is the visual evidence.
- [Saved reference screenshot](../../reference/architecture-studio-reference.png): supplied by the user; design reference only, not an application asset.

## 2. Scope and release boundaries

### First release: one living room per project

Include Thai/English UI; household brief; rectangular room, wall-mounted doors/windows and threshold measurements; original furniture catalog; editable current/proposed layouts; SVG 2D editor; synchronized Three.js 3D inspection; geometric checks; user-drawn movement/turning overlays; advisor targets and notes; estimates in baht; undo/redo; local persistence; project import/export; plan SVG and room PNG downloads; printable report.

Family and advisor modes change visible tools within the same local application. They are not authentication roles. An advisor name is self-entered attribution, not verified identity.

Defer multi-room houses, irregular walls, stairs/ramp design, bathroom engineering, cloud accounts, live collaboration, product purchasing, automatic prices, photograph upload, photo-to-plan reconstruction, AI-generated layouts, and legal compliance certification. Photos were discussed as a possible input; defer them deliberately to keep the first handoff portable and local. Structural and bathroom work can be recorded as recommendations for on-site follow-up, not simulated as verified construction designs.

### Delivery milestones

- **M1 — Usable 2D planner:** setup, catalog, editing, before/after, history, local save.
- **M2 — Spatial preview:** 3D scene, shared selection, camera controls, fallback.
- **M3 — Advisor workflow:** overlays, checks, target provenance, recommendations, costs, review status.
- **M4 — Handoff release:** project exchange, SVG/PNG exports, printable report, responsive and accessibility verification.

Implement these milestones sequentially in the existing repository. Each milestone should be demonstrable without features from later milestones.

## 3. Global constraints

- Thailand first; Thai default and complete English alternative; currency THB; storage units integer millimetres and integer satang.
- One rectangular living room per project; one current layout and one proposed layout; schemaVersion is 1.
- All views, checks, history, and exports derive from one validated Project document.
- Furniture placement changes occur in 2D or numeric forms; 3D provides inspection and selection.
- Accessibility targets remain unset until an advisor explicitly enters a project-specific value and rationale; do not ship invented Thai statutory thresholds.
- Existing unrelated working-tree changes must be preserved; read AGENTS.md and installed Next.js documentation before implementation.
- No backend, authentication, paid API, external model download, telemetry, or deployment is required for this release.
- Every visible action must function or explain why it is unavailable; no decorative save, review, export, or analysis buttons.

## 4. Primary workflow

1. Start screen offers New project, Open project file, and Open example. A saved local project offers Continue. The example is clearly labelled fictional.
2. Setup captures project title, optional province, household activities, mobility aids (multiple choices), assistance needs, resident preferences, budget, room dimensions and confidence. No diagnosis, full resident name, address, or contact details are required.
3. Edit Current: add openings and furniture. Family can enter measurements or mark them estimated. Individual furniture dimensions are editable to represent possessions, regardless of catalog defaults.
4. Create proposal makes an independent deep copy of Current, preserving entity IDs. Current is then read-only by default. Explicit Edit current enables corrections; these do not silently update Proposed. Reset proposal from current shows a replacement confirmation.
5. Edit Proposed and switch between the two layouts without changing the document. Selecting the same entity ID follows it between layouts where it exists; otherwise selection clears.
6. Open Checks to locate geometric issues. Enter Advisor mode to set targets, add overlays, verify measurements, and write recommendations. Checks explain their input assumptions.
7. Compare, review, estimate, and export. The advisor records their name and review date against the current project revision. Later substantive edits mark that review outdated.

## 5. Workspace and visual direction

Use the screenshot's restrained residential feel: warm off-white panels, pale sage canvas, dark green primary actions, light oak geometry and cream upholstery. Design original furniture silhouettes. Do not copy the reference logo or depend on its assets or source code.

Desktop at 1280px and wider: 72px header, 272px catalog left, flexible central canvas, 320px inspector right. Header contains project title, save state, Current/Proposed switch, Family/Advisor mode, language, and export menu. A toolbar above the canvas contains 2D/3D, undo/redo, measurement/overlay toggles and zoom. Selection tools belong near the selected object or in the inspector.

Inspector tabs: Items / Checks / Recommendations. Household brief and room measurements open in an accessible sheet. The catalog has categories Seating, Tables, Storage, Lighting, Rugs, Custom. Show dimensions and a recognizable preview on every card.

At 768–1279px: collapsible side sheets, at most one open at a time. Below 768px: canvas plus labelled bottom actions opening sheets. Preserve the selected item and active layout when the viewport changes. Numeric editing must be practical on a phone. A small screen must not require simultaneous side panels.

Minimum application control target is 44 by 44 CSS pixels. Use 16px body text, visible focus, labelled icons, sufficient contrast, text alongside issue colors, keyboard operation, and reduced-motion support. Target WCAG 2.2 AA; this is an implementation target, not an assertion of certification. Use a Thai-capable system font stack initially (Tahoma, Leelawadee UI, sans-serif) to avoid a remote-font dependency.

Required core labels:

| English | Thai |
|---|---|
| Current room | ก่อนปรับปรุง |
| Proposed room | หลังปรับปรุง |
| Items | รายการสิ่งของ |
| Areas to improve | จุดที่ควรปรับปรุง |
| Recommendations | ข้อเสนอแนะ |
| Estimated / Measured / Advisor verified | ประมาณการ / วัดแล้ว / ผู้ให้คำปรึกษาตรวจสอบแล้ว |
| Saved on this device | บันทึกบนอุปกรณ์นี้แล้ว |
| Unable to save — download project | บันทึกไม่สำเร็จ — ดาวน์โหลดไฟล์โครงการ |
| Not evaluated | ยังไม่ได้ประเมิน |

All interface copy lives in typed locale dictionaries. English is the complete key source; Thai must provide the same keys. Changing language updates document.lang and report language, without changing measurements or review status. User-entered labels and notes remain in their original language; the application does not machine-translate project content.

## 6. Authoritative document and data contracts

Define the following types in `lib/planner/types.ts` and validate equivalent shapes in `schema.ts` using Zod. IDs are opaque strings generated at entity creation. Dates are ISO 8601 strings; all coordinates and dimensions are finite integers. Dictionaries are application data, not embedded in project files.

| Type | Required fields and constraints |
|---|---|
| Measurement | `valueMm: number`, `confidence: estimated | measured | advisor-verified`; verification additionally requires `verifiedBy` and `verifiedAt` |
| PointMm | `xMm`, `yMm`; origin is northwest inner corner, x right/east, y down/south |
| Room | `width: Measurement`, `depth: Measurement`, `height: Measurement`; each 1500–15000 mm for width/depth, 2000–5000 mm height |
| Opening | `id`, `kind: door | window`, `wall: north | east | south | west`, `offset: Measurement`, `width: Measurement`, `height: Measurement`, `sill: Measurement`, `threshold: Measurement`; door also `operation: hinged-in | sliding`, `hinge: start | end` |
| FurnitureItem | `id`, `catalogId`, `label`, `center: PointMm`, `width/depth/height: Measurement`, `rotationDeg: 0 | 90 | 180 | 270`, `finish: oak | cream | sage | charcoal`, `obstruction: solid | rug` |
| RouteOverlay | `id`, `label`, `points: PointMm[]` (2–12), `widthMm: number | null`; width 100–3000 when supplied; null inherits project route target |
| TurningOverlay | `id`, `label`, `center: PointMm`, `diameterMm: number | null`; diameter 100–4000 when supplied; null inherits project turning target |
| Layout | `room: Room`, `openings: Opening[]`, `items: FurnitureItem[]`, `routes: RouteOverlay[]`, `turningAreas: TurningOverlay[]` |
| ProjectTarget | `valueMm`, `rationale`, `enteredBy`, `enteredAt`, optional `sourceUrl` and `sourceClause`; explicitly a project-specific target |
| HouseholdBrief | `province`, `activities: string[]`, `mobilityAids: string[]`, `concerns: ('lighting' | 'reach' | 'rugs' | 'thresholds')[]`, `assistanceNotes`, `residentPreferences`, `budgetSatang: number | null` |
| Recommendation | `id`, `layoutId: current | proposed`, optional `entityId`, `title`, `reason`, `action`, `priority: now | next | later`, `workType: rearrange | purchase | building-work | site-review`, `status: proposed | accepted | deferred | completed`, `advisorNote`, `materials: CostRange | null`, `labour: CostRange | null` |
| CostRange | `lowSatang`, `highSatang`, nonempty `sourceNote`, `estimatedAt`; integers >= 0, high >= low; null means unknown, 0 means explicitly no cost |
| ReviewReceipt | `reviewerName`, `reviewedAt`, `projectRevision`; computed status is not-reviewed, reviewed, or outdated |
| Project | `schemaVersion: 1`, `id`, `title`, `createdAt`, `updatedAt`, `revision`, `household`, `current: Layout`, `proposed: Layout | null`, `targets: { routeWidth: ProjectTarget | null, turningDiameter: ProjectTarget | null }`, `recommendations: Recommendation[]`, `review: ReviewReceipt | null` |

Opening offset is measured from the north/west end of its wall: north/south run west to east, east/west run north to south. Hinges use that direction, not clockwise wall traversal. Door sill is zero; threshold describes the level change and is not automatically a geometry compliance test. Openings must fit the wall length and room height and cannot overlap another opening on that wall. Editing a wall that would invalidate an opening is rejected with a repair message. Outward hinged doors are deferred rather than inaccurately modelled as inward.

Opening width is at least 100mm, height at least 100mm, offset/sill nonnegative, and threshold magnitude 0–500mm. Width/offset must fit the wall; height+sill must fit room height. Window threshold is zero. Route targets use the same 100–3000mm bound as route widths; turning targets use 100–4000mm. These bounds are input/model limits, not recommended construction dimensions. Budget and each cost endpoint must be safe integers from 0 to 1,000,000,000,000 satang. Empty optional text is an empty string; an unset budget is null. Timestamps must be valid ISO dates. Measurement verification requires a nonempty verifier name and timestamp; changing the numeric value resets that field to estimated until the user explicitly records a fresh measurement/verification.

Furniture width/depth range 100–5000mm and height 1–3000mm; coordinates must remain inside the room in normal editing. Imported or resized layouts may contain out-of-bounds footprints within coordinate limits -15000–30000mm so the user can repair them. Limit 100 furniture items, 20 openings, 20 routes, 20 turning areas, 100 recommendations. Project files max 2 MiB UTF-8. Titles max 120 chars, labels 160, free-text notes 4000. Keep references valid; deleting an entity clears its recommendation entityId while preserving its written recommendation.

Editor state is separate: active layout, mode, locale, selection, tool, zoom, orbit camera, visibility flags, dirty/save status and undo/redo. Persist view preferences and camera in a separate local storage entry; exported Project contains domain data only. Shared entity IDs across current/proposed are intentional; IDs must be unique within each layout.

All substantive document edits increment revision and update updatedAt. Setting a review receipt is metadata and does not increment revision. Undo/redo restores domain snapshots but assigns a new monotonically increasing revision, so an earlier review cannot silently become current again. View changes do not affect revision. Keep at most 50 undo entries in memory; coalesce one drag into one entry. Loading/importing another document clears history.

## 7. Geometry, editing and checks

2D uses SVG with millimetres as model coordinates. Display rooms in metres, furniture/clearances in centimetres; convert once at the form boundary, round to the nearest millimetre, and never store display units. Accept decimal point and Thai digits; reject ambiguous thousands separators with an inline message. Grid snap defaults to 50mm; numeric entry and an explicit fine-move mode allow 10mm increments. Arrow keys move 10mm and Shift+arrow 50mm when an item has focus; input fields retain normal text behavior. Rotation advances 90 degrees. Escape cancels placement/drag; duplicate makes a new ID and requires a valid position before commit.

Pure geometry functions own footprints and opening/overlay shapes. Both renderers consume these. Positive-area intersection counts as a collision; exact edge contact is not overlap, but may still obstruct a configured movement envelope. Rug footprints do not count as solid collisions; rugs produce a separate manually assessed trip-hazard reminder. A rectangular footprint is a conservative representation of irregular furniture.

Checks return `CheckResult { id, ruleId, layoutId, entityIds, status, messageKey, measuredMm?, targetMm?, evidence }`. `status` is `attention | clear | not-evaluated`. Evidence includes input confidence, geometry/target origin and a plain-language limitation. IDs are stable from rule + layout + sorted entity IDs, so results remain navigable across rechecks. Derived results are recalculated rather than saved as authoritative facts.

| Rule ID | Deterministic behavior | Wording boundary |
|---|---|---|
| G01 bounds | Rotated footprint lies outside the room interior | Item extends beyond entered room boundary |
| G02 collision | Positive-area overlap between two solid furniture rectangles | Furniture footprints overlap |
| G03 door-swing | Solid footprint intersects the interior quarter-disc swept by a hinged door leaf | Item obstructs the modelled door swing |
| G04 route | Positive intersection between any solid footprint and a route envelope, or envelope leaves room | Drawn movement corridor is obstructed; never claim all destinations are reachable |
| G05 turning | Circle intersects a solid footprint or extends outside room | Drawn turning space is obstructed; never certify maneuverability |
| M01 site-review | Rug, entered threshold, or household lighting/reach concern creates a manual-review entry | A physical condition needs checking; the 3D image cannot verify it |

A route envelope is the union of capsules around consecutive segments (round joins/end caps), with radius width/2. Duplicate adjacent route points are rejected. Without a width or a project route target, G04 is not-evaluated and the centerline is dashed. Without a diameter or project target, G05 is not-evaluated. If no overlays exist, show a not-evaluated summary inviting the user to draw them, not a clear result. User-specified overlay values are labelled custom, even when they differ from project targets. Check conflicts after every committed edit; do not generate recommendations automatically or move furniture without a preview and apply action.

Use analytic circle/rectangle and segment/rectangle distance checks for envelopes, and quarter-disc/rectangle checks for door swings; avoid sampling-only algorithms that miss narrow intersections. Room-wall clipping can be measured separately from furniture interference. Sliding doors display an opening but have no swing sector.

Clear means only that a modeled geometry check found no conflict under its inputs. Estimated dimensions remain visibly qualified. Changing mobility aids changes the brief, not dimensional targets automatically. For missing data show not-evaluated. The report never says the house is safe, universally accessible, or legally compliant based on these checks.

## 8. Furniture and 3D rendering

Initial catalog, with default width × depth × height in millimetres: sofa 2100×900×850; armchair 850×850×900; coffee table 1100×600×450; side table 450×450×550; dining chair 500×550×850; dining table 1400×800×750; low cabinet 1200×400×800; floor lamp 350×350×1600; rug 1800×1200×10; custom block 600×600×600. These are fictional furniture dimensions, not accessibility recommendations or product claims.

Create recognizable original procedural meshes from boxes/cylinders using each item's actual dimensions; catalog thumbnails can be inline SVG. 3D has floor, walls with modeled openings, warm materials, simple lighting/shadows, orbit, zoom, reset, and click selection. Use xWorld=xMm/1000, yWorld=heightMm/1000, zWorld=yMm/1000 and rotationY=-rotationDeg radians. Center objects at the same floor position as 2D. User can hide near walls to inspect interiors.

Load Three.js only after 3D is requested. Keep 2D editing available if WebGL fails or context is lost. Dispose renderer, geometries, materials, controls, observers and animation callbacks on unmount. Respect reduced motion and cap device pixel ratio at 2. Render on demand except while camera controls are moving. A report and SVG export must work without 3D.

## 9. Persistence, handoff and reporting

Local storage keys: `baan-yoo-dee.project.v1` and `baan-yoo-dee.preferences.v1`. The project storage value is an envelope `{storageVersion:1, writeToken:string, project:Project}`; file exports contain Project alone. Save a validated snapshot 500ms after a committed edit; update the saved status only after successful storage. Catch quota/unavailable-storage errors; keep in-memory work and offer project download. On startup, parse/validate before enabling autosave. Corrupt data gets a recover/download-raw or start-new choice; preserve the raw value until a user chooses replacement. Use a last-saved token and storage events to detect observed writes from another tab; pause autosave and offer reload or download current work. This is best-effort conflict detection, not an atomic lock: instruct users to edit a project in one tab, and do not claim concurrent-edit support.

JSON export is `<safe-title>.udhome.json` and contains the entire Project. Import validates size, schema version, finite numbers, bounds, IDs and references before replacement. Unknown versions produce a helpful error. Loading an imported project requires confirmation when replacing work. Invalid imports leave the current project unchanged. Unknown catalog IDs render as custom blocks using the saved dimensions.

Plan SVG export includes dimensions, layout name, objects, labels and visible overlays. Escape text; render user content as text, never executable markup. Room PNG exports the active 3D view after a fresh render; disable with a reason when WebGL is unavailable. Download failures are shown without changing project save status.

Report is an accessible HTML preview inside the app with print CSS and a Print / Save as PDF action using the browser print dialog. No server PDF service. Include project title, province if supplied, brief, dimensions/confidence, current/proposed plans, geometry results and limitations, recommendations, advisor notes, review status/revision, and cost totals. Include 3D image only if available. Reports use current recomputed checks, not cached results.

Cost summary totals accepted/completed recommendations; proposed/deferred remain listed separately. Sum each known materials/labour range independently; if any included component is unknown, label the total a known subtotal and show the number of missing components. Budget comparison is provisional when costs are incomplete. Formatting uses locale-appropriate separators and THB, with two decimals when needed. An estimated date/source remains visible. No prices are seeded as market facts.

## 10. Architecture and repository constraints

Current repository is a Next.js starter with React, TypeScript, Tailwind and Base UI-based shadcn components. No planner, tests, 3D renderer or persistence layer exists at inspection time. Existing uncommitted changes include app/globals.css, package.json, pnpm-lock.yaml and new components/hooks/lib files; inspect again before editing and preserve them.

Use App Router: server `app/page.tsx` mounts client `components/planner/planner-app.tsx`; `app/layout.tsx` owns metadata and default Thai language. Keep domain logic in `lib/planner/`; UI in `components/planner/`; tests in `tests/planner/` and `tests/e2e/`. React reducer/context is sufficient; no new global state library. Zod handles file/schema validation. Three.js with OrbitControls handles 3D; do not add a second scene framework.

Add only these dependencies when their tasks start: runtime `zod`, `three`; development `@types/three`, `vitest`, `@playwright/test`, `@axe-core/playwright`. Resolve versions compatible with the installed runtime at implementation time and commit the lockfile. Reuse existing components but inspect their actual Base UI APIs. Application sizing overrides existing small button defaults.

Installed Next.js guidance already consulted during planning: `01-app/01-getting-started/05-server-and-client-components.md` and `01-app/02-guides/lazy-loading.md` under `node_modules/next/dist/docs/`. In this version, browser APIs belong behind client boundaries and `ssr: false` dynamic loading belongs in a Client Component. Executors must read relevant installed docs again before coding against them.

## 11. Source register and evidence status

These links establish research starting points, not approved dimensional defaults:
- [Department of Older Persons: home adaptation program manual, FY 2568](https://www.dop.go.th/th/know/12/2590). Landing page verified; numeric criteria and applicability have not been extracted and approved.
- [Ministry record: accessibility regulation amendment, 2564](https://law.m-society.go.th/law/view/234). Candidate legal source; legal scope and current consolidated requirements need a qualified review before compliance logic is added.
- [NC State: universal design principles](https://design.ncsu.edu/research/center-for-universal-design/). Conceptual basis, not a dimensional standard.
- [W3C: older users](https://www.w3.org/WAI/older-users/) and [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/). Interface-accessibility references.
- [Three.js documentation](https://threejs.org/docs/). Implementation reference; check installed-version APIs.

Future Thai rule records need source URL, document title, edition/effective date, clause/page, units, applicable building/use types, reviewer and review date. Until that work is done, ship geometric checks and advisor-defined project targets only. Missing legal-source verification does not block M1–M4 as scoped.

## 12. Acceptance criteria

| ID | Observable acceptance |
|---|---|
| A01 | A Thai user creates a project and edits dimensions/openings/items without signing in. Thai and English core flows are complete. |
| A02 | Drag, numeric input and keyboard movement yield the same geometry; switching 2D/3D or current/proposed never changes saved dimensions. |
| A03 | Creating a proposal isolates current; undo/redo reverses a complete action, preserves revision monotonicity, and invalidates old reviews. |
| A04 | G01–G05 identify known fixtures and boundary cases; unset targets and missing overlays cannot produce an accessibility pass. |
| A05 | A family can understand a check, focus its location, and create a recommendation; an advisor can record evidence and review status. |
| A06 | Unknown costs remain unknown; THB estimates, sources, accepted subtotal and budget comparison behave as specified. |
| A07 | Reload and valid JSON round-trip retain all domain data; corrupt/oversize/future-version imports leave the active project intact. |
| A08 | Storage failure and concurrent-tab conflict expose recovery/download choices; neither silently erases work. |
| A09 | SVG, available PNG and printable report correspond to the selected project revision and label limitations and measurement confidence. |
| A10 | Full keyboard setup/edit/check/export flow works; focus survives sheets; 200% zoom and 390px, 768px and 1440px layouts remain usable. |
| A11 | WebGL failure leaves 2D, JSON export and report usable; repeated 3D mount/unmount does not retain canvases or active loops. |
| A12 | Fictional 6×5m example demonstrates an obstructed route and a separate improved proposal; no invented legal threshold or market price is presented as fact. |

Release checks: lint, TypeScript, unit tests, production build, browser integration flows, accessibility scan plus manual keyboard/Thai-copy review. Record actual commands, results and any unverified checks in the implementation handoff. Product code implementation is a separate task from authoring these documents.
