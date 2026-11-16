import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Material } from 'three'
import type { RoomSpace, WallFixture } from '../types'

// Wall fixtures are drawn in a local frame and then placed on their wall:
//   x = along the wall (the fixture's offset is x = 0)
//   y = up from the floor
//   z = out of the wall into the room (the wall surface is z = 0)

function part(group: Group, name: string, geometry: BufferGeometry, position: [number, number, number], material: Material) {
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.itemId = group.userData.itemId
  group.add(mesh)
  return mesh
}

export function buildFixtureMesh(fixture: WallFixture, room: Pick<RoomSpace, 'shape'>): Group {
  const group = new Group()
  group.name = `fixture-${fixture.id}`
  group.userData.itemId = fixture.id
  const height = fixture.referenceHeight.valueMm / 1000
  const length = fixture.length.valueMm / 1000
  const reach = Math.max(0.01, fixture.projection.valueMm / 1000)
  const radius = (fixture.diameter?.valueMm ?? 35) / 2000
  const steel = new MeshStandardMaterial({ color: 0xc9ced1, roughness: 0.3, metalness: 0.75 })
  const white = new MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.4 })
  const wood = new MeshStandardMaterial({ color: 0xd8ae7c, roughness: 0.62 })
  const post = (x: number, y: number) => part(group, 'fixture-bracket', new CylinderGeometry(radius * 0.8, radius * 0.8, reach, 10), [x, y, reach / 2], steel).rotation.set(Math.PI / 2, 0, 0)

  switch (fixture.kind) {
    case 'grab-bar-horizontal':
      part(group, 'grab-bar', new CylinderGeometry(radius, radius, length, 16), [0, height, reach], steel).rotation.set(0, 0, Math.PI / 2)
      post(-length / 2 + radius, height)
      post(length / 2 - radius, height)
      break
    case 'grab-bar-vertical':
      // The reference height is the bottom end; the bar rises `length` above it.
      part(group, 'grab-bar', new CylinderGeometry(radius, radius, length, 16), [0, height + length / 2, reach], steel)
      post(0, height + radius)
      post(0, height + length - radius)
      break
    case 'grab-bar-fold-down':
      // Drawn lowered: it reaches `length` into the room from a wall plate.
      part(group, 'grab-bar', new CylinderGeometry(radius, radius, length, 16), [0, height, length / 2], steel).rotation.set(Math.PI / 2, 0, 0)
      part(group, 'fixture-plate', new BoxGeometry(0.1, 0.22, 0.012), [0, height - 0.04, 0.006], steel)
      break
    case 'switch':
    case 'socket':
      part(group, 'fixture-plate', new BoxGeometry(Math.max(0.07, length), 0.12, reach), [0, height, reach / 2], white)
      break
    case 'shelf':
      // The reference height is the top surface.
      part(group, 'fixture-shelf', new BoxGeometry(length, 0.03, reach), [0, height - 0.015, reach / 2], wood)
      break
    case 'basin':
      // The reference height is the rim.
      part(group, 'fixture-basin', new BoxGeometry(length, 0.16, reach), [0, height - 0.08, reach / 2], white)
      part(group, 'fixture-basin-pipe', new CylinderGeometry(0.02, 0.02, Math.max(0.05, height - 0.16), 10), [0, (height - 0.16) / 2, 0.06], steel)
      break
  }

  // Place the local frame on the wall. Offsets run west to east on the north and south walls,
  // and north to south on the east and west walls (the same convention as openings).
  const offset = fixture.offset.valueMm / 1000
  const width = room.shape.width.valueMm / 1000
  const depth = room.shape.depth.valueMm / 1000
  if (fixture.wall === 'north') group.position.set(offset, 0, 0)
  if (fixture.wall === 'south') { group.position.set(offset, 0, depth); group.rotation.y = Math.PI }
  if (fixture.wall === 'west') { group.position.set(0, 0, offset); group.rotation.y = Math.PI / 2 }
  if (fixture.wall === 'east') { group.position.set(width, 0, offset); group.rotation.y = -Math.PI / 2 }
  return group
}
