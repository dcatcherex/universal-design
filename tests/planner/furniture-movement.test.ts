import { describe, expect, it } from 'vitest'
import { createExampleProject } from '../../lib/planner/fixtures'
import { getPrimaryRoom } from '../../lib/planner/layout-access'
import { moveFurnitureInLayout, snapToGridMm } from '../../lib/planner/furniture-movement'

describe('furniture movement helpers', () => {
  it('snaps floor movement to 50 mm increments', () => {
    expect(snapToGridMm(124)).toBe(100)
    expect(snapToGridMm(126)).toBe(150)
  })

  it('shares room-bound validation and layout construction for furniture moves', () => {
    const layout = createExampleProject('2026-11-17T00:00:00.000Z').current
    const moved = moveFurnitureInLayout(layout, 'coffee-table-1', { xMm: 3500, yMm: 1500 })
    expect(moved.ok).toBe(true)
    if (moved.ok) expect(getPrimaryRoom(moved.layout).items.find((item) => item.id === 'coffee-table-1')?.center).toEqual({ xMm: 3500, yMm: 1500 })
    expect(getPrimaryRoom(layout).items.find((item) => item.id === 'coffee-table-1')?.center).toEqual({ xMm: 3000, yMm: 500 })

    expect(moveFurnitureInLayout(layout, 'coffee-table-1', { xMm: 5900, yMm: 500 })).toEqual({ ok: false, reason: 'out-of-bounds' })
  })
})
