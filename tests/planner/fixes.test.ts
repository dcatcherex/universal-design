import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { CATALOG } from '../../lib/planner/catalog'
import { evaluateLayout } from '../../lib/planner/checks'
import { buildElevation, fixturePositionProblem } from '../../lib/planner/elevation'
import { buildReportData, hasHealthData } from '../../lib/planner/exports/report-data'
import { createPlanSvg } from '../../lib/planner/exports/plan-svg'
import { createBathroomExampleProject, createCatalogItem, createExampleProject } from '../../lib/planner/fixtures'
import { createFixture, FIXTURE_CATALOG } from '../../lib/planner/fixtures-catalog'
import { fixtureFitsWall, getFixtureSpan } from '../../lib/planner/geometry'
import { commitCommand, createHistory, getReviewStatus, undo } from '../../lib/planner/history'
import { getPrimaryRoom } from '../../lib/planner/layout-access'
import { buildFixtureMesh, buildFurnitureMesh } from '../../lib/planner/scene/build-scene'
import { validateProject } from '../../lib/planner/schema'
import { FIXES, getFixesForResult, previewFix } from '../../lib/planner/standards/fixes'
import type { PriceList } from '../../lib/planner/standards/schema'
import type { Measurement, Project, RuleId } from '../../lib/planner/types'

const now = '2026-09-28T00:00:00.000Z'
const m = (valueMm: number): Measurement => ({ valueMm, confidence: 'estimated' })
const bathroom = () => createBathroomExampleProject(now)
const result = (project: Project, ruleId: RuleId, layoutId: 'current' | 'proposed' = 'current') => evaluateLayout(project, layoutId).find((entry) => entry.ruleId === ruleId)!

describe('fix library', () => {
  it('offers fixes that fit the failing check', () => {
    const project = bathroom()
    const offered = (ruleId: RuleId) => getFixesForResult(result(project, ruleId), project).map((fix) => fix.id)
    expect(offered('B01')).toEqual(['door-sliding', 'door-rehang-out'])
    expect(offered('B03')).toEqual(['grab-bar-horizontal', 'grab-bar-fold-down'])
    expect(offered('B02')).toEqual(['raised-toilet-seat'])
    expect(offered('D01')).toEqual(['door-widen'])
    expect(offered('B05')).toEqual(['anti-slip-floor'])
    // The jar in the wet area can be moved or removed.
    expect(offered('B06')).toEqual(['move-item', 'remove-item'])
    // Nothing is offered for a check that is clear.
    expect(getFixesForResult(result(project, 'G01'), project)).toEqual([])
  })

  it('previews rehanging the door outward without changing the input', () => {
    const project = bathroom()
    const before = JSON.stringify(project)
    const preview = previewFix(project, 'door-rehang-out', { entityId: 'bathroom-door', ruleId: 'B01' }, now)
    if (!preview.ok) throw new Error(preview.error.code)
    expect(JSON.stringify(project)).toBe(before)
    expect(preview.value.changedIds).toEqual(['bathroom-door'])
    const proposed = getPrimaryRoom(preview.value.project.proposed!)
    expect(proposed.openings[0].operation).toBe('hinged-out')
    // Only the door changed in the copy.
    expect({ ...proposed, openings: [] }).toEqual({ ...getPrimaryRoom(project.current), openings: [] })
    expect(preview.value.newResults.find((entry) => entry.ruleId === 'B01')?.status).toBe('clear')
  })

  it('places a horizontal grab bar beside the toilet at the benchmark height', () => {
    const project = bathroom()
    const preview = previewFix(project, 'grab-bar-horizontal', { entityId: 'toilet-1', ruleId: 'B03' }, now)
    if (!preview.ok) throw new Error(preview.error.code)
    const bar = getPrimaryRoom(preview.value.project.proposed!).fixtures[0]
    // Only the public-building benchmark has a value: 650-700, midpoint rounded to 10 mm.
    expect(bar).toMatchObject({ kind: 'grab-bar-horizontal', wall: 'east', referenceHeight: { valueMm: 680, confidence: 'estimated' } })
    expect(preview.value.used).toMatchObject({ valueMm: 680, key: 'grabBar.horizontalHeight', benchmarkId: 'th-public-building', pendingReview: true })
    // The toilet's front edge is at y = 1075 and the bar reaches 280 mm past it.
    expect(bar.offset.valueMm - bar.length.valueMm / 2).toBe(795)
    expect(preview.value.newResults.find((entry) => entry.ruleId === 'B03')).toMatchObject({ status: 'clear', entityIds: [bar.id, 'toilet-1'] })
    expect(preview.value.recommendation).toMatchObject({ fixId: 'grab-bar-horizontal', ruleId: 'B03', status: 'proposed', layoutId: 'proposed', entityId: bar.id, materials: null, labour: null })
  })

  it('places a fold-down bar behind the toilet on its open side', () => {
    const project = bathroom()
    const preview = previewFix(project, 'grab-bar-fold-down', { entityId: 'toilet-1', ruleId: 'B03' }, now)
    if (!preview.ok) throw new Error(preview.error.code)
    const bar = getPrimaryRoom(preview.value.project.proposed!).fixtures[0]
    // The toilet backs onto the south wall with the east wall beside it, so the bar goes to its west.
    expect(bar).toMatchObject({ kind: 'grab-bar-fold-down', wall: 'south' })
    expect(bar.offset.valueMm).toBe(1300 - 180)
    expect(preview.value.newResults.find((entry) => entry.ruleId === 'B03')?.status).toBe('clear')
  })

  it('needs a position to move an item and rejects one outside the room', () => {
    const project = bathroom()
    expect(previewFix(project, 'move-item', { entityId: 'water-jar-1' }, now)).toMatchObject({ ok: false, error: { code: 'fix-position-required' } })
    expect(previewFix(project, 'move-item', { entityId: 'water-jar-1', position: { xMm: 100, yMm: 100 } }, now)).toMatchObject({ ok: false, error: { code: 'fix-out-of-bounds' } })
    const moved = previewFix(project, 'move-item', { entityId: 'water-jar-1', position: { xMm: 1400, yMm: 400 } }, now)
    expect(moved.ok && getPrimaryRoom(moved.value.project.proposed!).items.find((item) => item.id === 'water-jar-1')?.center).toEqual({ xMm: 1400, yMm: 400 })
    expect(previewFix(project, 'no-such-fix', {}, now)).toMatchObject({ ok: false, error: { code: 'fix-unknown' } })
    expect(previewFix(project, 'door-sliding', { entityId: 'missing-door' }, now)).toMatchObject({ ok: false, error: { code: 'fix-entity-missing' } })
  })

  it('aims other fixes at the benchmark value', () => {
    const project = bathroom()
    const widened = previewFix(project, 'door-widen', { entityId: 'bathroom-door' }, now)
    // With no primary benchmark the stricter width (900) is used.
    expect(widened.ok && getPrimaryRoom(widened.value.project.proposed!).openings[0].width.valueMm).toBe(900)
    expect(widened.ok && widened.value.recommendation.advisorNote).not.toBe('')
    const seat = previewFix(project, 'raised-toilet-seat', { entityId: 'toilet-1' }, now)
    expect(seat.ok && getPrimaryRoom(seat.value.project.proposed!).items[0].seatHeight?.valueMm).toBe(430)
    const lever = previewFix(project, 'lever-handle', { entityId: 'bathroom-door' }, now)
    expect(lever.ok && getPrimaryRoom(lever.value.project.proposed!).openings[0].handle).toEqual({ type: 'lever', height: m(1100) })
    const floor = previewFix(project, 'anti-slip-floor', {}, now)
    expect(floor.ok && floor.value.newResults.find((entry) => entry.ruleId === 'B05')?.status).toBe('clear')
    const bevel = previewFix(project, 'threshold-bevel', { entityId: 'bathroom-door' }, now)
    // A bevel strip leaves the step as it is: the plan is unchanged and only a recommendation is added.
    expect(bevel.ok && bevel.value.project.proposed).toEqual(project.current)
  })

  it('copies a price into the recommendation when the price list has one', () => {
    const prices: PriceList = { version: 'test', prices: [{ priceKey: 'door-rehang-out', unit: 'per-door', label: { th: 'ก', en: 'a' }, national: { materials: [50000, 90000], labour: [30000, 60000] }, regions: {}, sourceNote: 'Test jobs', collectedAt: '2026-10-01', sampleSize: 15 }] }
    const preview = previewFix(bathroom(), 'door-rehang-out', { entityId: 'bathroom-door' }, now, { prices })
    expect(preview.ok && preview.value.recommendation.materials).toEqual({ lowSatang: 50000, highSatang: 90000, sourceNote: 'Test jobs', estimatedAt: '2026-10-01T00:00:00.000Z' })
    expect(preview.ok && validateProject(preview.value.project).ok).toBe(true)
  })
})

describe('apply-fix command', () => {
  it('creates Proposed, changes it and adds the recommendation as one undoable step', () => {
    const project = bathroom()
    const state = createHistory(project)
    const applied = commitCommand(state, { type: 'apply-fix', fixId: 'door-rehang-out', params: { entityId: 'bathroom-door', ruleId: 'B01' } }, now)
    if (!applied.ok) throw new Error(applied.error.paths.join(', '))
    expect(applied.value.past).toHaveLength(1)
    const after = applied.value.present
    expect(after.revision).toBe(project.revision + 1)
    expect(getPrimaryRoom(after.proposed!).openings[0].operation).toBe('hinged-out')
    // Current is untouched.
    expect(after.current).toEqual(project.current)
    expect(after.recommendations).toHaveLength(1)
    expect(after.recommendations[0]).toMatchObject({ fixId: 'door-rehang-out', ruleId: 'B01', layoutId: 'proposed', entityId: 'bathroom-door', materials: null, labour: null })

    const undone = undo(applied.value, now).present
    expect(undone.proposed).toBeNull()
    expect(undone.recommendations).toEqual([])
  })

  it('applies to an existing Proposed and replaces the same fix rather than duplicating it', () => {
    let state = createHistory(bathroom())
    for (const command of [
      { type: 'apply-fix' as const, fixId: 'door-sliding', params: { entityId: 'bathroom-door' } },
      { type: 'apply-fix' as const, fixId: 'anti-slip-floor', params: {} },
      { type: 'apply-fix' as const, fixId: 'anti-slip-floor', params: {} },
    ]) {
      const next = commitCommand(state, command, now)
      if (!next.ok) throw new Error(next.error.code)
      state = next.value
    }
    const room = getPrimaryRoom(state.present.proposed!)
    expect(room.openings[0].operation).toBe('sliding')
    expect(room.floor.slipResistance).toBe('slip-resistant')
    expect(state.present.recommendations.map((entry) => entry.fixId)).toEqual(['door-sliding', 'anti-slip-floor'])
    // The third command changed nothing, so it added no history entry.
    expect(state.past).toHaveLength(2)
  })

  it('drops the recommendation link when the fix removes its entity, and fails cleanly on a bad fix', () => {
    const project = bathroom()
    const removed = commitCommand(createHistory(project), { type: 'apply-fix', fixId: 'remove-item', params: { entityId: 'water-jar-1' } }, now)
    expect(removed.ok && removed.value.present.recommendations[0].entityId).toBeUndefined()
    expect(removed.ok && getPrimaryRoom(removed.value.present.proposed!).items.map((item) => item.id)).toEqual(['toilet-1'])
    const bad = commitCommand(createHistory(project), { type: 'apply-fix', fixId: 'move-item', params: { entityId: 'water-jar-1' } }, now)
    expect(bad.ok).toBe(false)
  })

  it('has a fix for every rule that can need attention from a benchmark or the resident', () => {
    const covered = new Set(FIXES.fixes.flatMap((fix) => fix.ruleIds))
    for (const ruleId of ['D01', 'D02', 'D03', 'B01', 'B02', 'B03', 'B04', 'B05', 'H01', 'H02'] as const) expect(covered.has(ruleId), ruleId).toBe(true)
  })
})

describe('schema v2 limits', () => {
  const invalid = (change: (project: Project) => void) => { const project = bathroom(); change(project); return validateProject(project) }

  it('rejects a second room or floor, naming where', () => {
    const twoRooms = invalid((project) => { const floor = project.current.floors[0]; floor.rooms.push({ ...structuredClone(floor.rooms[0]), id: 'room-2', openings: [], items: [], wetZones: [] }) })
    expect(twoRooms).toMatchObject({ ok: false })
    expect(!twoRooms.ok && twoRooms.error.paths).toContain('current.floors.0.rooms')
    const twoFloors = invalid((project) => { project.current.floors.push({ id: 'floor-2', label: '', level: 1, rooms: [{ ...structuredClone(project.current.floors[0].rooms[0]), id: 'room-2', openings: [], items: [], wetZones: [] }], routes: [], turningAreas: [] }) })
    expect(!twoFloors.ok && twoFloors.error.paths).toContain('current.floors')
    expect(invalid((project) => { getPrimaryRoom(project.current).origin = { xMm: 100, yMm: 0 } }).ok).toBe(false)
  })

  it('requires a method for a verified measurement and accepts on-site and photo', () => {
    const verified = { valueMm: 700, confidence: 'advisor-verified' as const, verifiedBy: 'Advisor', verifiedAt: now }
    const missing = invalid((project) => { getPrimaryRoom(project.current).openings[0].width = verified })
    expect(!missing.ok && missing.error.paths.some((path) => path.endsWith('width.verificationMethod'))).toBe(true)
    for (const verificationMethod of ['on-site', 'photo', 'unspecified'] as const) {
      expect(invalid((project) => { getPrimaryRoom(project.current).openings[0].width = { ...verified, verificationMethod, verificationNote: 'tape measure' } }).ok).toBe(true)
    }
  })

  it('rejects fixtures that do not fit, too many fixtures and too many falls', () => {
    const room = getPrimaryRoom(bathroom().current)
    const bar = createFixture('grab-bar-horizontal', 'east', room, 'bar', 'Bar')
    expect(invalid((project) => { getPrimaryRoom(project.current).fixtures = [{ ...bar, offset: m(1700) }] }).ok).toBe(false)
    expect(invalid((project) => { getPrimaryRoom(project.current).fixtures = [{ ...bar, referenceHeight: m(2600) }] }).ok).toBe(false)
    expect(invalid((project) => { getPrimaryRoom(project.current).fixtures = [bar] }).ok).toBe(true)
    expect(invalid((project) => { getPrimaryRoom(project.current).fixtures = Array.from({ length: 61 }, (_, index) => ({ ...bar, id: `bar-${index}` })) }).ok).toBe(false)
    const fall = { id: 'fall', when: 'within-3-months' as const, roomId: 'room-1', point: null, activity: 'other' as const, note: '' }
    expect(invalid((project) => { project.resident.falls = Array.from({ length: 21 }, (_, index) => ({ ...fall, id: `fall-${index}` })) }).ok).toBe(false)
    expect(invalid((project) => { project.resident.falls = [{ ...fall, roomId: 'no-such-room' }] }).ok).toBe(false)
    expect(invalid((project) => { project.resident.falls = [fall] }).ok).toBe(true)
  })

  it('accepts an outward-opening door, a lever handle and no handle', () => {
    expect(invalid((project) => { getPrimaryRoom(project.current).openings[0].operation = 'hinged-out' }).ok).toBe(true)
    expect(invalid((project) => { getPrimaryRoom(project.current).openings[0].handle = { type: 'lever', height: m(1100) } }).ok).toBe(true)
    expect(invalid((project) => { getPrimaryRoom(project.current).openings[0].handle = null }).ok).toBe(true)
    // Wet areas belong to bathrooms only.
    const living = createExampleProject(now)
    getPrimaryRoom(living.current).wetZones = [{ id: 'wet', label: 'Wet', rect: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 } }]
    expect(validateProject(living).ok).toBe(false)
  })
})

describe('fixture geometry, wall view and 3D', () => {
  const room = getPrimaryRoom(bathroom().current)

  it('maps a fixture onto each wall with its span and projection', () => {
    const bar = (wall: 'north' | 'south' | 'east' | 'west') => createFixture('grab-bar-horizontal', wall, room, 'bar', 'Bar', { offset: 900, length: 600 })
    expect(getFixtureSpan(bar('north'), room)).toEqual({ start: { xMm: 600, yMm: 0 }, end: { xMm: 1200, yMm: 0 }, footprint: { minX: 600, maxX: 1200, minY: 0, maxY: 80 } })
    expect(getFixtureSpan(bar('south'), room).footprint).toEqual({ minX: 600, maxX: 1200, minY: 1720, maxY: 1800 })
    expect(getFixtureSpan(bar('west'), room).footprint).toEqual({ minX: 0, maxX: 80, minY: 600, maxY: 1200 })
    expect(getFixtureSpan(bar('east'), room).footprint).toEqual({ minX: 1920, maxX: 2000, minY: 600, maxY: 1200 })
    // Exactly at the wall end fits; 1 mm further does not.
    expect(fixtureFitsWall({ ...bar('east'), offset: m(1500) }, room)).toBe(true)
    expect(fixtureFitsWall({ ...bar('east'), offset: m(1501) }, room)).toBe(false)
    // A vertical bar rises from its reference height.
    const vertical = createFixture('grab-bar-vertical', 'east', room, 'v', 'V', { referenceHeight: 1900, length: 600 })
    expect(fixtureFitsWall(vertical, room)).toBe(true)
    expect(fixtureFitsWall({ ...vertical, referenceHeight: m(1901) }, room)).toBe(false)
  })

  it('does not let a switch or socket sit over an opening', () => {
    const socket = createFixture('socket', 'north', room, 'socket', 'Socket', { offset: 500, referenceHeight: 300 })
    expect(fixturePositionProblem(socket, room)).toBe('over-opening')
    expect(fixturePositionProblem({ ...socket, offset: m(1500) }, room)).toBeNull()
    expect(fixturePositionProblem({ ...socket, offset: m(2100) }, room)).toBe('outside-wall')
    // A grab bar may pass a doorway.
    expect(fixturePositionProblem(createFixture('grab-bar-horizontal', 'north', room, 'bar', 'Bar', { offset: 500 }), room)).toBeNull()
  })

  it('builds the wall view with nearby furniture, the reach band and benchmark bands', () => {
    const project = bathroom()
    const space = getPrimaryRoom(project.current)
    const bar = createFixture('grab-bar-horizontal', 'east', space, 'bar', 'Bar', { offset: 1100, referenceHeight: 680 })
    space.fixtures = [bar]
    const context = { roomType: 'bathroom' as const, mobilityAids: [] }
    const east = buildElevation(space, 'east', project.resident, 'bar', context)
    // The east wall runs north to south: 1800 mm long. The toilet (300 mm away) shows; the jar does not.
    expect(east.lengthMm).toBe(1800)
    expect(east.silhouettes.map((item) => item.id)).toEqual(['toilet-1'])
    expect(east.silhouettes[0]).toMatchObject({ startMm: 1075, endMm: 1725, topMm: 780 })
    expect(east.fixtures[0]).toMatchObject({ id: 'bar', startMm: 800, endMm: 1400, referenceHeightMm: 680 })
    // Only the public-building benchmark gives a grab bar height.
    expect(east.benchmarkBands).toEqual([expect.objectContaining({ benchmarkId: 'th-public-building', minMm: 650, maxMm: 700, pendingReview: true })])
    expect(east.reachBand).toBeNull()
    project.resident.reach = { posture: 'seated', low: m(400), high: m(1200) }
    expect(buildElevation(space, 'east', project.resident, null, context)).toMatchObject({ reachBand: { lowMm: 400, highMm: 1200 }, benchmarkBands: [] })
    // The door is on the north wall, and nothing stands within 300 mm of it.
    const north = buildElevation(space, 'north', project.resident, null, context)
    expect(north.openings).toEqual([{ id: 'bathroom-door', kind: 'door', startMm: 200, endMm: 900, bottomMm: 0, topMm: 2000 }])
    // A piece 200 mm from a wall is included; 400 mm is not.
    space.items = [createCatalogItem('bath-cabinet', 'near', 'Near', 500, 375), createCatalogItem('bath-cabinet', 'far', 'Far', 1500, 575)]
    expect(buildElevation(space, 'north', project.resident, null, context).silhouettes.map((item) => item.id)).toEqual(['near'])
  })

  it('draws each fixture kind on its wall at its height and projection', () => {
    for (const entry of FIXTURE_CATALOG) {
      const fixture = createFixture(entry.kind, 'east', room, entry.kind, entry.kind, { offset: 900 })
      const bounds = new Box3().setFromObject(buildFixtureMesh(fixture, room))
      // On the east wall (x = 2 m) at 0.9 m along it, reaching into the room and no further than its length or projection.
      expect(bounds.max.x, entry.kind).toBeCloseTo(2, 3)
      expect(bounds.getCenter(new Vector3()).z, entry.kind).toBeCloseTo(0.9, 2)
      const reach = (entry.kind === 'grab-bar-fold-down' ? fixture.length.valueMm : fixture.projection.valueMm + (fixture.diameter?.valueMm ?? 0) / 2) / 1000
      expect(2 - bounds.min.x, entry.kind).toBeLessThanOrEqual(reach + 0.001)
      const height = fixture.referenceHeight.valueMm / 1000
      expect(bounds.min.y, entry.kind).toBeLessThanOrEqual(height + 0.001)
      expect(bounds.max.y, entry.kind).toBeGreaterThanOrEqual(height - 0.001)
    }
  })

  it('keeps the bathroom pieces inside their declared size and marks only seats with a seat height', () => {
    for (const entry of CATALOG.filter((candidate) => candidate.category === 'bathroom')) {
      const size = new Box3().setFromObject(buildFurnitureMesh(createCatalogItem(entry.id, entry.id, entry.id, 1000, 1000))).getSize(new Vector3())
      expect(size.x, entry.id).toBeLessThanOrEqual(entry.defaultDimensionsMm.width / 1000 + 0.001)
      expect(size.z, entry.id).toBeLessThanOrEqual(entry.defaultDimensionsMm.depth / 1000 + 0.001)
      expect(size.y, entry.id).toBeLessThanOrEqual(entry.defaultDimensionsMm.height / 1000 + 0.001)
    }
    expect(CATALOG.filter((entry) => entry.defaultSeatHeightMm !== undefined).map((entry) => entry.id)).toEqual(['toilet-seated', 'shower-seat'])
    expect(createCatalogItem('toilet-squat', 'squat', 'Squat', 0, 0).seatHeight).toBeNull()
    expect(createCatalogItem('toilet-seated', 'seated', 'Seated', 0, 0).seatHeight?.valueMm).toBe(420)
  })
})

describe('report and exports in v2', () => {
  it('reports both benchmarks, the dataset version, the disclaimer and the room type', () => {
    const project = bathroom()
    const en = buildReportData(project, 'en')
    const th = buildReportData(project, 'th')
    expect(en.roomType).toBe('bathroom')
    expect(en.benchmarks).toMatchObject({ datasetVersion: '2026.10-draft', primary: null })
    expect(en.benchmarks.sources.map((source) => source.benchmarkId)).toEqual(['th-public-building', 'th-dop-home'])
    expect(en.disclaimer).toContain('not a certification')
    expect(th.disclaimer).toContain('ไม่ใช่การรับรอง')
    const doorWidth = en.plans.current.checks.find((check) => check.ruleId === 'D01')!
    expect(doorWidth.verdicts.map((verdict) => [verdict.benchmarkId, verdict.outcome, verdict.measuredMm])).toEqual([['th-public-building', 'likely-does-not-meet', 700], ['th-dop-home', 'likely-does-not-meet', 700]])
  })

  it('leaves fall history out unless the user includes it, and flags health data on export', () => {
    const project = bathroom()
    expect(hasHealthData(project)).toBe(false)
    project.resident.falls = [{ id: 'fall-1', when: 'within-3-months', roomId: 'room-1', point: null, activity: 'toileting', note: 'at night' }]
    project.resident.reach = { posture: 'seated', low: m(400), high: m(1200) }
    expect(hasHealthData(project)).toBe(true)
    const hidden = buildReportData(project, 'en')
    expect(hidden.falls).toBeNull()
    expect(JSON.stringify(hidden.residentNeeds)).not.toContain('at night')
    expect(hidden.residentNeeds.reach?.high.valueMm).toBe(1200)
    project.report.includeFallHistory = true
    expect(buildReportData(project, 'en').falls).toEqual(project.resident.falls)
  })

  it('makes a review outdated when the benchmark dataset version differs', () => {
    const project = bathroom()
    project.review = { reviewerName: 'Advisor', reviewedAt: now, projectRevision: project.revision, benchmarkDatasetVersion: '2026.10-draft' }
    expect(getReviewStatus(project)).toBe('reviewed')
    expect(getReviewStatus(project, '2026.11')).toBe('outdated')
  })

  it('draws fixtures and wet areas in the plan SVG with escaped labels', () => {
    const project = bathroom()
    const room = getPrimaryRoom(project.current)
    room.fixtures = [createFixture('grab-bar-horizontal', 'east', room, 'bar-1', '<b>Bar</b>', { offset: 1100 })]
    room.wetZones[0].label = 'Wet & soapy'
    const svg = createPlanSvg(project.current, { locale: 'en', layoutLabel: 'Current', showOverlays: true })
    expect(svg).toContain('viewBox="0 0 2000 1800"')
    expect(svg).toContain('data-fixture-id="bar-1"')
    expect(svg).toContain('data-wet-zone-id="wet-zone-1"')
    expect(svg).toContain('&lt;b&gt;Bar&lt;/b&gt;')
    expect(svg).toContain('Wet &amp; soapy')
    expect(svg).not.toContain('<b>')
  })
})
