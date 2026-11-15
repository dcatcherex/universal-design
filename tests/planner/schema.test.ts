import { describe, expect, it } from 'vitest'
import { validateProject } from '../../lib/planner/schema'
import type { FurnitureItem, Layout, Opening, Project } from '../../lib/planner/types'

const measurement = (valueMm: number, confidence: 'estimated' | 'measured' | 'advisor-verified' = 'estimated') => ({ valueMm, confidence })

function project(): Project {
  const room = {
    width: measurement(6000),
    depth: measurement(5000),
    height: measurement(2700),
  }
  const item: FurnitureItem = {
    id: 'sofa-1', catalogId: 'sofa', label: 'โซฟา', center: { xMm: 3000, yMm: 4000 },
    width: measurement(2100), depth: measurement(900), height: measurement(850),
    rotationDeg: 0, finish: 'oak', obstruction: 'solid',
  }
  const layout: Layout = { room, openings: [], items: [item], routes: [], turningAreas: [] }
  return {
    schemaVersion: 1, id: 'project-1', title: 'ห้องนั่งเล่น',
    createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z', revision: 0,
    household: { province: '', activities: [], mobilityAids: [], concerns: [], assistanceNotes: '', residentPreferences: '', budgetSatang: null },
    current: layout, proposed: null, targets: { routeWidth: null, turningDiameter: null },
    recommendations: [], review: null,
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
    value.current.room.width.valueMm = valueMm
    const result = validateProject(value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.paths).toContain('current.room.width.valueMm')
  })

  it('rejects more than 100 furniture items', () => {
    const value = project()
    value.current.items = Array.from({ length: 101 }, (_, index) => ({ ...value.current.items[0], id: `item-${index}` }))
    expect(validateProject(value)).toMatchObject({ ok: false })
  })

  it('rejects duplicate ids within one layout', () => {
    const value = project()
    value.current.items.push({ ...value.current.items[0] })
    expect(validateProject(value)).toMatchObject({ ok: false })
  })

  it('rejects overlapping openings on one wall', () => {
    const value = project()
    const opening: Opening = {
      id: 'door-1', kind: 'door', wall: 'north', offset: measurement(300), width: measurement(900),
      height: measurement(2100), sill: measurement(0), threshold: measurement(0), operation: 'sliding',
    }
    value.current.openings = [opening, { ...opening, id: 'door-2', offset: measurement(900) }]
    expect(validateProject(value)).toMatchObject({ ok: false })
  })

  it('requires verifier identity and timestamp for advisor-verified measurements', () => {
    const value = project()
    value.current.room.width = measurement(6000, 'advisor-verified')
    const result = validateProject(value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.paths).toContain('current.room.width.verifiedBy')
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
