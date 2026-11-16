import { z } from 'zod'
import { fixtureFitsWall } from './geometry'
import type { Project, Result } from './types'

// Schema v2 (spec §6). Versioning rule: an optional field with a default does not
// bump schemaVersion, the schema fills it in. Structural changes bump the version
// and need a migration in migrate.ts.

const isoDate = z.string().datetime({ offset: true })
const safeInt = (min: number, max: number) => z.number().finite().safe().int().min(min).max(max)
const text = (max: number) => z.string().max(max)
const id = text(160).min(1)
const confidence = z.enum(['estimated', 'measured', 'advisor-verified'])
const wall = z.enum(['north', 'east', 'south', 'west'])
const measurementShape = z.object({
  valueMm: z.number().finite().safe().int(),
  confidence,
  verifiedBy: text(160).optional(),
  verifiedAt: isoDate.optional(),
  verificationMethod: z.enum(['on-site', 'photo', 'unspecified']).optional(),
  verificationNote: text(500).optional(),
})
const checkedMeasurement = <T extends z.ZodObject>(shape: T) => shape.superRefine((value, ctx) => {
  const measured = value as { confidence: string; verifiedBy?: string; verifiedAt?: string; verificationMethod?: string }
  if (measured.confidence === 'advisor-verified') {
    if (!measured.verifiedBy?.trim()) ctx.addIssue({ code: 'custom', path: ['verifiedBy'], message: 'Verifier name is required' })
    if (!measured.verifiedAt) ctx.addIssue({ code: 'custom', path: ['verifiedAt'], message: 'Verification date is required' })
    if (!measured.verificationMethod) ctx.addIssue({ code: 'custom', path: ['verificationMethod'], message: 'Verification method is required for a verified measurement' })
  }
})
const measureInRange = (min: number, max: number) => checkedMeasurement(measurementShape.extend({ valueMm: safeInt(min, max) }))
const point = z.object({ xMm: safeInt(-15000, 30000), yMm: safeInt(-15000, 30000) })
const rect = z.object({ minX: safeInt(0, 15000), minY: safeInt(0, 15000), maxX: safeInt(0, 15000), maxY: safeInt(0, 15000) })

const handle = z.object({
  type: z.enum(['lever', 'knob', 'pull', 'none', 'unknown']),
  height: measureInRange(0, 3000).nullable(),
})
const opening = z.discriminatedUnion('kind', [
  z.object({
    id, kind: z.literal('door'), wall,
    offset: measureInRange(0, 30000), width: measureInRange(100, 15000),
    height: measureInRange(100, 5000), sill: measureInRange(0, 5000),
    threshold: measureInRange(-500, 500), operation: z.enum(['hinged-in', 'hinged-out', 'sliding']), hinge: z.enum(['start', 'end']),
    handle: handle.nullable().default(null),
    connectsToRoomId: id.nullable().default(null),
  }),
  z.object({
    id, kind: z.literal('window'), wall,
    offset: measureInRange(0, 30000), width: measureInRange(100, 15000),
    height: measureInRange(100, 5000), sill: measureInRange(0, 5000),
    threshold: measureInRange(0, 0),
  }),
])
const furniture = z.object({
  id, catalogId: id, label: text(160), center: point,
  width: measureInRange(100, 5000), depth: measureInRange(100, 5000),
  height: measureInRange(1, 3000), rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  finish: z.enum(['oak', 'cream', 'sage', 'charcoal']), obstruction: z.enum(['solid', 'rug']),
  seatHeight: measureInRange(1, 1500).nullable().default(null),
})
const fixture = z.object({
  id, label: text(160), wall,
  kind: z.enum(['grab-bar-horizontal', 'grab-bar-vertical', 'grab-bar-fold-down', 'switch', 'socket', 'shelf', 'basin']),
  offset: measureInRange(0, 15000), referenceHeight: measureInRange(0, 5000),
  length: measureInRange(10, 5000), projection: measureInRange(0, 1500),
  diameter: measureInRange(5, 200).nullable(),
  kneeClearanceDepth: measureInRange(0, 1500).nullable().default(null),
})
const wetZone = z.object({ id, label: text(160), rect })
const route = z.object({ id, label: text(160), points: z.array(point).min(2).max(12), widthMm: safeInt(100, 3000).nullable() })
const turning = z.object({ id, label: text(160), center: point, diameterMm: safeInt(100, 4000).nullable() })
const roomSpace = z.object({
  id, type: z.enum(['living', 'bathroom']), label: text(160), origin: point,
  shape: z.object({ kind: z.literal('rect'), width: measureInRange(1500, 15000), depth: measureInRange(1500, 15000) }),
  height: measureInRange(2000, 5000),
  floor: z.object({
    finish: z.enum(['tile', 'wood', 'vinyl', 'concrete', 'other', 'unknown']),
    slipResistance: z.enum(['unknown', 'slip-resistant', 'not-slip-resistant']),
    confidence,
  }),
  openings: z.array(opening).max(20), items: z.array(furniture).max(100),
  fixtures: z.array(fixture).max(60), wetZones: z.array(wetZone).max(10),
})
const floor = z.object({
  id, label: text(160), level: safeInt(-5, 50),
  rooms: z.array(roomSpace).min(1), routes: z.array(route).max(20), turningAreas: z.array(turning).max(20),
})
const layout = z.object({ floors: z.array(floor).min(1) })

const target = (max: number) => z.object({
  valueMm: safeInt(100, max), rationale: text(4000).min(1), enteredBy: text(160).min(1), enteredAt: isoDate,
  sourceUrl: z.string().url().optional(), sourceClause: text(500).optional(),
})
const costRange = z.object({
  lowSatang: safeInt(0, 1_000_000_000_000), highSatang: safeInt(0, 1_000_000_000_000),
  sourceNote: text(4000).min(1), estimatedAt: isoDate,
}).superRefine((value, ctx) => {
  if (value.highSatang < value.lowSatang) ctx.addIssue({ code: 'custom', path: ['highSatang'], message: 'High estimate must not be less than low estimate' })
})
const ruleId = z.enum(['G01', 'G02', 'G03', 'G04', 'G05', 'M01', 'D01', 'D02', 'D03', 'H01', 'H02', 'H03', 'B01', 'B02', 'B03', 'B04', 'B05', 'B06'])
const benchmarkId = z.enum(['th-public-building', 'th-dop-home'])
const recommendation = z.object({
  id, layoutId: z.enum(['current', 'proposed']), entityId: text(160).optional(), title: text(160),
  reason: text(4000), action: text(4000), priority: z.enum(['now', 'next', 'later']),
  workType: z.enum(['rearrange', 'purchase', 'building-work', 'site-review']), status: z.enum(['proposed', 'accepted', 'deferred', 'completed']),
  advisorNote: text(4000), materials: costRange.nullable(), labour: costRange.nullable(),
  fixId: text(160).optional(), ruleId: ruleId.optional(),
})
const resident = z.object({
  standingHeight: measureInRange(500, 2500).nullable(),
  reach: z.object({ posture: z.enum(['standing', 'seated']), low: measureInRange(0, 2500), high: measureInRange(0, 2500) }).nullable(),
  strongerHand: z.enum(['left', 'right', 'both', 'unknown']),
  wheelchair: z.object({ width: measureInRange(300, 1500), length: measureInRange(500, 2500) }).nullable(),
  falls: z.array(z.object({
    id, when: z.enum(['within-3-months', '3-to-12-months']), roomId: id.nullable(), point: point.nullable(),
    activity: z.enum(['toileting', 'bathing', 'transferring', 'walking', 'at-night', 'other']), note: text(500),
  })).max(20),
})

type ParsedLayout = z.infer<typeof layout>
type Issue = (path: (string | number)[], message: string) => void

function checkLayout(value: ParsedLayout, layoutId: 'current' | 'proposed', issue: Issue) {
  // R1 limits. The model is ready for more; the app is not.
  if (value.floors.length !== 1) issue([layoutId, 'floors'], 'This version supports one floor. Multiple floors arrive with the whole-home release (R2).')
  const seen = new Set<string>()
  const register = (entityId: string, path: (string | number)[]) => {
    if (seen.has(entityId)) issue(path, 'Ids must be unique within a layout')
    seen.add(entityId)
  }
  value.floors.forEach((floorValue, f) => {
    const floorPath = [layoutId, 'floors', f]
    if (floorValue.level !== 0) issue([...floorPath, 'level'], 'This version supports the ground floor only. Other levels arrive with the whole-home release (R2).')
    if (floorValue.rooms.length !== 1) issue([...floorPath, 'rooms'], 'This version supports one room. Multiple rooms arrive with the whole-home release (R2).')
    floorValue.routes.forEach((item, i) => register(item.id, [...floorPath, 'routes', i, 'id']))
    floorValue.turningAreas.forEach((item, i) => register(item.id, [...floorPath, 'turningAreas', i, 'id']))
    floorValue.routes.forEach((item, i) => {
      for (let j = 1; j < item.points.length; j++) {
        if (item.points[j].xMm === item.points[j - 1].xMm && item.points[j].yMm === item.points[j - 1].yMm) issue([...floorPath, 'routes', i, 'points', j], 'Adjacent route points must differ')
      }
    })
    floorValue.rooms.forEach((room, r) => {
      const roomPath = [...floorPath, 'rooms', r]
      if (room.origin.xMm !== 0 || room.origin.yMm !== 0) issue([...roomPath, 'origin'], 'Room origin must be 0,0 until multiple rooms are supported (R2).')
      room.openings.forEach((item, i) => register(item.id, [...roomPath, 'openings', i, 'id']))
      room.items.forEach((item, i) => register(item.id, [...roomPath, 'items', i, 'id']))
      room.fixtures.forEach((item, i) => register(item.id, [...roomPath, 'fixtures', i, 'id']))
      room.wetZones.forEach((item, i) => register(item.id, [...roomPath, 'wetZones', i, 'id']))

      const roomWidth = room.shape.width.valueMm
      const roomDepth = room.shape.depth.valueMm
      const roomHeight = room.height.valueMm
      room.openings.forEach((item, i) => {
        const wallLength = item.wall === 'north' || item.wall === 'south' ? roomWidth : roomDepth
        if (item.offset.valueMm + item.width.valueMm > wallLength) issue([...roomPath, 'openings', i, 'width', 'valueMm'], 'Opening must fit the wall')
        if (item.sill.valueMm + item.height.valueMm > roomHeight) issue([...roomPath, 'openings', i, 'height', 'valueMm'], 'Opening must fit room height')
        if (item.kind === 'door' && item.sill.valueMm !== 0) issue([...roomPath, 'openings', i, 'sill', 'valueMm'], 'Door sill must be zero')
        if (item.kind === 'door' && item.connectsToRoomId !== null) issue([...roomPath, 'openings', i, 'connectsToRoomId'], 'Doors cannot connect rooms until multiple rooms are supported (R2).')
        for (let j = 0; j < i; j++) {
          const other = room.openings[j]
          if (item.wall === other.wall && item.offset.valueMm < other.offset.valueMm + other.width.valueMm && other.offset.valueMm < item.offset.valueMm + item.width.valueMm) {
            issue([...roomPath, 'openings', i, 'offset', 'valueMm'], 'Openings cannot overlap on a wall')
          }
        }
      })
      room.fixtures.forEach((item, i) => {
        if (!fixtureFitsWall(item, room)) issue([...roomPath, 'fixtures', i, 'offset', 'valueMm'], 'Fixture must fit its wall and the room height')
        if (item.diameter !== null && !item.kind.startsWith('grab-bar')) issue([...roomPath, 'fixtures', i, 'diameter'], 'Only grab bars have a diameter')
      })
      room.wetZones.forEach((item, i) => {
        if (item.rect.minX >= item.rect.maxX || item.rect.minY >= item.rect.maxY || item.rect.maxX > roomWidth || item.rect.maxY > roomDepth) issue([...roomPath, 'wetZones', i, 'rect'], 'Wet zone must be a rectangle inside the room')
        if (room.type !== 'bathroom') issue([...roomPath, 'wetZones', i], 'Only bathrooms have wet zones')
      })
    })
  })
}

function entityIds(value: ParsedLayout | null): Set<string> {
  const ids = new Set<string>()
  for (const floorValue of value?.floors ?? []) {
    for (const item of [...floorValue.routes, ...floorValue.turningAreas]) ids.add(item.id)
    for (const room of floorValue.rooms) for (const item of [...room.openings, ...room.items, ...room.fixtures, ...room.wetZones]) ids.add(item.id)
  }
  return ids
}

export const projectSchema = z.object({
  schemaVersion: z.literal(2), id, title: text(120).min(1), createdAt: isoDate, updatedAt: isoDate,
  revision: safeInt(0, Number.MAX_SAFE_INTEGER),
  household: z.object({
    province: text(160), provinceCode: text(16).nullable().default(null),
    activities: z.array(text(500)).max(100), mobilityAids: z.array(text(160)).max(100),
    concerns: z.array(z.enum(['lighting', 'reach', 'rugs', 'thresholds'])).max(4), assistanceNotes: text(4000),
    residentPreferences: text(4000), budgetSatang: safeInt(0, 1_000_000_000_000).nullable(),
  }),
  resident,
  current: layout, proposed: layout.nullable(),
  benchmarkPolicy: z.object({ primary: benchmarkId, chosenBy: text(160).min(1), chosenAt: isoDate }).nullable(),
  targets: z.object({ routeWidth: target(3000).nullable(), turningDiameter: target(4000).nullable() }),
  recommendations: z.array(recommendation).max(100),
  review: z.object({
    reviewerName: text(160).min(1), reviewedAt: isoDate, projectRevision: safeInt(0, Number.MAX_SAFE_INTEGER),
    benchmarkDatasetVersion: text(40).min(1),
  }).nullable(),
  report: z.object({ includeFallHistory: z.boolean() }).default({ includeFallHistory: false }),
}).superRefine((project, ctx) => {
  const issue: Issue = (path, message) => ctx.addIssue({ code: 'custom', path, message })
  checkLayout(project.current, 'current', issue)
  if (project.proposed) checkLayout(project.proposed, 'proposed', issue)

  const currentIds = entityIds(project.current)
  const proposedIds = entityIds(project.proposed)
  const recommendationIds = new Set<string>()
  project.recommendations.forEach((item, i) => {
    if (recommendationIds.has(item.id)) issue(['recommendations', i, 'id'], 'Recommendation ids must be unique')
    recommendationIds.add(item.id)
    if (item.layoutId === 'proposed' && !project.proposed) issue(['recommendations', i, 'layoutId'], 'Proposed layout does not exist')
    if (item.entityId && !(item.layoutId === 'current' ? currentIds : proposedIds).has(item.entityId)) issue(['recommendations', i, 'entityId'], 'Recommendation entity does not exist')
  })

  // Falls are recorded against the CURRENT layout.
  const currentRooms = new Map(project.current.floors.flatMap((floorValue) => floorValue.rooms).map((room) => [room.id, room]))
  const fallIds = new Set<string>()
  project.resident.falls.forEach((fall, i) => {
    if (fallIds.has(fall.id)) issue(['resident', 'falls', i, 'id'], 'Fall ids must be unique')
    fallIds.add(fall.id)
    if (fall.roomId !== null && !currentRooms.has(fall.roomId)) issue(['resident', 'falls', i, 'roomId'], 'Fall refers to a room that is not in the current layout')
    if (fall.point !== null && fall.roomId === null) issue(['resident', 'falls', i, 'point'], 'A fall location needs a room')
  })
  if (project.resident.reach && project.resident.reach.low.valueMm > project.resident.reach.high.valueMm) issue(['resident', 'reach', 'high', 'valueMm'], 'Reach band upper limit must not be below its lower limit')
})

export function validateProject(input: unknown): Result<Project> {
  const parsed = projectSchema.safeParse(input)
  if (parsed.success) return { ok: true, value: parsed.data }
  return {
    ok: false,
    error: {
      code: 'invalid-project',
      messageKey: 'validation.invalidProject',
      paths: parsed.error.issues.map((issue) => issue.path.map(String).join('.')),
    },
  }
}
