'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { buildElevation, fixturePositionProblem } from '@/lib/planner/elevation'
import { createFixture, FIXTURE_CATALOG } from '@/lib/planner/fixtures-catalog'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { getPrimaryRoom, withPrimaryRoom } from '@/lib/planner/layout-access'
import type { FixtureKind, Layout, Locale, ResidentProfile, Wall, WallFixture } from '@/lib/planner/types'

const WALLS: { value: Wall; label: MessageKey }[] = [
  { value: 'north', label: 'wallNorth' }, { value: 'east', label: 'wallEast' }, { value: 'south', label: 'wallSouth' }, { value: 'west', label: 'wallWest' },
]
const BENCHMARK_NAMES = { 'th-public-building': 'benchmarkPublicShort', 'th-dop-home': 'benchmarkHomeShort' } as const

type Props = {
  layout: Layout; locale: Locale; wall: Wall; selectionId: string | null; resident: ResidentProfile; mobilityAids: readonly string[]; editable: boolean
  highlightIds?: readonly string[]
  onWallChange(wall: Wall): void; onSelect(id: string | null): void; onCommitLayout(layout: Layout): void
}

/** One wall seen from inside the room. Fixtures can be moved here; furniture is shown for reference only. */
export function WallElevation({ layout, locale, wall, selectionId, resident, mobilityAids, editable, highlightIds = [], onWallChange, onSelect, onCommitLayout }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const [preview, setPreview] = useState<{ id: string; offsetMm: number; heightMm: number } | null>(null)
  const [message, setMessage] = useState('')
  const [newKind, setNewKind] = useState<FixtureKind>('grab-bar-horizontal')
  const room = getPrimaryRoom(layout)
  const previewRoom = useMemo(() => preview ? { ...room, fixtures: room.fixtures.map((fixture) => fixture.id === preview.id ? { ...fixture, offset: { ...fixture.offset, valueMm: preview.offsetMm }, referenceHeight: { ...fixture.referenceHeight, valueMm: preview.heightMm } } : fixture) } : room, [room, preview])
  const model = useMemo(() => buildElevation(previewRoom, wall, resident, selectionId, { roomType: room.type, mobilityAids }), [previewRoom, wall, resident, selectionId, room.type, mobilityAids])
  const { lengthMm, heightMm } = model
  // Label and line sizes are in millimetres of wall, so scale them to how large the wall is drawn:
  // roughly 760 px of width and 440 px of height are available on a desktop.
  const k = Math.max(0.5, Math.min(1.4, (12 / Math.min(760 / lengthMm, 440 / heightMm)) / 95))
  const y = (mm: number) => heightMm - mm
  const pad = { left: 380 * k, right: 60 * k, top: 60 * k, bottom: 60 * k }

  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current) return
      dragRef.current = null
      setPreview(null)
      setMessage('')
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [])

  function modelPoint(event: { clientX: number; clientY: number }) {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return { along: 0, up: 0 }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { along: point.x, up: heightMm - point.y }
  }

  function tryCommit(fixture: WallFixture, offsetMm: number, referenceHeightMm: number): boolean {
    // Moving a fixture changes two measured values, so both go back to "estimated".
    const moved: WallFixture = { ...fixture, offset: { valueMm: Math.round(offsetMm), confidence: 'estimated' }, referenceHeight: { valueMm: Math.round(referenceHeightMm), confidence: 'estimated' } }
    if (moved.offset.valueMm === fixture.offset.valueMm && moved.referenceHeight.valueMm === fixture.referenceHeight.valueMm) return true
    const problem = fixturePositionProblem(moved, room)
    if (problem) { setMessage(t(locale, problem === 'over-opening' ? 'fixtureOverOpening' : 'fixtureOutsideWall')); return false }
    setMessage('')
    onCommitLayout(withPrimaryRoom(layout, (value) => ({ ...value, fixtures: value.fixtures.map((candidate) => candidate.id === fixture.id ? moved : candidate) })))
    return true
  }

  function onPointerDown(event: ReactPointerEvent<SVGGElement>, fixture: WallFixture) {
    event.stopPropagation()
    onSelect(fixture.id)
    if (!editable) return
    const point = modelPoint(event)
    dragRef.current = { id: fixture.id, dx: fixture.offset.valueMm - point.along, dy: fixture.referenceHeight.valueMm - point.up }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPreview({ id: fixture.id, offsetMm: fixture.offset.valueMm, heightMm: fixture.referenceHeight.valueMm })
  }
  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    const point = modelPoint(event)
    const snap = (value: number) => Math.round(value / 10) * 10
    setPreview({ id: drag.id, offsetMm: snap(point.along + drag.dx), heightMm: Math.max(0, snap(point.up + drag.dy)) })
  }
  function onPointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    const dropped = preview
    setPreview(null)
    const fixture = drag && room.fixtures.find((candidate) => candidate.id === drag.id)
    if (fixture && dropped) tryCommit(fixture, dropped.offsetMm, dropped.heightMm)
  }
  function onKeyDown(event: KeyboardEvent<SVGGElement>, fixture: WallFixture) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(fixture.id); return }
    if (!editable || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 50 : 10
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
    const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0
    onSelect(fixture.id)
    tryCommit(fixture, fixture.offset.valueMm + dx, fixture.referenceHeight.valueMm + dy)
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
  const ticks = Array.from({ length: Math.floor(heightMm / 500) + 1 }, (_, index) => index * 500)
  return <div className="canvas-wrap elevation-wrap">
    <div className="canvas-caption">
      <div><p className="eyebrow">{t(locale, 'wallView')}</p><span>{wallLabel} · {(lengthMm / 1000).toFixed(2)} × {(heightMm / 1000).toFixed(2)} m</span></div>
      <div className="wall-selector" role="group" aria-label={t(locale, 'chooseWall')}>{WALLS.map((entry) => <Button key={entry.value} type="button" variant={wall === entry.value ? 'secondary' : 'ghost'} aria-pressed={wall === entry.value} onClick={() => onWallChange(entry.value)}>{t(locale, entry.label)}</Button>)}</div>
    </div>
    <div className="canvas-stage elevation-stage">
      <svg ref={svgRef} role="group" aria-label={`${t(locale, 'wallView')}: ${wallLabel}`} viewBox={`${-pad.left} ${-pad.top} ${lengthMm + pad.left + pad.right} ${heightMm + pad.top + pad.bottom}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={(event) => { if (event.target === event.currentTarget) onSelect(null) }}>
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
          <rect x={0} y={y(band.maxMm)} width={lengthMm} height={Math.max(band.maxMm - band.minMm, 6)} />
          <text x={30 * k} y={y(band.maxMm) - 30 * k - index * 100 * k} fontSize={85 * k}>{t(locale, BENCHMARK_NAMES[band.benchmarkId])} {band.clause} · {band.minMm / 10}–{band.maxMm / 10}{band.pendingReview ? ` · ${t(locale, 'benchmarkPending')}` : ''}</text>
        </g>)}
        {model.openings.map((opening) => <g key={opening.id} className={`elevation-opening elevation-${opening.kind}`} pointerEvents="none">
          <rect x={opening.startMm} y={y(opening.topMm)} width={opening.endMm - opening.startMm} height={opening.topMm - opening.bottomMm} strokeWidth={16 * k} />
          <title>{t(locale, opening.kind === 'door' ? 'door' : 'window')}</title>
        </g>)}
        {model.silhouettes.map((item) => <g key={item.id} className="elevation-silhouette" pointerEvents="none">
          <rect x={Math.max(0, item.startMm)} y={y(item.topMm)} width={Math.min(lengthMm, item.endMm) - Math.max(0, item.startMm)} height={item.topMm} rx={30 * k} strokeWidth={10 * k} strokeDasharray={`${50 * k} ${34 * k}`} />
          <text x={(Math.max(0, item.startMm) + Math.min(lengthMm, item.endMm)) / 2} y={y(item.topMm / 2)} textAnchor="middle" dominantBaseline="central" fontSize={80 * k}>{item.label}</text>
        </g>)}
        <line x1={-40 * k} y1={heightMm} x2={lengthMm + 40 * k} y2={heightMm} className="elevation-floor" strokeWidth={28 * k} pointerEvents="none" />
        {model.fixtures.map((box) => {
          const fixture = room.fixtures.find((candidate) => candidate.id === box.id)!
          const selected = selectionId === box.id
          const grow = 22 * k
          return <g key={box.id} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${box.label}, ${box.referenceHeightMm} mm`}
            data-fixture-id={box.id} data-offset-mm={(box.startMm + box.endMm) / 2} data-height-mm={box.referenceHeightMm}
            className={`elevation-fixture ${fixture.kind.startsWith('grab-bar') ? 'elevation-fixture-bar' : ''} ${selected ? 'selected' : ''} ${highlightIds.includes(box.id) ? 'changed' : ''}`}
            onPointerDown={(event) => onPointerDown(event, fixture)} onKeyDown={(event) => onKeyDown(event, fixture)}>
            {/* A generous invisible target so thin bars are easy to grab. */}
            <rect className="elevation-hit" x={box.startMm - 60 * k} y={y(box.topMm) - 60 * k} width={box.endMm - box.startMm + 120 * k} height={box.topMm - box.bottomMm + 120 * k} />
            <rect className="elevation-shape" x={box.startMm - grow / 2} y={y(box.topMm) - grow / 2} width={box.endMm - box.startMm + grow} height={box.topMm - box.bottomMm + grow} rx={grow} strokeWidth={10 * k} />
            {selected && <text x={(box.startMm + box.endMm) / 2} y={y(box.topMm) - 70 * k} textAnchor="middle" fontSize={90 * k} className="elevation-fixture-label" pointerEvents="none">{box.label} · {box.referenceHeightMm / 10} {t(locale, 'unitCm')}</text>}
            <title>{`${box.label} · ${box.referenceHeightMm} mm`}</title>
          </g>
        })}
      </svg>
      {message && <p role="alert" className="canvas-alert">{message}</p>}
    </div>
    <div className="elevation-add">
      <label className="field-label">{t(locale, 'addFixture')}<select value={newKind} disabled={!editable} onChange={(event) => setNewKind(event.target.value as FixtureKind)}>{FIXTURE_CATALOG.map((entry) => <option key={entry.kind} value={entry.kind}>{entry.label[locale]}</option>)}</select></label>
      <Button type="button" variant="outline" disabled={!editable || room.fixtures.length >= 60} onClick={addFixture}>{t(locale, 'addToThisWall')}</Button>
    </div>
    <div className="canvas-legend"><span>{t(locale, 'elevationHelp')}</span></div>
  </div>
}
