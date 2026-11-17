import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Material } from 'three'
import { buildFixtureMesh } from './fixture-mesh'
import { buildFurnitureMesh } from './furniture-mesh'
import { getPrimaryRoom } from '../layout-access'
import type { Layout, Opening, PointMm } from '../types'

const WALL_THICKNESS = 0.12
const PLANK_WIDTH = 0.16
const PLANK_GAP = 0.004
const PLANK_COLORS = [0xe3c9a0, 0xdcc096, 0xe8d0a9, 0xd9bc90]

export function toWorldPosition(point: PointMm, heightMm: number): { x: number; y: number; z: number } {
  return { x: point.xMm / 1000, y: heightMm / 1000, z: point.yMm / 1000 }
}

export function toRoomPoint(point: { x: number; z: number }): PointMm {
  return { xMm: point.x * 1000, yMm: point.z * 1000 }
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

/** Places a box on a wall: `along` runs along the wall, `across` through its thickness. */
function wallBox(side: Opening['wall'], coordinate: number, alongCenter: number, yCenter: number, along: number, tall: number, across: number, material: Material) {
  const northSouth = side === 'north' || side === 'south'
  const mesh = new Mesh(northSouth ? new BoxGeometry(along, tall, across) : new BoxGeometry(across, tall, along), material)
  const outward = side === 'north' || side === 'west' ? -1 : 1
  const offset = coordinate + outward * WALL_THICKNESS / 2
  if (northSouth) mesh.position.set(alongCenter, yCenter, offset)
  else mesh.position.set(offset, yCenter, alongCenter)
  return mesh
}

function addWall(group: Group, side: Opening['wall'], length: number, height: number, coordinate: number, openings: Opening[]) {
  const axisCuts = sortedCuts(openings.flatMap((opening) => [opening.offset.valueMm / 1000, (opening.offset.valueMm + opening.width.valueMm) / 1000]), length)
  const verticalCuts = sortedCuts(openings.flatMap((opening) => [opening.sill.valueMm / 1000, (opening.sill.valueMm + opening.height.valueMm) / 1000]), height)
  const material = new MeshStandardMaterial({ color: 0xf8f6f1, roughness: 0.95, side: 2 })
  for (let i = 0; i < axisCuts.length - 1; i++) for (let j = 0; j < verticalCuts.length - 1; j++) {
    const start = axisCuts[i], end = axisCuts[i + 1], bottom = verticalCuts[j], top = verticalCuts[j + 1]
    if (end - start < 0.001 || top - bottom < 0.001 || openings.some((opening) => wallOpeningIntersectsCell(opening, start, end, bottom, top))) continue
    const mesh = wallBox(side, coordinate, (start + end) / 2, (bottom + top) / 2, end - start, top - bottom, WALL_THICKNESS, material)
    mesh.name = `wall-${side}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.ownedMaterial = material
    group.add(mesh)
  }
}

/** Frames and glass are decoration only: they sit inside the wall thickness and never enter the room. */
function addOpeningTrim(group: Group, side: Opening['wall'], coordinate: number, opening: Opening) {
  const start = opening.offset.valueMm / 1000
  const width = opening.width.valueMm / 1000
  const bottom = opening.sill.valueMm / 1000
  const tall = opening.height.valueMm / 1000
  const bar = 0.05
  const depth = WALL_THICKNESS * 0.8
  const frame = new MeshStandardMaterial({ color: 0xdcc49d, roughness: 0.7 })
  const glass = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.38 })
  const trim = new Group()
  trim.name = `opening-trim-${opening.id}`
  trim.userData.wall = side
  trim.userData.openingId = opening.id
  const part = (alongCenter: number, yCenter: number, along: number, partTall: number, across: number, material: Material) => {
    if (along <= 0 || partTall <= 0) return
    const mesh = wallBox(side, coordinate, alongCenter, yCenter, along, partTall, across, material)
    mesh.name = 'opening-trim'
    mesh.userData.openingId = opening.id
    trim.add(mesh)
  }
  part(start + bar / 2, bottom + tall / 2, bar, tall, depth, frame)
  part(start + width - bar / 2, bottom + tall / 2, bar, tall, depth, frame)
  part(start + width / 2, bottom + tall - bar / 2, width - bar * 2, bar, depth, frame)
  if (opening.kind === 'window') {
    part(start + width / 2, bottom + bar / 2, width - bar * 2, bar, depth, frame)
    if (width > 0.9) part(start + width / 2, bottom + tall / 2, bar * 0.7, tall - bar * 2, depth, frame)
    part(start + width / 2, bottom + tall / 2, width - bar * 2, tall - bar * 2, 0.012, glass)
  }
  group.add(trim)
}

function addFloor(group: Group, width: number, depth: number) {
  const slabMaterial = new MeshStandardMaterial({ color: 0xc9ad84, roughness: 0.9 })
  const slab = new Mesh(new BoxGeometry(width, 0.08, depth), slabMaterial)
  slab.name = 'room-floor'
  slab.position.set(width / 2, -0.04, depth / 2)
  slab.receiveShadow = true
  slab.userData.ownedMaterial = slabMaterial
  group.add(slab)

  // Wood planks sit a hair above the slab, so the slab shows through as the seams.
  const planks = new Group()
  planks.name = 'room-floor-planks'
  const materials = PLANK_COLORS.map((color) => new MeshStandardMaterial({ color, roughness: 0.78 }))
  const count = Math.max(1, Math.round(depth / PLANK_WIDTH))
  const pitch = depth / count
  for (let i = 0; i < count; i++) {
    const plank = new Mesh(new BoxGeometry(width, 0.01, pitch - PLANK_GAP), materials[(i * 7 + (i >> 1)) % materials.length])
    plank.name = 'room-floor-plank'
    plank.position.set(width / 2, -0.004, pitch * (i + 0.5))
    plank.receiveShadow = true
    planks.add(plank)
  }
  group.add(planks)
}

export function buildRoomScene(layout: Layout): Group {
  const group = new Group()
  group.name = 'room-scene'
  const room = getPrimaryRoom(layout)
  const width = room.shape.width.valueMm / 1000
  const depth = room.shape.depth.valueMm / 1000
  const height = room.height.valueMm / 1000
  addFloor(group, width, depth)

  const walls: [Opening['wall'], number, number][] = [['north', width, 0], ['south', width, depth], ['east', depth, width], ['west', depth, 0]]
  for (const [side, length, coordinate] of walls) {
    const openings = room.openings.filter((opening) => opening.wall === side)
    addWall(group, side, length, height, coordinate, openings)
    for (const opening of openings) addOpeningTrim(group, side, coordinate, opening)
  }
  for (const item of room.items) group.add(buildFurnitureMesh(item))
  for (const fixture of room.fixtures) group.add(buildFixtureMesh(fixture, room))
  for (const zone of room.wetZones) {
    // A thin tinted slab marks the wet area on the floor.
    const zoneMaterial = new MeshStandardMaterial({ color: 0x7fa9c4, roughness: 0.4, transparent: true, opacity: 0.32 })
    const slab = new Mesh(new BoxGeometry((zone.rect.maxX - zone.rect.minX) / 1000, 0.004, (zone.rect.maxY - zone.rect.minY) / 1000), zoneMaterial)
    slab.name = 'wet-zone'
    slab.position.set((zone.rect.minX + zone.rect.maxX) / 2000, 0.004, (zone.rect.minY + zone.rect.maxY) / 2000)
    slab.receiveShadow = true
    group.add(slab)
  }
  return group
}

export { buildFixtureMesh, buildFurnitureMesh }
