import { describe, expect, it } from 'vitest'
import { evaluateWithMove } from '../../lib/planner/checks'
import { moveEntity, moveEntityInRoom, snapToGridMm } from '../../lib/planner/entity-movement'
import { createBathroomExampleProject, createExampleProject } from '../../lib/planner/fixtures'
import { createFixture } from '../../lib/planner/fixtures-catalog'
import { getPrimaryRoom } from '../../lib/planner/layout-access'

const now = '2026-11-17T00:00:00.000Z'

function bathroomRoom() {
  const project = createBathroomExampleProject(now)
  return { project, room: getPrimaryRoom(project.current) }
}

describe('entity movement', () => {
  it('snaps floor movement to 50 mm increments', () => {
    expect(snapToGridMm(124)).toBe(100)
    expect(snapToGridMm(126)).toBe(150)
  })

  it('moves furniture within the room and rejects outside or unknown items', () => {
    const layout = createExampleProject(now).current
    const moved = moveEntity(layout, 'coffee-table-1', { xMm: 3500, yMm: 1500 })
    expect(moved.ok).toBe(true)
    if (moved.ok) expect(getPrimaryRoom(moved.layout).items.find((item) => item.id === 'coffee-table-1')?.center).toEqual({ xMm: 3500, yMm: 1500 })
    expect(getPrimaryRoom(layout).items.find((item) => item.id === 'coffee-table-1')?.center).toEqual({ xMm: 3000, yMm: 500 })

    expect(moveEntity(layout, 'coffee-table-1', { xMm: 5900, yMm: 500 })).toEqual({ ok: false, reason: 'out-of-bounds' })
    expect(moveEntity(layout, 'missing-item', { xMm: 1000, yMm: 1000 })).toEqual({ ok: false, reason: 'not-found' })
  })

  it('moves a wall fixture, rounding values and resetting both measurements to estimated', () => {
    const { project, room } = bathroomRoom()
    const fixture = createFixture('switch', 'north', room, 'switch-1', 'Switch', { offset: 1500, referenceHeight: 1200 })
    fixture.offset = { valueMm: 1500, confidence: 'measured' }
    fixture.referenceHeight = { valueMm: 1200, confidence: 'measured' }
    room.fixtures = [fixture]

    const moved = moveEntity(project.current, 'switch-1', { offsetMm: 1504.6, heightMm: 1199.4 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    const result = getPrimaryRoom(moved.layout).fixtures.find((candidate) => candidate.id === 'switch-1')!
    expect(result.offset).toEqual({ valueMm: 1505, confidence: 'estimated' })
    expect(result.referenceHeight).toEqual({ valueMm: 1199, confidence: 'estimated' })
    expect(room.fixtures[0].offset.confidence).toBe('measured')
  })

  it('rejects a fixture move outside the wall, over an opening, or for an unknown fixture', () => {
    const { room } = bathroomRoom()
    room.fixtures = [createFixture('switch', 'north', room, 'switch-1', 'Switch', { offset: 1500, referenceHeight: 1200 })]

    expect(moveEntityInRoom(room, 'switch-1', { offsetMm: 5000, heightMm: 1200 })).toEqual({ ok: false, reason: 'outside-wall' })
    expect(moveEntityInRoom(room, 'switch-1', { offsetMm: 1500, heightMm: -50 })).toEqual({ ok: false, reason: 'outside-wall' })
    expect(moveEntityInRoom(room, 'switch-1', { offsetMm: 300, heightMm: 1200 })).toEqual({ ok: false, reason: 'over-opening' })
    expect(moveEntityInRoom(room, 'missing-fixture', { offsetMm: 1500, heightMm: 1200 })).toEqual({ ok: false, reason: 'not-found' })
  })

  it('previews a fixture move through evaluateWithMove without mutating the project', () => {
    const { project, room } = bathroomRoom()
    room.fixtures = [createFixture('basin', 'south', room, 'basin-1', 'Basin', { offset: 1000, referenceHeight: 700 })]
    const before = structuredClone(project)

    const movedResults = evaluateWithMove(project, 'current', 'basin-1', { offsetMm: 1000, heightMm: 900 })
    expect(project).toEqual(before)
    expect(movedResults.find((result) => result.ruleId === 'B04' && result.entityIds.includes('basin-1'))?.measuredMm).toBe(900)
    expect(evaluateWithMove(project, 'current', 'missing-fixture', { offsetMm: 1000, heightMm: 900 }))
      .toEqual(evaluateWithMove(project, 'current', 'basin-1', { offsetMm: 1000, heightMm: 700 }))
  })
})
