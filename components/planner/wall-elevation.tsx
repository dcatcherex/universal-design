'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { buildElevation, fixturePositionProblem } from '@/lib/planner/elevation'
import { moveEntity, snapToGridMm } from '@/lib/planner/entity-movement'
import { createFixture, FIXTURE_CATALOG } from '@/lib/planner/fixtures-catalog'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { getPrimaryRoom, withPrimaryRoom } from '@/lib/planner/layout-access'
import { checkViewFromResults, type LayoutCheckView } from '@/lib/planner/checks'
import { benchmarkContextFor } from '@/lib/planner/resident-needs'
import type { FixtureKind, Layout, LayoutId, Locale, Project, ResidentProfile, Wall, WallFixture } from '@/lib/planner/types'
import { CheckMarkBadge } from './check-mark-badge'
import { useEntityDrag } from './use-entity-drag'

const WALLS: { value: Wall; label: MessageKey }[] = [
  { value: 'north', label: 'wallNorth' }, { value: 'east', label: 'wallEast' }, { value: 'south', label: 'wallSouth' }, { value: 'west', label: 'wallWest' },
]
const BENCHMARK_NAMES = { 'th-public-building': 'benchmarkPublicShort', 'th-dop-home': 'benchmarkHomeShort' } as const

type FixturePosition = { offsetMm: number; heightMm: number }

type Props = {
  layout: Layout; locale: Locale; wall: Wall; selectionId: string | null; resident: ResidentProfile; editable: boolean
  project: Project; layoutId: LayoutId; checkView: LayoutCheckView
  highlightIds?: readonly string[]
  showCheckMarks: boolean; onSelectCheckResult(resultId: string): void
  onWallChange(wall: Wall): void; onSelect(id: string | null): void; onCommitLayout(layout: Layout): void
}

/** One wall seen from inside the room. Fixtures can be moved here; furniture is shown for reference only. */
export function WallElevation({ layout, locale, wall, selectionId, resident, editable, highlightIds = [], checkView: baseCheckView, showCheckMarks, project, layoutId, onSelectCheckResult, onWallChange, onSelect, onCommitLayout }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')
  const [newKind, setNewKind] = useState<FixtureKind>('grab-bar-horizontal')
  const room = getPrimaryRoom(layout)

  function tryCommit(fixture: WallFixture, position: FixturePosition) {
    const offsetMm = Math.round(position.offsetMm)
    const heightMm = Math.round(position.heightMm)
    if (offsetMm === fixture.offset.valueMm && heightMm === fixture.referenceHeight.valueMm) return
    const result = moveEntity(layout, fixture.id, { offsetMm, heightMm })
    if (!result.ok) {
      setMessage(t(locale, result.reason === 'over-opening' ? 'fixtureOverOpening' : 'fixtureOutsideWall'))
      return
    }
    setMessage('')
    onCommitLayout(result.layout)
  }

  const drag = useEntityDrag<WallFixture, FixturePosition>({
    project, layoutId, checkResults: baseCheckView.results, locale,
    stageRef,
    editable,
    selectOnStart: true,
    keyboard: 'step-commit',
    modelPoint: (event) => {
      const svg = svgRef.current
      const matrix = svg?.getScreenCTM()
      if (!svg || !matrix) return { offsetMm: 0, heightMm: 0 }
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
      return { offsetMm: point.x, heightMm: room.height.valueMm - point.y }
    },
    positionOf: (fixture) => ({ offsetMm: fixture.offset.valueMm, heightMm: fixture.referenceHeight.valueMm }),
    positionFromDrag: (_fixture, start, current) => ({
      offsetMm: snapToGridMm(current.offsetMm + start.entity.offsetMm - start.pointer.offsetMm, 10),
      heightMm: Math.max(0, snapToGridMm(current.heightMm + start.entity.heightMm - start.pointer.heightMm, 10)),
    }),
    stepped: (position, dx, dy) => ({ offsetMm: position.offsetMm + dx, heightMm: position.heightMm + dy }),
    getEntity: (id) => room.fixtures.find((candidate) => candidate.id === id),
    entityId: (fixture) => fixture.id,
    commit: tryCommit,
    onSelect,
    onDragStart: () => setMessage(''),
    onDragCancel: () => setMessage(''),
  })
  const moveFeedback = drag.moveFeedback
  const checkView = useMemo(() => moveFeedback.preview ? checkViewFromResults(moveFeedback.preview.results) : baseCheckView, [baseCheckView, moveFeedback.preview])
  const checkStatuses = checkView.byEntity
  const previewPosition = drag.preview?.position ?? null
  const previewProblem = drag.preview ? (() => {
    const fixture = room.fixtures.find((candidate) => candidate.id === drag.preview!.id)
    return fixture && previewPosition ? fixturePositionProblem({ ...fixture, offset: { ...fixture.offset, valueMm: previewPosition.offsetMm }, referenceHeight: { ...fixture.referenceHeight, valueMm: previewPosition.heightMm } }, room) : null
  })() : null
  const previewRoom = useMemo(() => previewPosition ? { ...room, fixtures: room.fixtures.map((fixture) => fixture.id === drag.preview!.id ? { ...fixture, offset: { ...fixture.offset, valueMm: previewPosition.offsetMm }, referenceHeight: { ...fixture.referenceHeight, valueMm: previewPosition.heightMm } } : fixture) } : room, [room, previewPosition, drag.preview])
  const model = useMemo(() => buildElevation(previewRoom, wall, resident, selectionId, benchmarkContextFor(project, room)), [previewRoom, wall, resident, selectionId, project, room])
  const { lengthMm, heightMm } = model
  // Label and line sizes are in millimetres of wall, so scale them to how large the wall is drawn:
  // roughly 760 px of width and 440 px of height are available on a desktop.
  const k = Math.max(0.5, Math.min(1.4, (12 / Math.min(760 / lengthMm, 440 / heightMm)) / 95))
  const y = (mm: number) => heightMm - mm
  const pad = { left: 380 * k, right: 60 * k, top: 60 * k, bottom: 60 * k }

  function onKeyDown(event: KeyboardEvent<SVGGElement>, fixture: WallFixture) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(fixture.id); return }
    drag.onEntityKeyDown(event, fixture)
  }

  function addFixture() {
    if (room.fixtures.length >= 60) return
    const entry = FIXTURE_CATALOG.find((candidate) => candidate.kind === newKind)!
    const fixture = createFixture(newKind, wall, room, `fixture-${crypto.randomUUID()}`, entry.label[locale])
    // Start beside any opening a switch or socket would land on.
    const problem = fixturePositionProblem(fixture, room)
    if (problem === 'over-opening') {
      const free = [0.2, 0.8, 0.1, 0.9, 0.35, 0.65].map((share) => ({ ...fixture, offset: { ...fixture.offset, valueMm: Math.round(lengthMm * share) } })).find((candidate) => !fixturePositionProblem(candidate, room))
      if (!free) { setMessage(t(locale, 'fixtureOverOpening')); return }
      fixture.offset = free.offset
    } else if (problem) { setMessage(t(locale, 'fixtureOutsideWall')); return }
    setMessage('')
    onCommitLayout(withPrimaryRoom(layout, (value) => ({ ...value, fixtures: [...value.fixtures, fixture] })))
    onSelect(fixture.id)
  }

  const wallLabel = t(locale, WALLS.find((entry) => entry.value === wall)!.label)
  const ticks = model.ticks.canvas
  return <div className="canvas-wrap elevation-wrap">
    <div className="canvas-caption">
      <div><p className="eyebrow">{t(locale, 'wallView')}</p><span>{wallLabel} · {(lengthMm / 1000).toFixed(2)} × {(heightMm / 1000).toFixed(2)} m</span></div>
      <div className="wall-selector" role="group" aria-label={t(locale, 'chooseWall')}>{WALLS.map((entry) => <Button key={entry.value} type="button" variant={wall === entry.value ? 'secondary' : 'ghost'} aria-pressed={wall === entry.value} onClick={() => onWallChange(entry.value)}>{t(locale, entry.label)}</Button>)}</div>
    </div>
    <div className="canvas-stage elevation-stage" ref={stageRef}>
      <svg ref={svgRef} role="group" aria-label={`${t(locale, 'wallView')}: ${wallLabel}`} viewBox={`${-pad.left} ${-pad.top} ${lengthMm + pad.left + pad.right} ${heightMm + pad.top + pad.bottom}`} onPointerMove={drag.onSurfacePointerMove} onPointerUp={drag.onSurfacePointerUp} onPointerCancel={drag.onSurfacePointerUp} onClick={(event) => { if (event.target === event.currentTarget) onSelect(null) }}>
        <rect x={0} y={0} width={lengthMm} height={heightMm} className="elevation-wall" onClick={() => onSelect(null)} />
        {/* Height scale in centimetres. */}
        {ticks.map((mm) => <g key={mm} className="elevation-tick" pointerEvents="none">
          <line x1={-40 * k} y1={y(mm)} x2={lengthMm} y2={y(mm)} strokeWidth={4 * k} />
          <text x={-60 * k} y={y(mm)} textAnchor="end" dominantBaseline="central" fontSize={95 * k}>{mm / 10}</text>
        </g>)}
        <text x={-60 * k} y={-pad.top + 40 * k} textAnchor="end" fontSize={80 * k} className="elevation-unit" pointerEvents="none">{t(locale, 'unitCm')}</text>
        {model.reachBand && <g className="elevation-reach" data-testid="reach-band" pointerEvents="none">
          <rect x={0} y={y(model.reachBand.highMm)} width={lengthMm} height={model.reachBand.highMm - model.reachBand.lowMm} />
          <text x={lengthMm - 30 * k} y={y(model.reachBand.highMm) + 100 * k} textAnchor="end" fontSize={85 * k}>{t(locale, 'reachBand')} {model.reachBand.lowMm / 10}–{model.reachBand.highMm / 10}</text>
        </g>}
        {model.benchmarkBands.map((band, index) => <g key={band.benchmarkId} className={`elevation-band elevation-band-${index}`} data-testid="benchmark-band" data-benchmark={band.benchmarkId} pointerEvents="none">
          <rect x={0} y={y(band.drawing.canvas.highMm)} width={lengthMm} height={band.drawing.canvas.rectHeightMm} />
          <text x={30 * k} y={y(band.drawing.canvas.labelYmm) - band.drawing.canvas.labelOffsetMm * k} fontSize={85 * k}>{t(locale, BENCHMARK_NAMES[band.benchmarkId])} {band.clause} · {band.minMm / 10}–{band.maxMm / 10}{band.pendingReview ? ` · ${t(locale, 'benchmarkPending')}` : ''}</text>
        </g>)}
        {model.openings.map((opening) => {
          const status = checkStatuses.get(opening.id)
          const label = t(locale, opening.kind)
          return <g key={opening.id} data-opening-id={opening.id} data-entity-check-status={showCheckMarks ? status?.status : undefined} className={`elevation-opening elevation-${opening.kind}`} pointerEvents={showCheckMarks && status && status.status !== 'clear' ? undefined : 'none'}>
          {showCheckMarks && status && status.status !== 'clear' && <rect x={opening.checkOutline.startMm} y={y(opening.checkOutline.topMm)} width={opening.checkOutline.endMm - opening.checkOutline.startMm} height={opening.checkOutline.topMm - opening.checkOutline.bottomMm} className={`check-marker-outline check-marker-outline-${status.status}`} />}
          <rect x={opening.startMm} y={y(opening.topMm)} width={opening.endMm - opening.startMm} height={opening.topMm - opening.bottomMm} strokeWidth={16 * k} />
          {showCheckMarks && status && <CheckMarkBadge status={status} entityId={opening.id} entityLabel={label} locale={locale} x={opening.badgePoint.alongMm} y={y(opening.badgePoint.heightMm)} size={400 * k} onActivate={onSelectCheckResult} />}
          <title>{label}</title>
        </g>})}
        {model.silhouettes.map((item) => <g key={item.id} className="elevation-silhouette" pointerEvents="none">
          <rect x={item.drawing.canvas.startMm} y={y(item.topMm)} width={item.drawing.canvas.endMm - item.drawing.canvas.startMm} height={item.topMm} rx={30 * k} strokeWidth={10 * k} strokeDasharray={`${50 * k} ${34 * k}`} />
          <text x={item.drawing.canvas.centerMm} y={y(item.topMm / 2)} textAnchor="middle" dominantBaseline="central" fontSize={80 * k}>{item.label}</text>
        </g>)}
        <line x1={-40 * k} y1={heightMm} x2={lengthMm + 40 * k} y2={heightMm} className="elevation-floor" strokeWidth={28 * k} pointerEvents="none" />
        {model.fixtures.map((box) => {
          const fixture = room.fixtures.find((candidate) => candidate.id === box.id)!
          const selected = selectionId === box.id
          const status = checkStatuses.get(box.id)
          const grow = 22 * k
          return <g key={box.id}>
          <g role="button" tabIndex={0} aria-pressed={selected} aria-label={`${box.label}, ${box.referenceHeightMm} mm`}
            data-fixture-id={box.id} data-offset-mm={(box.startMm + box.endMm) / 2} data-height-mm={box.referenceHeightMm} data-entity-check-status={showCheckMarks ? status?.status : undefined}
            className={`elevation-fixture ${fixture.kind.startsWith('grab-bar') ? 'elevation-fixture-bar' : ''} ${selected ? 'selected' : ''} ${highlightIds.includes(box.id) ? 'changed' : ''}`}
            onPointerDown={(event) => drag.onEntityPointerDown(event, fixture)} onKeyDown={(event) => onKeyDown(event, fixture)}>
            {/* A generous invisible target so thin bars are easy to grab. */}
            <rect className="elevation-hit" x={box.startMm - 60 * k} y={y(box.topMm) - 60 * k} width={box.endMm - box.startMm + 120 * k} height={box.topMm - box.bottomMm + 120 * k} />
            {showCheckMarks && status && status.status !== 'clear' && <rect x={box.checkOutline.startMm} y={y(box.checkOutline.topMm)} width={box.checkOutline.endMm - box.checkOutline.startMm} height={box.checkOutline.topMm - box.checkOutline.bottomMm} className={`check-marker-outline check-marker-outline-${status.status}`} />}
            <rect className="elevation-shape" x={box.startMm - grow / 2} y={y(box.topMm) - grow / 2} width={box.endMm - box.startMm + grow} height={box.topMm - box.bottomMm + grow} rx={grow} strokeWidth={10 * k} />
            {selected && <text x={(box.startMm + box.endMm) / 2} y={y(box.topMm) - 70 * k} textAnchor="middle" fontSize={90 * k} className="elevation-fixture-label" pointerEvents="none">{box.label} · {box.referenceHeightMm / 10} {t(locale, 'unitCm')}</text>}
            <title>{`${box.label} · ${box.referenceHeightMm} mm`}</title>
          </g>
          {showCheckMarks && status && status.status !== 'clear' && <CheckMarkBadge status={status} entityId={box.id} entityLabel={box.label} locale={locale} x={box.badgePoint.alongMm} y={y(box.badgePoint.heightMm)} size={400 * k} onActivate={onSelectCheckResult} />}
          </g>
        })}
      </svg>
      {(message || previewProblem) && <p role="alert" className="canvas-alert">{message || t(locale, previewProblem === 'over-opening' ? 'fixtureOverOpening' : 'fixtureOutsideWall')}</p>}
      {moveFeedback.preview && !message && !previewProblem && <div className="move-check-chip" data-testid="move-check-chip" style={{ left: moveFeedback.preview.left, top: moveFeedback.preview.top }} aria-hidden="true">{moveFeedback.preview.attention.length ? `${moveFeedback.preview.attention.length} ${t(locale, moveFeedback.preview.attention.length === 1 ? 'moveNeedsAttentionOne' : 'moveNeedsAttentionMany')}: ${t(locale, moveFeedback.preview.attention[0].messageKey as MessageKey)}` : t(locale, 'moveNoAttention')}</div>}
      <span className="sr-only" data-testid="move-check-live" aria-live="polite">{moveFeedback.announcement}</span>
    </div>
    <div className="elevation-add">
      <label className="field-label">{t(locale, 'addFixture')}<select value={newKind} disabled={!editable} onChange={(event) => setNewKind(event.target.value as FixtureKind)}>{FIXTURE_CATALOG.map((entry) => <option key={entry.kind} value={entry.kind}>{entry.label[locale]}</option>)}</select></label>
      <Button type="button" variant="outline" disabled={!editable || room.fixtures.length >= 60} onClick={addFixture}>{t(locale, 'addToThisWall')}</Button>
    </div>
    <div className="canvas-legend"><span>{t(locale, 'elevationHelp')}</span>{showCheckMarks && <><span><i className="legend-check-marker legend-check-attention">!</i>{t(locale, 'checkMarkerLegendAttention')}</span><span><i className="legend-check-marker legend-check-not-evaluated">?</i>{t(locale, 'checkMarkerLegendNotEvaluated')}</span></>}</div>
  </div>
}
