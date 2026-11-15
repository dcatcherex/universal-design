import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { buildFurnitureMesh } from './furniture-mesh'
import type { Layout, Opening, PointMm } from '../types'

const WALL_THICKNESS = 0.12

export function toWorldPosition(point: PointMm, heightMm: number): { x: number; y: number; z: number } {
  return { x: point.xMm / 1000, y: heightMm / 1000, z: point.yMm / 1000 }
}

function wallOpeningIntersectsCell(opening: Opening, start: number, end: number, bottom: number, top: number) {
  const holeStart = opening.offset.valueMm / 1000
  const holeEnd = (opening.offset.valueMm + opening.width.valueMm) / 1000
  const holeBottom = opening.sill.valueMm / 1000
  const holeTop = holeBottom + opening.height.valueMm / 1000
  return start < holeEnd && end > holeStart && bottom < holeTop && top > holeBottom
}

function sortedCuts(values: number[], max: number) {
  return [...new Set([0, max, ...values])].sort((a, b) => a - b)
}

function addWall(group: Group, side: Opening['wall'], length: number, height: number, coordinate: number, openings: Opening[]) {
  const axisCuts = sortedCuts(openings.flatMap((opening) => [opening.offset.valueMm / 1000, (opening.offset.valueMm + opening.width.valueMm) / 1000]), length)
  const verticalCuts = sortedCuts(openings.flatMap((opening) => [opening.sill.valueMm / 1000, (opening.sill.valueMm + opening.height.valueMm) / 1000]), height)
  const material = new MeshStandardMaterial({ color: 0xe6dfd1, roughness: 0.92, side: 2 })
  for (let i = 0; i < axisCuts.length - 1; i++) for (let j = 0; j < verticalCuts.length - 1; j++) {
    const start = axisCuts[i], end = axisCuts[i + 1], bottom = verticalCuts[j], top = verticalCuts[j + 1]
    if (end - start < 0.001 || top - bottom < 0.001 || openings.some((opening) => wallOpeningIntersectsCell(opening, start, end, bottom, top))) continue
    const along = end - start
    const tall = top - bottom
    const mesh = new Mesh(side === 'north' || side === 'south'
      ? new BoxGeometry(along, tall, WALL_THICKNESS)
      : new BoxGeometry(WALL_THICKNESS, tall, along), material)
    mesh.name = `wall-${side}`
    const center = (start + end) / 2
    if (side === 'north') mesh.position.set(center, (bottom + top) / 2, coordinate - WALL_THICKNESS / 2)
    if (side === 'south') mesh.position.set(center, (bottom + top) / 2, coordinate + WALL_THICKNESS / 2)
    if (side === 'west') mesh.position.set(coordinate - WALL_THICKNESS / 2, (bottom + top) / 2, center)
    if (side === 'east') mesh.position.set(coordinate + WALL_THICKNESS / 2, (bottom + top) / 2, center)
    mesh.castShadow = true
    mesh.receiveShadow = false
    mesh.userData.ownedMaterial = material
    group.add(mesh)
  }
}

export function buildRoomScene(layout: Layout): Group {
  const group = new Group()
  group.name = 'room-scene'
  const width = layout.room.width.valueMm / 1000
  const depth = layout.room.depth.valueMm / 1000
  const height = layout.room.height.valueMm / 1000
  const floorMaterial = new MeshStandardMaterial({ color: 0xd5cbb9, roughness: 0.96 })
  const floor = new Mesh(new BoxGeometry(width, 0.08, depth), floorMaterial)
  floor.name = 'room-floor'
  floor.position.set(width / 2, -0.04, depth / 2)
  floor.receiveShadow = true
  floor.userData.ownedMaterial = floorMaterial
  group.add(floor)

  const north = layout.openings.filter((opening) => opening.wall === 'north')
  const south = layout.openings.filter((opening) => opening.wall === 'south')
  const east = layout.openings.filter((opening) => opening.wall === 'east')
  const west = layout.openings.filter((opening) => opening.wall === 'west')
  addWall(group, 'north', width, height, 0, north)
  addWall(group, 'south', width, height, depth, south)
  addWall(group, 'east', depth, height, width, east)
  addWall(group, 'west', depth, height, 0, west)
  for (const item of layout.items) group.add(buildFurnitureMesh(item))
  return group
}

export { buildFurnitureMesh }
