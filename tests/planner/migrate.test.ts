import { describe, expect, it } from 'vitest'
import { createExampleProject } from '../../lib/planner/fixtures'
import { getReviewStatus } from '../../lib/planner/history'
import { getPrimaryFloor, getPrimaryRoom, toFloorPoint, toRoomPoint, withPrimaryRoom } from '../../lib/planner/layout-access'
import { migrateProject } from '../../lib/planner/migrate'
import { decodeProject } from '../../lib/planner/project-files'
import { LEGACY_PROJECT_STORAGE_KEY, loadProject, PROJECT_STORAGE_KEY, saveProject, type StoragePort } from '../../lib/planner/storage'

const now = '2026-09-28T00:00:00.000Z'
const m = (valueMm: number) => ({ valueMm, confidence: 'estimated' })

/** A project exactly as v1 wrote it, with costs, a target, a review and a verified measurement. */
function v1Project(province = 'เชียงใหม่') {
  const layout = {
    room: { width: { valueMm: 6000, confidence: 'advisor-verified', verifiedBy: 'Advisor', verifiedAt: now }, depth: m(5000), height: m(2700) },
    openings: [
      { id: 'entry-door', kind: 'door', wall: 'north', offset: m(300), width: m(900), height: m(2100), sill: m(0), threshold: m(0), operation: 'hinged-in', hinge: 'start' },
      { id: 'south-window', kind: 'window', wall: 'south', offset: m(2400), width: m(1200), height: m(1200), sill: m(900), threshold: m(0) },
    ],
    items: [
      { id: 'sofa-1', catalogId: 'sofa', label: 'โซฟา', center: { xMm: 3000, yMm: 4200 }, width: m(2100), depth: m(900), height: m(850), rotationDeg: 0, finish: 'sage', obstruction: 'solid' },
      { id: 'coffee-table-1', catalogId: 'coffee-table', label: 'โต๊ะกลาง', center: { xMm: 3000, yMm: 500 }, width: m(1100), depth: m(600), height: m(450), rotationDeg: 90, finish: 'oak', obstruction: 'solid' },
    ],
    routes: [{ id: 'example-route', label: 'Route', points: [{ xMm: 500, yMm: 500 }, { xMm: 5500, yMm: 500 }], widthMm: 1000 }],
    turningAreas: [{ id: 'turn-1', label: 'Turn', center: { xMm: 3000, yMm: 2500 }, diameterMm: null }],
  }
  return {
    schemaVersion: 1, id: 'v1-project', title: 'โครงการเดิม', createdAt: now, updatedAt: now, revision: 4,
    household: { province, activities: ['ดูทีวี'], mobilityAids: ['ไม้เท้า'], concerns: ['rugs'], assistanceNotes: '', residentPreferences: 'ชอบนั่งริมหน้าต่าง', budgetSatang: 500000 },
    current: layout, proposed: structuredClone(layout),
    targets: { routeWidth: { valueMm: 900, rationale: 'For this household', enteredBy: 'Advisor', enteredAt: now }, turningDiameter: null },
    recommendations: [{
      id: 'rec-1', layoutId: 'proposed', entityId: 'coffee-table-1', title: 'ย้ายโต๊ะ', reason: 'ขวางทางเดิน', action: 'ย้ายไปกลางห้อง', priority: 'now',
      workType: 'rearrange', status: 'accepted', advisorNote: '', materials: { lowSatang: 10000, highSatang: 20000, sourceNote: 'ร้านใกล้บ้าน', estimatedAt: now }, labour: null,
    }],
    review: { reviewerName: 'Advisor', reviewedAt: now, projectRevision: 4 },
  }
}

describe('v1 to v2 migration', () => {
  it('keeps geometry, recommendations and costs identical', () => {
    const v1 = v1Project()
    const result = migrateProject(v1)
    if (!result.ok) throw new Error(result.error.paths.join(', '))
    const project = result.value
    expect(project.schemaVersion).toBe(2)
    for (const layoutId of ['current', 'proposed'] as const) {
      const room = getPrimaryRoom(project[layoutId]!)
      const floor = getPrimaryFloor(project[layoutId]!)
      expect(room.type).toBe('living')
      expect(room.origin).toEqual({ xMm: 0, yMm: 0 })
      expect(room.shape.width.valueMm).toBe(6000)
      expect(room.shape.depth.valueMm).toBe(5000)
      expect(room.height.valueMm).toBe(2700)
      expect(room.items.map((item) => [item.id, item.center, item.width.valueMm, item.depth.valueMm, item.rotationDeg])).toEqual(v1[layoutId].items.map((item) => [item.id, item.center, item.width.valueMm, item.depth.valueMm, item.rotationDeg]))
      expect(room.openings.map((opening) => [opening.id, opening.offset.valueMm, opening.width.valueMm])).toEqual(v1[layoutId].openings.map((opening) => [opening.id, opening.offset.valueMm, opening.width.valueMm]))
      expect(floor.routes).toEqual(v1[layoutId].routes)
      expect(floor.turningAreas).toEqual(v1[layoutId].turningAreas)
      expect(room.fixtures).toEqual([])
      expect(room.wetZones).toEqual([])
      expect(room.floor).toEqual({ finish: 'unknown', slipResistance: 'unknown', confidence: 'estimated' })
    }
    expect(project.recommendations).toEqual(v1.recommendations)
    expect(project.targets).toEqual(v1.targets)
    expect(project.revision).toBe(4)
  })

  it('fills the v2 additions with their defaults', () => {
    const result = migrateProject(v1Project())
    if (!result.ok) throw new Error(result.error.paths.join(', '))
    const door = getPrimaryRoom(result.value.current).openings[0]
    expect(door.handle).toBeNull()
    expect(door.connectsToRoomId).toBeNull()
    expect(door.operation).toBe('hinged-in')
    expect(result.value.resident).toEqual({ standingHeight: null, reach: null, strongerHand: 'unknown', wheelchair: null, falls: [], needs: [] })
    expect(result.value.benchmarkPolicy).toBeNull()
    expect(result.value.report).toEqual({ includeFallHistory: false })
  })

  it('marks a verified v1 measurement as verified by an unspecified method', () => {
    const result = migrateProject(v1Project())
    if (!result.ok) throw new Error(result.error.paths.join(', '))
    expect(getPrimaryRoom(result.value.current).shape.width).toMatchObject({ confidence: 'advisor-verified', verificationMethod: 'unspecified', verifiedBy: 'Advisor' })
  })

  it('keeps the old review as a record but never as current', () => {
    const result = migrateProject(v1Project())
    if (!result.ok) throw new Error(result.error.paths.join(', '))
    expect(result.value.review).toMatchObject({ reviewerName: 'Advisor', projectRevision: 4, benchmarkDatasetVersion: 'none' })
    expect(getReviewStatus(result.value)).toBe('outdated')
  })

  it('matches a province name exactly and otherwise keeps the free text', () => {
    const matched = migrateProject(v1Project('เชียงใหม่'))
    const english = migrateProject(v1Project('Chiang Mai'))
    const unmatched = migrateProject(v1Project('แถวบ้านยาย'))
    expect(matched.ok && matched.value.household.provinceCode).toBe('50')
    expect(english.ok && english.value.household.provinceCode).toBe('50')
    expect(unmatched.ok && unmatched.value.household).toMatchObject({ provinceCode: null, province: 'แถวบ้านยาย' })
  })

  it('returns a v2 document unchanged and does not modify its input', () => {
    const v2 = createExampleProject(now)
    expect(migrateProject(structuredClone(v2))).toEqual({ ok: true, value: v2 })
    const v1 = v1Project()
    const before = JSON.stringify(v1)
    migrateProject(v1)
    expect(JSON.stringify(v1)).toBe(before)
  })

  it('rejects a future version, an unknown version and a broken v1 document', () => {
    expect(migrateProject({ ...createExampleProject(now), schemaVersion: 3 })).toMatchObject({ ok: false, error: { code: 'future-version' } })
    expect(migrateProject({ schemaVersion: 'one' })).toMatchObject({ ok: false })
    expect(migrateProject({ schemaVersion: 1, current: null })).toMatchObject({ ok: false })
    expect(migrateProject(null)).toMatchObject({ ok: false })
  })

  it('upgrades a v1 project file on import', () => {
    const result = decodeProject(JSON.stringify(v1Project()))
    expect(result.ok && result.value.schemaVersion).toBe(2)
  })
})

describe('storage upgrade from v1', () => {
  function storage(entries: Record<string, string>): StoragePort & { entries: Record<string, string> } {
    return { entries, getItem(key) { return this.entries[key] ?? null }, setItem(key, value) { this.entries[key] = value } }
  }

  it('reads the v1 entry when there is no v2 entry, and never writes or removes it', () => {
    const legacy = JSON.stringify({ storageVersion: 1, writeToken: 'old-token', project: v1Project() })
    const store = storage({ [LEGACY_PROJECT_STORAGE_KEY]: legacy })
    const loaded = loadProject(store)
    if (!loaded.ok || !loaded.value) throw new Error('expected an upgraded project')
    expect(loaded.value.upgradedFromV1).toBe(true)
    expect(loaded.value.project.schemaVersion).toBe(2)
    // The first save goes to the v2 key and expects nothing there yet.
    expect(saveProject(store, loaded.value.project, null, 'new-token').ok).toBe(true)
    expect(store.entries[LEGACY_PROJECT_STORAGE_KEY]).toBe(legacy)
    expect(JSON.parse(store.entries[PROJECT_STORAGE_KEY]).project.schemaVersion).toBe(2)
    expect(loadProject(store)).toMatchObject({ ok: true, value: { writeToken: 'new-token' } })
    expect(loadProject(store).ok && (loadProject(store) as { value: { upgradedFromV1?: boolean } }).value.upgradedFromV1).toBeFalsy()
  })

  it('reports a corrupt v2 entry without touching a valid v1 entry', () => {
    const legacy = JSON.stringify({ storageVersion: 1, writeToken: 'old-token', project: v1Project() })
    const store = storage({ [LEGACY_PROJECT_STORAGE_KEY]: legacy, [PROJECT_STORAGE_KEY]: '{ broken' })
    expect(loadProject(store)).toMatchObject({ ok: false, error: { code: 'storage-corrupt' } })
    expect(store.entries[LEGACY_PROJECT_STORAGE_KEY]).toBe(legacy)
  })
})

describe('layout access helpers', () => {
  it('converts between room and floor coordinates with a non-zero origin', () => {
    const room = { origin: { xMm: 4000, yMm: 1500 } }
    expect(toFloorPoint(room, { xMm: 250, yMm: 300 })).toEqual({ xMm: 4250, yMm: 1800 })
    expect(toRoomPoint(room, { xMm: 4250, yMm: 1800 })).toEqual({ xMm: 250, yMm: 300 })
    expect(toRoomPoint(room, toFloorPoint(room, { xMm: -10, yMm: 0 }))).toEqual({ xMm: -10, yMm: 0 })
  })

  it('updates the primary room without changing the input layout', () => {
    const layout = createExampleProject(now).current
    const next = withPrimaryRoom(layout, (room) => ({ ...room, items: [] }))
    expect(getPrimaryRoom(next).items).toEqual([])
    expect(getPrimaryRoom(layout).items).toHaveLength(2)
    expect(getPrimaryFloor(next).routes).toEqual(getPrimaryFloor(layout).routes)
  })
})
