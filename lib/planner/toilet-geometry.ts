import { getFootprint } from './geometry'
import type { FurnitureItem, RoomSpace, Wall, WallFixture } from './types'

/** How far from a toilet's side a wall may be and still count as "beside" it. A model parameter, not a benchmark. */
export const GRAB_BAR_SEARCH_MM = 500

export type ToiletFacing = { depthAxis: 'x' | 'y'; frontPositive: boolean }

/**
 * Which way a toilet faces in the plan. Rotation 0 has its back to the north (smaller y);
 * each 90° turns it clockwise, so 90 backs onto the east, 180 the south, 270 the west.
 */
export function toiletFacing(item: FurnitureItem): ToiletFacing {
  switch (item.rotationDeg) {
    case 0: return { depthAxis: 'y', frontPositive: true }
    case 90: return { depthAxis: 'x', frontPositive: false }
    case 180: return { depthAxis: 'y', frontPositive: false }
    case 270: return { depthAxis: 'x', frontPositive: true }
  }
}

/** The toilet footprint projected onto the axis parallel to its side walls, and the axis across them. */
export function toiletSpans(toilet: FurnitureItem): { along: { min: number; max: number }; across: { min: number; max: number } } {
  const footprint = getFootprint(toilet)
  return toiletFacing(toilet).depthAxis === 'y'
    ? { along: { min: footprint.minY, max: footprint.maxY }, across: { min: footprint.minX, max: footprint.maxX } }
    : { along: { min: footprint.minX, max: footprint.maxX }, across: { min: footprint.minY, max: footprint.maxY } }
}

/** Both walls parallel to the toilet's depth axis, with each one's distance to the bowl. */
export function toiletSideWalls(room: RoomSpace, toilet: FurnitureItem): { wall: Wall; distance: number }[] {
  const footprint = getFootprint(toilet)
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  return toiletFacing(toilet).depthAxis === 'y'
    ? [{ wall: 'west', distance: footprint.minX }, { wall: 'east', distance: width - footprint.maxX }]
    : [{ wall: 'north', distance: footprint.minY }, { wall: 'south', distance: depth - footprint.maxY }]
}

/** The wall behind the toilet. */
export function toiletBackWall(toilet: FurnitureItem): Wall {
  const { depthAxis, frontPositive } = toiletFacing(toilet)
  return depthAxis === 'y' ? (frontPositive ? 'north' : 'south') : (frontPositive ? 'west' : 'east')
}

/** Distance from the bowl's back edge to the wall behind it. */
export function toiletBackDistanceMm(room: RoomSpace, toilet: FurnitureItem): number {
  const footprint = getFootprint(toilet)
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  switch (toiletBackWall(toilet)) {
    case 'north': return footprint.minY
    case 'south': return depth - footprint.maxY
    case 'west': return footprint.minX
    case 'east': return width - footprint.maxX
  }
}

export type ToiletBar = { bar: WallFixture; pastFrontMm: number; gapMm: number | null }

/**
 * Finds a grab bar that serves a toilet.
 *
 * A horizontal bar counts when it is on a side wall (a wall parallel to the toilet's depth
 * axis) no more than GRAB_BAR_SEARCH_MM from the toilet's side, and overlaps the toilet along
 * that wall. `pastFrontMm` is how far the bar reaches beyond the bowl's front edge, measured
 * along the wall:
 *
 *        back wall
 *   ┌──────────────┐
 *   │ bowl         │   bar on the side wall
 *   │              │   ══════════════════╗
 *   └── front ─────┘                     ║ pastFrontMm
 *                      ══════════════════╝
 *
 * A fold-down bar counts when it is on the wall behind the toilet, to one side of the bowl.
 * `gapMm` is the distance from its centre line to the nearer edge of the bowl.
 */
export function findToiletBar(room: RoomSpace, toilet: FurnitureItem): ToiletBar | null {
  const { along, across } = toiletSpans(toilet)
  const { frontPositive } = toiletFacing(toilet)
  const nearWalls = toiletSideWalls(room, toilet).filter((side) => side.distance <= GRAB_BAR_SEARCH_MM).map((side) => side.wall)
  const bars = [...room.fixtures].sort((a, b) => a.id.localeCompare(b.id))

  for (const bar of bars) {
    if (bar.kind !== 'grab-bar-horizontal' || !nearWalls.includes(bar.wall)) continue
    const start = bar.offset.valueMm - bar.length.valueMm / 2
    const end = bar.offset.valueMm + bar.length.valueMm / 2
    if (end <= along.min || start >= along.max) continue
    return { bar, pastFrontMm: frontPositive ? end - along.max : along.min - start, gapMm: null }
  }

  const backWall = toiletBackWall(toilet)
  const backDistance = toiletBackDistanceMm(room, toilet)
  if (backDistance > GRAB_BAR_SEARCH_MM) return null
  for (const bar of bars) {
    if (bar.kind !== 'grab-bar-fold-down' || bar.wall !== backWall) continue
    const position = bar.offset.valueMm
    const gap = position < across.min ? across.min - position : position > across.max ? position - across.max : null
    if (gap === null || gap > GRAB_BAR_SEARCH_MM) continue
    const reach = bar.length.valueMm - backDistance
    return { bar, pastFrontMm: reach - (along.max - along.min), gapMm: gap }
  }
  return null
}
