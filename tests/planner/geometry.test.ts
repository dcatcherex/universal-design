import { describe, expect, it } from 'vitest'
import { capsuleIntersectsRect, circleIntersectsRect, getDoorSector, getFootprint, isWithinRoom, rectanglesOverlap, sectorIntersectsRect } from '../../lib/planner/geometry'
import type { FurnitureItem, Opening } from '../../lib/planner/types'

const m = (valueMm: number) => ({ valueMm, confidence: 'estimated' as const })
const room = { shape: { kind: 'rect' as const, width: m(6000), depth: m(5000) } }
const item = (xMm = 1000, yMm = 1000, rotationDeg: FurnitureItem['rotationDeg'] = 90): FurnitureItem => ({
  id: 'item', catalogId: 'custom-block', label: 'block', center: { xMm, yMm }, width: m(800), depth: m(400), height: m(600),
  rotationDeg, finish: 'oak', obstruction: 'solid',
})

describe('shared millimetre geometry', () => {
  it('rotates a rectangular footprint by swapping its dimensions', () => {
    expect(getFootprint(item())).toEqual({ minX: 800, minY: 600, maxX: 1200, maxY: 1400 })
  })
  it('treats exact edge contact as non-overlap and a 1 mm intrusion as overlap', () => {
    expect(rectanglesOverlap({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, { minX: 1000, minY: 0, maxX: 2000, maxY: 1000 })).toBe(false)
    expect(rectanglesOverlap({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, { minX: 999, minY: 0, maxX: 2000, maxY: 1000 })).toBe(true)
  })
  it('accepts room-edge contact and rejects a footprint outside the room', () => {
    expect(isWithinRoom({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, room)).toBe(true)
    expect(isWithinRoom({ minX: -1, minY: 0, maxX: 1000, maxY: 1000 }, room)).toBe(false)
  })
  it.each([
    ['north', 'start', { xMm: 300, yMm: 0 }, 0, 90], ['north', 'end', { xMm: 1200, yMm: 0 }, 180, -90],
    ['south', 'start', { xMm: 300, yMm: 5000 }, 0, -90], ['south', 'end', { xMm: 1200, yMm: 5000 }, 180, 90],
    ['west', 'start', { xMm: 0, yMm: 300 }, 90, -90], ['west', 'end', { xMm: 0, yMm: 1200 }, 270, 90],
    ['east', 'start', { xMm: 6000, yMm: 300 }, 90, 90], ['east', 'end', { xMm: 6000, yMm: 1200 }, 270, -90],
  ] as const)('derives inward door swing for %s wall, %s hinge', (wall, hinge, hingePoint, startAngleDeg, sweepDeg) => {
    const door: Opening = { id: 'door', kind: 'door', wall, offset: m(300), width: m(900), height: m(2100), sill: m(0), threshold: m(0), operation: 'hinged-in', hinge }
    expect(getDoorSector(door, room)).toEqual({ hinge: hingePoint, radiusMm: 900, startAngleDeg, sweepDeg })
  })
  it('detects an arc-only collision but not a rectangle just outside the swing', () => {
    const sector = { hinge: { xMm: 1000, yMm: 1000 }, radiusMm: 1000, startAngleDeg: 0, sweepDeg: 90 as const }
    expect(sectorIntersectsRect(sector, { minX: 1650, minY: 1650, maxX: 1750, maxY: 1750 })).toBe(true)
    expect(sectorIntersectsRect(sector, { minX: 1900, minY: 1900, maxX: 1950, maxY: 1950 })).toBe(false)
  })
  it('detects round corridor endcaps, with tangency clear and 1 mm intrusion blocked', () => {
    expect(capsuleIntersectsRect({ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, 100, { minX: 500, minY: 99, maxX: 600, maxY: 200 })).toBe(true)
    expect(capsuleIntersectsRect({ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, 100, { minX: 500, minY: 100, maxX: 600, maxY: 200 })).toBe(false)
    expect(capsuleIntersectsRect({ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, 100, { minX: -50, minY: 50, maxX: 0, maxY: 150 })).toBe(true)
  })
  it('uses strict circle and rectangle overlap at tangency', () => {
    expect(circleIntersectsRect({ xMm: 0, yMm: 0 }, 100, { minX: 100, minY: -10, maxX: 150, maxY: 10 })).toBe(false)
    expect(circleIntersectsRect({ xMm: 0, yMm: 0 }, 100, { minX: 99, minY: -10, maxX: 150, maxY: 10 })).toBe(true)
  })
})
