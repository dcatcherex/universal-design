import type { FurnitureItem, Opening, PointMm, RectMm, RoomSpace, Wall, WallFixture } from './types'

const EPSILON = 0.001

export type DoorSector = { hinge: PointMm; radiusMm: number; startAngleDeg: number; sweepDeg: 90 | -90 }
/** The part of a room the plan geometry needs: its rectangular extent. */
export type RoomExtent = Pick<RoomSpace, 'shape'>

export function getFootprint(item: FurnitureItem): RectMm {
  const width = item.rotationDeg === 90 || item.rotationDeg === 270 ? item.depth.valueMm : item.width.valueMm
  const depth = item.rotationDeg === 90 || item.rotationDeg === 270 ? item.width.valueMm : item.depth.valueMm
  return {
    minX: item.center.xMm - width / 2,
    minY: item.center.yMm - depth / 2,
    maxX: item.center.xMm + width / 2,
    maxY: item.center.yMm + depth / 2,
  }
}

export function rectanglesOverlap(a: RectMm, b: RectMm): boolean {
  return a.minX < b.maxX - EPSILON && a.maxX > b.minX + EPSILON && a.minY < b.maxY - EPSILON && a.maxY > b.minY + EPSILON
}

export function isWithinRoom(rect: RectMm, room: RoomExtent): boolean {
  return rect.minX >= -EPSILON && rect.minY >= -EPSILON && rect.maxX <= room.shape.width.valueMm + EPSILON && rect.maxY <= room.shape.depth.valueMm + EPSILON
}

/** Swing area inside the room. Sliding doors have none; an outward-opening door swings outside the room. */
export function getDoorSector(opening: Opening, room: RoomExtent): DoorSector | null {
  if (opening.kind !== 'door' || opening.operation !== 'hinged-in' || !opening.hinge) return null
  const offset = opening.offset.valueMm
  const end = offset + opening.width.valueMm
  const atStart = opening.hinge === 'start'
  switch (opening.wall) {
    case 'north': return { hinge: { xMm: atStart ? offset : end, yMm: 0 }, radiusMm: opening.width.valueMm, startAngleDeg: atStart ? 0 : 180, sweepDeg: atStart ? 90 : -90 }
    case 'south': return { hinge: { xMm: atStart ? offset : end, yMm: room.shape.depth.valueMm }, radiusMm: opening.width.valueMm, startAngleDeg: atStart ? 0 : 180, sweepDeg: atStart ? -90 : 90 }
    case 'west': return { hinge: { xMm: 0, yMm: atStart ? offset : end }, radiusMm: opening.width.valueMm, startAngleDeg: atStart ? 90 : 270, sweepDeg: atStart ? -90 : 90 }
    case 'east': return { hinge: { xMm: room.shape.width.valueMm, yMm: atStart ? offset : end }, radiusMm: opening.width.valueMm, startAngleDeg: atStart ? 90 : 270, sweepDeg: atStart ? 90 : -90 }
  }
}

/** The arc a door leaf sweeps, for drawing. An outward-opening door sweeps the same quarter circle on the far side of its wall. */
export function getDoorSwing(opening: Opening, room: RoomExtent): { sector: DoorSector; outward: boolean } | null {
  if (opening.kind !== 'door' || !opening.hinge) return null
  if (opening.operation === 'hinged-in') return { sector: getDoorSector(opening, room)!, outward: false }
  if (opening.operation !== 'hinged-out') return null
  const inward = getDoorSector({ ...opening, operation: 'hinged-in' }, room)!
  return { sector: { ...inward, sweepDeg: (inward.sweepDeg === 90 ? -90 : 90) }, outward: true }
}

function distanceSquared(a: PointMm, b: PointMm): number {
  const dx = a.xMm - b.xMm
  const dy = a.yMm - b.yMm
  return dx * dx + dy * dy
}

function pointRectDistanceSquared(point: PointMm, rect: RectMm): number {
  const dx = Math.max(rect.minX - point.xMm, 0, point.xMm - rect.maxX)
  const dy = Math.max(rect.minY - point.yMm, 0, point.yMm - rect.maxY)
  return dx * dx + dy * dy
}

function pointSegmentDistanceSquared(point: PointMm, a: PointMm, b: PointMm): number {
  const vx = b.xMm - a.xMm
  const vy = b.yMm - a.yMm
  const lengthSquared = vx * vx + vy * vy
  if (lengthSquared === 0) return distanceSquared(point, a)
  const t = Math.max(0, Math.min(1, ((point.xMm - a.xMm) * vx + (point.yMm - a.yMm) * vy) / lengthSquared))
  return distanceSquared(point, { xMm: a.xMm + t * vx, yMm: a.yMm + t * vy })
}

function cross(a: PointMm, b: PointMm, c: PointMm): number {
  return (b.xMm - a.xMm) * (c.yMm - a.yMm) - (b.yMm - a.yMm) * (c.xMm - a.xMm)
}

function segmentsIntersect(a: PointMm, b: PointMm, c: PointMm, d: PointMm): boolean {
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  return abC * abD <= EPSILON && cdA * cdB <= EPSILON
    && Math.max(Math.min(a.xMm, b.xMm), Math.min(c.xMm, d.xMm)) <= Math.min(Math.max(a.xMm, b.xMm), Math.max(c.xMm, d.xMm)) + EPSILON
    && Math.max(Math.min(a.yMm, b.yMm), Math.min(c.yMm, d.yMm)) <= Math.min(Math.max(a.yMm, b.yMm), Math.max(c.yMm, d.yMm)) + EPSILON
}

function segmentSegmentDistanceSquared(a: PointMm, b: PointMm, c: PointMm, d: PointMm): number {
  if (segmentsIntersect(a, b, c, d)) return 0
  return Math.min(
    pointSegmentDistanceSquared(a, c, d), pointSegmentDistanceSquared(b, c, d),
    pointSegmentDistanceSquared(c, a, b), pointSegmentDistanceSquared(d, a, b),
  )
}

function rectCorners(rect: RectMm): PointMm[] {
  return [
    { xMm: rect.minX, yMm: rect.minY }, { xMm: rect.maxX, yMm: rect.minY },
    { xMm: rect.maxX, yMm: rect.maxY }, { xMm: rect.minX, yMm: rect.maxY },
  ]
}

function rectEdges(rect: RectMm): [PointMm, PointMm][] {
  const corners = rectCorners(rect)
  return corners.map((corner, index) => [corner, corners[(index + 1) % corners.length]])
}

export function circleIntersectsRect(center: PointMm, radiusMm: number, rect: RectMm): boolean {
  const radius = Math.max(0, radiusMm - EPSILON)
  return pointRectDistanceSquared(center, rect) < radius * radius
}

export function capsuleIntersectsRect(a: PointMm, b: PointMm, radiusMm: number, rect: RectMm): boolean {
  if (a.xMm >= rect.minX && a.xMm <= rect.maxX && a.yMm >= rect.minY && a.yMm <= rect.maxY) return radiusMm > 0
  if (b.xMm >= rect.minX && b.xMm <= rect.maxX && b.yMm >= rect.minY && b.yMm <= rect.maxY) return radiusMm > 0
  const distance = Math.min(...rectEdges(rect).map(([c, d]) => segmentSegmentDistanceSquared(a, b, c, d)))
  const radius = Math.max(0, radiusMm - EPSILON)
  return distance < radius * radius
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360
}

function angleInSector(angle: number, sector: DoorSector): boolean {
  const start = normalizeAngle(sector.startAngleDeg)
  const value = normalizeAngle(angle)
  const delta = sector.sweepDeg > 0 ? normalizeAngle(value - start) : normalizeAngle(start - value)
  return delta <= 90 + EPSILON
}

function pointInSector(point: PointMm, sector: DoorSector, includeArc = false): boolean {
  const dx = point.xMm - sector.hinge.xMm
  const dy = point.yMm - sector.hinge.yMm
  const radius = sector.radiusMm
  const distance2 = dx * dx + dy * dy
  if (includeArc ? distance2 > radius * radius + EPSILON : distance2 >= Math.max(0, radius - EPSILON) ** 2) return false
  return angleInSector(Math.atan2(dy, dx) * 180 / Math.PI, sector)
}

function segmentIntersectsRect(a: PointMm, b: PointMm, rect: RectMm): boolean {
  if (a.xMm >= rect.minX && a.xMm <= rect.maxX && a.yMm >= rect.minY && a.yMm <= rect.maxY) return true
  if (b.xMm >= rect.minX && b.xMm <= rect.maxX && b.yMm >= rect.minY && b.yMm <= rect.maxY) return true
  return rectEdges(rect).some(([c, d]) => segmentsIntersect(a, b, c, d))
}

export function sectorIntersectsRect(sector: DoorSector, rect: RectMm): boolean {
  if (pointInSector(sector.hinge, { ...sector, radiusMm: Number.EPSILON }, true)
    && sector.hinge.xMm >= rect.minX && sector.hinge.xMm <= rect.maxX && sector.hinge.yMm >= rect.minY && sector.hinge.yMm <= rect.maxY) return true
  if (rectCorners(rect).some((corner) => pointInSector(corner, sector))) return true

  const start = sector.startAngleDeg * Math.PI / 180
  const end = (sector.startAngleDeg + sector.sweepDeg) * Math.PI / 180
  const radialStart = { xMm: sector.hinge.xMm + sector.radiusMm * Math.cos(start), yMm: sector.hinge.yMm + sector.radiusMm * Math.sin(start) }
  const radialEnd = { xMm: sector.hinge.xMm + sector.radiusMm * Math.cos(end), yMm: sector.hinge.yMm + sector.radiusMm * Math.sin(end) }
  if (segmentIntersectsRect(sector.hinge, radialStart, rect) || segmentIntersectsRect(sector.hinge, radialEnd, rect)) return true

  for (const edge of rectEdges(rect)) {
    for (const point of edge) if (pointInSector(point, sector, true)) return true
    const [a, b] = edge
    const dx = b.xMm - a.xMm
    const dy = b.yMm - a.yMm
    const fx = a.xMm - sector.hinge.xMm
    const fy = a.yMm - sector.hinge.yMm
    const aa = dx * dx + dy * dy
    if (aa === 0) continue
    const bb = 2 * (fx * dx + fy * dy)
    const cc = fx * fx + fy * fy - sector.radiusMm * sector.radiusMm
    const discriminant = bb * bb - 4 * aa * cc
    if (discriminant < 0) continue
    for (const t of [(-bb - Math.sqrt(discriminant)) / (2 * aa), (-bb + Math.sqrt(discriminant)) / (2 * aa)]) {
      if (t >= -EPSILON && t <= 1 + EPSILON) {
        const point = { xMm: a.xMm + t * dx, yMm: a.yMm + t * dy }
        if (pointInSector(point, sector, true)) return true
      }
    }
  }
  return false
}

export function wallLengthMm(room: RoomExtent, wall: Wall): number {
  return wall === 'north' || wall === 'south' ? room.shape.width.valueMm : room.shape.depth.valueMm
}

/** How far a fixture reaches along its wall on each side of its centre. A vertical bar only has its own thickness. */
export function fixtureHalfSpanMm(fixture: WallFixture): number {
  if (fixture.kind === 'grab-bar-vertical') return (fixture.diameter?.valueMm ?? 40) / 2
  // A fold-down bar hinges at the wall and points into the room, so along the wall it is only as wide as its bracket.
  if (fixture.kind === 'grab-bar-fold-down') return 50
  return fixture.length.valueMm / 2
}

/** Highest point of a fixture above the floor. */
export function fixtureTopMm(fixture: WallFixture): number {
  return fixture.kind === 'grab-bar-vertical' ? fixture.referenceHeight.valueMm + fixture.length.valueMm : fixture.referenceHeight.valueMm
}

export function fixtureFitsWall(fixture: WallFixture, room: Pick<RoomSpace, 'shape' | 'height'>): boolean {
  const half = fixtureHalfSpanMm(fixture)
  return fixture.offset.valueMm - half >= -EPSILON
    && fixture.offset.valueMm + half <= wallLengthMm(room, fixture.wall) + EPSILON
    && fixtureTopMm(fixture) <= room.height.valueMm + EPSILON
}

/**
 * Where a fixture sits in the plan: the stretch of wall it covers and the floor area it projects over.
 * Offsets run west to east on the north and south walls, and north to south on the east and west walls.
 */
export function getFixtureSpan(fixture: WallFixture, room: RoomExtent): { start: PointMm; end: PointMm; footprint: RectMm } {
  const half = fixtureHalfSpanMm(fixture)
  const from = fixture.offset.valueMm - half
  const to = fixture.offset.valueMm + half
  // A fold-down bar reaches into the room by its length when lowered.
  const reach = fixture.kind === 'grab-bar-fold-down' ? fixture.length.valueMm : fixture.projection.valueMm
  const width = room.shape.width.valueMm
  const depth = room.shape.depth.valueMm
  switch (fixture.wall) {
    case 'north': return { start: { xMm: from, yMm: 0 }, end: { xMm: to, yMm: 0 }, footprint: { minX: from, maxX: to, minY: 0, maxY: reach } }
    case 'south': return { start: { xMm: from, yMm: depth }, end: { xMm: to, yMm: depth }, footprint: { minX: from, maxX: to, minY: depth - reach, maxY: depth } }
    case 'west': return { start: { xMm: 0, yMm: from }, end: { xMm: 0, yMm: to }, footprint: { minX: 0, maxX: reach, minY: from, maxY: to } }
    case 'east': return { start: { xMm: width, yMm: from }, end: { xMm: width, yMm: to }, footprint: { minX: width - reach, maxX: width, minY: from, maxY: to } }
  }
}