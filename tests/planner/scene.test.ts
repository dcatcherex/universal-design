import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { getPrimaryRoom } from '../../lib/planner/layout-access'
import { CATALOG } from '../../lib/planner/catalog'
import { createExampleProject } from '../../lib/planner/fixtures'
import { buildFurnitureMesh, buildRoomScene, toWorldPosition } from '../../lib/planner/scene/build-scene'
import type { FurnitureItem } from '../../lib/planner/types'

const now = '2026-09-28T00:00:00.000Z'

function itemFor(catalogId: string, dimensions = CATALOG.find((entry) => entry.id === catalogId)!.defaultDimensionsMm): FurnitureItem {
  return {
    id: catalogId, catalogId, label: catalogId, center: { xMm: 1000, yMm: 2000 },
    width: { valueMm: dimensions.width, confidence: 'estimated' },
    depth: { valueMm: dimensions.depth, confidence: 'estimated' },
    height: { valueMm: dimensions.height, confidence: 'estimated' },
    rotationDeg: 0, finish: 'oak', obstruction: catalogId === 'rug' ? 'rug' : 'solid',
  }
}

describe('shared 3D scene geometry', () => {
  it('maps room millimetres to metres on the shared x/z floor plane', () => {
    expect(toWorldPosition({ xMm: 1000, yMm: 2000 }, 0)).toEqual({ x: 1, y: 0, z: 2 })
  })

  it.each([0, 90] as const)('keeps furniture extents true to its 2D footprint at %i degrees', (rotationDeg) => {
    const item = { ...itemFor('coffee-table'), rotationDeg }
    const bounds = new Box3().setFromObject(buildFurnitureMesh(item))
    const size = bounds.getSize(new Vector3())
    const [expectedX, expectedZ] = rotationDeg === 0 ? [1.1, 0.6] : [0.6, 1.1]
    expect(size.x).toBeCloseTo(expectedX, 3)
    expect(size.z).toBeCloseTo(expectedZ, 3)
    expect(size.y).toBeCloseTo(0.45, 3)
  })

  it('keeps all catalog parts inside their declared width, depth and height', () => {
    for (const entry of CATALOG) {
      const bounds = new Box3().setFromObject(buildFurnitureMesh(itemFor(entry.id)))
      expect(bounds.getSize(new Vector3()).x, entry.id).toBeLessThanOrEqual(entry.defaultDimensionsMm.width / 1000 + 0.001)
      expect(bounds.getSize(new Vector3()).z, entry.id).toBeLessThanOrEqual(entry.defaultDimensionsMm.depth / 1000 + 0.001)
      expect(bounds.getSize(new Vector3()).y, entry.id).toBeLessThanOrEqual(entry.defaultDimensionsMm.height / 1000 + 0.001)
    }
  })

  it('leaves the example doorway and window volumes open in the wall geometry', () => {
    const layout = createExampleProject(now).current
    const scene = buildRoomScene(layout)
    const walls = scene.children.filter((child) => child.name.startsWith('wall-'))
    expect(walls.length).toBeGreaterThanOrEqual(6)

    const doorway = getPrimaryRoom(layout).openings.find((opening) => opening.kind === 'door')!
    const window = getPrimaryRoom(layout).openings.find((opening) => opening.kind === 'window')!
    for (const wall of walls) {
      const bounds = new Box3().setFromObject(wall)
      const doorOpeningPoint = new Vector3((doorway.offset.valueMm + doorway.width.valueMm / 2) / 1000, doorway.height.valueMm / 2000, -0.06)
      const windowOpeningPoint = new Vector3((window.offset.valueMm + window.width.valueMm / 2) / 1000, (window.sill.valueMm + window.height.valueMm / 2) / 1000, 5.06)
      expect(bounds.containsPoint(doorOpeningPoint)).toBe(false)
      expect(bounds.containsPoint(windowOpeningPoint)).toBe(false)
    }
  })

  it.each(['north', 'east', 'south', 'west'] as const)('cuts a window through the %s wall at its measured offset and height', (wall) => {
    const layout = structuredClone(createExampleProject(now).current)
    getPrimaryRoom(layout).openings = [{
      id: `window-${wall}`, kind: 'window', wall, offset: { valueMm: 300, confidence: 'measured' },
      width: { valueMm: 900, confidence: 'measured' }, height: { valueMm: 900, confidence: 'measured' },
      sill: { valueMm: 900, confidence: 'measured' }, threshold: { valueMm: 0, confidence: 'measured' },
    }]
    const sample = wall === 'north' ? new Vector3(0.75, 1.35, -0.06)
      : wall === 'south' ? new Vector3(0.75, 1.35, 5.06)
        : wall === 'east' ? new Vector3(6.06, 1.35, 0.75)
          : new Vector3(-0.06, 1.35, 0.75)
    const intersectingWalls = buildRoomScene(layout).children.filter((child) => child.name === `wall-${wall}`)
    expect(intersectingWalls.length).toBeGreaterThan(0)
    expect(intersectingWalls.some((wallMesh) => new Box3().setFromObject(wallMesh).containsPoint(sample))).toBe(false)
  })
})
