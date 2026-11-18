import fixData from './data/fixes-2026.11-draft.json'
import { getCatalogEntry, isToilet } from '../catalog'
import { evaluateLayout } from '../checks'
import { createFixture, getFixtureEntry } from '../fixtures-catalog'
import { fixtureFitsWall, getFootprint, wallLengthMm } from '../geometry'
import { moveEntityInRoom } from '../entity-movement'
import { t } from '../i18n'
import { getPrimaryRoom } from '../layout-access'
import { toiletBackWall, toiletFacing, toiletSideWalls, toiletSpans } from '../toilet-geometry'
import { benchmarkContextFor } from '../resident-needs'
import { strictestValue, targetMm, type BenchmarkKey, type BenchmarkValue } from './benchmarks'
import { getDefaultCosts } from './prices'
import { fixLibrarySchema, type Fix, type FixLibrary, type PriceList } from './schema'
import type { BenchmarkId, CheckResult, FurnitureItem, Locale, Measurement, PointMm, Project, Recommendation, Result, RoomSpace, RuleId, Wall } from '../types'

export type { Fix, FixEffect } from './schema'
export type EffortTier = 'no-cost' | 'small-job' | 'building-work'

/** The fix library in use, validated when the module loads. */
export const FIXES: FixLibrary = fixLibrarySchema.parse(fixData)

/** An explicit data override handles fixes whose physical work plainly needs a professional. */
export function getEffortTier(fix: Fix): EffortTier {
  if (fix.effort) return fix.effort
  if (fix.needsProfessional || fix.workType === 'site-review') return 'building-work'
  if (fix.workType === 'rearrange') return 'no-cost'
  return 'small-job'
}

export type FixParams = {
  /** The entity the fix acts on: an item, door or fixture. Not needed for whole-room fixes. */
  entityId?: string | null
  /** move-item: where the item's centre goes. */
  position?: PointMm
  /** add-fixture with placement 'selected-wall'. */
  wall?: Wall
  /** The rule whose result offered the fix. Recorded on the recommendation. */
  ruleId?: RuleId
  locale?: Locale
}
export type FixPreview = {
  /** The project as it would be after applying: Proposed changed and the recommendation added. */
  project: Project
  changedIds: string[]
  /** Checks re-run on the previewed Proposed layout. */
  newResults: CheckResult[]
  recommendation: Recommendation
  /** The benchmark number the fix aimed for, when it used one. */
  used: { valueMm: number; key: BenchmarkKey; benchmarkId: BenchmarkId; clause: string; pendingReview: boolean } | null
}

function failure<T>(code: string, messageKey: string, paths: string[] = []): Result<T> {
  return { ok: false, error: { code, messageKey, paths } }
}

const estimated = (valueMm: number): Measurement => ({ valueMm, confidence: 'estimated' })

export function getFix(fixId: string, library: FixLibrary = FIXES): Fix | undefined {
  return library.fixes.find((fix) => fix.id === fixId)
}

/** Fixes worth offering for a check result: only for results that are not clear, and only fixes that fit the entities involved. */
export function getFixesForResult(result: CheckResult, project: Project, library: FixLibrary = FIXES): Fix[] {
  if (result.status === 'clear') return []
  const layout = result.layoutId === 'current' ? project.current : project.proposed
  if (!layout) return []
  const room = getPrimaryRoom(layout)
  const items = room.items.filter((item) => result.entityIds.includes(item.id))
  return library.fixes.filter((fix) => {
    if (!fix.ruleIds.includes(result.ruleId)) return false
    switch (fix.effect.kind) {
      case 'move-item':
      case 'remove-item':
        return items.some((item) => !isToilet(item.catalogId))
      case 'replace-item':
        return items.some((item) => item.catalogId === 'toilet-squat')
      case 'set-seat-height':
        return items.some((item) => item.catalogId === 'toilet-seated')
      case 'add-fixture':
        // Offer a bar only when the toilet has none.
        return result.ruleId !== 'B03' || !room.fixtures.some((fixture) => result.entityIds.includes(fixture.id))
      case 'set-threshold':
      case 'note-only':
        return result.status === 'attention'
      default:
        return true
    }
  })
}

/** The entity a fix should act on by default, given the result that offered it. */
export function defaultFixEntity(fix: Fix, result: CheckResult, project: Project): string | null {
  const layout = result.layoutId === 'current' ? project.current : project.proposed
  if (!layout) return null
  const room = getPrimaryRoom(layout)
  const isItem = (id: string) => room.items.some((item) => item.id === id)
  switch (fix.effect.kind) {
    case 'move-item':
    case 'remove-item':
      // Prefer the movable thing: furniture rather than a toilet.
      return result.entityIds.find((id) => { const item = room.items.find((candidate) => candidate.id === id); return item && !isToilet(item.catalogId) }) ?? null
    case 'replace-item':
    case 'set-seat-height':
    case 'add-fixture':
      return result.entityIds.find(isItem) ?? null
    case 'set-fixture-height':
      return result.entityIds.find((id) => room.fixtures.some((fixture) => fixture.id === id)) ?? null
    case 'set-floor-surface':
    case 'note-only':
      return result.entityIds[0] ?? null
    default:
      return result.entityIds.find((id) => room.openings.some((opening) => opening.id === id)) ?? null
  }
}

type Applied = { room: RoomSpace; changedIds: string[]; used: BenchmarkValue | null; usedMm: number | null; linkId: string | null }

function resolveBenchmark(key: BenchmarkKey, room: RoomSpace, project: Project): { value: BenchmarkValue; mm: number } | null {
  const value = strictestValue(key, benchmarkContextFor(project, room), project.benchmarkPolicy?.primary ?? null)
  const mm = value ? targetMm(value) : null
  return value && mm !== null ? { value, mm } : null
}

/** Where a new grab bar goes for a toilet, using the same toilet geometry `findToiletBar` checks against. */
function placeToiletBar(kind: 'grab-bar-horizontal' | 'grab-bar-fold-down', toilet: FurnitureItem, room: RoomSpace, project: Project, heightMm: number, id: string, label: string) {
  const { frontPositive } = toiletFacing(toilet)
  const { along, across } = toiletSpans(toilet)
  const sides = toiletSideWalls(room, toilet)
  const nearer = sides[0].distance <= sides[1].distance ? sides[0] : sides[1]

  if (kind === 'grab-bar-horizontal') {
    const wallLength = wallLengthMm(room, nearer.wall)
    const defaultLength = getFixtureEntry(kind).defaults.length
    const past = resolveBenchmark('grabBar.projectionPastBowl', room, project)?.mm ?? 0
    // The bar's far end sits `past` beyond the bowl's front edge; the bar runs back from there.
    let end = frontPositive ? along.max + past : along.min - past
    let start = frontPositive ? end - defaultLength : end + defaultLength
    if (start > end) [start, end] = [end, start]
    start = Math.max(0, start)
    end = Math.min(wallLength, end)
    const length = Math.max(10, Math.round(end - start))
    // Rounding the midpoint can push offset + length/2 a fraction past the wall end; clamp on the rounded span.
    const offset = Math.min(Math.floor(wallLength - length / 2), Math.max(Math.ceil(length / 2), Math.round((start + end) / 2)))
    return createFixture(kind, nearer.wall, room, id, label, { offset, length, referenceHeight: heightMm })
  }
  // Fold-down: on the wall behind the toilet, on the side away from the nearer side wall.
  const backWall = toiletBackWall(toilet)
  const gap = resolveBenchmark('grabBar.foldDownGap', room, project)?.mm ?? 200
  const openSide = nearer === sides[0] ? 'max' : 'min'
  const offset = openSide === 'max' ? across.max + gap : across.min - gap
  const wallLength = wallLengthMm(room, backWall)
  return createFixture(kind, backWall, room, id, label, { offset: Math.round(Math.min(wallLength - 50, Math.max(50, offset))), referenceHeight: heightMm })
}

function applyEffect(fix: Fix, room: RoomSpace, project: Project, params: FixParams): Result<Applied> {
  const next = structuredClone(room)
  const entityId = params.entityId ?? null
  const item = next.items.find((candidate) => candidate.id === entityId)
  const door = next.openings.find((candidate) => candidate.id === entityId && candidate.kind === 'door')
  const fixture = next.fixtures.find((candidate) => candidate.id === entityId)
  const done = (changedIds: string[], linkId: string | null, used: { value: BenchmarkValue; mm: number } | null = null): Result<Applied> => ({ ok: true, value: { room: next, changedIds, used: used?.value ?? null, usedMm: used?.mm ?? null, linkId } })
  const missing = () => failure<Applied>('fix-entity-missing', 'fix.entityMissing', ['entityId'])
  const noBenchmark = () => failure<Applied>('fix-no-benchmark', 'fix.noBenchmark', ['fromBenchmark'])
  const effect = fix.effect

  switch (effect.kind) {
    case 'move-item': {
      if (!item) return missing()
      if (!params.position) return failure('fix-position-required', 'fix.positionRequired', ['position'])
      const moved = moveEntityInRoom(next, item.id, params.position)
      if (!moved.ok) return moved.reason === 'not-found' ? missing() : failure('fix-out-of-bounds', 'fix.outOfBounds', ['position'])
      next.items = moved.room.items
      return done([item.id], item.id)
    }
    case 'remove-item':
      if (!item) return missing()
      next.items = next.items.filter((candidate) => candidate.id !== item.id)
      return done([item.id], null)
    case 'replace-item': {
      if (!item) return missing()
      const entry = getCatalogEntry(effect.catalogId)
      if (!entry) return failure('fix-invalid', 'fix.invalid', ['catalogId'])
      item.catalogId = entry.id
      item.label = entry.label[params.locale ?? 'th']
      item.width = estimated(entry.defaultDimensionsMm.width)
      item.depth = estimated(entry.defaultDimensionsMm.depth)
      item.height = estimated(entry.defaultDimensionsMm.height)
      item.seatHeight = entry.defaultSeatHeightMm !== undefined ? estimated(entry.defaultSeatHeightMm) : null
      const footprint = getFootprint(item)
      // A larger replacement is nudged back inside the room rather than rejected.
      item.center = {
        xMm: Math.round(item.center.xMm + Math.max(0, -footprint.minX) - Math.max(0, footprint.maxX - next.shape.width.valueMm)),
        yMm: Math.round(item.center.yMm + Math.max(0, -footprint.minY) - Math.max(0, footprint.maxY - next.shape.depth.valueMm)),
      }
      return done([item.id], item.id)
    }
    case 'set-door-operation':
      if (!door) return missing()
      door.operation = effect.operation
      return done([door.id], door.id)
    case 'set-threshold':
      if (!door) return missing()
      door.threshold = estimated(effect.valueMm)
      return done([door.id], door.id)
    case 'set-door-width': {
      if (!door) return missing()
      const target = resolveBenchmark(effect.fromBenchmark, next, project)
      if (!target) return noBenchmark()
      const wallLength = wallLengthMm(next, door.wall)
      const widthMm = Math.max(door.width.valueMm, target.mm)
      if (widthMm > wallLength) return failure('fix-does-not-fit', 'fix.doesNotFit', ['width'])
      door.width = estimated(widthMm)
      // Keep the doorway on its wall; the widening goes toward the side with room.
      if (door.offset.valueMm + widthMm > wallLength) door.offset = estimated(wallLength - widthMm)
      const overlaps = next.openings.some((other) => other.id !== door.id && other.wall === door.wall && door.offset.valueMm < other.offset.valueMm + other.width.valueMm && other.offset.valueMm < door.offset.valueMm + widthMm)
      if (overlaps) return failure('fix-does-not-fit', 'fix.doesNotFit', ['width'])
      return done([door.id], door.id, target)
    }
    case 'set-handle': {
      if (!door) return missing()
      const target = resolveBenchmark(effect.fromBenchmark, next, project)
      if (!target) return noBenchmark()
      door.handle = { type: effect.type, height: estimated(target.mm) }
      return done([door.id], door.id, target)
    }
    case 'add-fixture': {
      const target = effect.fromBenchmark ? resolveBenchmark(effect.fromBenchmark, next, project) : null
      if (effect.fromBenchmark && !target) return noBenchmark()
      const entry = getFixtureEntry(effect.fixtureKind)
      const label = entry.label[params.locale ?? 'th']
      let id = `fixture-${fix.id}-${entityId ?? 'room'}`
      for (let n = 2; next.fixtures.some((candidate) => candidate.id === id); n++) id = `fixture-${fix.id}-${entityId ?? 'room'}-${n}`
      const heightMm = target?.mm ?? entry.defaults.referenceHeight
      let added
      if (effect.placement === 'beside-toilet') {
        if (!item || !isToilet(item.catalogId)) return missing()
        if (effect.fixtureKind !== 'grab-bar-horizontal' && effect.fixtureKind !== 'grab-bar-fold-down') return failure('fix-invalid', 'fix.invalid', ['fixtureKind'])
        added = placeToiletBar(effect.fixtureKind, item, next, project, heightMm, id, label)
      } else {
        if (!params.wall) return failure('fix-wall-required', 'fix.wallRequired', ['wall'])
        added = createFixture(effect.fixtureKind, params.wall, next, id, label, { referenceHeight: heightMm })
      }
      if (!fixtureFitsWall(added, next)) return failure('fix-does-not-fit', 'fix.doesNotFit', ['fixture'])
      if (next.fixtures.length >= 60) return failure('fix-does-not-fit', 'fix.doesNotFit', ['fixtures'])
      next.fixtures.push(added)
      return done([added.id], added.id, target)
    }
    case 'set-fixture-height': {
      if (!fixture) return missing()
      if (effect.fromResidentReach) {
        const reach = project.resident.reach
        if (!reach) return failure('fix-no-reach', 'fix.noReach', ['resident.reach'])
        fixture.referenceHeight = estimated(Math.min(reach.high.valueMm, Math.max(reach.low.valueMm, fixture.referenceHeight.valueMm)))
        return done([fixture.id], fixture.id)
      }
      const target = effect.fromBenchmark ? resolveBenchmark(effect.fromBenchmark, next, project) : null
      if (!target) return noBenchmark()
      fixture.referenceHeight = estimated(target.mm)
      return done([fixture.id], fixture.id, target)
    }
    case 'set-seat-height': {
      if (!item) return missing()
      const target = resolveBenchmark(effect.fromBenchmark, next, project)
      if (!target) return noBenchmark()
      item.seatHeight = estimated(target.mm)
      // A raised seat makes the whole piece at least that tall.
      if (item.height.valueMm < target.mm) item.height = estimated(target.mm)
      return done([item.id], item.id, target)
    }
    case 'set-floor-surface':
      next.floor = { ...next.floor, slipResistance: effect.slipResistance, confidence: 'estimated' }
      return done([], null)
    case 'note-only':
      return done([], entityId && [...next.items, ...next.openings, ...next.fixtures].some((candidate) => candidate.id === entityId) ? entityId : null)
  }
}

/**
 * Works out what applying a fix would do, without changing anything. The fix is applied to
 * Proposed, which is created from Current when it does not exist yet, and a linked
 * recommendation is added. Costs come from the price list, or stay unknown when it has none.
 */
export function previewFix(project: Project, fixId: string, params: FixParams, now: string, options: { library?: FixLibrary; prices?: PriceList } = {}): Result<FixPreview> {
  const fix = getFix(fixId, options.library)
  if (!fix) return failure('fix-unknown', 'fix.unknown', ['fixId'])
  const proposed = structuredClone(project.proposed ?? project.current)
  const applied = applyEffect(fix, getPrimaryRoom(proposed), project, params)
  if (!applied.ok) return applied
  proposed.floors[0].rooms[0] = applied.value.room

  const locale = params.locale ?? 'th'
  const costs = getDefaultCosts(fix.priceKey, project.household.provinceCode, options.prices)
  const recommendation: Recommendation = {
    // Deterministic, so applying the same fix to the same entity again updates its recommendation.
    id: `recommendation-fix-${fix.id}-${params.entityId ?? 'room'}`,
    layoutId: 'proposed',
    ...(applied.value.linkId ? { entityId: applied.value.linkId } : {}),
    title: fix.label[locale].slice(0, 160), reason: fix.description[locale], action: fix.label[locale],
    priority: 'next', workType: fix.workType, status: 'proposed',
    advisorNote: fix.needsProfessional ? t(locale, 'fixNeedsProfessional') : '',
    materials: costs.materials, labour: costs.labour,
    fixId: fix.id, ruleId: params.ruleId ?? fix.ruleIds[0],
  }
  const preview: Project = {
    ...project,
    proposed,
    recommendations: [...project.recommendations.filter((entry) => entry.id !== recommendation.id), recommendation],
    updatedAt: now,
  }
  const used = applied.value.used && applied.value.usedMm !== null
    ? { valueMm: applied.value.usedMm, key: applied.value.used.key, benchmarkId: applied.value.used.benchmarkId, clause: applied.value.used.clause, pendingReview: applied.value.used.review.status === 'pending' }
    : null
  return { ok: true, value: { project: preview, changedIds: applied.value.changedIds, newResults: evaluateLayout(preview, 'proposed'), recommendation, used } }
}
