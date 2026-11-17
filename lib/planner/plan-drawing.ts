import { getDoorSwing } from './geometry'
import type { FurnitureItem, Opening, RoomSpace, Wall } from './types'

export const PLAN_WALL_THICKNESS_MM = 100

type PlanLine = { x1: number; y1: number; x2: number; y2: number }
type PlanRect = { x: number; y: number; width: number; height: number }

export type OpeningDrawing = {
  opening: Opening
  windowLines: PlanLine[]
  doorLeaf: PlanLine | null
  swingPath: string | null
  outward: boolean
  slidingArrow: string | null
}

export type PlanDrawing = { walls: PlanRect[]; openings: OpeningDrawing[] }

const WALLS: Wall[] = ['north', 'east', 'south', 'west']

function sectorPath(hinge: { xMm: number; yMm: number }, radiusMm: number, startAngleDeg: number, sweepDeg: number): string {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const start = { xMm: hinge.xMm + Math.cos(radians(startAngleDeg)) * radiusMm, yMm: hinge.yMm + Math.sin(radians(startAngleDeg)) * radiusMm }
  const endAngle = startAngleDeg + sweepDeg
  const end = { xMm: hinge.xMm + Math.cos(radians(endAngle)) * radiusMm, yMm: hinge.yMm + Math.sin(radians(endAngle)) * radiusMm }
  return `M ${start.xMm} ${start.yMm} A ${radiusMm} ${radiusMm} 0 0 ${sweepDeg > 0 ? 1 : 0} ${end.xMm} ${end.yMm}`
}

function openingDrawing(opening: Opening, room: RoomSpace): OpeningDrawing {
  const horizontal = opening.wall === 'north' || opening.wall === 'south'
  const offset = opening.offset.valueMm
  const end = offset + opening.width.valueMm
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  const windowLines: PlanLine[] = []
  let doorLeaf: PlanLine | null = null
  let swingPath: string | null = null
  let outward = false
  let slidingArrow: string | null = null

  if (opening.kind === 'window') {
    const sides = opening.wall === 'north' ? [-20, -80] : opening.wall === 'south' ? [20, 80] : opening.wall === 'west' ? [-20, -80] : [20, 80]
    windowLines.push(...sides.map((side) => horizontal
      ? { x1: offset, y1: opening.wall === 'north' ? side : depth + side, x2: end, y2: opening.wall === 'north' ? side : depth + side }
      : { x1: opening.wall === 'west' ? side : width + side, y1: offset, x2: opening.wall === 'west' ? side : width + side, y2: end }))
  } else if (opening.operation === 'sliding') {
    const center = offset + opening.width.valueMm / 2
    const mid = opening.wall === 'north' ? -50 : opening.wall === 'south' ? depth + 50 : opening.wall === 'west' ? -50 : width + 50
    doorLeaf = horizontal ? { x1: offset, y1: mid, x2: end, y2: mid } : { x1: mid, y1: offset, x2: mid, y2: end }
    slidingArrow = horizontal
      ? `M ${center - 35} ${mid - 12} L ${center + 35} ${mid - 12} M ${center + 35} ${mid - 12} L ${center + 12} ${mid - 32} M ${center + 35} ${mid - 12} L ${center + 12} ${mid + 8}`
      : `M ${mid - 12} ${center - 35} L ${mid - 12} ${center + 35} M ${mid - 12} ${center + 35} L ${mid - 32} ${center + 12} M ${mid - 12} ${center + 35} L ${mid + 8} ${center + 12}`
  } else {
    const swing = getDoorSwing(opening, room)
    if (swing) {
      const { sector } = swing
      const angle = (sector.startAngleDeg + sector.sweepDeg) * Math.PI / 180
      const endPoint = { xMm: sector.hinge.xMm + Math.cos(angle) * sector.radiusMm, yMm: sector.hinge.yMm + Math.sin(angle) * sector.radiusMm }
      doorLeaf = { x1: sector.hinge.xMm, y1: sector.hinge.yMm, x2: endPoint.xMm, y2: endPoint.yMm }
      swingPath = sectorPath(sector.hinge, sector.radiusMm, sector.startAngleDeg, sector.sweepDeg)
      outward = swing.outward
    }
  }

  return { opening, windowLines, doorLeaf, swingPath, outward, slidingArrow }
}

export function buildPlanDrawing(room: RoomSpace): PlanDrawing {
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  const walls: PlanRect[] = []
  for (const wall of WALLS) {
    const horizontal = wall === 'north' || wall === 'south'
    const length = horizontal ? width : depth
    const openings = room.openings.filter((opening) => opening.wall === wall).sort((a, b) => a.offset.valueMm - b.offset.valueMm)
    let cursor = 0
    for (const opening of openings) {
      const start = Math.max(cursor, Math.min(length, opening.offset.valueMm))
      const end = Math.max(start, Math.min(length, opening.offset.valueMm + opening.width.valueMm))
      if (start > cursor) walls.push(wallRect(wall, cursor, start - cursor, width, depth))
      cursor = Math.max(cursor, end)
    }
    if (cursor < length) walls.push(wallRect(wall, cursor, length - cursor, width, depth))
  }
  return { walls, openings: room.openings.map((opening) => openingDrawing(opening, room)) }
}

function wallRect(wall: Wall, start: number, length: number, width: number, depth: number): PlanRect {
  if (wall === 'north') return { x: start, y: -PLAN_WALL_THICKNESS_MM, width: length, height: PLAN_WALL_THICKNESS_MM }
  if (wall === 'south') return { x: start, y: depth, width: length, height: PLAN_WALL_THICKNESS_MM }
  if (wall === 'west') return { x: -PLAN_WALL_THICKNESS_MM, y: start, width: PLAN_WALL_THICKNESS_MM, height: length }
  return { x: width, y: start, width: PLAN_WALL_THICKNESS_MM, height: length }
}

export type PlanSymbolMark =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'path'; d: string }

const rect = (x: number, y: number, width: number, height: number, rx?: number): PlanSymbolMark => ({ kind: 'rect', x, y, width, height, ...(rx === undefined ? {} : { rx }) })
const line = (x1: number, y1: number, x2: number, y2: number): PlanSymbolMark => ({ kind: 'line', x1, y1, x2, y2 })

export function planSymbol(catalogId: FurnitureItem['catalogId']): PlanSymbolMark[] {
  switch (catalogId) {
    case 'water-jar': return [{ kind: 'ellipse', cx: .5, cy: .5, rx: .43, ry: .43 }, line(.32, .16, .68, .16)]
    case 'toilet-seated': return [rect(.31, .04, .38, .24, .04), { kind: 'ellipse', cx: .5, cy: .64, rx: .31, ry: .32 }, { kind: 'ellipse', cx: .5, cy: .64, rx: .2, ry: .21 }]
    case 'toilet-squat': return [rect(.24, .08, .52, .84, .08), { kind: 'ellipse', cx: .5, cy: .5, rx: .17, ry: .34 }, rect(.08, .2, .12, .6), rect(.8, .2, .12, .6)]
    case 'basin': return [rect(.08, .06, .84, .88, .16), { kind: 'ellipse', cx: .5, cy: .54, rx: .3, ry: .3 }, { kind: 'ellipse', cx: .5, cy: .14, rx: .045, ry: .045 }]
    case 'shower-seat': return [rect(.12, .12, .76, .76), line(.2, .34, .8, .34), line(.2, .5, .8, .5), line(.2, .66, .8, .66)]
    case 'sofa': return [rect(.08, .08, .84, .22, .04), rect(.08, .28, .15, .64, .04), rect(.77, .28, .15, .64, .04), rect(.23, .3, .54, .62)]
    case 'bed': return [rect(.05, .05, .9, .9), rect(.1, .1, .34, .18, .04), rect(.56, .1, .34, .18, .04), line(.08, .34, .92, .34)]
    case 'armchair': return [rect(.1, .08, .8, .24, .08), rect(.1, .25, .18, .66, .08), rect(.72, .25, .18, .66, .08), rect(.28, .3, .44, .6)]
    case 'dining-chair': return [rect(.2, .38, .6, .55), line(.2, .08, .8, .08), line(.2, .08, .2, .38), line(.8, .08, .8, .38)]
    case 'low-cabinet':
    case 'bath-cabinet': return [rect(.06, .06, .88, .88), line(.5, .06, .5, .94), line(.46, .48, .46, .52), line(.54, .48, .54, .52)]
    case 'floor-lamp': return [rect(.2, .18, .6, .2, .08), line(.5, .38, .5, .84), { kind: 'ellipse', cx: .5, cy: .88, rx: .16, ry: .08 }]
    case 'rug': return [rect(.04, .04, .92, .92), line(.08, .08, .92, .92)]
    case 'custom-block': return [rect(.06, .06, .88, .88), line(.08, .08, .92, .92)]
    case 'coffee-table':
    case 'side-table':
    case 'dining-table': return [rect(.04, .04, .92, .92)]
    default: return [rect(.06, .06, .88, .88), line(.08, .08, .92, .92)]
  }
}
