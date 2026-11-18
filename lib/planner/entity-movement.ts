import { fixturePositionProblem } from './elevation'
import { getFootprint, isWithinRoom } from './geometry'
import { getPrimaryRoom, withPrimaryRoom } from './layout-access'
import type { FurnitureItem, Layout, PointMm, RoomSpace } from './types'

/** Where a move leaves an entity: a furniture centre, or a fixture's offset and height along its wall. */
export type MovePosition = PointMm | { offsetMm: number; heightMm: number }

export type EntityMoveError = 'not-found' | 'out-of-bounds' | 'outside-wall' | 'over-opening'
export type EntityMoveResult = { ok: true; layout: Layout } | { ok: false; reason: EntityMoveError }
export type RoomMoveResult = { ok: true; room: RoomSpace } | { ok: false; reason: EntityMoveError }

export function snapToGridMm(valueMm: number, gridMm = 50): number {
  return Math.round(valueMm / gridMm) * gridMm
}

export function isFurnitureWithinRoom(layout: Layout, item: FurnitureItem): boolean {
  return isWithinRoom(getFootprint(item), getPrimaryRoom(layout))
}

/**
 * Applies a position without validating it, so a move preview can evaluate the spot
 * under the pointer even when a commit would be rejected. The input room is not changed.
 */
export function previewEntityMove(room: RoomSpace, entityId: string, position: MovePosition): RoomSpace {
  if ('xMm' in position) {
    return { ...room, items: room.items.map((item) => item.id === entityId ? { ...item, center: position } : item) }
  }
  return { ...room, fixtures: room.fixtures.map((fixture) => fixture.id === entityId
    ? { ...fixture, offset: { valueMm: position.offsetMm, confidence: 'estimated' }, referenceHeight: { valueMm: position.heightMm, confidence: 'estimated' } }
    : fixture) }
}

/** The one validated move path. Values are rounded; neither argument is changed. */
export function moveEntityInRoom(room: RoomSpace, entityId: string, position: MovePosition): RoomMoveResult {
  if ('xMm' in position) {
    const item = room.items.find((candidate) => candidate.id === entityId)
    if (!item) return { ok: false, reason: 'not-found' }
    const center = { xMm: Math.round(position.xMm), yMm: Math.round(position.yMm) }
    if (!isWithinRoom(getFootprint({ ...item, center }), room)) return { ok: false, reason: 'out-of-bounds' }
    return { ok: true, room: { ...room, items: room.items.map((candidate) => candidate.id === entityId ? { ...item, center } : candidate) } }
  }
  const fixture = room.fixtures.find((candidate) => candidate.id === entityId)
  if (!fixture) return { ok: false, reason: 'not-found' }
  // Moving a fixture changes two measured values, so both go back to "estimated".
  const moved = { ...fixture, offset: { valueMm: Math.round(position.offsetMm), confidence: 'estimated' as const }, referenceHeight: { valueMm: Math.round(position.heightMm), confidence: 'estimated' as const } }
  const problem = fixturePositionProblem(moved, room)
  if (problem) return { ok: false, reason: problem }
  return { ok: true, room: { ...room, fixtures: room.fixtures.map((candidate) => candidate.id === entityId ? moved : candidate) } }
}

export function moveEntity(layout: Layout, entityId: string, position: MovePosition): EntityMoveResult {
  const moved = moveEntityInRoom(getPrimaryRoom(layout), entityId, position)
  if (!moved.ok) return moved
  return { ok: true, layout: withPrimaryRoom(layout, () => moved.room) }
}
