import {
  capsuleIntersectsRect,
  circleIntersectsRect,
  getDoorSector,
  getFootprint,
  isWithinRoom,
  rectanglesOverlap,
  sectorIntersectsRect,
} from './geometry'
import type { CheckResult, Confidence, Layout, LayoutId, Measurement, Project, RectMm } from './types'

const confidenceOrder: Record<Confidence, number> = { estimated: 0, measured: 1, 'advisor-verified': 2 }

function weakestConfidence(values: Confidence[]): Confidence {
  return values.reduce((weakest, value) => confidenceOrder[value] < confidenceOrder[weakest] ? value : weakest, 'advisor-verified')
}

function measurementConfidence(...measurements: (Measurement | undefined)[]): Confidence {
  return weakestConfidence(measurements.filter((value): value is Measurement => !!value).map((value) => value.confidence))
}

function result(ruleId: CheckResult['ruleId'], layoutId: LayoutId, entityIds: string[], status: CheckResult['status'], messageKey: string, confidence: Confidence, origin: CheckResult['evidence']['origin'], limitationKey: string, extra: Pick<CheckResult, 'measuredMm' | 'targetMm'> = {}): CheckResult {
  const sorted = [...new Set(entityIds)].sort()
  return {
    id: `${ruleId}:${layoutId}:${sorted.length ? sorted.join('|') : 'summary'}`,
    ruleId, layoutId, entityIds: sorted, status, messageKey,
    evidence: { confidence, origin, limitationKey },
    ...extra,
  }
}

function solidItems(layout: Layout) {
  return layout.items.filter((item) => item.obstruction === 'solid')
}

function routeLeavesRoom(points: Layout['routes'][number]['points'], radius: number, width: number, depth: number) {
  return points.some((point) => point.xMm - radius < -0.001 || point.yMm - radius < -0.001
    || point.xMm + radius > width + 0.001 || point.yMm + radius > depth + 0.001)
}

function routeIntersects(route: Layout['routes'][number], rect: RectMm, radius: number) {
  for (let i = 0; i < route.points.length - 1; i++) {
    if (capsuleIntersectsRect(route.points[i], route.points[i + 1], radius, rect)) return true
  }
  return false
}

function evaluateBounds(layout: Layout, layoutId: LayoutId): CheckResult[] {
  const outside = layout.items.filter((item) => !isWithinRoom(getFootprint(item), layout.room)).map((item) => item.id)
  if (outside.length) return outside.map((id) => {
    const item = layout.items.find((candidate) => candidate.id === id)!
    return result('G01', layoutId, [id], 'attention', 'checks.boundsAttention', measurementConfidence(layout.room.width, layout.room.depth, item.width, item.depth), 'geometry', 'checks.boundsLimit')
  })
  if (!layout.items.length) return [result('G01', layoutId, [], 'not-evaluated', 'checks.boundsNoItems', 'estimated', 'geometry', 'checks.boundsLimit')]
  return [result('G01', layoutId, layout.items.map((item) => item.id), 'clear', 'checks.boundsClear', measurementConfidence(layout.room.width, layout.room.depth, ...layout.items.flatMap((item) => [item.width, item.depth])), 'geometry', 'checks.boundsLimit')]
}

function evaluateCollisions(layout: Layout, layoutId: LayoutId): CheckResult[] {
  const items = solidItems(layout)
  const collisions: CheckResult[] = []
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const left = items[i], right = items[j]
    if (!rectanglesOverlap(getFootprint(left), getFootprint(right))) continue
    collisions.push(result('G02', layoutId, [left.id, right.id], 'attention', 'checks.collisionAttention', measurementConfidence(left.width, left.depth, right.width, right.depth), 'geometry', 'checks.collisionLimit'))
  }
  if (collisions.length) return collisions
  if (items.length < 2) return [result('G02', layoutId, items.map((item) => item.id), 'not-evaluated', 'checks.collisionNeedTwoItems', 'estimated', 'geometry', 'checks.collisionLimit')]
  return [result('G02', layoutId, items.map((item) => item.id), 'clear', 'checks.collisionClear', measurementConfidence(...items.flatMap((item) => [item.width, item.depth])), 'geometry', 'checks.collisionLimit')]
}

function evaluateDoorSwings(layout: Layout, layoutId: LayoutId): CheckResult[] {
  const hinged = layout.openings.filter((opening) => getDoorSector(opening, layout.room))
  const sliding = layout.openings.filter((opening) => opening.kind === 'door' && opening.operation === 'sliding')
  const items = solidItems(layout)
  const output: CheckResult[] = []
  if (!hinged.length) {
    output.push(result('G03', layoutId, sliding.map((opening) => opening.id), 'not-evaluated', sliding.length ? 'checks.slidingNoSwing' : 'checks.noHingedDoors', 'estimated', 'geometry', 'checks.doorLimit'))
  } else {
    for (const opening of hinged) {
      const sector = getDoorSector(opening, layout.room)!
      const obstructing = items.filter((item) => sectorIntersectsRect(sector, getFootprint(item)))
      const confidence = measurementConfidence(layout.room.width, layout.room.depth, opening.width, ...obstructing.flatMap((item) => [item.width, item.depth]))
      output.push(result('G03', layoutId, [opening.id, ...obstructing.map((item) => item.id)], obstructing.length ? 'attention' : 'clear', obstructing.length ? 'checks.doorAttention' : 'checks.doorClear', confidence, 'geometry', 'checks.doorLimit'))
    }
    for (const opening of sliding) output.push(result('G03', layoutId, [opening.id], 'not-evaluated', 'checks.slidingNoSwing', 'estimated', 'geometry', 'checks.doorLimit'))
  }
  return output
}

function evaluateRoutes(project: Project, layout: Layout, layoutId: LayoutId): CheckResult[] {
  if (!layout.routes.length) return [result('G04', layoutId, [], 'not-evaluated', 'checks.routesMissing', measurementConfidence(layout.room.width, layout.room.depth), 'geometry', 'checks.routeLimit')]
  return layout.routes.map((route) => {
    const target = project.targets.routeWidth
    const width = route.widthMm ?? target?.valueMm ?? null
    const origin = route.widthMm !== null ? 'custom-overlay' : target ? 'project-target' : 'custom-overlay'
    if (width === null) return result('G04', layoutId, [route.id], 'not-evaluated', 'checks.routeWidthMissing', measurementConfidence(layout.room.width, layout.room.depth), origin, 'checks.routeLimit')
    const radius = width / 2
    const blockers = solidItems(layout).filter((item) => routeIntersects(route, getFootprint(item), radius))
    const outOfRoom = routeLeavesRoom(route.points, radius, layout.room.width.valueMm, layout.room.depth.valueMm)
    const ids = [route.id, ...blockers.map((item) => item.id)]
    const confidence = measurementConfidence(layout.room.width, layout.room.depth, ...blockers.flatMap((item) => [item.width, item.depth]))
    return result('G04', layoutId, ids, blockers.length || outOfRoom ? 'attention' : 'clear', outOfRoom ? 'checks.routeOutside' : blockers.length ? 'checks.routeAttention' : 'checks.routeClear', confidence, origin, 'checks.routeLimit', {
      measuredMm: width,
      ...(route.widthMm === null && target ? { targetMm: target.valueMm } : {}),
    })
  })
}

function circleLeavesRoom(center: { xMm: number; yMm: number }, radius: number, width: number, depth: number) {
  return center.xMm - radius < -0.001 || center.yMm - radius < -0.001
    || center.xMm + radius > width + 0.001 || center.yMm + radius > depth + 0.001
}

function evaluateTurning(project: Project, layout: Layout, layoutId: LayoutId): CheckResult[] {
  if (!layout.turningAreas.length) return [result('G05', layoutId, [], 'not-evaluated', 'checks.turningMissing', measurementConfidence(layout.room.width, layout.room.depth), 'geometry', 'checks.turningLimit')]
  return layout.turningAreas.map((area) => {
    const target = project.targets.turningDiameter
    const diameter = area.diameterMm ?? target?.valueMm ?? null
    const origin = area.diameterMm !== null ? 'custom-overlay' : target ? 'project-target' : 'custom-overlay'
    if (diameter === null) return result('G05', layoutId, [area.id], 'not-evaluated', 'checks.turningDiameterMissing', measurementConfidence(layout.room.width, layout.room.depth), origin, 'checks.turningLimit')
    const radius = diameter / 2
    const blockers = solidItems(layout).filter((item) => circleIntersectsRect(area.center, radius, getFootprint(item)))
    const outside = circleLeavesRoom(area.center, radius, layout.room.width.valueMm, layout.room.depth.valueMm)
    const ids = [area.id, ...blockers.map((item) => item.id)]
    const confidence = measurementConfidence(layout.room.width, layout.room.depth, ...blockers.flatMap((item) => [item.width, item.depth]))
    return result('G05', layoutId, ids, blockers.length || outside ? 'attention' : 'clear', outside ? 'checks.turningOutside' : blockers.length ? 'checks.turningAttention' : 'checks.turningClear', confidence, origin, 'checks.turningLimit', {
      measuredMm: diameter,
      ...(area.diameterMm === null && target ? { targetMm: target.valueMm } : {}),
    })
  })
}

function evaluateManual(project: Project, layout: Layout, layoutId: LayoutId): CheckResult[] {
  const rugs = layout.items.filter((item) => item.obstruction === 'rug')
  const thresholds = layout.openings.filter((opening) => opening.threshold.valueMm !== 0)
  const concerns = project.household.concerns.filter((concern) => concern === 'lighting' || concern === 'reach')
  const ids = [...rugs.map((item) => item.id), ...thresholds.map((opening) => opening.id)]
  if (!ids.length && !concerns.length) return []
  const thresholdConfidence = thresholds.map((opening) => opening.threshold.confidence)
  const confidence = weakestConfidence([...thresholdConfidence, ...((concerns.length || rugs.length) ? ['estimated' as const] : [])])
  return [result('M01', layoutId, ids, 'attention', 'checks.manualAttention', confidence, 'manual', 'checks.manualLimit')]
}

export function evaluateLayout(project: Project, layoutId: LayoutId): CheckResult[] {
  const layout = layoutId === 'current' ? project.current : project.proposed
  if (!layout) return []
  return [
    ...evaluateBounds(layout, layoutId),
    ...evaluateCollisions(layout, layoutId),
    ...evaluateDoorSwings(layout, layoutId),
    ...evaluateRoutes(project, layout, layoutId),
    ...evaluateTurning(project, layout, layoutId),
    ...evaluateManual(project, layout, layoutId),
  ]
}
