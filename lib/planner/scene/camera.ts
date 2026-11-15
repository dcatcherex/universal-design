import { PerspectiveCamera, Vector3 } from 'three'
import type { Room } from '../types'

export function createRoomCamera(room: Room, aspect: number): PerspectiveCamera {
  const width = room.width.valueMm / 1000
  const depth = room.depth.valueMm / 1000
  const camera = new PerspectiveCamera(50, aspect, 0.05, 100)
  const center = new Vector3(width / 2, room.height.valueMm / 2000, depth / 2)
  const distance = Math.max(width, depth) * 1.12
  camera.position.set(center.x + distance * 0.85, center.y + distance * 1.65, center.z + distance * 1.05)
  camera.lookAt(center)
  return camera
}
