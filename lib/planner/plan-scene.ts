import { getFixtureSpan, getFootprint } from './geometry'
import { getPrimaryFloor, getPrimaryRoom, toRoomPoint } from './layout-access'
import { buildPlanAnnotations, type PlanAnnotations } from './plan-annotations'
import { buildPlanDimensions, PLAN_DIMENSION_MARGIN_MM, type PlanDimension } from './plan-dimensions'
import { buildPlanDrawing, PLAN_WALL_THICKNESS_MM, planSymbol, type OpeningDrawing, type PlanSymbolMark } from './plan-drawing'
import { buildPlanSchedule, type PlanSchedule } from './plan-schedule'
import { t } from './i18n'
import type { EntityCheckStatus } from './checks'
import type { CheckResult, FurnitureItem, Layout, Locale, Opening, PointMm, RectMm, RouteOverlay, TurningOverlay, Wall, WallFixture } from './types'

export type { PlanSymbolMark } from './plan-drawing'

export type PlanSceneOptions = {
  locale: Locale
  showOverlays: boolean
  showDimensions?: boolean
  showCheckMarks?: boolean
  checkStatuses?: ReadonlyMap<string, EntityCheckStatus>
  roomCheckResults?: CheckResult[]
  selectedItemId?: string | null
  selectedEntityId?: string | null
  movePreview?: { id: string; xMm: number; yMm: number } | null
  routeTargetMm?: number | null
  turningTargetMm?: number | null
}

export type PlanRect = { x: number; y: number; width: number; height: number }
export type PlanLine = { x1: number; y1: number; x2: number; y2: number }
export type PlanSceneAnnotations = PlanAnnotations & {
  roomLabel: PlanAnnotations['roomLabel'] & { typeY: number; areaY: number }
}
export type PlanScenePrimitive =
  | { kind: 'wall'; geometry: PlanRect; styleToken: 'wall' }
  | { kind: 'wet-zone'; entityId: string; label: string; geometry: PlanRect; styleToken: 'wet' }
  | {
      kind: 'route'
      entity: RouteOverlay
      geometry: { points: PointMm[]; widthMm: { canvas: number; export: number }; widthKnown: { canvas: boolean; export: boolean }; checkWidthMm: number; badge: PointMm; opacity: { canvas: number; export: number } }
      styleToken: 'route' | 'selection'
      label: { canvas: string; export: string }
      selected: boolean
      checkStatus?: EntityCheckStatus
    }
  | {
      kind: 'turning-area'
      entity: TurningOverlay
      geometry: { center: PointMm; radiusMm: { canvas: number; export: number }; checkRadiusMm: { canvas: number; export: number }; badge: { canvas: PointMm; export: PointMm } }
      styleToken: 'turning' | 'selection'
      selected: boolean
      hasDiameter: { canvas: boolean; export: boolean }
      checkStatus?: EntityCheckStatus
    }
  | {
      kind: 'opening'
      entity: Opening
      geometry: { drawing: OpeningDrawing; outline: PlanRect; badge: PointMm }
      label: string
      selected: boolean
      checkStatus?: EntityCheckStatus
    }
  | {
      kind: 'item'
      entity: FurnitureItem
      geometry: {
        center: PointMm
        footprint: RectMm
        localFootprint: PlanRect
        checkOutline: PlanRect
        numberY: number
        labelY: number
        badgePoints: { world: PointMm; local: PointMm }
      }
      itemNumber: number
      selected: boolean
      styleToken: 'rug' | FurnitureItem['finish']
      symbol: PlanSymbolMark[]
      checkStatus?: EntityCheckStatus
      dimensionsLabel: string
    }
  | {
      kind: 'fixture'
      entity: WallFixture
      geometry: { footprint: RectMm; width: number; height: number; shape: PlanRect; checkOutline: PlanRect; badge: PointMm }
      selected: boolean
      styleToken: 'grab-bar' | 'fixture'
      symbol: PlanSymbolMark[]
      checkStatus?: EntityCheckStatus
    }
  | { kind: 'dimension'; geometry: PlanDimension; description: string; styleToken: 'dimension' }
  | { kind: 'annotation'; geometry: PlanSceneAnnotations; styleToken: 'annotation' }

export type PlanScene = {
  roomId: string
  widthMm: number
  depthMm: number
  scale: number
  viewBox: { x: number; y: number; width: number; height: number }
  wallLines: { wall: Wall; line: PlanLine }[]
  badgeSizeMm: number
  legendY: number
  schedule: PlanSchedule
  primitives: PlanScenePrimitive[]
  roomCheckCounts: { attention: number; notEvaluated: number }
}

function wallLines(width: number, depth: number): PlanScene['wallLines'] {
  return [
    { wall: 'north', line: { x1: 0, y1: 0, x2: width, y2: 0 } },
    { wall: 'south', line: { x1: 0, y1: depth, x2: width, y2: depth } },
    { wall: 'west', line: { x1: 0, y1: 0, x2: 0, y2: depth } },
    { wall: 'east', line: { x1: width, y1: 0, x2: width, y2: depth } },
  ]
}

function openingOutline(opening: Opening, width: number, depth: number): PlanRect {
  const start = opening.offset.valueMm
  return opening.wall === 'north' ? { x: start, y: -PLAN_WALL_THICKNESS_MM, width: opening.width.valueMm, height: PLAN_WALL_THICKNESS_MM }
    : opening.wall === 'south' ? { x: start, y: depth, width: opening.width.valueMm, height: PLAN_WALL_THICKNESS_MM }
      : opening.wall === 'west' ? { x: -PLAN_WALL_THICKNESS_MM, y: start, width: PLAN_WALL_THICKNESS_MM, height: opening.width.valueMm }
        : { x: width, y: start, width: PLAN_WALL_THICKNESS_MM, height: opening.width.valueMm }
}

function openingBadgePoint(opening: Opening, width: number, depth: number): PointMm {
  const start = opening.offset.valueMm
  const end = start + opening.width.valueMm
  return opening.wall === 'north' ? { xMm: end, yMm: -PLAN_WALL_THICKNESS_MM }
    : opening.wall === 'south' ? { xMm: end, yMm: depth + PLAN_WALL_THICKNESS_MM }
      : opening.wall === 'west' ? { xMm: -PLAN_WALL_THICKNESS_MM, yMm: end }
        : { xMm: width + PLAN_WALL_THICKNESS_MM, yMm: start }
}

function wallName(locale: Locale, wall: Wall): string {
  return t(locale, wall === 'north' ? 'wallNorth' : wall === 'south' ? 'wallSouth' : wall === 'east' ? 'wallEast' : 'wallWest')
}

function dimensionDescription(locale: Locale, dimension: PlanDimension): string {
  return dimension.kind === 'overall'
    ? t(locale, dimension.wall === 'north' ? 'overallRoomWidth' : 'overallRoomDepth')
    : dimension.kind === 'chain'
      ? `${wallName(locale, dimension.wall)} · ${t(locale, 'wallDimensionChain')}`
      : `${t(locale, 'clearanceToWall')} · ${wallName(locale, dimension.side ?? dimension.wall)}`
}

function checkStatus(options: PlanSceneOptions, entityId: string): EntityCheckStatus | undefined {
  return options.showCheckMarks === false ? undefined : options.checkStatuses?.get(entityId)
}

/**
 * Derives the complete plan drawing once so the interactive canvas and SVG export
 * consume the same geometry, defaults, labels, and check-marker positions.
 */
export function buildPlanScene(layout: Layout, options: PlanSceneOptions): PlanScene {
  const room = getPrimaryRoom(layout)
  const floor = getPrimaryFloor(layout)
  const widthMm = room.shape.width.valueMm
  const depthMm = room.shape.depth.valueMm
  const scale = Math.max(0.4, Math.min(1, Math.max(widthMm, depthMm) / 6000))
  const schedule = buildPlanSchedule(room)
  const itemNumbers = new Map(schedule.items.map((entry) => [entry.id, entry.number]))
  const baseAnnotations = buildPlanAnnotations(room, {
    roomType: t(options.locale, room.type === 'bathroom' ? 'roomBathroom' : 'roomLiving'),
    planNorth: t(options.locale, 'planNorth'),
    scaleBar: t(options.locale, 'scaleBar'),
  })
  const annotations: PlanSceneAnnotations = {
    ...baseAnnotations,
    roomLabel: {
      ...baseAnnotations.roomLabel,
      typeY: baseAnnotations.roomLabel.point.yMm - 75 * scale,
      areaY: baseAnnotations.roomLabel.point.yMm + 95 * scale,
    },
  }
  const selectedItem = room.items.find((item) => item.id === options.selectedItemId)
  const selectedItemForDimensions = selectedItem && options.movePreview?.id === selectedItem.id
    ? { ...selectedItem, center: { xMm: options.movePreview.xMm, yMm: options.movePreview.yMm } }
    : selectedItem
  const showDimensions = options.showDimensions !== false
  const drawing = buildPlanDrawing(room)
  const primitives: PlanScenePrimitive[] = [
    ...drawing.walls.map((geometry) => ({ kind: 'wall' as const, geometry, styleToken: 'wall' as const })),
    ...room.wetZones.map((zone) => ({
      kind: 'wet-zone' as const,
      entityId: zone.id,
      label: zone.label,
      geometry: { x: zone.rect.minX, y: zone.rect.minY, width: zone.rect.maxX - zone.rect.minX, height: zone.rect.maxY - zone.rect.minY },
      styleToken: 'wet' as const,
    })),
  ]

  if (options.showOverlays) {
    primitives.push(...floor.routes.map((entity) => {
      const points = entity.points.map((point) => toRoomPoint(room, point))
      const canvasWidthKnown = entity.widthMm !== null || options.routeTargetMm !== null && options.routeTargetMm !== undefined
      const exportWidthKnown = entity.widthMm !== null
      return {
        kind: 'route' as const,
        entity,
        geometry: {
          points,
          widthMm: {
            canvas: entity.widthMm ?? options.routeTargetMm ?? 28 * scale,
            export: entity.widthMm ?? 28 * scale,
          },
          widthKnown: { canvas: canvasWidthKnown, export: exportWidthKnown },
          checkWidthMm: 64 * scale,
          badge: points[0] ?? { xMm: 0, yMm: 0 },
          opacity: { canvas: canvasWidthKnown ? 0.18 : 0.75, export: exportWidthKnown ? 0.16 : 0.75 },
        },
        styleToken: entity.id === options.selectedEntityId ? 'selection' as const : 'route' as const,
        label: {
          canvas: entity.widthMm === null ? t(options.locale, 'checkNotEvaluated') : `${entity.widthMm} mm`,
          export: entity.widthMm === null ? (options.locale === 'th' ? 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸„à¸§à¸²à¸¡à¸à¸§à¹‰à¸²à¸‡' : 'Width not set') : `${entity.widthMm} mm`,
        },
        selected: entity.id === options.selectedEntityId,
        checkStatus: checkStatus(options, entity.id),
      }
    }))
    primitives.push(...floor.turningAreas.map((entity) => {
      const center = toRoomPoint(room, entity.center)
      const canvasDiameter = entity.diameterMm ?? options.turningTargetMm ?? null
      const exportDiameter = entity.diameterMm
      const canvasRadius = (canvasDiameter ?? 400) / 2
      const exportRadius = (exportDiameter ?? 800) / 2
      return {
        kind: 'turning-area' as const,
        entity,
        geometry: {
          center,
          radiusMm: { canvas: canvasRadius, export: exportRadius },
          checkRadiusMm: { canvas: canvasRadius + 70 * scale, export: exportRadius + 70 * scale },
          badge: {
            canvas: { xMm: center.xMm + canvasRadius, yMm: center.yMm - canvasRadius },
            export: { xMm: center.xMm + exportRadius, yMm: center.yMm - exportRadius },
          },
        },
        styleToken: entity.id === options.selectedEntityId ? 'selection' as const : 'turning' as const,
        selected: entity.id === options.selectedEntityId,
        hasDiameter: { canvas: canvasDiameter !== null, export: exportDiameter !== null },
        checkStatus: checkStatus(options, entity.id),
      }
    }))
  }

  primitives.push(...drawing.openings.map(({ opening, ...openingDrawing }) => {
    const status = checkStatus(options, opening.id)
    const label = t(options.locale, opening.kind)
    return {
      kind: 'opening' as const,
      entity: opening,
      geometry: { drawing: { opening, ...openingDrawing }, outline: openingOutline(opening, widthMm, depthMm), badge: openingBadgePoint(opening, widthMm, depthMm) },
      label,
      selected: opening.id === options.selectedEntityId,
      checkStatus: status,
    }
  }))

  primitives.push(...room.items.map((original) => {
    const item = options.movePreview?.id === original.id
      ? { ...original, center: { xMm: options.movePreview.xMm, yMm: options.movePreview.yMm } }
      : original
    const x = -item.width.valueMm / 2
    const y = -item.depth.valueMm / 2
    const visibleDepth = item.rotationDeg % 180 === 0 ? item.depth.valueMm : item.width.valueMm
    const angle = item.rotationDeg * Math.PI / 180
    const status = checkStatus(options, item.id)
    return {
      kind: 'item' as const,
      entity: item,
      geometry: {
        center: item.center,
        footprint: getFootprint(item),
        localFootprint: { x, y, width: item.width.valueMm, height: item.depth.valueMm },
        checkOutline: { x: x - 45 * scale, y: y - 45 * scale, width: item.width.valueMm + 90 * scale, height: item.depth.valueMm + 90 * scale },
        numberY: y - 100 * scale,
        labelY: visibleDepth / 2 + 100 * scale,
        badgePoints: {
          world: {
            xMm: item.center.xMm + item.width.valueMm / 2 * Math.cos(angle) + item.depth.valueMm / 2 * Math.sin(angle),
            yMm: item.center.yMm + item.width.valueMm / 2 * Math.sin(angle) - item.depth.valueMm / 2 * Math.cos(angle),
          },
          local: { xMm: item.width.valueMm / 2, yMm: -item.depth.valueMm / 2 },
        },
      },
      itemNumber: itemNumbers.get(item.id) ?? 0,
      selected: item.id === options.selectedItemId,
      styleToken: item.obstruction === 'rug' ? 'rug' as const : item.finish,
      symbol: planSymbol(item.catalogId),
      checkStatus: status,
      dimensionsLabel: `${item.width.valueMm} × ${item.depth.valueMm} mm · ${options.locale === 'th' ? (item.width.confidence === 'advisor-verified' ? 'à¸œà¸¹à¹‰à¹ƒà¸«à¹‰à¸„à¸³à¸›à¸£à¸¶à¸à¸©à¸²à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š' : item.width.confidence === 'measured' ? 'à¸§à¸±à¸”à¹à¸¥à¹‰à¸§' : 'à¸›à¸£à¸°à¸¡à¸²à¸“à¸à¸²à¸£') : item.width.confidence === 'advisor-verified' ? 'Advisor verified' : item.width.confidence === 'measured' ? 'Measured' : 'Estimated'} / ${options.locale === 'th' ? (item.depth.confidence === 'advisor-verified' ? 'à¸œà¸¹à¹‰à¹ƒà¸«à¹‰à¸„à¸³à¸›à¸£à¸¶à¸à¸©à¸²à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š' : item.depth.confidence === 'measured' ? 'à¸§à¸±à¸”à¹à¸¥à¹‰à¸§' : 'à¸›à¸£à¸°à¸¡à¸²à¸“à¸à¸²à¸£') : item.depth.confidence === 'advisor-verified' ? 'Advisor verified' : item.depth.confidence === 'measured' ? 'Measured' : 'Estimated'}`,
    }
  }))

  primitives.push(...room.fixtures.map((entity) => {
    const { footprint } = getFixtureSpan(entity, room)
    const width = Math.max(footprint.maxX - footprint.minX, 30 * scale)
    const height = Math.max(footprint.maxY - footprint.minY, 30 * scale)
    const status = checkStatus(options, entity.id)
    return {
      kind: 'fixture' as const,
      entity,
      geometry: {
        footprint,
        width,
        height,
        shape: { x: footprint.minX - 16 * scale, y: footprint.minY - 16 * scale, width: width + 32 * scale, height: height + 32 * scale },
        checkOutline: { x: footprint.minX - 16 * scale - 28 * scale, y: footprint.minY - 16 * scale - 28 * scale, width: width + 32 * scale + 56 * scale, height: height + 32 * scale + 56 * scale },
        badge: { xMm: footprint.maxX, yMm: footprint.minY },
      },
      selected: entity.id === options.selectedEntityId,
      styleToken: entity.kind.startsWith('grab-bar') ? 'grab-bar' as const : 'fixture' as const,
      symbol: entity.kind === 'basin' ? planSymbol('basin') : [],
      checkStatus: status,
    }
  }))

  const dimensions = showDimensions ? buildPlanDimensions(room, selectedItemForDimensions) : []
  primitives.push(...dimensions.map((geometry) => ({
    kind: 'dimension' as const,
    geometry,
    description: `${dimensionDescription(options.locale, geometry)}: ${geometry.label}`,
    styleToken: 'dimension' as const,
  })))
  primitives.push({ kind: 'annotation', geometry: annotations, styleToken: 'annotation' })

  const roomResults = options.roomCheckResults ?? []
  return {
    roomId: room.id,
    widthMm,
    depthMm,
    scale,
    viewBox: {
      x: -PLAN_DIMENSION_MARGIN_MM,
      y: -PLAN_DIMENSION_MARGIN_MM,
      width: widthMm + PLAN_DIMENSION_MARGIN_MM * 2,
      height: depthMm + PLAN_DIMENSION_MARGIN_MM * 2,
    },
    wallLines: wallLines(widthMm, depthMm),
    badgeSizeMm: 400 * scale,
    legendY: depthMm + PLAN_DIMENSION_MARGIN_MM - 35,
    schedule,
    primitives,
    roomCheckCounts: {
      attention: roomResults.filter((result) => result.status === 'attention').length,
      notEvaluated: roomResults.filter((result) => result.status === 'not-evaluated').length,
    },
  }
}
