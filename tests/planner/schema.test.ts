import { describe, expect, it } from 'vitest'
import { getPrimaryRoom } from '../../lib/planner/layout-access'
import { validateProject } from '../../lib/planner/schema'
import type { FurnitureItem, Layout, Opening, Project } from '../../lib/planner/types'

const measurement = (valueMm: number, confidence: 'estimated' | 'measured' | 'advisor-verified' = 'estimated') => ({ valueMm, confidence })

function project(): Project {
  const item: FurnitureItem = {
    id: 'sofa-1', catalogId: 'sofa', label: 'โซฟา', center: { xMm: 3000, yMm: 4000 },
    width: measurement(2100), depth: measurement(900), height: measurement(850),
    rotationDeg: 0, finish: 'oak', obstruction: 'solid', seatHeight: null,
  }
  const layout: Layout = {
    floors: [{
      id: 'floor-1', label: '', level: 0, routes: [], turningAreas: [],
      rooms: [{
        id: 'room-1', type: 'living', label: '', origin: { xMm: 0, yMm: 0 },
        shape: { kind: 'rect', width: measurement(6000), depth: measurement(5000) }, height: measurement(2700),
        floor: { finish: 'unknown', slipResistance: 'unknown', confidence: 'estimated' },
        openings: [], items: [item], fixtures: [], wetZones: [],
      }],
    }],
  }
  return {
    schemaVersion: 2, id: 'project-1', title: 'ห้องนั่งเล่น',
    createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z', revision: 0,
    household: { province: '', provinceCode: null, activities: [], mobilityAids: [], concerns: [], assistanceNotes: '', residentPreferences: '', budgetSatang: null },
    resident: { standingHeight: null, reach: null, strongerHand: 'unknown', wheelchair: null, falls: [] },
    current: layout, proposed: null, benchmarkPolicy: null, targets: { routeWidth: null, turningDiameter: null },
    recommendations: [], review: null, report: { includeFallHistory: false },
  }
}

describe('project schema', () => {
  it('accepts a 6000 by 5000 mm room and an optionally shared item id across layouts', () => {
    const value = project()
    value.proposed = structuredClone(value.current)
    expect(validateProject(value)).toMatchObject({ ok: true })
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid measurement %s with a field path', (valueMm) => {
    const value = project()
    getPrimaryRoom(value.current).shape.width.valueMm = valueMm
    const result = validateProject(value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.paths).toContain('current.floors.0.rooms.0.shape.width.valueMm')
  })

  it('rejects more than 100 furniture items', () => {
    const value = project()
    getPrimaryRoom(value.current).items = Array.from({ length: 101 }, (_, index) => ({ ...getPrimaryRoom(value.current).items[0], id: `item-${index}` }))
    expect(validateProject(value)).toMatchObject({ ok: false })
  })

  it('rejects duplicate ids within one layout', () => {
    const value = project()
    getPrimaryRoom(value.current).items.push({ ...getPrimaryRoom(value.current).items[0] })
    expect(validateProject(value)).toMatchObject({ ok: false })
  })

  it('rejects overlapping openings on one wall', () => {
    const value = project()
    const opening: Opening = {
      id: 'door-1', kind: 'door', wall: 'north', offset: measurement(300), width: measurement(900),
      height: measurement(2100), sill: measurement(0), threshold: measurement(0), operation: 'sliding', hinge: 'start',
    }
    getPrimaryRoom(value.current).openings = [opening, { ...opening, id: 'door-2', offset: measurement(900) }]
    expect(validateProject(value)).toMatchObject({ ok: false })
  })

  it('requires verifier identity and timestamp for advisor-verified measurements', () => {
    const value = project()
    getPrimaryRoom(value.current).shape.width = measurement(6000, 'advisor-verified')
    const result = validateProject(value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.paths).toContain('current.floors.0.rooms.0.shape.width.verifiedBy')
  })

  it('rejects reversed estimate ranges', () => {
    const value = project()
    value.recommendations = [{
      id: 'rec-1', layoutId: 'proposed', title: 'เพิ่มราวจับ', reason: '', action: '', priority: 'next',
      workType: 'purchase', status: 'proposed', advisorNote: '',
      materials: { lowSatang: 20000, highSatang: 10000, sourceNote: 'ตัวอย่าง', estimatedAt: '2026-09-28T00:00:00.000Z' },
      labour: null,
    }]
    expect(validateProject(value)).toMatchObject({ ok: false })
  })
})
