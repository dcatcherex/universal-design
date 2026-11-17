'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { getFootprint } from '@/lib/planner/geometry'
import { isFurnitureWithinRoom, moveFurnitureInLayout, snapToGridMm } from '@/lib/planner/furniture-movement'
import { getPrimaryFloor, getPrimaryRoom } from '@/lib/planner/layout-access'
import { buildPlanScene, type PlanScenePrimitive, type PlanSymbolMark } from '@/lib/planner/plan-scene'
import { PLAN_PALETTE } from '@/lib/planner/plan-palette'
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
type ItemPrimitive = Extract<PlanScenePrimitive, { kind: 'item' }>

function SymbolMarks({ marks }: { marks: PlanSymbolMark[] }) {
  return <>{marks.map((mark, index) => mark.kind === 'rect'
    ? <rect key={index} x={mark.x} y={mark.y} width={mark.width} height={mark.height} rx={mark.rx} vectorEffect="non-scaling-stroke" />
    : mark.kind === 'ellipse'
      ? <ellipse key={index} cx={mark.cx} cy={mark.cy} rx={mark.rx} ry={mark.ry} vectorEffect="non-scaling-stroke" />
      : mark.kind === 'line'
        ? <line key={index} x1={mark.x1} y1={mark.y1} x2={mark.x2} y2={mark.y2} vectorEffect="non-scaling-stroke" />
        : <path key={index} d={mark.d} vectorEffect="non-scaling-stroke" />)}</>
}

function FurnitureShape({ primitive, highlighted, scale, onPointerDown, onKeyDown, onKeyUp, locale, onSelectCheckResult }: {
  primitive: ItemPrimitive; highlighted: boolean; scale: number; onPointerDown(event: ReactPointerEvent<SVGGElement>, item: FurnitureItem): void;
  onKeyDown(event: KeyboardEvent<SVGGElement>, item: FurnitureItem): void; onKeyUp(event: KeyboardEvent<SVGGElement>, item: FurnitureItem): void; locale: Locale; onSelectCheckResult(resultId: string): void
}) {
  const { entity: item, itemNumber, selected, geometry, symbol, checkStatus } = primitive
  const { center, localFootprint, badgePoints } = geometry
  const width = item.rotationDeg % 180 === 0 ? item.width.valueMm : item.depth.valueMm
  const depth = item.rotationDeg % 180 === 0 ? item.depth.valueMm : item.width.valueMm
  const className = item.obstruction === 'rug' ? 'plan-rug' : `plan-item finish-${item.finish}`
  return <>
  <g
    role="button" tabIndex={0} aria-label={`${item.label}, ${item.width.valueMm} by ${item.depth.valueMm} mm`} aria-pressed={selected}
    data-item-id={item.id} data-item-number={itemNumber} data-x-mm={center.xMm} data-y-mm={center.yMm} data-rotation={item.rotationDeg} data-entity-check-status={checkStatus?.status}
    className={`${className} ${selected ? 'selected' : ''} ${highlighted ? 'changed' : ''}`}
    transform={`translate(${center.xMm} ${center.yMm}) rotate(${item.rotationDeg})`}
    onPointerDown={(event) => onPointerDown(event, item)} onKeyDown={(event) => onKeyDown(event, item)} onKeyUp={(event) => onKeyUp(event, item)}
  >
    <rect className="item-footprint" {...localFootprint} pointerEvents="all" />
    <g className="item-symbol" transform={`translate(${localFootprint.x} ${localFootprint.y}) scale(${localFootprint.width} ${localFootprint.height})`}><SymbolMarks marks={symbol} /></g>
    <text className="plan-item-number" textAnchor="middle" dominantBaseline="central" x={0} y={geometry.numberY} transform={`rotate(${-item.rotationDeg} 0 ${geometry.numberY})`} aria-hidden="true" pointerEvents="none">{itemNumber}</text>
    {/* The label stays upright and below the piece whatever its rotation. */}
    <text textAnchor="middle" dominantBaseline="central" transform={`rotate(${-item.rotationDeg})`} y={geometry.labelY}>{item.label}</text>
    {checkStatus && checkStatus.status !== 'clear' && <rect className={`check-marker-outline check-marker-outline-${checkStatus.status}`} {...geometry.checkOutline} rx={24 * scale} pointerEvents="none" />}
    <title>{`${item.label} · ${width} × ${depth} mm`}</title>
  </g>
    {checkStatus && checkStatus.status !== 'clear' && <g transform={`translate(${badgePoints.world.xMm} ${badgePoints.world.yMm})`}><CheckMarkBadge status={checkStatus} entityId={item.id} entityLabel={item.label} locale={locale} x={0} y={0} size={400 * scale} onActivate={onSelectCheckResult} /></g>}
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
  const activeResults = moveFeedback.preview?.results ?? checkResults
  const checkStatuses = useMemo(() => moveFeedback.preview ? getEntityStatuses(activeResults) : baseCheckStatuses, [activeResults, baseCheckStatuses, moveFeedback.preview])
  const roomCheckResults = moveFeedback.preview ? activeResults.filter((result) => result.entityIds.length === 0) : baseRoomCheckResults
  const roomAttentionResults = roomCheckResults.filter((result) => result.status === 'attention')
  const roomPendingResults = roomCheckResults.filter((result) => result.status === 'not-evaluated')
  const previewItem = preview && preview.id !== '__placement__' ? room.items.find((item) => item.id === preview.id) : undefined
  const previewOutside = !!(previewItem && preview && outsideRoom({ ...previewItem, center: { xMm: preview.xMm, yMm: preview.yMm } }))
  const scene = buildPlanScene(layout, {
    locale,
    showOverlays: true,
    showDimensions,
    showCheckMarks,
    checkStatuses,
    roomCheckResults,
    selectedItemId: selectionId,
    selectedEntityId: selectionId,
    movePreview: preview && preview.id !== '__placement__' ? preview : null,
    routeTargetMm,
    turningTargetMm,
  })
  const scale = scene.scale
  const annotations = scene.primitives.find((primitive) => primitive.kind === 'annotation')!.geometry
  const schedule = scene.schedule
  const wallPrimitives = scene.primitives.filter((primitive) => primitive.kind === 'wall')
  const wetZonePrimitives = scene.primitives.filter((primitive) => primitive.kind === 'wet-zone')
  const routePrimitives = scene.primitives.filter((primitive) => primitive.kind === 'route')
  const turningPrimitives = scene.primitives.filter((primitive) => primitive.kind === 'turning-area')
  const openingPrimitives = scene.primitives.filter((primitive) => primitive.kind === 'opening')
  const fixturePrimitives = scene.primitives.filter((primitive) => primitive.kind === 'fixture')
  const itemPrimitives = scene.primitives.filter((primitive) => primitive.kind === 'item')
  const dimensionPrimitives = scene.primitives.filter((primitive) => primitive.kind === 'dimension')
  const wallLines = scene.wallLines
  const wallName = (wall: Wall) => t(locale, wall === 'north' ? 'wallNorth' : wall === 'south' ? 'wallSouth' : wall === 'east' ? 'wallEast' : 'wallWest')
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

  const openingGaps = openingPrimitives.map((primitive) => {
    const { entity: opening, geometry, selected, checkStatus, label } = primitive
    const { drawing: openingDrawing, outline, badge } = geometry
    const { windowLines, doorLeaf, swingPath, outward, slidingArrow } = openingDrawing
    return <g key={opening.id} role="group" data-opening-id={opening.id} data-entity-check-status={checkStatus?.status} className={`${selected ? 'opening-selected' : ''} ${highlightIds.includes(opening.id) ? 'changed' : ''}`} aria-label={label}>
      {checkStatus && checkStatus.status !== 'clear' && <rect {...outline} className={`check-marker-outline check-marker-outline-${checkStatus.status}`} pointerEvents="none" />}
      {swingPath && <path d={swingPath} fill="none" className={`door-swing ${outward ? 'door-swing-out' : ''}`} />}
      {doorLeaf && <line {...doorLeaf} className={`opening-line door-leaf ${outward ? 'door-leaf-out' : ''}`} />}
      {windowLines.map((line, index) => <line key={index} {...line} className="window-line" />)}
      {slidingArrow && <path d={slidingArrow} className="sliding-arrow" />}
      {checkStatus && <CheckMarkBadge status={checkStatus} entityId={opening.id} entityLabel={label} locale={locale} x={badge.xMm} y={badge.yMm} size={400 * scale} onActivate={onSelectCheckResult} />}
    </g>
  })

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
      <svg ref={svgRef} style={style} role="group" aria-label={`${t(locale, 'roomPlan')} ${(width / 1000).toFixed(1)} × ${(depth / 1000).toFixed(1)} m`} viewBox={`${scene.viewBox.x} ${scene.viewBox.y} ${scene.viewBox.width} ${scene.viewBox.height}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={(event) => {
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
        {wallPrimitives.map((primitive, index) => <rect key={index} className="plan-wall" {...primitive.geometry} />)}
        <rect width={width} height={depth} className="room-floor" />
        <rect width={width} height={depth} fill="url(#room-grid)" />
        {wetZonePrimitives.map((primitive) => <g key={primitive.entityId} data-wet-zone-id={primitive.entityId} className={`wet-zone ${highlightIds.includes(primitive.entityId) ? 'changed' : ''}`} pointerEvents="none">
          <rect {...primitive.geometry} />
          <text x={primitive.geometry.x + 60 * scale} y={primitive.geometry.y + 150 * scale}>{primitive.label}</text>
        </g>)}
        {routePrimitives.map((primitive) => {
          const { entity: route, geometry, selected, checkStatus } = primitive
          const points = geometry.points.map((point) => `${point.xMm},${point.yMm}`).join(' ')
          return <g key={route.id}>
            <g role="button" tabIndex={busy ? -1 : 0} aria-label={`${t(locale, 'routeOverlay')}: ${route.label}`} aria-pressed={selected} data-overlay-id={route.id} data-entity-check-status={checkStatus?.status} className={`route-overlay ${selected ? 'selected' : ''}`} pointerEvents={busy ? 'none' : undefined} onClick={(event) => { event.stopPropagation(); onSelect(route.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(route.id) } }}>
            {checkStatus && checkStatus.status !== 'clear' && <polyline points={points} className={`check-marker-outline check-marker-outline-${checkStatus.status}`} strokeWidth={geometry.checkWidthMm} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />}
            <polyline points={points} fill="none" stroke={selected ? PLAN_PALETTE.selection : PLAN_PALETTE.route} strokeOpacity={geometry.opacity.canvas} strokeWidth={geometry.widthMm.canvas} strokeDasharray={!geometry.widthKnown.canvas ? `${100 * scale} ${70 * scale}` : undefined} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={points} fill="none" stroke={selected ? PLAN_PALETTE.selection : PLAN_PALETTE.route} strokeOpacity={selected ? '.95' : '.9'} strokeWidth={(selected ? 32 : 14) * scale} strokeDasharray={`${80 * scale} ${60 * scale}`} strokeLinecap="round" strokeLinejoin="round" />
            <title>{`${route.label} · ${primitive.label.canvas}`}</title>
            </g>
            {checkStatus && checkStatus.status !== 'clear' && <CheckMarkBadge status={checkStatus} entityId={route.id} entityLabel={route.label} locale={locale} x={geometry.badge.xMm} y={geometry.badge.yMm} size={scene.badgeSizeMm} onActivate={onSelectCheckResult} />}
          </g>
        })}
        {turningPrimitives.map((primitive) => {
          const { entity: area, geometry, selected, checkStatus, hasDiameter } = primitive
          const { center } = geometry
          const radius = geometry.radiusMm.canvas
          return <g key={area.id}>
            <g role="button" tabIndex={busy ? -1 : 0} aria-label={`${t(locale, 'turningOverlay')}: ${area.label}`} aria-pressed={selected} data-overlay-id={area.id} data-entity-check-status={checkStatus?.status} className={`turning-overlay ${selected ? 'selected' : ''}`} pointerEvents={busy ? 'none' : undefined} onClick={(event) => { event.stopPropagation(); onSelect(area.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(area.id) } }}>
            {checkStatus && checkStatus.status !== 'clear' && <circle cx={center.xMm} cy={center.yMm} r={geometry.checkRadiusMm.canvas} className={`check-marker-outline check-marker-outline-${checkStatus.status}`} pointerEvents="none" />}
            <circle cx={center.xMm} cy={center.yMm} r={radius} fill={hasDiameter.canvas ? '#75988022' : 'none'} stroke={selected ? PLAN_PALETTE.selection : PLAN_PALETTE.turning} strokeWidth={(selected ? 38 : 24) * scale} strokeDasharray={`${90 * scale} ${48 * scale}`} />
            <title>{`${area.label} · ${hasDiameter.canvas ? `${radius * 2} mm` : t(locale, 'checkNotEvaluated')}`}</title>
            </g>
            {checkStatus && checkStatus.status !== 'clear' && <CheckMarkBadge status={checkStatus} entityId={area.id} entityLabel={area.label} locale={locale} x={geometry.badge.canvas.xMm} y={geometry.badge.canvas.yMm} size={scene.badgeSizeMm} onActivate={onSelectCheckResult} />}
          </g>
        })}
        {onSelectWall && !busy && wallLines.map(({ wall: side, line }) => <line key={side} {...line} className="wall-hit" data-wall={side} role="button" tabIndex={0} aria-label={`${t(locale, 'wallView')}: ${wallName(side)}`} onClick={(event) => { event.stopPropagation(); onSelectWall(side) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectWall(side) } }}><title>{`${t(locale, 'wallView')}: ${wallName(side)}`}</title></line>)}
        {openingGaps}
        {fixturePrimitives.map((primitive) => {
          const { entity: fixture, geometry, selected, styleToken, checkStatus, symbol } = primitive
          return <g key={fixture.id}>
            <g role="button" tabIndex={busy ? -1 : 0} aria-label={`${fixture.label}, ${wallName(fixture.wall)}, ${fixture.referenceHeight.valueMm} mm`} aria-pressed={selected} data-fixture-id={fixture.id} data-fixture-kind={fixture.kind} data-wall={fixture.wall} data-offset-mm={fixture.offset.valueMm} data-height-mm={fixture.referenceHeight.valueMm}
            data-entity-check-status={checkStatus?.status} className={`plan-fixture ${styleToken === 'grab-bar' ? 'plan-fixture-bar' : ''} ${selected ? 'selected' : ''} ${highlightIds.includes(fixture.id) ? 'changed' : ''}`} pointerEvents={busy ? 'none' : undefined}
            onClick={(event) => { event.stopPropagation(); onSelect(fixture.id) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(fixture.id) } }}>
            {checkStatus && checkStatus.status !== 'clear' && <rect {...geometry.checkOutline} rx={28 * scale} className={`check-marker-outline check-marker-outline-${checkStatus.status}`} pointerEvents="none" />}
            <rect className="fixture-footprint" {...geometry.shape} rx={16 * scale} />
            {symbol.length > 0 && <g className="basin-symbol" transform={`translate(${geometry.footprint.minX} ${geometry.footprint.minY}) scale(${geometry.width} ${geometry.height})`}><SymbolMarks marks={symbol} /></g>}
            <title>{`${fixture.label} · ${fixture.referenceHeight.valueMm} mm`}</title>
            </g>
            {checkStatus && checkStatus.status !== 'clear' && <CheckMarkBadge status={checkStatus} entityId={fixture.id} entityLabel={fixture.label} locale={locale} x={geometry.badge.xMm} y={geometry.badge.yMm} size={scene.badgeSizeMm} onActivate={onSelectCheckResult} />}
          </g>
        })}
        {overlayTool === 'route' && routeDraft.tool === 'route' && routeDraft.points.length > 0 && <polyline className="overlay-draft-route" points={[...routeDraft.points, ...(overlayCursor ? [overlayCursor] : [])].map((point) => `${point.xMm},${point.yMm}`).join(' ')} />}
        {overlayTool === 'route' && routeDraft.tool === 'route' && routeDraft.points.map((point, index) => <circle key={index} className="overlay-draft-point" cx={point.xMm} cy={point.yMm} r={55 * scale}><title>{`${t(locale, 'routePoint')} ${index + 1}`}</title></circle>)}
        {overlayTool === 'turning' && overlayCursor && <circle className="overlay-draft-turning" cx={overlayCursor.xMm} cy={overlayCursor.yMm} r="500" />}
        {itemPrimitives.map((primitive) => <FurnitureShape key={primitive.entity.id} primitive={primitive} scale={scale} highlighted={highlightIds.includes(primitive.entity.id)} onPointerDown={onItemPointerDown} onKeyDown={keyboardMove} onKeyUp={keyboardMoveEnd} locale={locale} onSelectCheckResult={onSelectCheckResult} />)}
        <g className="plan-room-annotation" data-plan-annotation="room-label" data-label-x-mm={annotations.roomLabel.point.xMm} data-label-y-mm={annotations.roomLabel.point.yMm} role="img" aria-label={`${annotations.roomLabel.typeLabel}, ${annotations.roomLabel.areaLabel}`} pointerEvents="none">
          <text className="plan-room-label-type" x={annotations.roomLabel.point.xMm} y={annotations.roomLabel.typeY} textAnchor="middle" dominantBaseline="central">{annotations.roomLabel.typeLabel}</text>
          <text className="plan-room-label-area" x={annotations.roomLabel.point.xMm} y={annotations.roomLabel.areaY} textAnchor="middle" dominantBaseline="central">{annotations.roomLabel.areaLabel}</text>
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
        {dimensionPrimitives.map(({ geometry: dimension, description }) => {
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
    <PlanSchedule room={room} schedule={schedule} locale={locale} selectionId={selectionId} onSelect={onSelect} />
    <div className="canvas-legend"><span><i className="legend-furniture" />{locale === 'th' ? 'สิ่งของ' : 'Furniture'}</span><span><i className="legend-route" />{locale === 'th' ? 'แนวทางเดินตัวอย่าง' : 'Illustrative movement corridor'}</span>{floor.turningAreas.length > 0 && <span><i className="legend-turning" />{t(locale, 'turningOverlay')}</span>}{room.fixtures.length > 0 && <span><i className="legend-fixture" />{t(locale, 'fixtures')}</span>}{room.wetZones.length > 0 && <span><i className="legend-wet" />{t(locale, 'wetZone')}</span>}{falls.some((fall) => fall.point) && <span><i className="legend-fall" />{t(locale, 'fallMarker')}</span>}{showCheckMarks && <><span><i className="legend-check-marker legend-check-attention">!</i>{t(locale, 'checkMarkerLegendAttention')}</span><span><i className="legend-check-marker legend-check-not-evaluated">?</i>{t(locale, 'checkMarkerLegendNotEvaluated')}</span></>}<span>{locale === 'th' ? 'กดปุ่มลูกศรเพื่อขยับ 10 มม. · Shift + ลูกศร 50 มม.' : 'Arrow keys move 10 mm · Shift + arrow moves 50 mm'}</span></div>
  </div>
}
