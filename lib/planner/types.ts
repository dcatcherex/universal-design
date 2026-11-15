export type Locale = 'th' | 'en'
export type LayoutId = 'current' | 'proposed'
export type Confidence = 'estimated' | 'measured' | 'advisor-verified'
export type Measurement = {
  valueMm: number
  confidence: Confidence
  verifiedBy?: string
  verifiedAt?: string
}
export type PointMm = { xMm: number; yMm: number }
export type RectMm = { minX: number; minY: number; maxX: number; maxY: number }
export type Room = { width: Measurement; depth: Measurement; height: Measurement }
export type Opening = {
  id: string
  kind: 'door' | 'window'
  wall: 'north' | 'east' | 'south' | 'west'
  offset: Measurement
  width: Measurement
  height: Measurement
  sill: Measurement
  threshold: Measurement
  operation?: 'hinged-in' | 'sliding'
  hinge?: 'start' | 'end'
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
}
export type RouteOverlay = { id: string; label: string; points: PointMm[]; widthMm: number | null }
export type TurningOverlay = { id: string; label: string; center: PointMm; diameterMm: number | null }
export type Layout = { room: Room; openings: Opening[]; items: FurnitureItem[]; routes: RouteOverlay[]; turningAreas: TurningOverlay[] }
export type ProjectTarget = {
  valueMm: number
  rationale: string
  enteredBy: string
  enteredAt: string
  sourceUrl?: string
  sourceClause?: string
}
export type HouseholdBrief = {
  province: string
  activities: string[]
  mobilityAids: string[]
  concerns: ('lighting' | 'reach' | 'rugs' | 'thresholds')[]
  assistanceNotes: string
  residentPreferences: string
  budgetSatang: number | null
}
export type CostRange = { lowSatang: number; highSatang: number; sourceNote: string; estimatedAt: string }
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
}
export type ReviewReceipt = { reviewerName: string; reviewedAt: string; projectRevision: number }
export type CheckResult = {
  id: string
  ruleId: 'G01' | 'G02' | 'G03' | 'G04' | 'G05' | 'M01'
  layoutId: LayoutId
  entityIds: string[]
  status: 'attention' | 'clear' | 'not-evaluated'
  messageKey: string
  measuredMm?: number
  targetMm?: number
  evidence: {
    confidence: Confidence
    origin: 'geometry' | 'project-target' | 'custom-overlay' | 'manual'
    limitationKey: string
  }
}
export type Project = {
  schemaVersion: 1
  id: string
  title: string
  createdAt: string
  updatedAt: string
  revision: number
  household: HouseholdBrief
  current: Layout
  proposed: Layout | null
  targets: { routeWidth: ProjectTarget | null; turningDiameter: ProjectTarget | null }
  recommendations: Recommendation[]
  review: ReviewReceipt | null
}
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; messageKey: string; paths: string[] } }
