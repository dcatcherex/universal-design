import type { Floor, Layout, PointMm, RoomSpace } from './types'

// R1 has exactly one floor and one room. These helpers keep that assumption in
// one place so R2 (several rooms and floors) does not have to hunt for `[0]`.

export function getPrimaryFloor(layout: Layout): Floor {
  return layout.floors[0]
}

export function getPrimaryRoom(layout: Layout): RoomSpace {
  return layout.floors[0].rooms[0]
}

/** Room coordinates to floor coordinates. Identity in R1, where every origin is {0,0}. */
export function toFloorPoint(room: Pick<RoomSpace, 'origin'>, point: PointMm): PointMm {
  return { xMm: point.xMm + room.origin.xMm, yMm: point.yMm + room.origin.yMm }
}

/** Floor coordinates to room coordinates. */
export function toRoomPoint(room: Pick<RoomSpace, 'origin'>, point: PointMm): PointMm {
  return { xMm: point.xMm - room.origin.xMm, yMm: point.yMm - room.origin.yMm }
}

/** Returns a new layout with the primary room replaced by `updater(room)`. The input is not changed. */
export function withPrimaryRoom(layout: Layout, updater: (room: RoomSpace) => RoomSpace): Layout {
  const next = structuredClone(layout)
  next.floors[0].rooms[0] = updater(next.floors[0].rooms[0])
  return next
}

/** Returns a new layout with the primary floor replaced by `updater(floor)`. The input is not changed. */
export function withPrimaryFloor(layout: Layout, updater: (floor: Floor) => Floor): Layout {
  const next = structuredClone(layout)
  next.floors[0] = updater(next.floors[0])
  return next
}

/** Every entity ID in a layout: rooms' openings, items, fixtures and wet zones, plus floor overlays. */
export function layoutEntityIds(layout: Layout): Set<string> {
  const ids = new Set<string>()
  for (const floor of layout.floors) {
    for (const entity of [...floor.routes, ...floor.turningAreas]) ids.add(entity.id)
    for (const room of floor.rooms) {
      for (const entity of [...room.openings, ...room.items, ...room.fixtures, ...room.wetZones]) ids.add(entity.id)
    }
  }
  return ids
}
