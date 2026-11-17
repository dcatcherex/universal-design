import type { BenchmarkKey } from './standards/benchmark-keys'

export type Locale = 'th' | 'en'
export type LayoutId = 'current' | 'proposed'
export type Confidence = 'estimated' | 'measured' | 'advisor-verified'
export type VerificationMethod = 'on-site' | 'photo' | 'unspecified'
export type Measurement = {
  valueMm: number
  confidence: Confidence
  verifiedBy?: string
  verifiedAt?: string
  /** Required when confidence is advisor-verified. */
  verificationMethod?: VerificationMethod
  verificationNote?: string
}
export type PointMm = { xMm: number; yMm: number }
export type RectMm = { minX: number; minY: number; maxX: number; maxY: number }
export type Wall = 'north' | 'east' | 'south' | 'west'

export type DoorHandle = { type: 'lever' | 'knob' | 'pull' | 'none' | 'unknown'; height: Measurement | null }
export type Opening = {
  id: string
  kind: 'door' | 'window'
  wall: Wall
  offset: Measurement
  width: Measurement
  height: Measurement
  sill: Measurement
  threshold: Measurement
  operation?: 'hinged-in' | 'hinged-out' | 'sliding'
  hinge?: 'start' | 'end'
  /** Doors only. null means "not recorded". */
  handle?: DoorHandle | null
  /** Always null in R1; R2 connects rooms through openings. */
  connectsToRoomId?: string | null
}
export type FurnitureItem = {
  id: string
  catalogId: string
  label: string
  center: PointMm
  width: Measurement
  depth: Measurement
  height: Measurement
  rotationDeg: 0 | 90 | 180 | 270
  finish: 'oak' | 'cream' | 'sage' | 'charcoal'
  obstruction: 'solid' | 'rug'
  /** Toilets, shower seats and seating. */
  seatHeight?: Measurement | null
}
export type FixtureKind = 'grab-bar-horizontal' | 'grab-bar-vertical' | 'grab-bar-fold-down' | 'switch' | 'socket' | 'shelf' | 'basin'
export type WallFixture = {
  id: string
  kind: FixtureKind
  label: string
  wall: Wall
  /** Along the wall to the fixture's centre, same direction convention as openings. */
  offset: Measurement
  /**
   * Meaning depends on kind. Horizontal and fold-down grab bars: centreline.
   * Vertical grab bar: bottom end. Switch and socket: centre. Shelf: top surface. Basin: rim.
   */
  referenceHeight: Measurement
  /** Along the wall. For a vertical grab bar this is its vertical extent. */
  length: Measurement
  /** How far it sticks out from the wall. */
  projection: Measurement
  /** Grab bars only. */
  diameter: Measurement | null
  /** Basins only. */
  kneeClearanceDepth?: Measurement | null
}
export type RouteOverlay = { id: string; label: string; points: PointMm[]; widthMm: number | null }
export type TurningOverlay = { id: string; label: string; center: PointMm; diameterMm: number | null }

export type RoomType = 'living' | 'bathroom'
export type RoomShape = { kind: 'rect'; width: Measurement; depth: Measurement }
export type FloorSurface = {
  finish: 'tile' | 'wood' | 'vinyl' | 'concrete' | 'other' | 'unknown'
  slipResistance: 'unknown' | 'slip-resistant' | 'not-slip-resistant'
  confidence: Confidence
}
/** Room coordinates. Bathrooms only. */
export type WetZone = { id: string; label: string; rect: RectMm }
export type RoomSpace = {
  id: string
  type: RoomType
  label: string
  /** Position of the room's north-west inner corner on its floor. {0,0} in R1. */
  origin: PointMm
  shape: RoomShape
  height: Measurement
  floor: FloorSurface
  /** Openings, items, fixtures and wet zones use room coordinates. */
  openings: Opening[]
  items: FurnitureItem[]
  fixtures: WallFixture[]
  wetZones: WetZone[]
}
export type Floor = {
  id: string
  label: string
  level: number
  rooms: RoomSpace[]
  /** Routes and turning areas use floor coordinates: room.origin + room point. */
  routes: RouteOverlay[]
  turningAreas: TurningOverlay[]
}
/** R1 allows exactly one floor with one room. Use the helpers in layout-access.ts instead of indexing. */
export type Layout = { floors: Floor[] }

export type ProjectTarget = {
  valueMm: number
  rationale: string
  enteredBy: string
  enteredAt: string
  sourceUrl?: string
  sourceClause?: string
}
export type HouseholdBrief = {
  /** Free text, kept for v1 values that match no province. */
  province: string
  provinceCode: string | null
  activities: string[]
  mobilityAids: string[]
  concerns: ('lighting' | 'reach' | 'rugs' | 'thresholds')[]
  assistanceNotes: string
  residentPreferences: string
  budgetSatang: number | null
}
export type FallRecord = {
  id: string
  when: 'within-3-months' | '3-to-12-months'
  roomId: string | null
  /** Room coordinates in the CURRENT layout. */
  point: PointMm | null
  activity: 'toileting' | 'bathing' | 'transferring' | 'walking' | 'at-night' | 'other'
  note: string
}
/** Health information: stays on this device in R1 and is left out of reports unless the user includes it. */
export type ResidentProfile = {
  standingHeight: Measurement | null
  /** Comfortable band, floor to hand. */
  reach: { posture: 'standing' | 'seated'; low: Measurement; high: Measurement } | null
  strongerHand: 'left' | 'right' | 'both' | 'unknown'
  wheelchair: { width: Measurement; length: Measurement } | null
  falls: FallRecord[]
  needs?: ResidentNeed[]
}
export type ResidentNeed = 'cane' | 'walker' | 'wheelchair' | 'weak-grip' | 'difficulty-standing-up' | 'unsteady-balance'
export type CostRange = { lowSatang: number; highSatang: number; sourceNote: string; estimatedAt: string }

export type RuleId =
  | 'G01' | 'G02' | 'G03' | 'G04' | 'G05' | 'M01'
  | 'D01' | 'D02' | 'D03'
  | 'H01' | 'H02' | 'H03'
  | 'B01' | 'B02' | 'B03' | 'B04' | 'B05' | 'B06'
export type BenchmarkId = 'th-public-building' | 'th-dop-home'

export type Recommendation = {
  id: string
  layoutId: LayoutId
  entityId?: string
  title: string
  reason: string
  action: string
  priority: 'now' | 'next' | 'later'
  workType: 'rearrange' | 'purchase' | 'building-work' | 'site-review'
  status: 'proposed' | 'accepted' | 'deferred' | 'completed'
  advisorNote: string
  materials: CostRange | null
  labour: CostRange | null
  /** Set when the recommendation was created by applying a fix from the library. */
  fixId?: string
  ruleId?: RuleId
  /** Links a recommendation drafted from a walk-through finding. */
  findingQuestionId?: string
}
export type ReviewReceipt = {
  reviewerName: string
  reviewedAt: string
  projectRevision: number
  /** 'none' for reviews migrated from v1, which covered checks without benchmarks. */
  benchmarkDatasetVersion: string
}

export type VerdictOutcome = 'meets' | 'does-not-meet' | 'likely-meets' | 'likely-does-not-meet' | 'no-value' | 'not-evaluated'
export type BenchmarkVerdict = {
  benchmarkId: BenchmarkId
  key: BenchmarkKey
  outcome: VerdictOutcome
  measuredMm?: number
  /** For allowed-value comparisons such as door operation. */
  measuredValue?: string
  /** True when the benchmark value used is still pending review. */
  pendingReview: boolean
}
export type CheckResult = {
  id: string
  ruleId: RuleId
  layoutId: LayoutId
  roomId: string
  entityIds: string[]
  status: 'attention' | 'clear' | 'not-evaluated'
  messageKey: string
  measuredMm?: number
  targetMm?: number
  /** One per benchmark for benchmark rules; empty otherwise. */
  verdicts: BenchmarkVerdict[]
  basis: 'benchmark' | 'resident' | 'geometry' | 'manual'
  /** Within the display distance of a recorded fall, or in a room with an unlocated fall. */
  nearFall: boolean
  /** Needs that make this check more relevant; this never changes the check itself. */
  relevantNeeds?: ResidentNeed[]
  evidence: {
    confidence: Confidence
    origin: 'geometry' | 'project-target' | 'custom-overlay' | 'manual' | 'benchmark' | 'resident'
    limitationKey: string
  }
}
export type Project = {
  schemaVersion: 2
  id: string
  title: string
  createdAt: string
  updatedAt: string
  revision: number
  household: HouseholdBrief
  resident: ResidentProfile
  current: Layout
  proposed: Layout | null
  /** The benchmark that drives each check's overall status. null = not chosen. */
  benchmarkPolicy: { primary: BenchmarkId; chosenBy: string; chosenAt: string } | null
  targets: { routeWidth: ProjectTarget | null; turningDiameter: ProjectTarget | null }
  recommendations: Recommendation[]
  review: ReviewReceipt | null
  report: { includeFallHistory: boolean }
  checklist?: ChecklistAnswer[]
}
export type ChecklistAnswer = {
  questionId: string
  answer: 'yes' | 'no' | 'unsure' | 'not-applicable'
  note: string
  answeredAt: string
}
export type ChecklistFinding = {
  questionId: string
  kind: 'hazard' | 'get-checked'
  note: string
}
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; messageKey: string; paths: string[] } }
