import { getFootprint } from './geometry'
import { PLAN_WALL_THICKNESS_MM } from './plan-drawing'
import type { FurnitureItem, RoomSpace, Wall } from './types'

export const PLAN_DIMENSION_MARGIN_MM = 360

type PlanLine = { x1: number; y1: number; x2: number; y2: number }
type PlanPoint = { xMm: number; yMm: number }

export type DimensionChainSegment = { kind: 'wall' | 'opening'; startMm: number; endMm: number; lengthMm: number }
export type WallDimensionChain = { wall: Wall; lengthMm: number; segments: DimensionChainSegment[] }
export type PlanDimension = {
  id: string
  kind: 'overall' | 'chain' | 'clearance'
  wall: Wall
  side: Wall | null
  valueMm: number
  line: PlanLine
  ticks: [PlanLine, PlanLine]
  label: string
  labelPoint: PlanPoint
  labelRotationDeg: 0 | -90
}

const WALLS: Wall[] = ['north', 'east', 'south', 'west']
const TICK_HALF_MM = 24
const CHAIN_OFFSET_MM = PLAN_WALL_THICKNESS_MM + 50
const OVERALL_OFFSET_MM = PLAN_WALL_THICKNESS_MM + 160
const CLEARANCE_LABEL_OFFSET_MM = 55

export function formatPlanLength(valueMm: number): string {
  return `${(Math.round(valueMm / 10) / 100).toFixed(2)} m`
}

export function buildDimensionChains(room: RoomSpace): WallDimensionChain[] {
  const width = room.shape.width.valueMm
  const depth = room.shape.depth.valueMm
  return WALLS.flatMap((wall) => {
    const lengthMm = wall === 'north' || wall === 'south' ? width : depth
    const openings = room.openings.filter((opening) => opening.wall === wall).sort((a, b) => a.offset.valueMm - b.offset.valueMm)
    if (!openings.length) return []
    const segments: DimensionChainSegment[] = []
    let cursor = 0
    for (const opening of openings) {
      const startMm = Math.max(cursor, Math.min(lengthMm, opening.offset.valueMm))
      const endMm = Math.max(startMm, Math.min(lengthMm, opening.offset.valueMm + opening.width.valueMm))
      if (startMm > cursor) segments.push({ kind: 'wall', startMm: cursor, endMm: startMm, lengthMm: startMm - cursor })
      if (endMm > startMm) segments.push({ kind: 'opening', startMm, endMm, lengthMm: endMm - startMm })
      cursor = Math.max(cursor, endMm)
    }
    if (cursor < lengthMm) segments.push({ kind: 'wall', startMm: cursor, endMm: lengthMm, lengthMm: lengthMm - cursor })
    return [{ wall, lengthMm, segments }]
  })
}

export function buildPlanDimensions(room: RoomSpace, selectedItem?: FurnitureItem): PlanDimension[] {
  const width = room.shape.width.valueMm
  const depth = room.shape.depth.valueMm
  const dimensions: PlanDimension[] = [
    makeDimension('overall-width', 'overall', 'north', null, width, 0, -OVERALL_OFFSET_MM, width, -OVERALL_OFFSET_MM, width / 2, -OVERALL_OFFSET_MM - 32, 0),
    makeDimension('overall-depth', 'overall', 'west', null, depth, -OVERALL_OFFSET_MM, 0, -OVERALL_OFFSET_MM, depth, -OVERALL_OFFSET_MM - 32, depth / 2, -90),
  ]

  for (const chain of buildDimensionChains(room)) {
    for (const [index, segment] of chain.segments.entries()) {
      const horizontal = chain.wall === 'north' || chain.wall === 'south'
      const coordinate = chain.wall === 'north' ? -CHAIN_OFFSET_MM
        : chain.wall === 'south' ? depth + CHAIN_OFFSET_MM
          : chain.wall === 'west' ? -CHAIN_OFFSET_MM : width + CHAIN_OFFSET_MM
      const labelOffset = chain.wall === 'north' || chain.wall === 'west' ? -32 : 32
      const x1 = horizontal ? segment.startMm : coordinate
      const y1 = horizontal ? coordinate : segment.startMm
      const x2 = horizontal ? segment.endMm : coordinate
      const y2 = horizontal ? coordinate : segment.endMm
      const labelX = horizontal ? (segment.startMm + segment.endMm) / 2 : coordinate + labelOffset
      const labelY = horizontal ? coordinate + labelOffset : (segment.startMm + segment.endMm) / 2
      dimensions.push(makeDimension(`chain-${chain.wall}-${index}`, 'chain', chain.wall, null, segment.lengthMm, x1, y1, x2, y2, labelX, labelY, horizontal ? 0 : -90))
    }
  }

  if (selectedItem) {
    const footprint = getFootprint(selectedItem)
    const centerX = (footprint.minX + footprint.maxX) / 2
    const centerY = (footprint.minY + footprint.maxY) / 2
    const north = footprint.minY
    const east = width - footprint.maxX
    const south = depth - footprint.maxY
    const west = footprint.minX
    dimensions.push(
      makeDimension('clearance-north', 'clearance', 'north', 'north', north, centerX, 0, centerX, footprint.minY, centerX + CLEARANCE_LABEL_OFFSET_MM, north / 2, -90),
      makeDimension('clearance-east', 'clearance', 'east', 'east', east, footprint.maxX, centerY, width, centerY, (footprint.maxX + width) / 2, centerY - CLEARANCE_LABEL_OFFSET_MM, 0),
      makeDimension('clearance-south', 'clearance', 'south', 'south', south, centerX, footprint.maxY, centerX, depth, centerX - CLEARANCE_LABEL_OFFSET_MM, (footprint.maxY + depth) / 2, -90),
      makeDimension('clearance-west', 'clearance', 'west', 'west', west, 0, centerY, footprint.minX, centerY, footprint.minX / 2, centerY + CLEARANCE_LABEL_OFFSET_MM, 0),
    )
  }

  return dimensions
}

function makeDimension(
  id: string,
  kind: PlanDimension['kind'],
  wall: Wall,
  side: Wall | null,
  valueMm: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  labelX: number,
  labelY: number,
  labelRotationDeg: 0 | -90,
): PlanDimension {
  const tick = (x: number, y: number): PlanLine => ({
    x1: x - TICK_HALF_MM,
    y1: y + TICK_HALF_MM,
    x2: x + TICK_HALF_MM,
    y2: y - TICK_HALF_MM,
  })
  return {
    id, kind, wall, side, valueMm, line: { x1, y1, x2, y2 },
    ticks: [tick(x1, y1), tick(x2, y2)],
    label: formatPlanLength(valueMm),
    labelPoint: { xMm: labelX, yMm: labelY },
    labelRotationDeg,
  }
}
