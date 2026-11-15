import { z } from 'zod'
import type { Project, Result } from './types'

const isoDate = z.string().datetime({ offset: true })
const safeInt = (min: number, max: number) => z.number().finite().safe().int().min(min).max(max)
const text = (max: number) => z.string().max(max)
const measurementShape = z.object({
  valueMm: z.number().finite().safe().int(),
  confidence: z.enum(['estimated', 'measured', 'advisor-verified']),
  verifiedBy: text(160).optional(),
  verifiedAt: isoDate.optional(),
})
const checkedMeasurement = <T extends z.ZodObject>(shape: T) => shape.superRefine((value, ctx) => {
  const measured = value as { confidence: string; verifiedBy?: string; verifiedAt?: string }
  if (measured.confidence === 'advisor-verified') {
    if (!measured.verifiedBy?.trim()) ctx.addIssue({ code: 'custom', path: ['verifiedBy'], message: 'Verifier name is required' })
    if (!measured.verifiedAt) ctx.addIssue({ code: 'custom', path: ['verifiedAt'], message: 'Verification date is required' })
  }
})
const measureInRange = (min: number, max: number) => checkedMeasurement(measurementShape.extend({ valueMm: safeInt(min, max) }))
const point = z.object({ xMm: safeInt(-15000, 30000), yMm: safeInt(-15000, 30000) })
const room = z.object({
  width: measureInRange(1500, 15000),
  depth: measureInRange(1500, 15000),
  height: measureInRange(2000, 5000),
})
const opening = z.discriminatedUnion('kind', [
  z.object({
    id: text(160).min(1), kind: z.literal('door'), wall: z.enum(['north', 'east', 'south', 'west']),
    offset: measureInRange(0, 30000), width: measureInRange(100, 15000),
    height: measureInRange(100, 5000), sill: measureInRange(0, 5000),
    threshold: measureInRange(-500, 500), operation: z.enum(['hinged-in', 'sliding']), hinge: z.enum(['start', 'end']),
  }),
  z.object({
    id: text(160).min(1), kind: z.literal('window'), wall: z.enum(['north', 'east', 'south', 'west']),
    offset: measureInRange(0, 30000), width: measureInRange(100, 15000),
    height: measureInRange(100, 5000), sill: measureInRange(0, 5000),
    threshold: measureInRange(0, 0),
  }),
])
const furniture = z.object({
  id: text(160).min(1), catalogId: text(160).min(1), label: text(160), center: point,
  width: measureInRange(100, 5000), depth: measureInRange(100, 5000),
  height: measureInRange(1, 3000), rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  finish: z.enum(['oak', 'cream', 'sage', 'charcoal']), obstruction: z.enum(['solid', 'rug']),
})
const route = z.object({ id: text(160).min(1), label: text(160), points: z.array(point).min(2).max(12), widthMm: safeInt(100, 3000).nullable() })
const turning = z.object({ id: text(160).min(1), label: text(160), center: point, diameterMm: safeInt(100, 4000).nullable() })
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
const recommendation = z.object({
  id: text(160).min(1), layoutId: z.enum(['current', 'proposed']), entityId: text(160).optional(), title: text(160),
  reason: text(4000), action: text(4000), priority: z.enum(['now', 'next', 'later']),
  workType: z.enum(['rearrange', 'purchase', 'building-work', 'site-review']), status: z.enum(['proposed', 'accepted', 'deferred', 'completed']),
  advisorNote: text(4000), materials: costRange.nullable(), labour: costRange.nullable(),
})
const layout = z.object({ room, openings: z.array(opening).max(20), items: z.array(furniture).max(100), routes: z.array(route).max(20), turningAreas: z.array(turning).max(20) })

export const projectSchema = z.object({
  schemaVersion: z.literal(1), id: text(160).min(1), title: text(120).min(1), createdAt: isoDate, updatedAt: isoDate,
  revision: safeInt(0, Number.MAX_SAFE_INTEGER),
  household: z.object({
    province: text(160), activities: z.array(text(500)).max(100), mobilityAids: z.array(text(160)).max(100),
    concerns: z.array(z.enum(['lighting', 'reach', 'rugs', 'thresholds'])).max(4), assistanceNotes: text(4000),
    residentPreferences: text(4000), budgetSatang: safeInt(0, 1_000_000_000_000).nullable(),
  }),
  current: layout, proposed: layout.nullable(),
  targets: z.object({ routeWidth: target(3000).nullable(), turningDiameter: target(4000).nullable() }),
  recommendations: z.array(recommendation).max(100),
  review: z.object({ reviewerName: text(160).min(1), reviewedAt: isoDate, projectRevision: safeInt(0, Number.MAX_SAFE_INTEGER) }).nullable(),
}).superRefine((project, ctx) => {
  for (const layoutId of ['current', 'proposed'] as const) {
    const value = project[layoutId]
    if (!value) continue
    const seen = new Set<string>()
    const register = (id: string, path: (string | number)[]) => {
      if (seen.has(id)) ctx.addIssue({ code: 'custom', path, message: 'Ids must be unique within a layout' })
      seen.add(id)
    }
    value.openings.forEach((item, i) => register(item.id, [layoutId, 'openings', i, 'id']))
    value.items.forEach((item, i) => register(item.id, [layoutId, 'items', i, 'id']))
    value.routes.forEach((item, i) => register(item.id, [layoutId, 'routes', i, 'id']))
    value.turningAreas.forEach((item, i) => register(item.id, [layoutId, 'turningAreas', i, 'id']))

    const roomWidth = value.room.width.valueMm
    const roomDepth = value.room.depth.valueMm
    const roomHeight = value.room.height.valueMm
    for (let i = 0; i < value.openings.length; i++) {
      const item = value.openings[i]
      const wallLength = item.wall === 'north' || item.wall === 'south' ? roomWidth : roomDepth
      if (item.offset.valueMm + item.width.valueMm > wallLength) ctx.addIssue({ code: 'custom', path: [layoutId, 'openings', i, 'width', 'valueMm'], message: 'Opening must fit the wall' })
      if (item.sill.valueMm + item.height.valueMm > roomHeight) ctx.addIssue({ code: 'custom', path: [layoutId, 'openings', i, 'height', 'valueMm'], message: 'Opening must fit room height' })
      if (item.kind === 'door' && item.sill.valueMm !== 0) ctx.addIssue({ code: 'custom', path: [layoutId, 'openings', i, 'sill', 'valueMm'], message: 'Door sill must be zero' })
      for (let j = 0; j < i; j++) {
        const other = value.openings[j]
        if (item.wall === other.wall && item.offset.valueMm < other.offset.valueMm + other.width.valueMm && other.offset.valueMm < item.offset.valueMm + item.width.valueMm) {
          ctx.addIssue({ code: 'custom', path: [layoutId, 'openings', i, 'offset', 'valueMm'], message: 'Openings cannot overlap on a wall' })
        }
      }
      if (item.kind === 'door' && item.threshold.valueMm > 500) ctx.addIssue({ code: 'custom', path: [layoutId, 'openings', i, 'threshold', 'valueMm'], message: 'Threshold exceeds model limit' })
    }
    for (let i = 0; i < value.routes.length; i++) {
      const pts = value.routes[i].points
      for (let j = 1; j < pts.length; j++) {
        if (pts[j].xMm === pts[j - 1].xMm && pts[j].yMm === pts[j - 1].yMm) ctx.addIssue({ code: 'custom', path: [layoutId, 'routes', i, 'points', j], message: 'Adjacent route points must differ' })
      }
    }
  }
  const currentIds = new Set([...project.current.items, ...project.current.openings, ...project.current.routes, ...project.current.turningAreas].map((item) => item.id))
  const proposedIds = new Set([...(project.proposed?.items ?? []), ...(project.proposed?.openings ?? []), ...(project.proposed?.routes ?? []), ...(project.proposed?.turningAreas ?? [])].map((item) => item.id))
  const recommendationIds = new Set<string>()
  project.recommendations.forEach((item, i) => {
    if (recommendationIds.has(item.id)) ctx.addIssue({ code: 'custom', path: ['recommendations', i, 'id'], message: 'Recommendation ids must be unique' })
    recommendationIds.add(item.id)
    if (item.layoutId === 'proposed' && !project.proposed) ctx.addIssue({ code: 'custom', path: ['recommendations', i, 'layoutId'], message: 'Proposed layout does not exist' })
    if (item.entityId && !(item.layoutId === 'current' ? currentIds : proposedIds).has(item.entityId)) ctx.addIssue({ code: 'custom', path: ['recommendations', i, 'entityId'], message: 'Recommendation entity does not exist' })
  })
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
