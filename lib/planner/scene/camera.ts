import { PerspectiveCamera, Vector3 } from 'three'
import type { RoomSpace } from '../types'

/** Three-quarter view from the south-east corner, high enough to see the whole floor. */
export function createRoomCamera(room: Pick<RoomSpace, 'shape' | 'height'>, aspect: number): PerspectiveCamera {
  const width = room.shape.width.valueMm / 1000
  const depth = room.shape.depth.valueMm / 1000
  const camera = new PerspectiveCamera(38, aspect, 0.05, 100)
  const center = new Vector3(width / 2, room.height.valueMm / 2200, depth / 2)
  // Far enough to take in the floor plan, and for small rooms far enough to take in the wall height too.
  const distance = Math.max(Math.max(width, depth) * 1.2 + 1.2, (room.height.valueMm / 1000) * 2.6)
  camera.position.set(center.x + distance * 0.62, center.y + distance * 0.72, center.z + distance * 0.86)
  camera.lookAt(center)
  return camera
}
