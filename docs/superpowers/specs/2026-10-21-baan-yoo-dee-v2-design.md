# Baan Yoo Dee v2 — Product and Technical Specification

Status: implementation-ready for R1; R2–R4 are agreed direction to be detailed in their own plans.
Date: 2026-10-21. Supersedes [the v1 specification](2026-09-28-thailand-home-adaptation-design.md) for all new work; v1 remains the record of the shipped M1–M4 baseline.
Working product name: **บ้านอยู่ดี / Baan Yoo Dee** (provisional, not a registered brand).

## 1. Purpose and priorities

Help families and home-modification advisors in Thailand rework an older adult's home so it is safer and easier to use, and get the work funded and done.

Goals, in priority order. When two goals conflict, the higher one wins:

1. **Fall-risk reduction.** Find and fix the hazards behind most falls: the bathroom, the night route from bed to toilet, thresholds and level changes, reach and height, lighting, and missing support.
2. **Advisor productivity.** An advisor assesses more homes, faster, and leaves with a report, a contractor work order and a grant application pack.
3. **Family self-service.** A family member or village health volunteer (อสม.) can capture the home and see likely problems without an advisor present.

Operating model: **hand-off.** A family member or village health volunteer captures the home and the household's needs. An advisor then verifies, proposes, reviews and exports.

Pilot: one local-government area (อบต. or เทศบาล) with its subdistrict health hospital (รพ.สต.) and the provincial social development office (พมจ.). Pilot success measures:
- Assessment time per home.
- Grant approval rate.
- Falls at 6 and 12 months, tracked as the real outcome; pilot decisions do not wait for it.

Funding and licence: free for every user, publicly or grant funded, open source under **AGPL-3.0**. A ministry or province must be able to self-host the whole stack.

## 2. Release plan

| Release | Scope | Runs |
|---|---|---|
| **R1 — Benchmarks and bathroom** | Versioned benchmark data; two-benchmark verdicts; door, threshold, route and turning checks against benchmarks; bathroom room type with fixtures and checks; heights and wall elevation views; resident profile with fall history; reach and socket checks; suggested-fix library with price list; report updates. Schema v2 is multi-room-ready but limited to one room. | Local only (as v1) |
| **R2 — Whole home** | Multiple rooms per floor, multiple floors, non-rectangular rooms, openings connecting rooms, the night route from bed to toilet across rooms and floors, stairs as marked areas with riser/tread notes, bedroom room type (bed height), lighting/contrast checks, support-point checks. | Local only |
| **R3 — Cloud and hand-off** | Sign-in, organisations and roles, consent, sharing, offline-first sync and live co-editing, locked verified values, photo capture with face/document blurring, capture mode (large text, voice prompts) for families and village health volunteers. | Cloud + offline |
| **R4 — Pilot outputs** | Contractor work order, grant application pack, "possibly eligible" grant indicator with outcome tracking, organisation price lists, workflow event logging, pilot launch. | Cloud + offline |

Each release must be pilot-usable on its own. R1 must add value to the existing local app without depending on any later release.

**Out of scope for all releases unless re-decided:**
- Native apps and LiDAR or AR scanning (the decision is web/PWA only).
- AI-generated layouts or photo-to-plan reconstruction.
- Stair and ramp design.
- Structural engineering.
- Product purchasing or contractor marketplace links.
- Any claim of legal compliance or certification.

## 3. Global constraints

- Thai default and a complete English alternative. Currency THB. Store integer millimetres and integer satang.
- One validated Project document drives every view, check, history entry and export. Derived results are recomputed, never stored as authoritative facts.
- Floor furniture can be moved in the 2D plan, numeric forms, or by dragging in the 3D view. A 3D drag moves only floor furniture across the floor, snaps to 50 mm, and uses the same bounds validation and one-step history as the 2D plan; it does not rotate, resize, add, or delete items. The 2D plan and numeric forms remain the precise placement tools, and keyboard users can move items with the arrow keys in the 2D plan. Wall fixtures remain read-only in 3D and are edited in the 2D wall elevation.
- **Benchmarks, never compliance.** The app compares a measurement with a cited benchmark value. Never use "compliant", "ถูกต้องตามกฎหมาย", "safe" or "accessible" as a verdict. The public-building regulation does not legally apply to private homes; every check and report must say so (§7.4).
- Definite verdicts need verified inputs and a reviewed benchmark value (§7.3). Anything else is "likely". Missing data is "not evaluated", never "clear".
- Every visible action works or explains why it is unavailable.
- Preserve existing unrelated working-tree changes. Read `AGENTS.md` and the installed Next.js docs under `node_modules/next/dist/docs/` before coding.
- R1 and R2: no backend, no authentication, no telemetry, no deployment. R3 and R4 introduce these under §11.

## 4. Primary workflow (R1)

1. **Start.** New project, open file, open example, or continue. On first load, a v1 project in storage or a v1 file is migrated automatically (§6.6).
2. **Setup.**
   - Title, province (select from the 77 provinces, which determines the price region) and household brief.
   - **Room type: living room or bathroom.**
   - Room size, floor finish and slip resistance.
   - **Resident profile** (§6.3). All fields optional, and the form says why each one helps.
3. **Capture Current.**
   - Openings, with door operation and handle.
   - Furniture, and in bathrooms the toilet, shower seat and water storage.
   - Wall fixtures (grab bars, switches, sockets, shelves, basin) in the plan or the wall elevation view.
   - Wet zones (bathroom).
   - Fall locations, marked on the plan.
   - Each measurement records its confidence.
4. **Checks.**
   - Every check shows both benchmarks side by side, with verdicts labelled definite or "likely".
   - A "likely does not meet" verdict, or one based on an unreviewed value, shows **"Get this checked"** (ให้ผู้เชี่ยวชาญตรวจสอบ).
   - Checks near a recorded fall location are listed first and marked.
5. **Advisor verification.**
   - The advisor records verification for each measurement: on site, or from a photo (§6.1).
   - The advisor chooses the **primary benchmark** that drives each check's overall status, or leaves it unset.
6. **Suggested fixes.**
   - Each failing check lists fixes from the library, each with a price range and grant category.
   - **Preview** applies the fix to a copy of Proposed and shows the changed items and the re-run checks.
   - **Apply** commits the layout change and a linked recommendation as one undoable action.
7. **Review and export.** The report shows both benchmarks, the benchmark data version, resident needs (fall history only if the user includes it), the before and after plans, the fixes and costs, and the disclaimer.

## 5. Workspace

Keep the v1 visual direction, responsive rules, 44px targets, WCAG 2.2 AA target and Thai-capable font stack (v1 §5).

R1 additions:
- **View switch:** Plan / Wall / 3D. Wall shows the elevation of the selected wall: north, east, south or west, picked from a wall selector or by clicking a wall in the plan.
- Inspector tabs: Items / Fixtures / Checks / Fixes & recommendations / Resident.
- The checks list sorts by: near a fall location, then does not meet, likely does not meet, not evaluated, meets.
- A **benchmark banner** shows the data version and how many of the values in use are still pending review.

Core labels added in R1:

| English | Thai |
|---|---|
| Public-building benchmark (Ministerial Regulation B.E. 2548, amended 2564) | เกณฑ์อาคารสาธารณะ (กฎกระทรวง พ.ศ. 2548 แก้ไข 2564) |
| Home recommendation (Department of Older Persons) | คำแนะนำสำหรับบ้าน (กรมกิจการผู้สูงอายุ) |
| Meets / Does not meet | เป็นไปตามเกณฑ์ / ไม่เป็นไปตามเกณฑ์ |
| Likely meets / Likely does not meet | น่าจะเป็นไปตามเกณฑ์ / น่าจะไม่เป็นไปตามเกณฑ์ |
| No benchmark value | ไม่มีค่าเกณฑ์อ้างอิง |
| Benchmark pending review | ค่าเกณฑ์รอการตรวจทาน |
| Get this checked | ให้ผู้เชี่ยวชาญตรวจสอบ |
| Verified on site / Verified from photo | ตรวจสอบที่หน้างาน / ตรวจสอบจากภาพถ่าย |
| Primary benchmark | เกณฑ์หลัก |
| Suggested fixes | แนวทางแก้ไขที่แนะนำ |
| Preview / Apply fix | ดูตัวอย่าง / ใช้แนวทางนี้ |
| Wall view | มุมมองผนัง |
| Resident | ผู้อยู่อาศัย |
| Falls in the last 12 months | การหกล้มในช่วง 12 เดือนที่ผ่านมา |
| Bathroom | ห้องน้ำ |

Thai copy for the new labels and the disclaimer needs a native-speaker review before release (R1 Task 11).

## 6. Data contracts — schema v2

Types live in `lib/planner/types.ts` and are validated in `schema.ts` with Zod. v1 rules carry over unless changed here: opaque IDs, ISO dates, finite integers, size limits and bounds, the 2 MiB file limit, and IDs shared across current/proposed but unique within each layout.

**Versioning rule.** Adding an optional field that has a default does not bump `schemaVersion`; the schema fills the default when the field is missing. Structural changes bump it and need a pure migration with tests.

### 6.1 Measurement

| Field | Change |
|---|---|
| `valueMm`, `confidence`, `verifiedBy`, `verifiedAt` | As v1 |
| `verificationMethod?: 'on-site' \| 'photo' \| 'unspecified'` | Required when `confidence = advisor-verified`. Migrated v1 verified values become `unspecified`. |
| `verificationNote?: string` | Optional, max 500 chars. In R1 a photo has no attachment, so the note says what was seen. |

Changing `valueMm` resets confidence to `estimated` and clears the verification fields (as v1). In R3, a verified value is also locked against non-advisor edits (§11).

### 6.2 Layout and rooms (multi-room-ready)

```text
Layout      = { floors: Floor[] }
Floor       = { id, label, level: integer, rooms: RoomSpace[], routes: RouteOverlay[], turningAreas: TurningOverlay[] }
RoomSpace   = { id, type: RoomType, label, origin: PointMm, shape: RoomShape, height: Measurement,
                floor: FloorSurface, openings: Opening[], items: FurnitureItem[], fixtures: WallFixture[],
                wetZones: WetZone[] }
RoomType    = 'living' | 'bathroom'                       // R2 adds 'bedroom', 'kitchen', 'other'
RoomShape   = { kind: 'rect', width: Measurement, depth: Measurement }   // R2 adds { kind: 'polygon', ... }
FloorSurface= { finish: 'tile' | 'wood' | 'vinyl' | 'concrete' | 'other' | 'unknown',
                slipResistance: 'unknown' | 'slip-resistant' | 'not-slip-resistant', confidence: Confidence }
WetZone     = { id, label, rect: RectMm }                 // room coordinates; bathrooms only
```

- Room-local entities (openings, items, fixtures, wet zones) use room coordinates: the origin is the room's north-west inner corner, as in v1.
- Routes and turning areas use **floor coordinates**: `floorPoint = room.origin + roomPoint`. In R2 a route can then cross rooms without another migration.
- **R1 limits:** exactly one floor (`level 0`) and one room, with `origin {0,0}`, so floor and room coordinates are the same. Validation rejects more and names the R2 feature in the message.
- Geometry functions take a `RoomSpace`. Provide `getPrimaryRoom(layout)` and `getPrimaryFloor(layout)` so R1 UI code doesn't spread `[0]` indexing around.

**Opening changes:**
- `operation: 'hinged-in' | 'hinged-out' | 'sliding'`. For `hinged-out` the swing sector is outside the room, so G03 doesn't check it in R1; R2 checks it against the connected room.
- `handle: { type: 'lever' | 'knob' | 'pull' | 'none' | 'unknown', height: Measurement | null } | null` (doors only).
- `connectsToRoomId: string | null`, always `null` in R1.

**FurnitureItem changes:**
- Optional `seatHeight: Measurement | null`, used for toilets, shower seats and seating.
- The catalog marks which entries have a seat height.

**WallFixture (new):**

```text
WallFixture = { id, kind: FixtureKind, label, wall: 'north'|'east'|'south'|'west',
                offset: Measurement,          // along the wall to the fixture's centre, v1 wall direction convention
                referenceHeight: Measurement, // meaning depends on kind, below
                length: Measurement,          // along the wall (vertical bars: their vertical extent)
                projection: Measurement,      // distance it sticks out from the wall
                diameter: Measurement | null } // grab bars only
FixtureKind = 'grab-bar-horizontal' | 'grab-bar-vertical' | 'grab-bar-fold-down'
            | 'switch' | 'socket' | 'shelf' | 'basin'
```

`referenceHeight` by kind:
- Horizontal and fold-down grab bars: centreline height.
- Vertical grab bar: bottom end.
- Switch and socket: centre.
- Shelf: top surface.
- Basin: rim.

A basin also has `kneeClearanceDepth: Measurement | null`. Fixtures must fit the wall length and room height. Limit: 60 fixtures per room.

### 6.3 Resident profile

```text
ResidentProfile = {
  standingHeight: Measurement | null,
  reach: { posture: 'standing' | 'seated', low: Measurement, high: Measurement } | null,  // comfortable band, floor to hand
  strongerHand: 'left' | 'right' | 'both' | 'unknown',
  wheelchair: { width: Measurement, length: Measurement } | null,
  falls: FallRecord[],              // max 20
  needs?: ('cane' | 'walker' | 'wheelchair' | 'weak-grip' | 'difficulty-standing-up' | 'unsteady-balance')[]
}
FallRecord = { id, when: 'within-3-months' | '3-to-12-months', roomId: string | null,
               point: PointMm | null,   // room coordinates in the CURRENT layout
               activity: 'toileting' | 'bathing' | 'transferring' | 'walking' | 'at-night' | 'other', note }
```

- `household.mobilityAids` (multi-select) stays in the brief.
- `resident.needs` is an optional, language-independent set of presets. Older v2 files without it open with `[]`; the saved mobility-aid labels remain supported and are merged when checks are evaluated.
- The resident profile adds body and fall data. The setup form explains that it is health information, stays on this device in R1, and is left out of the report unless the user includes it.
- A fall whose room or point no longer exists keeps its record with the location cleared, like recommendation entity references in v1.

### 6.4 Project v2

```text
Project = {
  schemaVersion: 2, id, title, createdAt, updatedAt, revision,
  household: HouseholdBrief & { provinceCode: string | null },  // province free text kept as `province` for unmatched v1 values
  resident: ResidentProfile,
  current: Layout, proposed: Layout | null,
  benchmarkPolicy: { primary: BenchmarkId, chosenBy: string, chosenAt: string } | null,
  targets: { routeWidth: ProjectTarget | null, turningDiameter: ProjectTarget | null },   // advisor overrides, as v1
  recommendations: (Recommendation & { fixId?: string, ruleId?: RuleId })[],
  review: (ReviewReceipt & { benchmarkDatasetVersion: string }) | null,
  report: { includeFallHistory: boolean }   // default false
}
```

- Setting `benchmarkPolicy` is a substantive edit: it increments `revision` and makes an existing review outdated.
- A change to the benchmark dataset version also makes a review outdated. Review status compares `review.benchmarkDatasetVersion` with the loaded dataset.

### 6.5 Persistence

- Storage key `baan-yoo-dee.project.v2`, with the same envelope, autosave, conflict and recovery behaviour as v1.
- Files keep the `.udhome.json` extension.
- **Export warning:** when the resident profile contains body or fall data, the download dialog warns that the file contains health information and asks the user to share it only with the advisor.

### 6.6 Migration v1 → v2

`migrateProject(input: unknown): Result<ProjectV2>` is pure, runs on stored and imported v1 data, and produces a validated v2 project:

- **Each layout:** becomes one floor (`id 'floor-1'`, level 0) with one room (`id 'room-1'`, type `living`, origin `{0,0}`). The v1 room becomes the rect shape and height. Routes and turning areas move to the floor with their coordinates unchanged. Each layout gets `fixtures: []` and `wetZones: []`, and floor surface `unknown/unknown/estimated`.
- **Doors:** `handle: null`, `connectsToRoomId: null`. The v1 operations keep their meaning.
- **Verified measurements:** get `verificationMethod: 'unspecified'`.
- **Resident:** empty profile.
- **Province:** `provinceCode` is matched from the free text when it equals a Thai or English province name exactly; otherwise it is `null` and the text is kept.
- **Policy and report:** `benchmarkPolicy: null`, `report.includeFallHistory: false`.
- **Review:** an existing review becomes outdated, because it covered checks without benchmarks. The migration keeps the receipt with `benchmarkDatasetVersion: 'none'`.

The v1 storage entry is left untouched after migration, so a user can still recover it.

## 7. Benchmarks and verdicts

### 7.1 Benchmark sources

| `BenchmarkId` | Source | Legal status for a home |
|---|---|---|
| `th-public-building` | กฎกระทรวงกำหนดสิ่งอำนวยความสะดวกในอาคารสำหรับผู้พิการหรือทุพพลภาพ และคนชรา พ.ศ. 2548 (Royal Gazette vol. 122 part 52 ก, 2 Jul 2005), amended by ฉบับที่ 2 พ.ศ. 2564 (vol. 138 part 16 ก, 4 Mar 2021). | **Not binding.** ข้อ 3 lists public, commercial (≥ 50 m² business area), healthcare, care, government and large residential buildings; private houses are not listed, and existing buildings are exempt. |
| `th-dop-home` | กรมกิจการผู้สูงอายุ, "คู่มือสำหรับช่างและสมาชิกในชุมชน เพื่อการจัดสภาพแวดล้อมที่เหมาะสมสำหรับผู้สูงอายุ" (about 2012). | Advisory home guidance. It has known errors, e.g. it gives the ramp slope as "not less than 1:12". Where it is wrong, the dataset uses the legal value and adds a note. |

### 7.2 Dataset

Benchmark values live in `lib/planner/standards/data/benchmarks-th-<version>.json`, are validated by a Zod schema, and are imported at build time. Shape:

```text
BenchmarkDataset = { datasetVersion: string, sources: BenchmarkSource[], values: BenchmarkValue[] }
BenchmarkSource  = { id, benchmarkId, title, edition, url, applicability: { th, en } }
BenchmarkValue   = { key: BenchmarkKey, benchmarkId, sourceId, clause: string,
                     comparison: 'min' | 'max' | 'range' | 'allowed-values' | 'required',
                     minMm?, maxMm?, allowed?: string[],
                     appliesWhen?: { roomTypes?: RoomType[], mobilityAids?: string[] },
                     notApplicableReason?: { th, en },     // explicit "no value" with a reason
                     note: { th, en },
                     review: { status: 'pending' | 'reviewed', reviewer?: string, reviewedAt?: string } }
```

- **Seed values for R1.** Version `2026.10-draft`, with every value marked **`pending`**. The values come from research done for this spec. They must be checked against the primary documents by the named owner (R1 Task 0) before any is set to `reviewed`.

| Key | `th-public-building` | `th-dop-home` |
|---|---|---|
| `door.clearWidth` | min 860 (ข้อ 18(3)) | min 900 |
| `door.threshold` | max 13 (ข้อ 18(2); bevel 1:2 for 6.4–13) | max 20 (ideally none) |
| `door.handleHeight` | range 1000–1200, lever (ข้อ 18(7)) | range 1000–1200 |
| `door.handleType` | allowed `lever` (ข้อ 18(7)) | — |
| `route.clearWidth` | not applicable (the 1500 walkway rule, ข้อ 16, applies between buildings) | min 800 (indoor) |
| `bathroom.doorOperation` | allowed `sliding`, `hinged-out` (ข้อ 21(2)) | required: openable from outside (record as allowed `sliding`, `hinged-out`; note) |
| `bathroom.turningDiameter` | min 1500 (ข้อ 21(1)) | min 1500 |
| `toilet.seatHeight` | range 400–450 (ข้อ 21(5)) | — (recommends a sit-down toilet) |
| `toilet.type` | — | allowed `seated` |
| `grabBar.horizontalHeight` | range 650–700 (ข้อ 21(6)) | — (rails throughout) |
| `grabBar.projectionPastBowl` | range 250–300 (ข้อ 21(6)) | — |
| `grabBar.foldDownGap` | range 150–200 from bowl edge (ข้อ 21(7)) | — |
| `grabBar.diameter` | range 30–40 (ข้อ 8(7)) | range 30–40 |
| `basin.rimHeight` | range 750–800 (ข้อ 21(10)) | — |
| `basin.kneeClearanceDepth` | min 450 (ข้อ 21(10)) | — |
| `floor.slipResistant` | required in toilet rooms | required |
| `socket.height` | not specified | range 800–900, `appliesWhen.mobilityAids: ['wheelchair']` |

- A dash means that benchmark has no value. Show "No benchmark value", which is not a failure.
- **Updates.** Add a new versioned file, never edit a released one. Every value cites a clause or page. One named owner (the product owner or a partner professional) reviews each change. Reports and reviews record the dataset version they used.

### 7.3 Verdicts

Each benchmark check returns one verdict per benchmark:

```text
BenchmarkVerdict = { benchmarkId, key, outcome: 'meets' | 'does-not-meet' | 'likely-meets' | 'likely-does-not-meet'
                     | 'no-value' | 'not-evaluated', measuredMm?, valueRef }   // valueRef points at the BenchmarkValue used
```

A verdict is **definite** only if both of these hold:
- Every measurement compared directly with the benchmark is `advisor-verified` with `verificationMethod: 'on-site'`.
- The benchmark value's review status is `reviewed`.

Otherwise it is "likely".

Other inputs, such as the size of an item that blocks a route, may be verified from a photo. They don't make a verdict "likely", but they keep the existing weakest-confidence evidence label.

The check's overall `status`:
- **Primary benchmark set:** status follows that benchmark's verdict. `does-not-meet` or `likely-does-not-meet` gives `attention`; `meets` or `likely-meets` gives `clear`; `no-value` or `not-evaluated` gives `not-evaluated`.
- **No primary benchmark:**
  - `attention` if either verdict does or likely does not meet.
  - `clear` only when every benchmark that has a value meets or likely meets.
  - Otherwise `not-evaluated`.

**Value precedence for a check:**
1. The overlay's own value (custom).
2. The project target set by the advisor.
3. The benchmark value.

The source is shown as it is today (`custom-overlay`, `project-target`, or new `benchmark`).

### 7.4 Disclaimer (report, check panel footer, export dialog)

> EN: These results compare entered measurements with reference benchmarks. They are not a certification. The Ministerial Regulation applies to public buildings, not private homes. Consult a licensed architect or engineer for structural work or work that needs a permit.
>
> TH: ผลการตรวจนี้เป็นการเปรียบเทียบค่าที่บันทึกกับเกณฑ์อ้างอิงเท่านั้น ไม่ใช่การรับรอง กฎกระทรวงฯ บังคับใช้กับอาคารสาธารณะ ไม่ใช่บ้านพักอาศัยส่วนบุคคล งานโครงสร้างหรืองานที่ต้องขออนุญาตควรปรึกษาสถาปนิกหรือวิศวกรที่มีใบอนุญาต

## 8. Checks (R1)

v1 rules G01–G05 stay, and run per room against room or floor geometry. M01 stays for rugs, lighting and reach concerns. Thresholds move to D03.

| Rule | Applies to | Behaviour | Wording boundary |
|---|---|---|---|
| G04 route | Floor | As v1. Width fallback is the `route.clearWidth` benchmark after the overlay and project target. | Drawn corridor only |
| G05 turning | Floor | As v1. Turning areas whose centre is in a bathroom fall back to `bathroom.turningDiameter`. | Drawn circle only |
| D01 door width | Each door | Opening `width` against `door.clearWidth`. | Clear width as entered; frame and leaf thickness are the user's measurement responsibility |
| D02 door handle | Each door with a handle | Handle height against `door.handleHeight` and type against `door.handleType`. Without a handle record → not evaluated. | |
| D03 threshold | Each door | `abs(threshold)` against `door.threshold`. Replaces the threshold part of M01. | Level change only; edge bevel is noted, not modelled |
| H03 wheelchair fit | Each door, when the resident uses a wheelchair and its width is recorded | Physical fit: door width ≥ wheelchair width. **Not a benchmark.** Result is `attention` or `clear`, and is labelled "physical fit only, no hand clearance". | No invented margin |
| B01 bathroom door | Doors of a bathroom room | Operation against `bathroom.doorOperation`. | |
| B02 toilet | Each toilet item | Type against `toilet.type`; seat height against `toilet.seatHeight`. A squat toilet gives `does-not-meet` for type and `no-value` for seat height. | |
| B03 toilet grab bars | Each toilet item | Is there a horizontal grab bar on a wall within 500 mm of the toilet's side? (the search distance is a model parameter, not a benchmark). Check its height, its projection past the bowl front, and the diameter if recorded. No bar → `attention` with outcome "missing". | Presence and dimensions only; no strength or fixing assessment |
| B04 basin | Each basin fixture | Rim height and knee clearance depth. | |
| B05 floor | Bathroom rooms | `floor.slipResistance` against `floor.slipResistant`. `unknown` → not evaluated, with "Get this checked". | Recorded surface, not tested friction |
| B06 wet zone | Bathrooms with wet zones | Manual-review reminder when a solid item other than a shower seat or toilet sits in a wet zone. | |
| H01 reach | Switches, sockets and shelves, when a resident reach band exists | `referenceHeight` within the band. **Based on the resident, not a benchmark.** | Recorded reach only |
| H02 socket height | Sockets, when the household's mobility aids include a wheelchair | Against `socket.height`. | |

**Fall proximity.** Results whose entities lie within 1000 mm of a recorded fall point in the same room, or whose room has a fall with no point, get `nearFall: true`. They sort first and show a marker. 1000 mm is a display parameter, not a safety claim.

**Resident-need relevance.** Checks relevant to a selected need receive a text tag and sort after near-fall results but before the existing status order. Wheelchair maps to H02, H03, D01, D03, G04, G05 and B04; walker to D01, D03 and G04; cane to D03 and B05; weak grip to D02 and B03; difficulty standing up to B02 and B03; unsteady balance to B03, B05 and D03. Needs can also surface prompts for missing existing data. They do not add benchmark values, measurements, rules, or verdict changes.

`CheckResult` adds:
- `verdicts: BenchmarkVerdict[]` (empty for non-benchmark rules).
- `basis: 'benchmark' | 'resident' | 'geometry' | 'manual'`.
- `nearFall: boolean`.
- `roomId`.

Result IDs stay stable: `rule + layout + room + sorted entity IDs`.

## 9. Wall elevation view

- Uses SVG and the same millimetre model.
- Shows the selected wall of the selected room, with its openings, wall fixtures, and any furniture whose footprint is within 300 mm of the wall, drawn as front silhouettes. Furniture is read-only here.
- **Overlays:**
  - The resident's reach band, if recorded.
  - When a fixture is selected, the benchmark range for its key, shaded per benchmark with the band labelled.
  - The floor line, and a height scale in centimetres.
- **Editing fixtures:**
  - Drag horizontally (`offset`) and vertically (`referenceHeight`) with a transient preview and one commit.
  - Arrow keys move 10 mm, Shift+arrow 50 mm.
  - Numeric fields in the inspector.
  - Invalid positions (outside the wall, overlapping an opening for switches and sockets) aren't committed, and the reason is shown.
- Add a fixture from the Fixtures catalog onto the visible wall.
- The plan shows fixtures as wall-attached symbols, and 3D shows simple meshes at their heights. Neither the plan nor 3D may move fixtures; use the wall elevation to add, move or edit them.

## 10. Fix library and price list

**Fix library.** File: `lib/planner/standards/data/fixes-<version>.json`, versioned the same way as benchmarks.

```text
Fix = { id, label: {th,en}, description: {th,en}, ruleIds: RuleId[], workType, effect: FixEffect,
        priceKey: string | null, grantCategories: ('older-persons-home' | 'disability-home')[],
        needsProfessional: boolean }
FixEffect = { kind: 'move-item' }               // user picks the new position in the preview
          | { kind: 'remove-item' }
          | { kind: 'set-door-operation', operation: 'sliding' | 'hinged-out' }
          | { kind: 'set-threshold', valueMm: 0 }
          | { kind: 'set-door-width', fromBenchmark: 'door.clearWidth' }   // needsProfessional: true
          | { kind: 'set-handle', type: 'lever', fromBenchmark: 'door.handleHeight' }
          | { kind: 'add-fixture', fixtureKind, placement: 'beside-toilet' | 'selected-wall', fromBenchmark?: BenchmarkKey }
          | { kind: 'set-fixture-height', fromBenchmark?: BenchmarkKey, fromResidentReach?: boolean }
          | { kind: 'set-seat-height', fromBenchmark: 'toilet.seatHeight' }   // e.g. raised seat
          | { kind: 'set-floor-surface', slipResistance: 'slip-resistant' }
          | { kind: 'note-only' }
```

**How `fromBenchmark` resolves:**
- The primary benchmark if one is set, otherwise the stricter benchmark.
- For ranges it uses the midpoint, rounded to 10 mm.
- The preview shows the value used and where it came from.

**Seed fixes:**
- Move or remove an item (G02–G05).
- Bevel strip or remove the threshold (D03).
- Convert to a sliding door or rehang it outward (B01).
- Widen the door (D01, needs a professional).
- Lever handle (D02).
- Raised toilet seat, or replace with a seated toilet (B02).
- Install a horizontal or fold-down grab bar (B03).
- Adjust basin height (B04).
- Anti-slip treatment (B05).
- Move the fixture height into the reach band or benchmark (H01, H02).

**Applying a fix.**
- `previewFix(project, fixId, params): Result<{ project, changedIds, newResults }>` is pure.
- Applying commits `apply-fix { fixId, params }`. This single command:
  - Creates Proposed from Current if it doesn't exist yet.
  - Applies the effect to Proposed.
  - Upserts a `proposed` recommendation that is linked to the fix and rule and pre-filled with costs.

  It is one history entry. Nothing is applied without the preview and confirmation.

**Price list.** File: `lib/planner/standards/data/prices-<version>.json`.

```text
PriceEntry = { priceKey, unit: 'per-item' | 'per-door' | 'per-m2' | 'per-job', label: {th,en},
               national: CostBand | null, regions: Partial<Record<PriceRegion, CostBand>>,
               sourceNote, collectedAt, sampleSize }
CostBand   = { materials: [lowSatang, highSatang] | null, labour: [lowSatang, highSatang] | null }
PriceRegion= 'bangkok-vicinity' | 'central' | 'north' | 'northeast' | 'east' | 'west' | 'south'
```

- The province select maps to a region using `lib/planner/standards/data/provinces-th.json` (77 provinces with Thai and English names and region).
- **No invented prices.** Until real job data has been collected (R1 Task 0b), entries are `null` and the fix shows "No default price yet — enter an estimate". The recommendation cost fields stay `null`, meaning unknown, as in v1.
- Government labour rates (ว480) may be recorded as a separate `sourceNote` cross-check. They are never presented as the full price.
- Region values come first, then the national value. The `sourceNote` and `collectedAt` copied into the recommendation keep v1's estimate-provenance rules.

## 11. Cloud, roles and privacy (R3–R4 direction)

These decisions are fixed now. R3 and R4 plans will detail them.

- **Platform:** installable PWA, offline-first. Yjs CRDT documents sync through a self-hostable server; the Project schema is validated when changes merge. Main deployment: Vercel plus managed Postgres and S3-compatible storage in the **Singapore** region. Every service sits behind an interface so a deployment can run on Thai hosting or be self-hosted.
- **Sign-in:** Better Auth (open source, self-hostable). LINE Login through generic OAuth, phone one-time code through a Thai SMS gateway, and email for advisors. Families can use the app without an account; signing in uploads their local project.
- **Roles:**

  | Role | Can do |
  |---|---|
  | Family owner | Owns the project and its consent record; edits everything except verified values; shares; deletes |
  | Family member | Edits and comments; can't share or delete |
  | Village health volunteer (อสม.) | Capture only, on assigned projects; can't see costs or reviews |
  | Advisor | Verifies, sets the benchmark, approves fixes, produces outputs |
  | Supervisor | Advisor rights, plus approving other advisors' reviews and seeing the organisation's caseload |
  | Org admin | Manages members, price list and fix library; can't see projects that weren't shared with the organisation |

  A solo advisor is an organisation of one.
- **Locked verified values:** a non-advisor edit to a verified value becomes a proposed correction that an advisor accepts or rejects. Edits to anything else merge normally.
- **PDPA:**
  - A consent record per project names who consented and their relationship to the resident.
  - Sharing is controlled by the family.
  - Photos can be deleted individually; faces and documents are blurred automatically before upload.
  - Inactive projects are archived and later deleted after a defined period.
  - Vision, cognition and continence data are not collected.
- **Telemetry:** organisation projects only, recording workflow timestamps (capture started, shared, verified, report issued, grant submitted, outcome). No content and no personal data. Local family projects are never tracked.
- **Grants (R4):**
  - The "possibly eligible" indicator matches the Department of Older Persons home grant and the disability home grant (each up to 40,000 baht) using age, disability card, welfare card or self-reported low income, and residence status.
  - It shows the ceiling, where to apply, a document checklist and the date the information was last checked.
  - It records the outcome.
  - Never say "eligible".

## 12. Architecture (R1)

- Domain logic lives in `lib/planner/`; benchmark, fix, price and province data and their loaders and schemas live in `lib/planner/standards/`. UI goes in `components/planner/`.
- No new runtime dependencies are expected for R1. Zod, Three.js, Vitest and Playwright are already installed.
- Data files are JSON validated by Zod at import, and a unit test fails the build on invalid data.
- Keep the reducer, history, persistence and lazy 3D patterns from v1. Domain code never imports React, storage or Three.js.

## 13. Unverified facts (block definite verdicts or launch claims, not R1 code)

1. Benchmark values and clause numbers: checking them against the Royal Gazette PDFs and the Department of Older Persons manual is Task 0a. Until then every value is `pending`, so every verdict is "likely".
2. Whether the Department of Older Persons regulation text on dop.go.th matches the news-reported grant criteria (affects R4).
3. Whether the older-persons home grant is funded and open in fiscal year 2026, and whether the two grants can be combined (R4).
4. Whether the 2024 cabinet-approved draft disability-facilities regulation has been enacted (it could change `th-public-building` values).
5. The exemption reported by a secondary source: homes of 150 m² or less don't need an architect for layout design (affects the professional-referral wording).
6. Regional price data: none exists until real jobs are collected (Task 0b).

## 14. R1 acceptance criteria

| ID | Observable acceptance |
|---|---|
| R1-A01 | A v1 stored project and a v1 file open as v2 with identical geometry, recommendations and costs. The old review shows as outdated, and the v1 storage entry is untouched. |
| R1-A02 | A v2 project round-trips through reload and file. Schema validation rejects a second room or floor, a fixture outside its wall, and a verified measurement without a method, each with a clear message. |
| R1-A03 | Every benchmark check shows both benchmarks, with clause, value and outcome. "No benchmark value" is never shown as a failure. |
| R1-A04 | With seed data (all `pending`), no verdict is definite, even with on-site verified inputs. Once a test dataset marks a value `reviewed`, on-site verification makes it definite, and photo or unspecified verification stays "likely". |
| R1-A05 | Choosing a primary benchmark changes overall statuses as §7.3 says, increments the revision and makes the review outdated. |
| R1-A06 | A bathroom project shows the toilet, grab bars, basin, wet zone and floor checks. A squat toilet, a missing grab bar, an inward-opening door and an unknown floor are each reported with the right outcome. |
| R1-A07 | In the wall view, a grab bar can be added, moved by drag, keyboard and numeric entry, and shows its benchmark band and the resident's reach band. The plan and 3D show the same position. |
| R1-A08 | The resident profile drives H01, H02 and H03. Results near a recorded fall sort first with a marker. Fall history is left out of the report unless the user includes it. |
| R1-A09 | Each failing check offers fixes. Preview shows the changed entities and re-run checks without committing. Apply is one undoable step that creates Proposed if needed and adds a linked recommendation. A fix without price data leaves costs unknown. |
| R1-A10 | The report shows the two-benchmark table, the dataset version, the disclaimer in the active language, and before/after plans including bathroom fixtures. The export dialog warns about health data when it is present. |
| R1-A11 | Thai and English keys stay in parity. New flows pass axe scans and keyboard use at 390, 768 and 1440 px. A native speaker has reviewed the new Thai copy. |
| R1-A12 | The fictional example set includes a bathroom example labelled as fictional. No pending benchmark value or missing price is presented as a verified fact. |
