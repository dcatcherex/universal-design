import { getFootprint } from './geometry'
import type { FurnitureItem, PointMm, RectMm, RoomSpace } from './types'

export const PLAN_SCALE_BAR_LENGTH_MM = 1000

type PlanLine = { x1: number; y1: number; x2: number; y2: number }

export type PlanAnnotationLabels = {
  roomType: string
  planNorth: string
  scaleBar: string
}

export type PlanAnnotations = {
  roomLabel: {
    point: PointMm
    bounds: RectMm
    typeLabel: string
    areaLabel: string
  }
  scaleBar: {
    line: PlanLine
    ticks: [PlanLine, PlanLine]
    labelPoint: PointMm
    label: string
    lengthMm: number
  }
  northArrow: {
    shaft: PlanLine
    head: [PlanLine, PlanLine]
    labelPoint: PointMm
    label: string
  }
}

function intersects(a: RectMm, b: RectMm): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

function labelBounds(point: PointMm, halfWidth: number, halfHeight: number, gap: number): RectMm {
  return {
    minX: point.xMm - halfWidth - gap,
    maxX: point.xMm + halfWidth + gap,
    minY: point.yMm - halfHeight - gap,
    maxY: point.yMm + halfHeight + gap,
  }
}

function findRoomLabelPoint(room: RoomSpace, widthMm: number, heightMm: number, scale: number): { point: PointMm; bounds: RectMm } {
  const width = room.shape.width.valueMm
  const depth = room.shape.depth.valueMm
  const gap = 55 * scale
  const halfWidth = widthMm / 2
  const halfHeight = heightMm / 2
  const minX = Math.min(width / 2, halfWidth + gap)
  const maxX = Math.max(width / 2, width - halfWidth - gap)
  const minY = Math.min(depth / 2, halfHeight + gap)
  const maxY = Math.max(depth / 2, depth - halfHeight - gap)
  const fractions = [0.5, 0.35, 0.65, 0.2, 0.8]
  const candidates: PointMm[] = []
  const seen = new Set<string>()

  for (const yFraction of fractions) {
    for (const xFraction of fractions) {
      const point = {
        xMm: Math.max(minX, Math.min(maxX, width * xFraction)),
        yMm: Math.max(minY, Math.min(maxY, depth * yFraction)),
      }
      const key = `${point.xMm}:${point.yMm}`
      if (!seen.has(key)) {
        seen.add(key)
        candidates.push(point)
      }
    }
  }

  const center = { xMm: width / 2, yMm: depth / 2 }
  candidates.sort((a, b) => {
    const aDistance = (a.xMm - center.xMm) ** 2 + (a.yMm - center.yMm) ** 2
    const bDistance = (b.xMm - center.xMm) ** 2 + (b.yMm - center.yMm) ** 2
    return aDistance - bDistance
  })
  const footprints = room.items.map((item: FurnitureItem) => getFootprint(item))
  const point = candidates.find((candidate) => {
    const bounds = labelBounds(candidate, halfWidth, halfHeight, gap)
    return footprints.every((footprint) => !intersects(bounds, footprint))
  }) ?? candidates[0] ?? center

  return { point, bounds: labelBounds(point, halfWidth, halfHeight, gap) }
}

/** Shared room annotations for the interactive plan and exported SVG. */
export function buildPlanAnnotations(room: RoomSpace, labels: PlanAnnotationLabels): PlanAnnotations {
  const width = room.shape.width.valueMm
  const depth = room.shape.depth.valueMm
  const scale = Math.max(0.4, Math.min(1, Math.max(width, depth) / 6000))
  const areaLabel = `${((width * depth) / 1_000_000).toFixed(2)} m²`
  const roomTypeWidth = labels.roomType.length * 125 * scale
  const areaWidth = areaLabel.length * 80 * scale
  const labelWidth = Math.min(width * 0.82, Math.max(roomTypeWidth, areaWidth) + 180 * scale)
  const labelHeight = 420 * scale
  const roomLabel = findRoomLabelPoint(room, labelWidth, labelHeight, scale)

  const scaleX = Math.min(120 * scale, Math.max(0, width - PLAN_SCALE_BAR_LENGTH_MM))
  const scaleY = depth - 120 * scale
  const tickHalf = 24 * scale
  const scaleBar = {
    line: { x1: scaleX, y1: scaleY, x2: scaleX + PLAN_SCALE_BAR_LENGTH_MM, y2: scaleY },
    ticks: [
      { x1: scaleX, y1: scaleY - tickHalf, x2: scaleX, y2: scaleY + tickHalf },
      { x1: scaleX + PLAN_SCALE_BAR_LENGTH_MM, y1: scaleY - tickHalf, x2: scaleX + PLAN_SCALE_BAR_LENGTH_MM, y2: scaleY + tickHalf },
    ] as [PlanLine, PlanLine],
    labelPoint: { xMm: scaleX + PLAN_SCALE_BAR_LENGTH_MM / 2, yMm: scaleY - 70 * scale },
    label: labels.scaleBar,
    lengthMm: PLAN_SCALE_BAR_LENGTH_MM,
  }

  const northX = width - 145 * scale
  const northTipY = 75 * scale
  const headY = northTipY + 65 * scale
  const northBaseY = northTipY + 195 * scale
  const northArrow = {
    shaft: { x1: northX, y1: northBaseY, x2: northX, y2: northTipY },
    head: [
      { x1: northX, y1: northTipY, x2: northX - 44 * scale, y2: headY },
      { x1: northX, y1: northTipY, x2: northX + 44 * scale, y2: headY },
    ] as [PlanLine, PlanLine],
    labelPoint: { xMm: northX - 20 * scale, yMm: northBaseY + 115 * scale },
    label: labels.planNorth,
  }

  return {
    roomLabel: { ...roomLabel, typeLabel: labels.roomType, areaLabel },
    scaleBar,
    northArrow,
  }
}
