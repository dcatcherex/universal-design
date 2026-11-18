'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { isFurnitureWithinRoom, moveEntity, snapToGridMm } from '@/lib/planner/entity-movement'
import { getPrimaryFloor, getPrimaryRoom } from '@/lib/planner/layout-access'
import { buildPlanScene, type PlanScenePrimitive, type PlanSymbolMark } from '@/lib/planner/plan-scene'
import { PLAN_PALETTE } from '@/lib/planner/plan-palette'
import { checkViewFromResults, type LayoutCheckView } from '@/lib/planner/checks'
import type { FallRecord, FurnitureItem, Layout, LayoutId, Locale, PointMm, Project, Wall } from '@/lib/planner/types'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { PlanSchedule } from './plan-schedule'
import { CheckMarkBadge } from './check-mark-badge'
import { useEntityDrag } from './use-entity-drag'

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
  checkView: LayoutCheckView
  showCheckMarks: boolean
  project: Project; layoutId: LayoutId
  onToggleCheckMarks(show: boolean): void
  onSelectCheckResult(resultId: string): void
  onSelect(id: string | null): void; onCommitLayout(layout: Layout): void; onPlace(center: { xMm: number; yMm: number }): void; onCancelPlacement(): void
  onPlaceRoute(points: PointMm[]): void; onPlaceTurning(center: PointMm): void; onCancelOverlay(): void
  onPickFall?(point: PointMm): void; onCancelPickFall?(): void
  /** Clicking a wall line picks that wall, e.g. to open its elevation. */
  onSelectWall?(wall: Wall): void
}
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

export function PlanCanvas({ layout, locale, selectionId, showDimensions, onToggleDimensions, routeTargetMm, turningTargetMm, placement, overlayTool = null, falls = [], pickingFall = false, highlightIds = [], checkView: baseCheckView, showCheckMarks, project, layoutId, onToggleCheckMarks, onSelectCheckResult, onSelect, onCommitLayout, onPlace, onCancelPlacement, onPlaceRoute, onPlaceTurning, onCancelOverlay, onPickFall, onCancelPickFall, onSelectWall }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [placementPreview, setPlacementPreview] = useState<PointMm | null>(null)
  const [overlayCursor, setOverlayCursor] = useState<PointMm | null>(null)
  const [routeDraft, setRouteDraft] = useState<{ tool: OverlayTool; points: PointMm[] }>({ tool: null, points: [] })
  const [message, setMessage] = useState('')
  const room = getPrimaryRoom(layout)
  const floor = getPrimaryFloor(layout)
  const width = room.shape.width.valueMm, depth = room.shape.depth.valueMm
  const drag = useEntityDrag<FurnitureItem, PointMm>({
    project, layoutId, checkResults: baseCheckView.results, locale,
    stageRef,
    editable: true,
    canStartDrag: () => !(pickingFall || placement || overlayTool),
    selectOnStart: false,
    keyboard: 'preview-then-commit',
    modelPoint,
    positionOf: (item) => item.center,
    positionFromDrag: (_item, _start, current) => ({ xMm: snapToGridMm(current.xMm), yMm: snapToGridMm(current.yMm) }),
    stepped: (position, dx, dy) => ({ xMm: position.xMm + dx, yMm: position.yMm - dy }),
    allowStep: (item, position) => isFurnitureWithinRoom(layout, { ...item, center: position }),
    chipPointFor: (position) => modelChipPoint(position),
    getEntity: (id) => room.items.find((item) => item.id === id),
    entityId: (item) => item.id,
    commit: (item, center) => {
      const moved = { ...item, center }
      if (!isFurnitureWithinRoom(layout, moved)) { setMessage(t(locale, 'outOfBounds')); return }
      const result = moveEntity(layout, moved.id, moved.center)
      if (!result.ok) { setMessage(t(locale, 'outOfBounds')); return }
      onCommitLayout(result.layout)
      setMessage('')
    },
    onSelect,
    onDragStart: () => setMessage(''),
    onDragCancel: () => setMessage(''),
  })
  const moveFeedback = drag.moveFeedback
  const checkView = useMemo(() => moveFeedback.preview ? checkViewFromResults(moveFeedback.preview.results) : baseCheckView, [baseCheckView, moveFeedback.preview])
  const roomAttentionResults = checkView.roomLevel.filter((result) => result.status === 'attention')
  const roomPendingResults = checkView.roomLevel.filter((result) => result.status === 'not-evaluated')
  const previewPosition = drag.preview?.position ?? null
  const previewItem = drag.preview ? room.items.find((item) => item.id === drag.preview!.id) : undefined
  const previewOutside = !!(previewItem && previewPosition && !isFurnitureWithinRoom(layout, { ...previewItem, center: previewPosition }))
  const scene = buildPlanScene(layout, {
    locale,
    showOverlays: true,
    showDimensions,
    showCheckMarks,
    checkView,
    selectedItemId: selectionId,
    selectedEntityId: selectionId,
    movePreview: drag.preview && previewPosition ? { id: drag.preview.id, ...previewPosition } : null,
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
      if (event.key !== 'Escape' || !(placement || overlayTool || pickingFall)) return
      setPlacementPreview(null)
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
  }, [placement, overlayTool, pickingFall, onCancelPlacement, onCancelOverlay, onCancelPickFall])

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

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (overlayTool) { setOverlayCursor(clampToRoom(modelPoint(event))); return }
    if (placement) {
      const point = modelPoint(event)
      setPlacementPreview({ xMm: snap(point.xMm), yMm: snap(point.yMm) })
      return
    }
    drag.onSurfacePointerMove(event)
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
      <svg ref={svgRef} style={style} role="group" aria-label={`${t(locale, 'roomPlan')} ${(width / 1000).toFixed(1)} × ${(depth / 1000).toFixed(1)} m`} viewBox={`${scene.viewBox.x} ${scene.viewBox.y} ${scene.viewBox.width} ${scene.viewBox.height}`} onPointerMove={onPointerMove} onPointerUp={drag.onSurfacePointerUp} onPointerCancel={drag.onSurfacePointerUp} onClick={(event) => {
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
          const candidate: FurnitureItem = { id: 'preview', catalogId: placement.catalogId, label: placement.label, center, width: { valueMm: placement.widthMm, confidence: 'estimated' }, depth: { valueMm: placement.depthMm, confidence: 'estimated' }, height: { valueMm: placement.heightMm, confidence: 'estimated' }, rotationDeg: 0, finish: placement.finish, obstruction: placement.obstruction }
          if (!isFurnitureWithinRoom(layout, candidate)) { setMessage(t(locale, 'outOfBounds')); return }
          setMessage('')
          onPlace(center)
          setPlacementPreview(null)
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
        if (!drag.isDragging() && event.target === event.currentTarget) onSelect(null)
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
        {itemPrimitives.map((primitive) => <FurnitureShape key={primitive.entity.id} primitive={primitive} scale={scale} highlighted={highlightIds.includes(primitive.entity.id)} onPointerDown={drag.onEntityPointerDown} onKeyDown={drag.onEntityKeyDown} onKeyUp={drag.onEntityKeyUp} locale={locale} onSelectCheckResult={onSelectCheckResult} />)}
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
        {placement && placementPreview && <g className="placement-preview" transform={`translate(${placementPreview.xMm} ${placementPreview.yMm})`} pointerEvents="none"><rect x={-placement.widthMm / 2} y={-placement.depthMm / 2} width={placement.widthMm} height={placement.depthMm} rx={70 * scale} /><text textAnchor="middle" dominantBaseline="central">{placement.label}</text></g>}
      </svg>
      {message && <p role="alert" className="canvas-alert">{message}</p>}
      {moveFeedback.preview && !message && !previewOutside && <div className="move-check-chip" data-testid="move-check-chip" style={{ left: moveFeedback.preview.left, top: moveFeedback.preview.top }} aria-hidden="true">{moveFeedback.preview.attention.length ? `${moveFeedback.preview.attention.length} ${t(locale, moveFeedback.preview.attention.length === 1 ? 'moveNeedsAttentionOne' : 'moveNeedsAttentionMany')}: ${t(locale, moveFeedback.preview.attention[0].messageKey as MessageKey)}` : t(locale, 'moveNoAttention')}</div>}
      <span className="sr-only" data-testid="move-check-live" aria-live="polite">{moveFeedback.announcement}</span>
    </div>
    <PlanSchedule room={room} schedule={schedule} locale={locale} selectionId={selectionId} onSelect={onSelect} />
    <div className="canvas-legend"><span><i className="legend-furniture" />{t(locale, 'legendFurniture')}</span><span><i className="legend-route" />{t(locale, 'legendRouteCorridor')}</span>{floor.turningAreas.length > 0 && <span><i className="legend-turning" />{t(locale, 'turningOverlay')}</span>}{room.fixtures.length > 0 && <span><i className="legend-fixture" />{t(locale, 'fixtures')}</span>}{room.wetZones.length > 0 && <span><i className="legend-wet" />{t(locale, 'wetZone')}</span>}{falls.some((fall) => fall.point) && <span><i className="legend-fall" />{t(locale, 'fallMarker')}</span>}{showCheckMarks && <><span><i className="legend-check-marker legend-check-attention">!</i>{t(locale, 'checkMarkerLegendAttention')}</span><span><i className="legend-check-marker legend-check-not-evaluated">?</i>{t(locale, 'checkMarkerLegendNotEvaluated')}</span></>}<span>{t(locale, 'arrowMoveHint')}</span></div>
  </div>
}
