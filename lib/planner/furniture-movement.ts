import { getFootprint, isWithinRoom } from './geometry'
import { getPrimaryRoom } from './layout-access'
import type { FurnitureItem, Layout, PointMm } from './types'

export type FurnitureMoveError = 'item-not-found' | 'out-of-bounds'
export type FurnitureMoveResult =
  | { ok: true; layout: Layout }
  | { ok: false; reason: FurnitureMoveError }

export function snapToGridMm(valueMm: number, gridMm = 50): number {
  return Math.round(valueMm / gridMm) * gridMm
}

export function isFurnitureWithinRoom(layout: Layout, item: FurnitureItem): boolean {
  return isWithinRoom(getFootprint(item), getPrimaryRoom(layout))
}

export function moveFurnitureInLayout(layout: Layout, itemId: string, center: PointMm): FurnitureMoveResult {
  const room = getPrimaryRoom(layout)
  const item = room.items.find((candidate) => candidate.id === itemId)
  if (!item) return { ok: false, reason: 'item-not-found' }

  const moved = { ...item, center }
  if (!isWithinRoom(getFootprint(moved), room)) return { ok: false, reason: 'out-of-bounds' }

  const next = structuredClone(layout)
  const nextRoom = getPrimaryRoom(next)
  nextRoom.items = nextRoom.items.map((candidate) => candidate.id === itemId ? moved : candidate)
  return { ok: true, layout: next }
}
