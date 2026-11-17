import { isToilet } from './catalog'
import {
  capsuleIntersectsRect,
  circleIntersectsRect,
  getDoorSector,
  getFixtureSpan,
  getFootprint,
  isWithinRoom,
  rectanglesOverlap,
  sectorIntersectsRect,
} from './geometry'
import { getPrimaryRoom, toRoomPoint, withPrimaryRoom } from './layout-access'
import { getRelevantNeedsForRule, getResidentNeeds } from './resident-needs'
import { BENCHMARKS, hasValue, getBenchmarkValues, strictestValue, type BenchmarkContext, type BenchmarkDataset, type BenchmarkKey } from './standards/benchmarks'
import { evaluateVerdict, isOnSiteVerified, needsProfessionalCheck, statusFromVerdicts, type Measured } from './standards/verdicts'
import type {
  BenchmarkId, BenchmarkVerdict, CheckResult, Confidence, Floor, FurnitureItem, LayoutId, Measurement, Opening, PointMm, Project,
  RectMm, RoomSpace, RouteOverlay, RuleId, WallFixture,
} from './types'

/** How far from a toilet's side a wall may be and still count as "beside" it. A model parameter, not a benchmark. */
export const GRAB_BAR_SEARCH_MM = 500
/** Results this close to a recorded fall are listed first. A display parameter, not a safety claim. */
export const NEAR_FALL_MM = 1000

const confidenceOrder: Record<Confidence, number> = { estimated: 0, measured: 1, 'advisor-verified': 2 }

function weakestConfidence(values: Confidence[]): Confidence {
  return values.reduce((weakest, value) => confidenceOrder[value] < confidenceOrder[weakest] ? value : weakest, 'advisor-verified')
}

function measurementConfidence(...measurements: (Measurement | null | undefined)[]): Confidence {
  return weakestConfidence(measurements.filter((value): value is Measurement => !!value).map((value) => value.confidence))
}

/**
 * A value worked out from several measurements (e.g. how far a bar reaches past a toilet).
 * It can only support a definite verdict when every input was verified on site.
 */
function derived(valueMm: number, ...sources: Measurement[]): Measurement {
  if (sources.length > 0 && sources.every(isOnSiteVerified)) return { valueMm, confidence: 'advisor-verified', verificationMethod: 'on-site' }
  return { valueMm, confidence: measurementConfidence(...sources) === 'advisor-verified' ? 'measured' : measurementConfidence(...sources) }
}

type Scope = {
  project: Project
  layoutId: LayoutId
  floor: Floor
  room: RoomSpace
  context: BenchmarkContext
  primary: BenchmarkId | null
  dataset: BenchmarkDataset
}
type Extra = Partial<Pick<CheckResult, 'measuredMm' | 'targetMm' | 'verdicts' | 'basis'>>

function result(scope: Scope, ruleId: RuleId, entityIds: string[], status: CheckResult['status'], messageKey: string, confidence: Confidence, origin: CheckResult['evidence']['origin'], limitationKey: string, extra: Extra = {}): CheckResult {
  const sorted = [...new Set(entityIds)].sort()
  const basis = extra.basis ?? (origin === 'benchmark' ? 'benchmark' : origin === 'resident' ? 'resident' : origin === 'manual' ? 'manual' : 'geometry')
  return {
    // Stable identity: rule + layout + room + sorted entity IDs.
    id: `${ruleId}:${scope.layoutId}:${scope.room.id}:${sorted.length ? sorted.join('|') : 'summary'}`,
    ruleId, layoutId: scope.layoutId, roomId: scope.room.id, entityIds: sorted, status, messageKey,
    verdicts: [], nearFall: false,
    evidence: { confidence, origin, limitationKey },
    ...extra,
    basis,
  }
}

type Messages = { attention: string; clear: string; notEvaluated: string }

/** A check made of one or more benchmark comparisons. Its status follows the verdicts and the project's primary benchmark. */
function benchmarkResult(scope: Scope, ruleId: RuleId, entityIds: string[], parts: { key: BenchmarkKey; measured: Measured }[], messages: Messages, limitationKey: string, confidence: Confidence, extra: Extra = {}): CheckResult {
  const verdicts = parts.flatMap((part) => evaluateVerdict({ key: part.key, measured: part.measured, context: scope.context, primary: scope.primary, dataset: scope.dataset }).verdicts)
  const status = statusFromVerdicts(verdicts, scope.primary)
  const messageKey = status === 'attention' ? messages.attention : status === 'clear' ? messages.clear : messages.notEvaluated
  return result(scope, ruleId, entityIds, status, messageKey, confidence, 'benchmark', limitationKey, { ...extra, verdicts })
}

function solidItems(room: RoomSpace) {
  return room.items.filter((item) => item.obstruction === 'solid')
}

function routeIntersects(points: PointMm[], rect: RectMm, radius: number) {
  for (let i = 0; i < points.length - 1; i++) {
    if (capsuleIntersectsRect(points[i], points[i + 1], radius, rect)) return true
  }
  return false
}

function pointsLeaveRoom(points: PointMm[], radius: number, room: RoomSpace) {
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  return points.some((point) => point.xMm - radius < -0.001 || point.yMm - radius < -0.001
    || point.xMm + radius > width + 0.001 || point.yMm + radius > depth + 0.001)
}

function evaluateBounds(scope: Scope): CheckResult[] {
  const { room } = scope
  const size = [room.shape.width, room.shape.depth]
  const outside = room.items.filter((item) => !isWithinRoom(getFootprint(item), room))
  if (outside.length) return outside.map((item) => result(scope, 'G01', [item.id], 'attention', 'checks.boundsAttention', measurementConfidence(...size, item.width, item.depth), 'geometry', 'checks.boundsLimit'))
  if (!room.items.length) return [result(scope, 'G01', [], 'not-evaluated', 'checks.boundsNoItems', 'estimated', 'geometry', 'checks.boundsLimit')]
  return [result(scope, 'G01', room.items.map((item) => item.id), 'clear', 'checks.boundsClear', measurementConfidence(...size, ...room.items.flatMap((item) => [item.width, item.depth])), 'geometry', 'checks.boundsLimit')]
}

function evaluateCollisions(scope: Scope): CheckResult[] {
  const items = solidItems(scope.room)
  const collisions: CheckResult[] = []
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const left = items[i], right = items[j]
    if (!rectanglesOverlap(getFootprint(left), getFootprint(right))) continue
    collisions.push(result(scope, 'G02', [left.id, right.id], 'attention', 'checks.collisionAttention', measurementConfidence(left.width, left.depth, right.width, right.depth), 'geometry', 'checks.collisionLimit'))
  }
  if (collisions.length) return collisions
  if (items.length < 2) return [result(scope, 'G02', items.map((item) => item.id), 'not-evaluated', 'checks.collisionNeedTwoItems', 'estimated', 'geometry', 'checks.collisionLimit')]
  return [result(scope, 'G02', items.map((item) => item.id), 'clear', 'checks.collisionClear', measurementConfidence(...items.flatMap((item) => [item.width, item.depth])), 'geometry', 'checks.collisionLimit')]
}

function evaluateDoorSwings(scope: Scope): CheckResult[] {
  const { room } = scope
  const doors = room.openings.filter((opening) => opening.kind === 'door')
  const hinged = doors.filter((opening) => getDoorSector(opening, room))
  // Sliding doors have no swing. An outward-opening door swings outside this room; R2 checks it against the room it opens into.
  const noSwing = doors.filter((opening) => opening.operation === 'sliding' || opening.operation === 'hinged-out')
  const noSwingKey = (opening: Opening) => opening.operation === 'hinged-out' ? 'checks.outwardNoSwing' : 'checks.slidingNoSwing'
  const items = solidItems(room)
  const output: CheckResult[] = []
  if (!hinged.length) {
    output.push(result(scope, 'G03', noSwing.map((opening) => opening.id), 'not-evaluated', noSwing.length ? noSwingKey(noSwing[0]) : 'checks.noHingedDoors', 'estimated', 'geometry', 'checks.doorLimit'))
    return output
  }
  for (const opening of hinged) {
    const sector = getDoorSector(opening, room)!
    const obstructing = items.filter((item) => sectorIntersectsRect(sector, getFootprint(item)))
    const confidence = measurementConfidence(room.shape.width, room.shape.depth, opening.width, ...obstructing.flatMap((item) => [item.width, item.depth]))
    output.push(result(scope, 'G03', [opening.id, ...obstructing.map((item) => item.id)], obstructing.length ? 'attention' : 'clear', obstructing.length ? 'checks.doorAttention' : 'checks.doorClear', confidence, 'geometry', 'checks.doorLimit'))
  }
  for (const opening of noSwing) output.push(result(scope, 'G03', [opening.id], 'not-evaluated', noSwingKey(opening), 'estimated', 'geometry', 'checks.doorLimit'))
  return output
}

/**
 * Value precedence for corridor width and turning diameter (spec §7.3):
 * the overlay's own value, then the advisor's project target, then the benchmark.
 */
function evaluateRoutes(scope: Scope): CheckResult[] {
  const { project, floor, room } = scope
  const size = [room.shape.width, room.shape.depth]
  if (!floor.routes.length) return [result(scope, 'G04', [], 'not-evaluated', 'checks.routesMissing', measurementConfidence(...size), 'geometry', 'checks.routeLimit')]
  return floor.routes.map((route) => {
    const points = route.points.map((point) => toRoomPoint(room, point))
    const blockersAt = (width: number) => solidItems(room).filter((item) => routeIntersects(points, getFootprint(item), width / 2))
    const target = project.targets.routeWidth
    const custom = route.widthMm ?? target?.valueMm ?? null
    if (custom !== null) {
      const origin = route.widthMm !== null ? 'custom-overlay' : 'project-target'
      const blockers = blockersAt(custom)
      const outside = pointsLeaveRoom(points, custom / 2, room)
      const confidence = measurementConfidence(...size, ...blockers.flatMap((item) => [item.width, item.depth]))
      return result(scope, 'G04', [route.id, ...blockers.map((item) => item.id)], blockers.length || outside ? 'attention' : 'clear', outside ? 'checks.routeOutside' : blockers.length ? 'checks.routeAttention' : 'checks.routeClear', confidence, origin, 'checks.routeLimit', {
        measuredMm: custom,
        ...(route.widthMm === null && target ? { targetMm: target.valueMm } : {}),
      })
    }
    return benchmarkGeometry(scope, 'G04', route.id, 'route.clearWidth', (width) => {
      const blockers = blockersAt(width)
      return { blockers, outside: pointsLeaveRoom(points, width / 2, room) }
    }, { missing: 'checks.routeWidthMissing', outside: 'checks.routeOutside', attention: 'checks.routeAttention', clear: 'checks.routeClear' }, 'checks.routeLimit')
  })
}

function evaluateTurning(scope: Scope): CheckResult[] {
  const { project, floor, room } = scope
  const size = [room.shape.width, room.shape.depth]
  if (!floor.turningAreas.length) return [result(scope, 'G05', [], 'not-evaluated', 'checks.turningMissing', measurementConfidence(...size), 'geometry', 'checks.turningLimit')]
  return floor.turningAreas.map((area) => {
    const center = toRoomPoint(room, area.center)
    const blockersAt = (diameter: number) => solidItems(room).filter((item) => circleIntersectsRect(center, diameter / 2, getFootprint(item)))
    const target = project.targets.turningDiameter
    const custom = area.diameterMm ?? target?.valueMm ?? null
    if (custom !== null) {
      const origin = area.diameterMm !== null ? 'custom-overlay' : 'project-target'
      const blockers = blockersAt(custom)
      const outside = pointsLeaveRoom([center], custom / 2, room)
      const confidence = measurementConfidence(...size, ...blockers.flatMap((item) => [item.width, item.depth]))
      return result(scope, 'G05', [area.id, ...blockers.map((item) => item.id)], blockers.length || outside ? 'attention' : 'clear', outside ? 'checks.turningOutside' : blockers.length ? 'checks.turningAttention' : 'checks.turningClear', confidence, origin, 'checks.turningLimit', {
        measuredMm: custom,
        ...(area.diameterMm === null && target ? { targetMm: target.valueMm } : {}),
      })
    }
    return benchmarkGeometry(scope, 'G05', area.id, 'bathroom.turningDiameter', (diameter) => {
      const blockers = blockersAt(diameter)
      return { blockers, outside: pointsLeaveRoom([center], diameter / 2, room) }
    }, { missing: 'checks.turningDiameterMissing', outside: 'checks.turningOutside', attention: 'checks.turningAttention', clear: 'checks.turningClear' }, 'checks.turningLimit')
  })
}

/**
 * A drawn corridor or turning circle with no size of its own, tested at the benchmark size.
 * Each benchmark that has a value gets its own verdict at its own size. The drawing itself is
 * shown at the value the project would act on: the primary benchmark, or else the stricter one.
 */
function benchmarkGeometry(
  scope: Scope, ruleId: 'G04' | 'G05', overlayId: string, key: BenchmarkKey,
  test: (sizeMm: number) => { blockers: FurnitureItem[]; outside: boolean },
  messages: { missing: string; outside: string; attention: string; clear: string }, limitationKey: string,
): CheckResult {
  const { room } = scope
  const size = [room.shape.width, room.shape.depth]
  const values = getBenchmarkValues(key, scope.context, scope.dataset)
  const acting = strictestValue(key, scope.context, scope.primary, scope.dataset)
  if (!acting || acting.minMm === undefined) {
    // No overlay size, no project target and no benchmark that applies here.
    return result(scope, ruleId, [overlayId], 'not-evaluated', messages.missing, measurementConfidence(...size), 'custom-overlay', limitationKey)
  }
  const verdicts: BenchmarkVerdict[] = []
  for (const benchmarkId of ['th-public-building', 'th-dop-home'] as const) {
    const value = values[benchmarkId]
    const sizeMm = hasValue(value) ? value.minMm : undefined
    const outcome = sizeMm === undefined ? null : test(sizeMm)
    const inputs = outcome ? [...size, ...outcome.blockers.flatMap((item) => [item.width, item.depth])] : size
    const measured: Measured = outcome === null ? null : { satisfied: !outcome.blockers.length && !outcome.outside, definiteInput: inputs.every(isOnSiteVerified), shownMm: sizeMm }
    verdicts.push(evaluateVerdict({ key, measured, context: scope.context, primary: scope.primary, dataset: scope.dataset }).verdicts.find((verdict) => verdict.benchmarkId === benchmarkId)!)
  }
  const shown = test(acting.minMm)
  const status = statusFromVerdicts(verdicts, scope.primary)
  const messageKey = status === 'clear' ? messages.clear : status === 'not-evaluated' ? messages.missing : shown.outside ? messages.outside : messages.attention
  const confidence = measurementConfidence(...size, ...shown.blockers.flatMap((item) => [item.width, item.depth]))
  return result(scope, ruleId, [overlayId, ...shown.blockers.map((item) => item.id)], status, messageKey, confidence, 'benchmark', limitationKey, { measuredMm: acting.minMm, targetMm: acting.minMm, verdicts })
}

/** Rugs and the household's lighting and reach concerns need a person to look. Thresholds are checked by D03. */
function evaluateManual(scope: Scope): CheckResult[] {
  const rugs = scope.room.items.filter((item) => item.obstruction === 'rug')
  const concerns = scope.project.household.concerns.filter((concern) => concern === 'lighting' || concern === 'reach')
  if (!rugs.length && !concerns.length) return []
  return [result(scope, 'M01', rugs.map((item) => item.id), 'attention', 'checks.manualAttention', 'estimated', 'manual', 'checks.manualLimit')]
}

function evaluateDoors(scope: Scope): CheckResult[] {
  const { room, project } = scope
  const output: CheckResult[] = []
  for (const door of room.openings.filter((opening) => opening.kind === 'door')) {
    // D01: clear width as entered. Frame and leaf thickness are the measurer's responsibility.
    output.push(benchmarkResult(scope, 'D01', [door.id], [{ key: 'door.clearWidth', measured: door.width }],
      { attention: 'checks.doorWidthAttention', clear: 'checks.doorWidthClear', notEvaluated: 'checks.doorWidthNotEvaluated' }, 'checks.doorWidthLimit', door.width.confidence, { measuredMm: door.width.valueMm }))

    // D02: handle height and type. No handle record means there is nothing to compare.
    const handle = door.handle ?? null
    const handleType: Measured = handle && handle.type !== 'unknown' ? { value: handle.type, definiteInput: false } : null
    output.push(benchmarkResult(scope, 'D02', [door.id], [
      { key: 'door.handleHeight', measured: handle?.height ?? null },
      { key: 'door.handleType', measured: handleType },
    ], { attention: 'checks.handleAttention', clear: 'checks.handleClear', notEvaluated: handle ? 'checks.handleNotEvaluated' : 'checks.handleMissing' }, 'checks.handleLimit', handle?.height?.confidence ?? 'estimated',
    handle?.height ? { measuredMm: handle.height.valueMm } : {}))

    // D03: the size of the level change, up or down. An edge bevel is noted, not modelled.
    const step = Math.abs(door.threshold.valueMm)
    output.push(benchmarkResult(scope, 'D03', [door.id], [{ key: 'door.threshold', measured: { ...door.threshold, valueMm: step } }],
      { attention: 'checks.thresholdAttention', clear: 'checks.thresholdClear', notEvaluated: 'checks.thresholdNotEvaluated' }, 'checks.thresholdLimit', door.threshold.confidence, { measuredMm: step }))

    // H03: physical fit only. No margin is invented for hands or turning.
    const wheelchair = project.resident.wheelchair
    if (wheelchair) {
      const fits = door.width.valueMm >= wheelchair.width.valueMm
      output.push(result(scope, 'H03', [door.id], fits ? 'clear' : 'attention', fits ? 'checks.wheelchairFitClear' : 'checks.wheelchairFitAttention',
        measurementConfidence(door.width, wheelchair.width), 'resident', 'checks.wheelchairFitLimit', { measuredMm: door.width.valueMm, targetMm: wheelchair.width.valueMm }))
    }

    // B01: how a bathroom door opens.
    if (room.type === 'bathroom') {
      output.push(benchmarkResult(scope, 'B01', [door.id], [{ key: 'bathroom.doorOperation', measured: door.operation ? { value: door.operation, definiteInput: false } : null }],
        { attention: 'checks.bathroomDoorAttention', clear: 'checks.bathroomDoorClear', notEvaluated: 'checks.bathroomDoorNotEvaluated' }, 'checks.bathroomDoorLimit', 'estimated'))
    }
  }
  return output
}

type Axis = 'x' | 'y'
/**
 * Which way a toilet faces in the plan. Rotation 0 has its back to the north (smaller y);
 * each 90° turns it clockwise, so 90 backs onto the east, 180 the south, 270 the west.
 */
function toiletFacing(item: FurnitureItem): { depthAxis: Axis; frontPositive: boolean } {
  switch (item.rotationDeg) {
    case 0: return { depthAxis: 'y', frontPositive: true }
    case 90: return { depthAxis: 'x', frontPositive: false }
    case 180: return { depthAxis: 'y', frontPositive: false }
    case 270: return { depthAxis: 'x', frontPositive: true }
  }
}

type BesideBar = { bar: WallFixture; pastFrontMm: number; gapMm: number | null }

/**
 * Finds a grab bar that serves a toilet.
 *
 * A horizontal bar counts when it is on a side wall (a wall parallel to the toilet's depth
 * axis) no more than GRAB_BAR_SEARCH_MM from the toilet's side, and overlaps the toilet along
 * that wall. `pastFrontMm` is how far the bar reaches beyond the bowl's front edge, measured
 * along the wall:
 *
 *        back wall
 *   ┌──────────────┐
 *   │ bowl         │   bar on the side wall
 *   │              │   ══════════════════╗
 *   └── front ─────┘                     ║ pastFrontMm
 *                      ══════════════════╝
 *
 * A fold-down bar counts when it is on the wall behind the toilet, to one side of the bowl.
 * `gapMm` is the distance from its centre line to the nearer edge of the bowl.
 */
function findToiletBar(room: RoomSpace, toilet: FurnitureItem): BesideBar | null {
  const footprint = getFootprint(toilet)
  const { depthAxis, frontPositive } = toiletFacing(toilet)
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  const along = depthAxis === 'y' ? { min: footprint.minY, max: footprint.maxY } : { min: footprint.minX, max: footprint.maxX }
  const across = depthAxis === 'y' ? { min: footprint.minX, max: footprint.maxX } : { min: footprint.minY, max: footprint.maxY }
  const sideWalls = depthAxis === 'y'
    ? [{ wall: 'west' as const, distance: footprint.minX }, { wall: 'east' as const, distance: width - footprint.maxX }]
    : [{ wall: 'north' as const, distance: footprint.minY }, { wall: 'south' as const, distance: depth - footprint.maxY }]
  const nearWalls = sideWalls.filter((side) => side.distance <= GRAB_BAR_SEARCH_MM).map((side) => side.wall)
  const bars = [...room.fixtures].sort((a, b) => a.id.localeCompare(b.id))

  for (const bar of bars) {
    if (bar.kind !== 'grab-bar-horizontal' || !nearWalls.includes(bar.wall)) continue
    const start = bar.offset.valueMm - bar.length.valueMm / 2
    const end = bar.offset.valueMm + bar.length.valueMm / 2
    if (end <= along.min || start >= along.max) continue
    return { bar, pastFrontMm: frontPositive ? end - along.max : along.min - start, gapMm: null }
  }

  const backWall = depthAxis === 'y' ? (frontPositive ? 'north' : 'south') : (frontPositive ? 'west' : 'east')
  const backDistance = backWall === 'north' ? footprint.minY : backWall === 'south' ? depth - footprint.maxY : backWall === 'west' ? footprint.minX : width - footprint.maxX
  if (backDistance > GRAB_BAR_SEARCH_MM) return null
  for (const bar of bars) {
    if (bar.kind !== 'grab-bar-fold-down' || bar.wall !== backWall) continue
    const position = bar.offset.valueMm
    const gap = position < across.min ? across.min - position : position > across.max ? position - across.max : null
    if (gap === null || gap > GRAB_BAR_SEARCH_MM) continue
    const reach = bar.length.valueMm - backDistance
    return { bar, pastFrontMm: reach - (along.max - along.min), gapMm: gap }
  }
  return null
}

function evaluateToilets(scope: Scope): CheckResult[] {
  const { room } = scope
  const output: CheckResult[] = []
  for (const toilet of room.items.filter((item) => isToilet(item.catalogId))) {
    const squat = toilet.catalogId === 'toilet-squat'
    // B02: type and seat height. A squat toilet has no seat, so seat height has nothing to compare.
    const typeVerdicts = evaluateVerdict({ key: 'toilet.type', measured: { value: squat ? 'squat' : 'seated', definiteInput: false }, context: scope.context, primary: scope.primary, dataset: scope.dataset }).verdicts
    const seatVerdicts = squat
      ? (['th-public-building', 'th-dop-home'] as const).map((benchmarkId): BenchmarkVerdict => ({ benchmarkId, key: 'toilet.seatHeight', outcome: 'no-value', pendingReview: false }))
      : evaluateVerdict({ key: 'toilet.seatHeight', measured: toilet.seatHeight ?? null, context: scope.context, primary: scope.primary, dataset: scope.dataset }).verdicts
    const verdicts = [...typeVerdicts, ...seatVerdicts]
    const status = statusFromVerdicts(verdicts, scope.primary)
    output.push(result(scope, 'B02', [toilet.id], status, status === 'attention' ? 'checks.toiletAttention' : status === 'clear' ? 'checks.toiletClear' : 'checks.toiletNotEvaluated',
      toilet.seatHeight?.confidence ?? 'estimated', 'benchmark', 'checks.toiletLimit', { verdicts, ...(toilet.seatHeight && !squat ? { measuredMm: toilet.seatHeight.valueMm } : {}) }))

    // B03: is there a grab bar beside it, and where is it? Presence and dimensions only, never strength or fixing.
    const found = findToiletBar(room, toilet)
    if (!found) {
      output.push(result(scope, 'B03', [toilet.id], 'attention', 'checks.grabBarMissing', measurementConfidence(toilet.width, toilet.depth), 'benchmark', 'checks.grabBarLimit'))
      continue
    }
    const { bar } = found
    const parts: { key: BenchmarkKey; measured: Measured }[] = [{ key: 'grabBar.horizontalHeight', measured: bar.referenceHeight }]
    if (found.gapMm === null) parts.push({ key: 'grabBar.projectionPastBowl', measured: derived(found.pastFrontMm, bar.offset, bar.length, toilet.depth) })
    else parts.push({ key: 'grabBar.foldDownGap', measured: derived(found.gapMm, bar.offset, toilet.width) })
    if (bar.diameter) parts.push({ key: 'grabBar.diameter', measured: bar.diameter })
    output.push(benchmarkResult(scope, 'B03', [toilet.id, bar.id], parts,
      { attention: 'checks.grabBarAttention', clear: 'checks.grabBarClear', notEvaluated: 'checks.grabBarNotEvaluated' }, 'checks.grabBarLimit',
      measurementConfidence(bar.referenceHeight, bar.offset, bar.length, toilet.depth), { measuredMm: bar.referenceHeight.valueMm }))
  }
  return output
}

function evaluateFixtures(scope: Scope): CheckResult[] {
  const { room, project } = scope
  const output: CheckResult[] = []
  const reach = project.resident.reach
  const usesWheelchair = getResidentNeeds(project).includes('wheelchair')
  for (const fixture of room.fixtures) {
    // B04: basin rim height and the knee space under it.
    if (fixture.kind === 'basin') {
      output.push(benchmarkResult(scope, 'B04', [fixture.id], [
        { key: 'basin.rimHeight', measured: fixture.referenceHeight },
        { key: 'basin.kneeClearanceDepth', measured: fixture.kneeClearanceDepth ?? null },
      ], { attention: 'checks.basinAttention', clear: 'checks.basinClear', notEvaluated: 'checks.basinNotEvaluated' }, 'checks.basinLimit',
      measurementConfidence(fixture.referenceHeight, fixture.kneeClearanceDepth), { measuredMm: fixture.referenceHeight.valueMm }))
    }
    if (fixture.kind === 'switch' || fixture.kind === 'socket' || fixture.kind === 'shelf') {
      // H01: is it inside the band this resident says they can reach? Based on the resident, not on a benchmark.
      if (reach) {
        const height = fixture.referenceHeight.valueMm
        const inside = height >= reach.low.valueMm && height <= reach.high.valueMm
        output.push(result(scope, 'H01', [fixture.id], inside ? 'clear' : 'attention', inside ? 'checks.reachClear' : 'checks.reachAttention',
          measurementConfidence(fixture.referenceHeight, reach.low, reach.high), 'resident', 'checks.reachLimit',
          { measuredMm: height, targetMm: height < reach.low.valueMm ? reach.low.valueMm : reach.high.valueMm }))
      }
      // H02: socket height, only when the household uses a wheelchair.
      if (fixture.kind === 'socket' && usesWheelchair) {
        output.push(benchmarkResult(scope, 'H02', [fixture.id], [{ key: 'socket.height', measured: fixture.referenceHeight }],
          { attention: 'checks.socketAttention', clear: 'checks.socketClear', notEvaluated: 'checks.socketNotEvaluated' }, 'checks.socketLimit', fixture.referenceHeight.confidence, { measuredMm: fixture.referenceHeight.valueMm }))
      }
    }
  }
  return output
}

function evaluateBathroomSurfaces(scope: Scope): CheckResult[] {
  const { room } = scope
  if (room.type !== 'bathroom') return []
  const output: CheckResult[] = []
  // B05: the recorded surface, not a tested friction value. Unknown is a gap, never a pass.
  const slip = room.floor.slipResistance
  output.push(benchmarkResult(scope, 'B05', [], [{ key: 'floor.slipResistant', measured: slip === 'unknown' ? null : { satisfied: slip === 'slip-resistant', definiteInput: false } }],
    { attention: 'checks.floorAttention', clear: 'checks.floorClear', notEvaluated: 'checks.floorNotEvaluated' }, 'checks.floorLimit', room.floor.confidence))
  // B06: a reminder to look at things standing in the wet area. Shower seats and toilets belong there.
  for (const zone of room.wetZones) {
    const inZone = solidItems(room).filter((item) => item.catalogId !== 'shower-seat' && !isToilet(item.catalogId) && rectanglesOverlap(getFootprint(item), zone.rect))
    if (inZone.length) output.push(result(scope, 'B06', [zone.id, ...inZone.map((item) => item.id)], 'attention', 'checks.wetZoneReview', 'estimated', 'manual', 'checks.wetZoneLimit'))
  }
  return output
}

function distanceToRect(point: PointMm, rect: RectMm): number {
  return Math.hypot(Math.max(rect.minX - point.xMm, 0, point.xMm - rect.maxX), Math.max(rect.minY - point.yMm, 0, point.yMm - rect.maxY))
}

function distanceToSegment(point: PointMm, a: PointMm, b: PointMm): number {
  const vx = b.xMm - a.xMm, vy = b.yMm - a.yMm
  const lengthSquared = vx * vx + vy * vy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.xMm - a.xMm) * vx + (point.yMm - a.yMm) * vy) / lengthSquared))
  return Math.hypot(point.xMm - (a.xMm + t * vx), point.yMm - (a.yMm + t * vy))
}

function openingSegment(opening: Opening, room: RoomSpace): [PointMm, PointMm] {
  const from = opening.offset.valueMm, to = from + opening.width.valueMm
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  switch (opening.wall) {
    case 'north': return [{ xMm: from, yMm: 0 }, { xMm: to, yMm: 0 }]
    case 'south': return [{ xMm: from, yMm: depth }, { xMm: to, yMm: depth }]
    case 'west': return [{ xMm: 0, yMm: from }, { xMm: 0, yMm: to }]
    case 'east': return [{ xMm: width, yMm: from }, { xMm: width, yMm: to }]
  }
}

/** Distance in room coordinates from a point to an entity of this room or floor. null when the ID is unknown. */
function distanceToEntity(point: PointMm, entityId: string, room: RoomSpace, floor: Floor): number | null {
  const item = room.items.find((candidate) => candidate.id === entityId)
  if (item) return distanceToRect(point, getFootprint(item))
  const opening = room.openings.find((candidate) => candidate.id === entityId)
  if (opening) return distanceToSegment(point, ...openingSegment(opening, room))
  const fixture = room.fixtures.find((candidate) => candidate.id === entityId)
  if (fixture) return distanceToRect(point, getFixtureSpan(fixture, room).footprint)
  const zone = room.wetZones.find((candidate) => candidate.id === entityId)
  if (zone) return distanceToRect(point, zone.rect)
  const route: RouteOverlay | undefined = floor.routes.find((candidate) => candidate.id === entityId)
  if (route) {
    const points = route.points.map((routePoint) => toRoomPoint(room, routePoint))
    return Math.min(...points.slice(1).map((routePoint, index) => distanceToSegment(point, points[index], routePoint)))
  }
  const area = floor.turningAreas.find((candidate) => candidate.id === entityId)
  if (area) {
    const center = toRoomPoint(room, area.center)
    return Math.max(0, Math.hypot(point.xMm - center.xMm, point.yMm - center.yMm) - (area.diameterMm ?? 0) / 2)
  }
  return null
}

/**
 * Marks results near a recorded fall. Falls are located in the CURRENT layout; the same room
 * ID and coordinates are used for Proposed, so a fix near the fall stays flagged there too.
 * "All items are inside the room" style summaries are skipped: they would always match.
 */
function tagNearFalls(results: CheckResult[], scope: Scope): CheckResult[] {
  const falls = scope.project.resident.falls.filter((fall) => fall.roomId === scope.room.id)
  if (!falls.length) return results
  const wholeRoom = falls.some((fall) => fall.point === null)
  const points = falls.flatMap((fall) => fall.point ? [fall.point] : [])
  return results.map((entry) => {
    const summary = (entry.ruleId === 'G01' || entry.ruleId === 'G02') && entry.status !== 'attention'
    if (summary) return entry
    if (wholeRoom) return { ...entry, nearFall: true }
    const near = entry.entityIds.some((entityId) => points.some((point) => {
      const distance = distanceToEntity(point, entityId, scope.room, scope.floor)
      return distance !== null && distance <= NEAR_FALL_MM
    }))
    return near ? { ...entry, nearFall: true } : entry
  })
}

export function evaluateLayout(project: Project, layoutId: LayoutId, dataset: BenchmarkDataset = BENCHMARKS): CheckResult[] {
  const layout = layoutId === 'current' ? project.current : project.proposed
  if (!layout) return []
  const output: CheckResult[] = []
  const residentNeeds = getResidentNeeds(project)
  for (const floor of layout.floors) for (const room of floor.rooms) {
    const scope: Scope = {
      project, layoutId, floor, room, dataset,
      context: { roomType: room.type, mobilityAids: residentNeeds },
      primary: project.benchmarkPolicy?.primary ?? null,
    }
    output.push(...tagNearFalls([
      ...evaluateBounds(scope),
      ...evaluateCollisions(scope),
      ...evaluateDoorSwings(scope),
      ...evaluateRoutes(scope),
      ...evaluateTurning(scope),
      ...evaluateDoors(scope),
      ...evaluateToilets(scope),
      ...evaluateFixtures(scope),
      ...evaluateBathroomSurfaces(scope),
      ...evaluateManual(scope),
    ], scope).map((entry) => {
      const relevantNeeds = getRelevantNeedsForRule(entry.ruleId, residentNeeds)
      return relevantNeeds.length ? { ...entry, relevantNeeds } : entry
    }))
  }
  return output
}

export type MovePosition = PointMm | { offsetMm: number; heightMm: number }

/** Evaluate a moved item or wall fixture on a copy; the input project and history remain untouched. */
export function evaluateWithMove(project: Project, layoutId: LayoutId, entityId: string, position: MovePosition): CheckResult[] {
  const layout = layoutId === 'current' ? project.current : project.proposed
  if (!layout) return []
  const room = getPrimaryRoom(layout)
  const isItemMove = 'xMm' in position
  const movedLayout = withPrimaryRoom(layout, (source) => {
    if ('xMm' in position) {
      return { ...source, items: source.items.map((item) => item.id === entityId ? { ...item, center: position } : item) }
    }
    return { ...source, fixtures: source.fixtures.map((fixture) => fixture.id === entityId
      ? { ...fixture, offset: { valueMm: position.offsetMm, confidence: 'estimated' }, referenceHeight: { valueMm: position.heightMm, confidence: 'estimated' } }
      : fixture) }
  })
  const exists = isItemMove ? room.items.some((item) => item.id === entityId) : room.fixtures.some((fixture) => fixture.id === entityId)
  if (!exists) return evaluateLayout(project, layoutId)
  const movedProject = layoutId === 'current' ? { ...project, current: movedLayout } : { ...project, proposed: movedLayout }
  return evaluateLayout(movedProject, layoutId)
}

export type EntityCheckStatus = {
  status: CheckResult['status']
  nearFall: boolean
  resultIds: string[]
  attentionCount: number
  notEvaluatedCount: number
}

/** Merge the already-computed results for drawing; never re-evaluates a check. */
export function getEntityStatuses(results: readonly CheckResult[]): Map<string, EntityCheckStatus> {
  const rank: Record<CheckResult['status'], number> = { clear: 0, 'not-evaluated': 1, attention: 2 }
  const statuses = new Map<string, EntityCheckStatus>()
  for (const result of results) {
    for (const entityId of result.entityIds) {
      const existing = statuses.get(entityId)
      if (!existing) {
        statuses.set(entityId, {
          status: result.status,
          nearFall: result.nearFall,
          resultIds: [result.id],
          attentionCount: result.status === 'attention' ? 1 : 0,
          notEvaluatedCount: result.status === 'not-evaluated' ? 1 : 0,
        })
        continue
      }
      existing.status = rank[result.status] > rank[existing.status] ? result.status : existing.status
      existing.nearFall ||= result.nearFall
      if (!existing.resultIds.includes(result.id)) existing.resultIds.push(result.id)
      if (result.status === 'attention') existing.attentionCount += 1
      if (result.status === 'not-evaluated') existing.notEvaluatedCount += 1
    }
  }
  return statuses
}

export type CheckSummary = {
  attention: number
  likelyAttention: number
  notEvaluated: number
  clear: number
  total: number
  nearFall: number
}

/** Count each derived result once, independently of its number of benchmark verdict rows. */
export function summarizeChecks(results: readonly CheckResult[]): CheckSummary {
  return results.reduce<CheckSummary>((summary, entry) => {
    summary.total += 1
    if (entry.status === 'attention') {
      summary.attention += 1
      if (entry.verdicts.some((verdict) => verdict.outcome === 'likely-does-not-meet')) summary.likelyAttention += 1
    } else if (entry.status === 'not-evaluated') summary.notEvaluated += 1
    else summary.clear += 1
    if (entry.nearFall) summary.nearFall += 1
    return summary
  }, { attention: 0, likelyAttention: 0, notEvaluated: 0, clear: 0, total: 0, nearFall: 0 })
}

export type CheckStatusChange = {
  ruleId: RuleId
  entityIds: string[]
  before: CheckResult
  after: CheckResult
}

function checkComparisonKey(entry: CheckResult): string {
  return JSON.stringify([entry.ruleId, [...entry.entityIds].sort()])
}

/** Compare matching rule/entity results; layout-specific result IDs are intentionally ignored. */
export function compareCheckResults(before: readonly CheckResult[], after: readonly CheckResult[]): CheckStatusChange[] {
  const afterByKey = new Map(after.map((entry) => [checkComparisonKey(entry), entry]))
  return before.flatMap((beforeResult) => {
    const afterResult = afterByKey.get(checkComparisonKey(beforeResult))
    if (!afterResult || afterResult.status === beforeResult.status) return []
    return [{ ruleId: beforeResult.ruleId, entityIds: [...beforeResult.entityIds], before: beforeResult, after: afterResult }]
  }).sort((left, right) => left.ruleId.localeCompare(right.ruleId) || left.entityIds.join('|').localeCompare(right.entityIds.join('|')))
}

/** True when the result should be taken to a professional rather than acted on directly. */
export function resultNeedsProfessionalCheck(entry: CheckResult): boolean {
  return entry.verdicts.some(needsProfessionalCheck) || (entry.ruleId === 'B05' && entry.status === 'not-evaluated')
}

function sortRank(entry: CheckResult): number {
  if (entry.status === 'attention') return entry.verdicts.some((verdict) => verdict.outcome === 'does-not-meet') || !entry.verdicts.length ? 0 : 1
  return entry.status === 'not-evaluated' ? 2 : 3
}

/** Display order (spec §5): near a fall first, then does not meet, likely does not meet, not evaluated, meets. */
export function sortCheckResults(results: CheckResult[]): CheckResult[] {
  return results.map((entry, index) => ({ entry, index }))
    .sort((a, b) => Number(b.entry.nearFall) - Number(a.entry.nearFall)
      || Number(!!b.entry.relevantNeeds?.length) - Number(!!a.entry.relevantNeeds?.length)
      || sortRank(a.entry) - sortRank(b.entry)
      || a.index - b.index)
    .map(({ entry }) => entry)
}
