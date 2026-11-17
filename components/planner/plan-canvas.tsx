'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { getFixtureSpan, getFootprint } from '@/lib/planner/geometry'
import { isFurnitureWithinRoom, moveFurnitureInLayout, snapToGridMm } from '@/lib/planner/furniture-movement'
import { getPrimaryFloor, getPrimaryRoom, toRoomPoint } from '@/lib/planner/layout-access'
import { buildPlanAnnotations } from '@/lib/planner/plan-annotations'
import { buildPlanDrawing, PLAN_WALL_THICKNESS_MM, planSymbol, type PlanSymbolMark } from '@/lib/planner/plan-drawing'
import { buildPlanDimensions, PLAN_DIMENSION_MARGIN_MM } from '@/lib/planner/plan-dimensions'
import { PLAN_PALETTE } from '@/lib/planner/plan-palette'
import { buildPlanSchedule } from '@/lib/planner/plan-schedule'
import { getEntityStatuses, type EntityCheckStatus } from '@/lib/planner/checks'
import type { CheckResult, FallRecord, FurnitureItem, Layout, LayoutId, Locale, PointMm, Project, Wall } from '@/lib/planner/types'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { PlanSchedule } from './plan-schedule'
import { CheckMarkBadge } from './check-mark-badge'
import { useMoveCheckPreview } from './use-move-check-preview'

type Placement = { catalogId: string; label: string; widthMm: number; depthMm: number; heightMm: number; finish: FurnitureItem['finish']; obstruction: FurnitureItem['obstruction'] }
type OverlayTool = 'route' | 'turning' | null
type Props = {
  layout: Layout; locale: Locale; selectionId: string | null; routeTargetMm?: number | null; turningTargetMm?: number | null
  showDimensions: boolean; onToggleDimensions(show: boolean): void
  placement?: Placement | null; overlayTool?: OverlayTool
  /** Recorded falls to mark. Their points are in this room's coordinates. */
  falls?: FallRecord[]
  /** True while the user is picking where a fall happened. */
  pickingFall?: boolean
  /** Entities to outline, e.g. what a fix preview would change. */
  highlightIds?: readonly string[]
  checkStatuses: ReadonlyMap<string, EntityCheckStatus>
  roomCheckResults: CheckResult[]
  showCheckMarks: boolean
  project: Project; layoutId: LayoutId; checkResults: CheckResult[]
  onToggleCheckMarks(show: boolean): void
  onSelectCheckResult(resultId: string): void
  onSelect(id: string | null): void; onCommitLayout(layout: Layout): void; onPlace(center: { xMm: number; yMm: number }): void; onCancelPlacement(): void
  onPlaceRoute(points: PointMm[]): void; onPlaceTurning(center: PointMm): void; onCancelOverlay(): void
  onPickFall?(point: PointMm): void; onCancelPickFall?(): void
  /** Clicking a wall line picks that wall, e.g. to open its elevation. */
  onSelectWall?(wall: Wall): void
}
type Preview = { id: string; xMm: number; yMm: number }

function SymbolMarks({ marks }: { marks: PlanSymbolMark[] }) {
  return <>{marks.map((mark, index) => mark.kind === 'rect'
    ? <rect key={index} x={mark.x} y={mark.y} width={mark.width} height={mark.height} rx={mark.rx} vectorEffect="non-scaling-stroke" />
    : mark.kind === 'ellipse'
      ? <ellipse key={index} cx={mark.cx} cy={mark.cy} rx={mark.rx} ry={mark.ry} vectorEffect="non-scaling-stroke" />
      : mark.kind === 'line'
        ? <line key={index} x1={mark.x1} y1={mark.y1} x2={mark.x2} y2={mark.y2} vectorEffect="non-scaling-stroke" />
        : <path key={index} d={mark.d} vectorEffect="non-scaling-stroke" />)}</>
}

function FurnitureShape({ item, itemNumber, selected, highlighted, xMm, yMm, scale, onPointerDown, onKeyDown, onKeyUp, label, checkStatus, checkMarksVisible, locale, onSelectCheckResult }: {
  item: FurnitureItem; itemNumber: number; selected: boolean; highlighted: boolean; xMm: number; yMm: number; scale: number; onPointerDown(event: ReactPointerEvent<SVGGElement>, item: FurnitureItem): void;
  onKeyDown(event: KeyboardEvent<SVGGElement>, item: FurnitureItem): void; onKeyUp(event: KeyboardEvent<SVGGElement>, item: FurnitureItem): void; label: string; checkStatus?: EntityCheckStatus; checkMarksVisible: boolean; locale: Locale; onSelectCheckResult(resultId: string): void
}) {
  const width = item.rotationDeg % 180 === 0 ? item.width.valueMm : item.depth.valueMm
  const depth = item.rotationDeg % 180 === 0 ? item.depth.valueMm : item.width.valueMm
  const className = item.obstruction === 'rug' ? 'plan-rug' : `plan-item finish-${item.finish}`
  const marks = planSymbol(item.catalogId)
  const angle = item.rotationDeg * Math.PI / 180
  const badgeX = xMm + item.width.valueMm / 2 * Math.cos(angle) + item.depth.valueMm / 2 * Math.sin(angle)
  const badgeY = yMm + item.width.valueMm / 2 * Math.sin(angle) - item.depth.valueMm / 2 * Math.cos(angle)
  return <>
  <g
    role="button" tabIndex={0} aria-label={label} aria-pressed={selected}
    data-item-id={item.id} data-item-number={itemNumber} data-x-mm={xMm} data-y-mm={yMm} data-rotation={item.rotationDeg} data-entity-check-status={checkMarksVisible ? checkStatus?.status : undefined}
    className={`${className} ${selected ? 'selected' : ''} ${highlighted ? 'changed' : ''}`}
    transform={`translate(${xMm} ${yMm}) rotate(${item.rotationDeg})`}
    onPointerDown={(event) => onPointerDown(event, item)} onKeyDown={(event) => onKeyDown(event, item)} onKeyUp={(event) => onKeyUp(event, item)}
  >
    <rect className="item-footprint" x={-item.width.valueMm / 2} y={-item.depth.valueMm / 2} width={item.width.valueMm} height={item.depth.valueMm} pointerEvents="all" />
    <g className="item-symbol" transform={`translate(${-item.width.valueMm / 2} ${-item.depth.valueMm / 2}) scale(${item.width.valueMm} ${item.depth.valueMm})`}><SymbolMarks marks={marks} /></g>
    <text className="plan-item-number" textAnchor="middle" dominantBaseline="central" x={0} y={-item.depth.valueMm / 2 - 100 * scale} transform={`rotate(${-item.rotationDeg} 0 ${-item.depth.valueMm / 2 - 100 * scale})`} aria-hidden="true" pointerEvents="none">{itemNumber}</text>
    {/* The label stays upright and below the piece whatever its rotation. */}
    <text textAnchor="middle" dominantBaseline="central" transform={`rotate(${-item.rotationDeg})`} y={depth / 2 + 100 * scale}>{item.label}</text>
    {checkMarksVisible && checkStatus && checkStatus.status !== 'clear' && <>
      <rect className={`check-marker-outline check-marker-outline-${checkStatus.status}`} x={-item.width.valueMm / 2 - 45 * scale} y={-item.depth.valueMm / 2 - 45 * scale} width={item.width.valueMm + 90 * scale} height={item.depth.valueMm + 90 * scale} rx={24 * scale} pointerEvents="none" />
    </>}
    <title>{`${item.label} · ${width} × ${depth} mm`}</title>
  </g>
    {checkMarksVisible && checkStatus && checkStatus.status !== 'clear' && <g transform={`translate(${badgeX} ${badgeY}) rotate(${-item.rotationDeg})`}><CheckMarkBadge status={checkStatus} entityId={item.id} entityLabel={item.label} locale={locale} x={0} y={0} size={400 * scale} onActivate={onSelectCheckResult} /></g>}
  </>
}

export function PlanCanvas({ layout, locale, selectionId, showDimensions, onToggleDimensions, routeTargetMm, turningTargetMm, placement, overlayTool = null, falls = [], pickingFall = false, highlightIds = [], checkStatuses: baseCheckStatuses, roomCheckResults: baseRoomCheckResults, showCheckMarks, project, layoutId, checkResults, onToggleCheckMarks, onSelectCheckResult, onSelect, onCommitLayout, onPlace, onCancelPlacement, onPlaceRoute, onPlaceTurning, onCancelOverlay, onPickFall, onCancelPickFall, onSelectWall }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; xMm: number; yMm: number } | null>(null)
  const keyboardMoveRef = useRef<{ id: string; xMm: number; yMm: number } | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const moveFeedback = useMoveCheckPreview(project, layoutId, checkResults, locale)
  const clearMoveFeedback = moveFeedback.clear
  const [overlayCursor, setOverlayCursor] = useState<PointMm | null>(null)
  const [routeDraft, setRouteDraft] = useState<{ tool: OverlayTool; points: PointMm[] }>({ tool: null, points: [] })
  const [message, setMessage] = useState('')
  const room = getPrimaryRoom(layout)
  const floor = getPrimaryFloor(layout)
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  const annotations = buildPlanAnnotations(room, {
    roomType: t(locale, room.type === 'bathroom' ? 'roomBathroom' : 'roomLiving'),
    planNorth: t(locale, 'planNorth'),
    scaleBar: t(locale, 'scaleBar'),
  })
  const drawing = buildPlanDrawing(room)
  const schedule = buildPlanSchedule(room)
  const itemNumbers = new Map(schedule.items.map((entry) => [entry.id, entry.number]))
  const selectedItem = room.items.find((item) => item.id === selectionId)
  const selectedDimensionItem = selectedItem && preview?.id === selectedItem.id
    ? { ...selectedItem, center: { xMm: preview.xMm, yMm: preview.yMm } }
    : selectedItem
  const activeResults = moveFeedback.preview?.results ?? checkResults
  const checkStatuses = useMemo(() => moveFeedback.preview ? getEntityStatuses(activeResults) : baseCheckStatuses, [activeResults, baseCheckStatuses, moveFeedback.preview])
  const roomCheckResults = moveFeedback.preview ? activeResults.filter((result) => result.entityIds.length === 0) : baseRoomCheckResults
  const roomAttentionResults = roomCheckResults.filter((result) => result.status === 'attention')
  const roomPendingResults = roomCheckResults.filter((result) => result.status === 'not-evaluated')
  const previewItem = preview && preview.id !== '__placement__' ? room.items.find((item) => item.id === preview.id) : undefined
  const previewOutside = !!(previewItem && preview && outsideRoom({ ...previewItem, center: { xMm: preview.xMm, yMm: preview.yMm } }))
  // Line weights and labels are sized for a 6 m room; smaller rooms scale them down so a bathroom stays legible.
  const scale = Math.max(0.4, Math.min(1, Math.max(width, depth) / 6000))
  const snap = snapToGridMm

  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !(dragRef.current || keyboardMoveRef.current || placement || overlayTool || pickingFall)) return
      if (dragRef.current) {
        dragRef.current = null
        setPreview(null)
        clearMoveFeedback()
        setMessage('')
      }
      if (keyboardMoveRef.current) {
        keyboardMoveRef.current = null
        setPreview(null)
        clearMoveFeedback()
      }
      if (placement) onCancelPlacement()
      if (pickingFall) onCancelPickFall?.()
      if (overlayTool) {
        setRouteDraft({ tool: null, points: [] })
        setOverlayCursor(null)
        onCancelOverlay()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [placement, overlayTool, pickingFall, onCancelPlacement, onCancelOverlay, onCancelPickFall, clearMoveFeedback])

  function chipPoint(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect()
    return { left: rect ? clientX - rect.left + 12 : 12, top: rect ? clientY - rect.top + 12 : 12 }
  }
  function modelChipPoint(point: PointMm) {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return { left: 12, top: 12 }
    const screen = svg.createSVGPoint()
    screen.x = point.xMm
    screen.y = point.yMm
    const client = screen.matrixTransform(matrix)
    return chipPoint(client.x, client.y)
  }

  function modelPoint(event: { clientX: number; clientY: number }) {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()?.inverse()
    if (!svg || !matrix) return { xMm: 0, yMm: 0 }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const model = point.matrixTransform(matrix)
    return { xMm: model.x, yMm: model.y }
  }
  const clampToRoom = (point: PointMm): PointMm => ({ xMm: Math.min(width, Math.max(0, snap(point.xMm))), yMm: Math.min(depth, Math.max(0, snap(point.yMm))) })

  function onItemPointerDown(event: ReactPointerEvent<SVGGElement>, item: FurnitureItem) {
    if (pickingFall || placement || overlayTool) return
    event.stopPropagation()
    keyboardMoveRef.current = null
    setMessage('')
    dragRef.current = { id: item.id, xMm: item.center.xMm, yMm: item.center.yMm }
    ;(event.currentTarget as SVGGElement).setPointerCapture(event.pointerId)
    setPreview({ id: item.id, xMm: item.center.xMm, yMm: item.center.yMm })
    const chip = chipPoint(event.clientX, event.clientY)
    moveFeedback.begin(item.id, item.center, chip.left, chip.top)
  }

  function findItem(id: string) { return room.items.find((item) => item.id === id) }
  function commitMovedItem(moved: FurnitureItem): boolean {
    const result = moveFurnitureInLayout(layout, moved.id, moved.center)
    if (!result.ok) return false
    onCommitLayout(result.layout)
    return true
  }
  function outsideRoom(item: FurnitureItem) {
    return !isFurnitureWithinRoom(layout, item)
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (overlayTool) { setOverlayCursor(clampToRoom(modelPoint(event))); return }
    if (placement) {
      const point = modelPoint(event)
      setPreview({ id: '__placement__', xMm: snap(point.xMm), yMm: snap(point.yMm) })
      return
    }
    if (!dragRef.current) return
    const point = modelPoint(event)
    const item = findItem(dragRef.current.id)
    if (!item) return
    const xMm = snap(point.xMm)
    const yMm = snap(point.yMm)
    dragRef.current = { ...dragRef.current, xMm, yMm }
    setPreview({ id: item.id, xMm, yMm })
    const chip = chipPoint(event.clientX, event.clientY)
    moveFeedback.schedule(item.id, { xMm, yMm }, chip.left, chip.top)
  }

  function onPointerUp() {
    if (!dragRef.current) return
    const dropped = dragRef.current
    const item = findItem(dragRef.current.id)
    dragRef.current = null
    setPreview(null)
    moveFeedback.clear()
    if (!item) return
    onSelect(item.id)
    const moved = { ...item, center: { xMm: dropped.xMm, yMm: dropped.yMm } }
    if (outsideRoom(moved)) {
      setMessage(t(locale, 'outOfBounds'))
      return
    }
    if (!commitMovedItem(moved)) {
      setMessage(t(locale, 'outOfBounds'))
      return
    }
    setMessage('')
  }

  function keyboardMove(event: KeyboardEvent<SVGGElement>, item: FurnitureItem) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const delta = event.shiftKey ? 50 : 10
    const dx = event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0
    const dy = event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0
    const current = keyboardMoveRef.current?.id === item.id ? keyboardMoveRef.current : item.center
    const center = { xMm: current.xMm + dx, yMm: current.yMm + dy }
    const moved = { ...item, center }
    if (outsideRoom(moved)) return
    if (keyboardMoveRef.current?.id !== item.id) {
      const chip = modelChipPoint(current)
      moveFeedback.begin(item.id, item.center, chip.left, chip.top)
    }
    keyboardMoveRef.current = { id: item.id, ...center }
    setPreview({ id: item.id, ...center })
    const chip = modelChipPoint(center)
    moveFeedback.schedule(item.id, center, chip.left, chip.top)
  }

  function keyboardMoveEnd(event: KeyboardEvent<SVGGElement>, item: FurnitureItem) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    const pending = keyboardMoveRef.current
    if (!pending || pending.id !== item.id) return
    keyboardMoveRef.current = null
    setPreview(null)
    moveFeedback.clear()
    commitMovedItem({ ...item, center: { xMm: pending.xMm, yMm: pending.yMm } })
  }

  const openingGaps = drawing.openings.map(({ opening, windowLines, doorLeaf, swingPath, outward, slidingArrow }) => {
    const selected = selectionId === opening.id
    const status = checkStatuses.get(opening.id)
    const start = opening.offset.valueMm, end = start + opening.width.valueMm
    const openingBox = opening.wall === 'north'
      ? { x: start, y: -PLAN_WALL_THICKNESS_MM, width: opening.width.valueMm, height: PLAN_WALL_THICKNESS_MM }
      : opening.wall === 'south'
        ? { x: start, y: depth, width: opening.width.valueMm, height: PLAN_WALL_THICKNESS_MM }
        : opening.wall === 'west'
          ? { x: -PLAN_WALL_THICKNESS_MM, y: start, width: PLAN_WALL_THICKNESS_MM, height: opening.width.valueMm }
          : { x: width, y: start, width: PLAN_WALL_THICKNESS_MM, height: opening.width.valueMm }
    const badgePoint = opening.wall === 'north' ? { x: end, y: -PLAN_WALL_THICKNESS_MM }
      : opening.wall === 'south' ? { x: end, y: depth + PLAN_WALL_THICKNESS_MM }
        : opening.wall === 'west' ? { x: -PLAN_WALL_THICKNESS_MM, y: end }
          : { x: width + PLAN_WALL_THICKNESS_MM, y: start }
    const label = opening.kind === 'door' ? t(locale, 'door') : t(locale, 'window')
    return <g key={opening.id} role="group" data-opening-id={opening.id} data-entity-check-status={showCheckMarks ? status?.status : undefined} className={`${selected ? 'opening-selected' : ''} ${highlightIds.includes(opening.id) ? 'changed' : ''}`} aria-label={label}>
      {showCheckMarks && status && status.status !== 'clear' && <rect {...openingBox} className={`check-marker-outline check-marker-outline-${status.status}`} pointerEvents="none" />}
      {swingPath && <path d={swingPath} fill="none" className={`door-swing ${outward ? 'door-swing-out' : ''}`} />}
      {doorLeaf && <line {...doorLeaf} className={`opening-line door-leaf ${outward ? 'door-leaf-out' : ''}`} />}
      {windowLines.map((line, index) => <line key={index} {...line} className="window-line" />)}
      {slidingArrow && <path d={slidingArrow} className="sliding-arrow" />}
      {showCheckMarks && status && <CheckMarkBadge status={status} entityId={opening.id} entityLabel={label} locale={locale} x={badgePoint.x} y={badgePoint.y} size={400 * scale} onActivate={onSelectCheckResult} />}
    </g>
  })

  const wallLines: { wall: Wall; x1: number; y1: number; x2: number; y2: number }[] = [
    { wall: 'north', x1: 0, y1: 0, x2: width, y2: 0 }, { wall: 'south', x1: 0, y1: depth, x2: width, y2: depth },
    { wall: 'west', x1: 0, y1: 0, x2: 0, y2: depth }, { wall: 'east', x1: width, y1: 0, x2: width, y2: depth },
  ]
  const wallName = (wall: Wall) => t(locale, wall === 'north' ? 'wallNorth' : wall === 'south' ? 'wallSouth' : wall === 'east' ? 'wallEast' : 'wallWest')
  const dimensions = showDimensions ? buildPlanDimensions(room, selectedDimensionItem) : []
  const dimensionDescription = (dimension: (typeof dimensions)[number]) => dimension.kind === 'overall'
    ? t(locale, dimension.wall === 'north' ? 'overallRoomWidth' : 'overallRoomDepth')
    : dimension.kind === 'chain'
      ? `${wallName(dimension.wall)} · ${t(locale, 'wallDimensionChain')}`
      : `${t(locale, 'clearanceToWall')} · ${wallName(dimension.side ?? dimension.wall)}`
  const busy = !!placement || !!overlayTool || pickingFall
  const style = { '--k': scale } as CSSProperties

  return <div className="canvas-wrap">
    <div className="canvas-caption">
      <div><p className="eyebrow">{t(locale, 'roomPlan')}</p><span>{(width / 1000).toFixed(2)} × {(depth / 1000).toFixed(2)} m</span>{placement && <span className="placement-hint"> · {t(locale, 'placingHint')}</span>}{overlayTool && <span className="placement-hint"> · {t(locale, 'drawingHint')}</span>}{pickingFall && <span className="placement-hint"> · {t(locale, 'fallPickHint')}</span>}</div>
      <div className="canvas-caption-actions">
        <Button type="button" variant="outline" aria-pressed={showDimensions} onClick={() => onToggleDimensions(!showDimensions)}>{t(locale, showDimensions ? 'dimensionsEnabled' : 'dimensionsDisabled')}</Button>
        <Button type="button" variant="outline" aria-pressed={showCheckMarks} onClick={() => onToggleCheckMarks(!showCheckMarks)}>{t(locale, showCheckMarks ? 'checkMarksEnabled' : 'checkMarksDisabled')}</Button>
        {showCheckMarks && roomAttentionResults.length > 0 && <button type="button" className="room-check-badge room-check-badge-attention" aria-label={`${t(locale, 'roomCheckMarkers')}: ${roomAttentionResults.length} ${t(locale, 'checkMarkerAttentionSummary')}`} onClick={() => onSelectCheckResult(roomAttentionResults[0].id)}><span aria-hidden="true">!</span>{roomAttentionResults.length}</button>}
        {showCheckMarks && roomPendingResults.length > 0 && <button type="button" className="room-check-badge room-check-badge-not-evaluated" aria-label={`${t(locale, 'roomCheckMarkers')}: ${roomPendingResults.length} ${t(locale, 'checkMarkerNotEvaluatedSummary')}`} onClick={() => onSelectCheckResult(roomPendingResults[0].id)}><span aria-hidden="true">?</span>{roomPendingResults.length}</button>}
        {overlayTool === 'route' ? <div className="overlay-canvas-actions"><Button type="button" onClick={() => { if (routeDraft.tool !== 'route' || routeDraft.points.length < 2) { setMessage(t(locale, 'drawingNeedTwoPoints')); return } onPlaceRoute(routeDraft.points); setRouteDraft({ tool: null, points: [] }); setOverlayCursor(null) }} disabled={routeDraft.tool !== 'route' || routeDraft.points.length < 2}>{t(locale, 'finishRoute')}</Button><Button type="button" variant="outline" onClick={() => { setRouteDraft({ tool: null, points: [] }); setOverlayCursor(null); onCancelOverlay() }}>{t(locale, 'cancelDrawing')}</Button></div> : overlayTool === 'turning' ? <Button type="button" variant="outline" onClick={onCancelOverlay}>{t(locale, 'cancelDrawing')}</Button> : pickingFall ? <Button type="button" variant="outline" onClick={() => onCancelPickFall?.()}>{t(locale, 'cancelDrawing')}</Button> : <span className="confidence-pill">{t(locale, 'estimated')}</span>}
      </div>
    </div>
    <div className="canvas-stage" ref={stageRef}>
      <svg ref={svgRef} style={style} role="group" aria-label={`${t(locale, 'roomPlan')} ${(width / 1000).toFixed(1)} × ${(depth / 1000).toFixed(1)} m`} viewBox={`${-PLAN_DIMENSION_MARGIN_MM} ${-PLAN_DIMENSION_MARGIN_MM} ${width + PLAN_DIMENSION_MARGIN_MM * 2} ${depth + PLAN_DIMENSION_MARGIN_MM * 2}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={(event) => {
        if (pickingFall) {
          event.stopPropagation()
          const point = modelPoint(event)
          onPickFall?.({ xMm: Math.min(width, Math.max(0, Math.round(point.xMm / 10) * 10)), yMm: Math.min(depth, Math.max(0, Math.round(point.yMm / 10) * 10)) })
          return
        }
        if (placement) {
          event.stopPropagation()
          const point = modelPoint(event)
          const center = { xMm: snap(point.xMm), yMm: snap(point.yMm) }
          const footprint = getFootprint({ id: 'preview', catalogId: placement.catalogId, label: placement.label, center, width: { valueMm: placement.widthMm, confidence: 'estimated' }, depth: { valueMm: placement.depthMm, confidence: 'estimated' }, height: { valueMm: placement.heightMm, confidence: 'estimated' }, rotationDeg: 0, finish: placement.finish, obstruction: placement.obstruction })
          if (footprint.minX < 0 || footprint.minY < 0 || footprint.maxX > width || footprint.maxY > depth) { setMessage(t(locale, 'outOfBounds')); return }
          setMessage('')
          onPlace(center)
          setPreview(null)
          return
        }
        if (overlayTool) {
          const center = clampToRoom(modelPoint(event))
          if (overlayTool === 'turning') {
            onPlaceTurning(center)
            setOverlayCursor(null)
          } else {
            const points = routeDraft.tool === 'route' ? routeDraft.points : []
            setRouteDraft({ tool: 'route', points: [...points, center].slice(0, 12) })
          }
          return
        }
        if (!dragRef.current && event.target === event.currentTarget) onSelect(null)
      }}>
        <defs><pattern id="room-grid" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#d9e1d5" strokeWidth={8 * scale} /></pattern><pattern id="plan-wet-zone-hatch" width="160" height="160" patternUnits="userSpaceOnUse"><rect width="160" height="160" fill="#e8f0f3" /><path d="M -40 40 L40 -40 M0 160 L160 0 M120 200 L200 120" fill="none" stroke={PLAN_PALETTE.wet} strokeWidth={18 * scale} /></pattern><filter id="item-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy={24 * scale} stdDeviation={18 * scale} floodColor="#21382d" floodOpacity=".12" /></filter></defs>
        {drawing.walls.map((wall, index) => <rect key={index} className="plan-wall" x={wall.x} y={wall.y} width={wall.width} height={wall.height} />)}
        <rect width={width} height={depth} className="room-floor" />
        <rect width={width} height={depth} fill="url(#room-grid)" />
        {room.wetZones.map((zone) => <g key={zone.id} data-wet-zone-id={zone.id} className={`wet-zone ${highlightIds.includes(zone.id) ? 'changed' : ''}`} pointerEvents="none">
          <rect x={zone.rect.minX} y={zone.rect.minY} width={zone.rect.maxX - zone.rect.minX} height={zone.rect.maxY - zone.rect.minY} />
          <text x={zone.rect.minX + 60 * scale} y={zone.rect.minY + 150 * scale}>{zone.label}</text>
        </g>)}
        {floor.routes.map((route) => {
          const widthMm = route.widthMm ?? routeTargetMm ?? null
          const selected = selectionId === route.id
          const routePoints = route.points.map((point) => toRoomPoint(room, point))
          const points = routePoints.map((point) => `${point.xMm},${point.yMm}`).join(' ')
          const status = checkStatuses.get(route.id)
          const markerPoint = routePoints[0]
          return <g key={route.id}>
            <g role="button" tabIndex={busy ? -1 : 0} aria-label={`${t(locale, 'routeOverlay')}: ${route.label}`} aria-pressed={selected} data-overlay-id={route.id} data-entity-check-status={showCheckMarks ? status?.status : undefined} className={`route-overlay ${selected ? 'selected' : ''}`} pointerEvents={busy ? 'none' : undefined} onClick={(event) => { event.stopPropagation(); onSelect(route.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(route.id) } }}>
            {showCheckMarks && status && status.status !== 'clear' && <polyline points={points} className={`check-marker-outline check-marker-outline-${status.status}`} strokeWidth={64 * scale} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />}
            <polyline points={points} fill="none" stroke={selected ? PLAN_PALETTE.selection : PLAN_PALETTE.route} strokeOpacity={widthMm === null ? '.75' : '.18'} strokeWidth={widthMm ?? 28 * scale} strokeDasharray={widthMm === null ? `${100 * scale} ${70 * scale}` : undefined} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={points} fill="none" stroke={selected ? PLAN_PALETTE.selection : PLAN_PALETTE.route} strokeOpacity={selected ? '.95' : '.9'} strokeWidth={(selected ? 32 : 14) * scale} strokeDasharray={`${80 * scale} ${60 * scale}`} strokeLinecap="round" strokeLinejoin="round" />
            <title>{`${route.label} · ${widthMm === null ? t(locale, 'checkNotEvaluated') : `${widthMm} mm`}`}</title>
            </g>
            {showCheckMarks && status && status.status !== 'clear' && <CheckMarkBadge status={status} entityId={route.id} entityLabel={route.label} locale={locale} x={markerPoint.xMm} y={markerPoint.yMm} size={400 * scale} onActivate={onSelectCheckResult} />}
          </g>
        })}
        {floor.turningAreas.map((area) => {
          const diameter = area.diameterMm ?? turningTargetMm ?? null
          const selected = selectionId === area.id
          const center = toRoomPoint(room, area.center)
          const status = checkStatuses.get(area.id)
          const radius = (diameter ?? 400) / 2
          return <g key={area.id}>
            <g role="button" tabIndex={busy ? -1 : 0} aria-label={`${t(locale, 'turningOverlay')}: ${area.label}`} aria-pressed={selected} data-overlay-id={area.id} data-entity-check-status={showCheckMarks ? status?.status : undefined} className={`turning-overlay ${selected ? 'selected' : ''}`} pointerEvents={busy ? 'none' : undefined} onClick={(event) => { event.stopPropagation(); onSelect(area.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(area.id) } }}>
            {showCheckMarks && status && status.status !== 'clear' && <circle cx={center.xMm} cy={center.yMm} r={radius + 70 * scale} className={`check-marker-outline check-marker-outline-${status.status}`} pointerEvents="none" />}
            <circle cx={center.xMm} cy={center.yMm} r={(diameter ?? 400) / 2} fill={diameter === null ? 'none' : '#75988022'} stroke={selected ? PLAN_PALETTE.selection : PLAN_PALETTE.turning} strokeWidth={(selected ? 38 : 24) * scale} strokeDasharray={`${90 * scale} ${48 * scale}`} />
            <title>{`${area.label} · ${diameter === null ? t(locale, 'checkNotEvaluated') : `${diameter} mm`}`}</title>
            </g>
            {showCheckMarks && status && status.status !== 'clear' && <CheckMarkBadge status={status} entityId={area.id} entityLabel={area.label} locale={locale} x={center.xMm + radius} y={center.yMm - radius} size={400 * scale} onActivate={onSelectCheckResult} />}
          </g>
        })}
        {onSelectWall && !busy && wallLines.map(({ wall: side, ...line }) => <line key={side} {...line} className="wall-hit" data-wall={side} role="button" tabIndex={0} aria-label={`${t(locale, 'wallView')}: ${wallName(side)}`} onClick={(event) => { event.stopPropagation(); onSelectWall(side) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectWall(side) } }}><title>{`${t(locale, 'wallView')}: ${wallName(side)}`}</title></line>)}
        {openingGaps}
        {room.fixtures.map((fixture) => {
          const { footprint } = getFixtureSpan(fixture, room)
          const selected = selectionId === fixture.id
          const pad = 16 * scale
          const grabBar = fixture.kind.startsWith('grab-bar')
          const fixtureWidth = Math.max(footprint.maxX - footprint.minX, 30 * scale)
          const fixtureDepth = Math.max(footprint.maxY - footprint.minY, 30 * scale)
          const status = checkStatuses.get(fixture.id)
          return <g key={fixture.id}>
            <g role="button" tabIndex={busy ? -1 : 0} aria-label={`${fixture.label}, ${wallName(fixture.wall)}, ${fixture.referenceHeight.valueMm} mm`} aria-pressed={selected} data-fixture-id={fixture.id} data-fixture-kind={fixture.kind} data-wall={fixture.wall} data-offset-mm={fixture.offset.valueMm} data-height-mm={fixture.referenceHeight.valueMm}
            data-entity-check-status={showCheckMarks ? status?.status : undefined} className={`plan-fixture ${grabBar ? 'plan-fixture-bar' : ''} ${selected ? 'selected' : ''} ${highlightIds.includes(fixture.id) ? 'changed' : ''}`} pointerEvents={busy ? 'none' : undefined}
            onClick={(event) => { event.stopPropagation(); onSelect(fixture.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(fixture.id) } }}>
            {showCheckMarks && status && status.status !== 'clear' && <rect x={footprint.minX - pad - 28 * scale} y={footprint.minY - pad - 28 * scale} width={fixtureWidth + pad * 2 + 56 * scale} height={fixtureDepth + pad * 2 + 56 * scale} rx={28 * scale} className={`check-marker-outline check-marker-outline-${status.status}`} pointerEvents="none" />}
            <rect className="fixture-footprint" x={footprint.minX - pad} y={footprint.minY - pad} width={fixtureWidth + pad * 2} height={fixtureDepth + pad * 2} rx={pad} />
            {fixture.kind === 'basin' && <g className="basin-symbol" transform={`translate(${footprint.minX} ${footprint.minY}) scale(${fixtureWidth} ${fixtureDepth})`}><SymbolMarks marks={planSymbol('basin')} /></g>}
            <title>{`${fixture.label} · ${fixture.referenceHeight.valueMm} mm`}</title>
            </g>
            {showCheckMarks && status && status.status !== 'clear' && <CheckMarkBadge status={status} entityId={fixture.id} entityLabel={fixture.label} locale={locale} x={footprint.maxX} y={footprint.minY} size={400 * scale} onActivate={onSelectCheckResult} />}
          </g>
        })}
        {overlayTool === 'route' && routeDraft.tool === 'route' && routeDraft.points.length > 0 && <polyline className="overlay-draft-route" points={[...routeDraft.points, ...(overlayCursor ? [overlayCursor] : [])].map((point) => `${point.xMm},${point.yMm}`).join(' ')} />}
        {overlayTool === 'route' && routeDraft.tool === 'route' && routeDraft.points.map((point, index) => <circle key={index} className="overlay-draft-point" cx={point.xMm} cy={point.yMm} r={55 * scale}><title>{`${t(locale, 'routePoint')} ${index + 1}`}</title></circle>)}
        {overlayTool === 'turning' && overlayCursor && <circle className="overlay-draft-turning" cx={overlayCursor.xMm} cy={overlayCursor.yMm} r="500" />}
        {room.items.map((item) => <FurnitureShape key={item.id} item={item} itemNumber={itemNumbers.get(item.id) ?? 0} scale={scale} selected={selectionId === item.id} highlighted={highlightIds.includes(item.id)} xMm={preview?.id === item.id ? preview.xMm : item.center.xMm} yMm={preview?.id === item.id ? preview.yMm : item.center.yMm} onPointerDown={onItemPointerDown} onKeyDown={keyboardMove} onKeyUp={keyboardMoveEnd} label={`${item.label}, ${item.width.valueMm} by ${item.depth.valueMm} mm`} checkStatus={checkStatuses.get(item.id)} checkMarksVisible={showCheckMarks} locale={locale} onSelectCheckResult={onSelectCheckResult} />)}
        <g className="plan-room-annotation" data-plan-annotation="room-label" data-label-x-mm={annotations.roomLabel.point.xMm} data-label-y-mm={annotations.roomLabel.point.yMm} role="img" aria-label={`${annotations.roomLabel.typeLabel}, ${annotations.roomLabel.areaLabel}`} pointerEvents="none">
          <text className="plan-room-label-type" x={annotations.roomLabel.point.xMm} y={annotations.roomLabel.point.yMm - 75 * scale} textAnchor="middle" dominantBaseline="central">{annotations.roomLabel.typeLabel}</text>
          <text className="plan-room-label-area" x={annotations.roomLabel.point.xMm} y={annotations.roomLabel.point.yMm + 95 * scale} textAnchor="middle" dominantBaseline="central">{annotations.roomLabel.areaLabel}</text>
        </g>
        <g className="plan-scale-bar" data-plan-annotation="scale-bar" data-length-mm={annotations.scaleBar.lengthMm} role="img" aria-label={annotations.scaleBar.label} pointerEvents="none">
          <line {...annotations.scaleBar.line} />
          {annotations.scaleBar.ticks.map((tick, index) => <line key={index} {...tick} />)}
          <text x={annotations.scaleBar.labelPoint.xMm} y={annotations.scaleBar.labelPoint.yMm} textAnchor="middle" dominantBaseline="central">{annotations.scaleBar.label}</text>
        </g>
        <g className="plan-north-arrow" data-plan-annotation="north-arrow" role="img" aria-label={annotations.northArrow.label} pointerEvents="none">
          <line {...annotations.northArrow.shaft} />
          {annotations.northArrow.head.map((line, index) => <line key={index} {...line} />)}
          <text x={annotations.northArrow.labelPoint.xMm} y={annotations.northArrow.labelPoint.yMm} textAnchor="end" dominantBaseline="central">{annotations.northArrow.label}</text>
        </g>
        {dimensions.map((dimension) => {
          const description = `${dimensionDescription(dimension)}: ${dimension.label}`
          const rotate = dimension.labelRotationDeg ? `rotate(${dimension.labelRotationDeg} ${dimension.labelPoint.xMm} ${dimension.labelPoint.yMm})` : undefined
          return <g key={dimension.id} className={`plan-dimension plan-dimension-${dimension.kind}${dimension.kind === 'chain' ? ` plan-dimension-${dimension.wall}` : ''}`} data-dimension-id={dimension.id} data-dimension-kind={dimension.kind} data-dimension-wall={dimension.kind === 'chain' ? dimension.wall : undefined} role="img" aria-label={description}>
            <line className="dimension-stroke" {...dimension.line} vectorEffect="non-scaling-stroke" />
            {dimension.ticks.map((tick, index) => <line key={index} className="dimension-stroke" {...tick} vectorEffect="non-scaling-stroke" />)}
            <text x={dimension.labelPoint.xMm} y={dimension.labelPoint.yMm} transform={rotate} textAnchor="middle" dominantBaseline="central">{dimension.label}</text>
          </g>
        })}
        {/* Falls use a triangle with an exclamation mark, a shape nothing else on the plan uses. */}
        {falls.filter((fall) => fall.roomId === room.id && fall.point).map((fall, index) => {
          const size = 170 * scale
          const { xMm, yMm } = fall.point!
          return <g key={fall.id} className="fall-marker" data-fall-id={fall.id} role="img" aria-label={`${t(locale, 'fallMarker')} ${index + 1}`} pointerEvents="none">
            <path d={`M ${xMm} ${yMm - size} L ${xMm + size * 0.92} ${yMm + size * 0.6} L ${xMm - size * 0.92} ${yMm + size * 0.6} Z`} />
            <text x={xMm} y={yMm + size * 0.12} textAnchor="middle" dominantBaseline="central">!</text>
          </g>
        })}
        {placement && preview?.id === '__placement__' && <g className="placement-preview" transform={`translate(${preview.xMm} ${preview.yMm})`} pointerEvents="none"><rect x={-placement.widthMm / 2} y={-placement.depthMm / 2} width={placement.widthMm} height={placement.depthMm} rx={70 * scale} /><text textAnchor="middle" dominantBaseline="central">{placement.label}</text></g>}
      </svg>
      {message && <p role="alert" className="canvas-alert">{message}</p>}
      {moveFeedback.preview && !message && !previewOutside && <div className="move-check-chip" data-testid="move-check-chip" style={{ left: moveFeedback.preview.left, top: moveFeedback.preview.top }} aria-hidden="true">{moveFeedback.preview.attention.length ? `${moveFeedback.preview.attention.length} ${t(locale, moveFeedback.preview.attention.length === 1 ? 'moveNeedsAttentionOne' : 'moveNeedsAttentionMany')}: ${t(locale, moveFeedback.preview.attention[0].messageKey as MessageKey)}` : t(locale, 'moveNoAttention')}</div>}
      <span className="sr-only" data-testid="move-check-live" aria-live="polite">{moveFeedback.announcement}</span>
    </div>
    <PlanSchedule room={room} locale={locale} selectionId={selectionId} onSelect={onSelect} />
    <div className="canvas-legend"><span><i className="legend-furniture" />{locale === 'th' ? 'สิ่งของ' : 'Furniture'}</span><span><i className="legend-route" />{locale === 'th' ? 'แนวทางเดินตัวอย่าง' : 'Illustrative movement corridor'}</span>{floor.turningAreas.length > 0 && <span><i className="legend-turning" />{t(locale, 'turningOverlay')}</span>}{room.fixtures.length > 0 && <span><i className="legend-fixture" />{t(locale, 'fixtures')}</span>}{room.wetZones.length > 0 && <span><i className="legend-wet" />{t(locale, 'wetZone')}</span>}{falls.some((fall) => fall.point) && <span><i className="legend-fall" />{t(locale, 'fallMarker')}</span>}{showCheckMarks && <><span><i className="legend-check-marker legend-check-attention">!</i>{t(locale, 'checkMarkerLegendAttention')}</span><span><i className="legend-check-marker legend-check-not-evaluated">?</i>{t(locale, 'checkMarkerLegendNotEvaluated')}</span></>}<span>{locale === 'th' ? 'กดปุ่มลูกศรเพื่อขยับ 10 มม. · Shift + ลูกศร 50 มม.' : 'Arrow keys move 10 mm · Shift + arrow moves 50 mm'}</span></div>
  </div>
}
