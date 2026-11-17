'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { resolveCatalogEntry } from '@/lib/planner/catalog'
import { createCatalogItem } from '@/lib/planner/fixtures'
import { createFixture, FIXTURE_CATALOG } from '@/lib/planner/fixtures-catalog'
import { buildElevation, fixturePositionProblem } from '@/lib/planner/elevation'
import { t, type MessageKey } from '@/lib/planner/i18n'
import { moveFurnitureInLayout } from '@/lib/planner/furniture-movement'
import { getPrimaryFloor, getPrimaryRoom, toFloorPoint, withPrimaryFloor, withPrimaryRoom } from '@/lib/planner/layout-access'
import type { NeedPrompt } from '@/lib/planner/resident-needs'
import { usePlanner } from './planner-provider'
import { EditorToolbar, type WorkspaceView } from './editor-toolbar'
import { CatalogPanel } from './catalog-panel'
import { ItemInspector } from './item-inspector'
import { PlanCanvas } from './plan-canvas'
import { ProjectMenu } from './project-menu'
import type { FixtureKind, FurnitureItem, PointMm, Wall } from '@/lib/planner/types'
import { RoomEditor } from './room-editor'
import type { SceneHandle } from './room-view-3d'
import { evaluateLayout, getEntityStatuses, summarizeChecks } from '@/lib/planner/checks'
import { BenchmarkPolicy, ChecksPanel } from './checks-panel'
import { BenchmarkBanner } from './benchmark-verdicts'
import { OverlayEditor } from './overlay-editor'
import { AdvisorTargets } from './advisor-targets'
import { RecommendationsPanel } from './recommendations-panel'
import { buildRecommendationDraft } from '@/lib/planner/recommendations'
import type { CheckResult, LayoutId, Recommendation } from '@/lib/planner/types'
import { ExportMenu } from './export-menu'
import { ReportPreview } from './report-preview'
import { WalkthroughPanel } from './walkthrough-panel'
import { buildReportData } from '@/lib/planner/exports/report-data'
import { createPlanSvg } from '@/lib/planner/exports/plan-svg'
import { createElevationSvg } from '@/lib/planner/exports/elevation-svg'
import { downloadBlob, downloadText, safeDownloadName } from '@/lib/planner/exports/download'
import type { Fix, FixParams } from '@/lib/planner/standards/fixes'
import type { WalkthroughFinding } from '@/lib/planner/standards/checklist'
import { FixtureInspector } from './fixture-inspector'
import { FixPreview } from './fix-preview'
import { ResidentPanel } from './resident-panel'
import { WallElevation } from './wall-elevation'

const RoomView3D = dynamic(() => import('./room-view-3d').then((module) => module.RoomView3D), {
  ssr: false,
  loading: () => <div className="scene-loading" role="status">Loading 3D view…</div>,
})

type Panel = 'catalog' | 'inspector' | 'checks' | 'recommendations' | 'resident' | 'walkthrough' | 'details' | null
type InspectorTab = 'items' | 'fixtures' | 'checks' | 'recommendations' | 'resident' | 'walkthrough'
const WALL_LABELS: Record<Wall, MessageKey> = { north: 'wallNorth', east: 'wallEast', south: 'wallSouth', west: 'wallWest' }

export function Workspace({ onHome, onNewSetup }: { onHome(): void; onNewSetup(): void }) {
  const planner = usePlanner()
  const commit = planner.commit
  const { project, activeLayout, activeLayoutId, locale, selectionId, showDimensions, showCheckMarks } = planner
  const [panel, setPanel] = useState<Panel>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('items')
  const [view, setView] = useState<WorkspaceView>('2d')
  const [wall, setWall] = useState<Wall>('north')
  const [overlayTool, setOverlayTool] = useState<'route' | 'turning' | null>(null)
  const [pickingFallId, setPickingFallId] = useState<string | null>(null)
  const [fixPreview, setFixPreview] = useState<{ result: CheckResult; fix: Fix } | null>(null)
  const [newFixture, setNewFixture] = useState<{ kind: FixtureKind; wall: Wall }>({ kind: 'grab-bar-horizontal', wall: 'north' })
  const [recommendationDraft, setRecommendationDraft] = useState<{ projectId: string; recommendation: Recommendation } | null>(null)
  const [reportOpen, setReportOpen] = useState<{ locale: typeof locale; pngUrl: string | null } | null>(null)
  const [exportMessage, setExportMessage] = useState('')
  const [viewError, setViewError] = useState<string | null>(null)
  const [sceneHandle, setSceneHandle] = useState<SceneHandle | null>(null)
  const [placement, setPlacement] = useState<{ catalogId: string; label: string; widthMm: number; depthMm: number; heightMm: number; finish: FurnitureItem['finish']; obstruction: FurnitureItem['obstruction'] } | null>(null)
  const room = getPrimaryRoom(activeLayout)
  const floor = getPrimaryFloor(activeLayout)
  const selectedItem = useMemo(() => room.items.find((item) => item.id === selectionId), [room.items, selectionId])
  const selectedFixture = useMemo(() => room.fixtures.find((fixture) => fixture.id === selectionId), [room.fixtures, selectionId])
  const currentCheckResults = useMemo(() => evaluateLayout(project, 'current'), [project])
  const proposedCheckResults = useMemo(() => project.proposed ? evaluateLayout(project, 'proposed') : [], [project])
  const checkResults = activeLayoutId === 'current' ? currentCheckResults : proposedCheckResults
  const currentSummary = useMemo(() => summarizeChecks(currentCheckResults), [currentCheckResults])
  const proposedSummary = useMemo(() => summarizeChecks(proposedCheckResults), [proposedCheckResults])
  const entityCheckStatuses = useMemo(() => getEntityStatuses(checkResults), [checkResults])
  const roomCheckResults = useMemo(() => checkResults.filter((result) => result.entityIds.length === 0), [checkResults])
  // The report re-reads the project while it is open, so the fall-history toggle takes effect at once.
  const reportData = useMemo(() => reportOpen ? buildReportData(structuredClone(project), reportOpen.locale) : null, [project, reportOpen])
  const canEdit = activeLayoutId === 'proposed' || !project.proposed || planner.editingCurrent
  const advisorMode = planner.mode === 'advisor'
  const pngAvailable = view === '3d' && !!sceneHandle && viewError === null

  useEffect(() => () => { if (reportOpen?.pngUrl) URL.revokeObjectURL(reportOpen.pngUrl) }, [reportOpen])
  const on3dUnavailable = useCallback((reason: string) => {
    setViewError(reason)
    setSceneHandle(null)
    setView('2d')
  }, [])

  function changeView(nextView: WorkspaceView) {
    setSceneHandle(null)
    setView(nextView)
  }
  function showWall(nextWall: Wall) {
    setWall(nextWall)
    changeView('wall')
  }

  async function openReport() {
    let pngUrl: string | null = null
    if (pngAvailable && sceneHandle) {
      try { pngUrl = URL.createObjectURL(await sceneHandle.capturePng()) }
      catch { setExportMessage(t(locale, 'exportFailed')) }
    }
    setReportOpen({ locale, pngUrl })
  }

  function exportSvg() {
    try {
      const svg = createPlanSvg(activeLayout, { locale, layoutLabel: t(locale, activeLayoutId), showOverlays: true, showDimensions, showCheckMarks, checkStatuses: entityCheckStatuses, roomCheckResults, selectedItemId: selectionId })
      downloadText(svg, 'image/svg+xml;charset=utf-8', `${safeDownloadName(project.title)}-${activeLayoutId}.svg`)
      setExportMessage('')
    } catch { setExportMessage(t(locale, 'exportFailed')) }
  }

  function exportWallSvg() {
    if (view !== 'wall') { setExportMessage(t(locale, 'wallSvgUnavailable')); return }
    try {
      const model = buildElevation(room, wall, project.resident, selectionId, { roomType: room.type, mobilityAids: project.household.mobilityAids })
      const svg = createElevationSvg(model, locale, { checkStatuses: entityCheckStatuses, showCheckMarks })
      downloadText(svg, 'image/svg+xml;charset=utf-8', `${safeDownloadName(project.title)}-${wall}-elevation.svg`)
      setExportMessage('')
    } catch { setExportMessage(t(locale, 'exportFailed')) }
  }

  async function exportPng() {
    if (!pngAvailable || !sceneHandle) { setExportMessage(t(locale, 'pngUnavailable')); return }
    try {
      downloadBlob(await sceneHandle.capturePng(), `${safeDownloadName(project.title)}-${activeLayoutId}-3d.png`)
      setExportMessage('')
    } catch { setExportMessage(t(locale, 'exportFailed')) }
  }
  const onSceneReady = useCallback((handle: SceneHandle) => {
    setSceneHandle(handle)
    setViewError(null)
  }, [])

  const commitLayout = useCallback((layout: typeof activeLayout): MessageKey | null => {
    const result = commit({ type: 'replace-layout', layoutId: activeLayoutId, layout })
    if (!result.ok) {
      const reason: MessageKey = result.error.code === 'current-readonly' ? 'currentReadOnly' : 'openingInvalid'
      window.alert(t(locale, reason))
      return reason
    }
    return null
  }, [commit, activeLayoutId, locale])

  const moveFurniture3d = useCallback((id: string, center: PointMm): MessageKey | null => {
    const result = moveFurnitureInLayout(activeLayout, id, center)
    if (!result.ok) return result.reason === 'out-of-bounds' ? 'outOfBounds' : 'selectItem'
    return commitLayout(result.layout)
  }, [activeLayout, commitLayout])

  function startOverlayDrawing(tool: 'route' | 'turning') {
    if (!canEdit) return
    setView('2d')
    setInspectorTab('checks')
    setPickingFallId(null)
    setOverlayTool(tool)
    setPanel(null)
  }

  // Points come from the plan in room coordinates; overlays are stored in floor coordinates.
  function placeRoute(points: PointMm[]) {
    if (floor.routes.length >= 20 || points.length < 2) return
    const route = { id: `route-${crypto.randomUUID()}`, label: t(locale, 'routeOverlay'), points: points.map((point) => toFloorPoint(room, point)), widthMm: null }
    const result = planner.commit({ type: 'replace-layout', layoutId: activeLayoutId, layout: withPrimaryFloor(activeLayout, (value) => ({ ...value, routes: [...value.routes, route] })) })
    if (!result.ok) window.alert(t(locale, 'overlayInputError'))
    setOverlayTool(null)
  }

  function placeTurning(center: PointMm) {
    if (floor.turningAreas.length >= 20) return
    const area = { id: `turning-${crypto.randomUUID()}`, label: t(locale, 'turningOverlay'), center: toFloorPoint(room, center), diameterMm: null }
    const result = planner.commit({ type: 'replace-layout', layoutId: activeLayoutId, layout: withPrimaryFloor(activeLayout, (value) => ({ ...value, turningAreas: [...value.turningAreas, area] })) })
    if (!result.ok) window.alert(t(locale, 'overlayInputError'))
    setOverlayTool(null)
  }

  function selectCheckLocation(result: CheckResult) {
    planner.setActiveLayout(result.layoutId)
    const targetLayout = result.layoutId === 'current' ? project.current : project.proposed
    const targetRoom = targetLayout ? getPrimaryRoom(targetLayout) : null
    const targetFloor = targetLayout ? getPrimaryFloor(targetLayout) : null
    const fixture = targetRoom?.fixtures.find((candidate) => result.entityIds.includes(candidate.id))
    const selected = result.entityIds.find((id) => targetRoom?.items.some((item) => item.id === id))
      ?? fixture?.id
      ?? result.entityIds.find((id) => targetFloor?.routes.some((route) => route.id === id))
      ?? result.entityIds.find((id) => targetFloor?.turningAreas.some((area) => area.id === id))
      ?? result.entityIds.find((id) => targetRoom?.openings.some((opening) => opening.id === id))
      ?? null
    const isOpening = !!targetRoom?.openings.some((opening) => opening.id === selected)
    // Fixtures are easiest to judge on their wall; everything else is shown on the plan.
    if (fixture && selected === fixture.id) { setWall(fixture.wall); setView('wall'); setInspectorTab('fixtures') }
    else { setView('2d'); setInspectorTab(isOpening || result.ruleId === 'B05' ? 'items' : 'checks') }
    planner.setSelection(selected)
    setPanel(window.innerWidth < 768 ? 'checks' : null)
    window.requestAnimationFrame(() => {
      const mobileOverlay = document.querySelector<HTMLElement>('.mobile-checks-content #overlay-instructions')
      if (isOpening || result.ruleId === 'B05') document.getElementById('room-editor')?.focus()
      else if (!result.entityIds.length) (mobileOverlay ?? document.getElementById('overlay-instructions'))?.focus()
    })
  }

  function focusNeedPrompt(prompt: NeedPrompt) {
    const focusTarget = () => {
      const input = [...document.querySelectorAll<HTMLElement>(`[data-need-focus="${prompt.focusTarget}"]`)]
        .find((element) => element.getClientRects().length > 0)
      input?.focus()
    }
    if (prompt.focusTarget === 'wheelchair-width') {
      setInspectorTab('resident')
      if (window.innerWidth < 768) setPanel('resident')
      window.requestAnimationFrame(focusTarget)
      return
    }
    if (prompt.focusTarget === 'walking-route' || prompt.focusTarget === 'turning-area') {
      startOverlayDrawing(prompt.focusTarget === 'walking-route' ? 'route' : 'turning')
      window.requestAnimationFrame(() => document.getElementById('overlay-instructions')?.focus())
      return
    }
    const result = checkResults.find((entry) => entry.ruleId === prompt.ruleId && (!prompt.entityId || entry.entityIds.includes(prompt.entityId)))
    if (result) selectCheckLocation(result)
    setInspectorTab('items')
    if (window.innerWidth < 768) setPanel('details')
    window.requestAnimationFrame(() => window.requestAnimationFrame(focusTarget))
  }

  function selectCheckResult(resultId: string) {
    setInspectorTab('checks')
    if (window.innerWidth < 768) setPanel('checks')
    window.requestAnimationFrame(() => {
      document.getElementById(`check-result-${resultId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  function openRecommendationDraft(recommendation: Recommendation, layoutId: LayoutId) {
    setRecommendationDraft({ projectId: project.id, recommendation })
    planner.setActiveLayout(layoutId)
    setInspectorTab('recommendations')
    if (window.innerWidth < 768) setPanel('recommendations')
  }

  function createRecommendationDraft(result: CheckResult) {
    const text = buildRecommendationDraft(result, locale)
    const recommendation: Recommendation = {
      id: `recommendation-${crypto.randomUUID()}`,
      layoutId: result.layoutId,
      ...(result.entityIds[0] ? { entityId: result.entityIds[0] } : {}),
      ...text,
      priority: 'next', workType: 'site-review', status: 'proposed', advisorNote: '', materials: null, labour: null, ruleId: result.ruleId,
    }
    openRecommendationDraft(recommendation, result.layoutId)
  }

  function createWalkthroughRecommendation(finding: WalkthroughFinding) {
    const question = finding.question
    const recommendation: Recommendation = {
      id: `recommendation-${crypto.randomUUID()}`,
      layoutId: 'current',
      findingQuestionId: finding.questionId,
      title: question.text[locale],
      reason: `${question.why[locale]}${finding.note ? ` ${t(locale, 'walkthroughNote')}: ${finding.note}` : ''}`,
      action: question.advice[locale],
      priority: 'next',
      workType: question.effort === 'no-cost' ? 'rearrange' : question.effort === 'small-job' ? 'purchase' : 'building-work',
      status: 'proposed',
      advisorNote: '',
      materials: null,
      labour: null,
    }
    openRecommendationDraft(recommendation, 'current')
  }

  function saveRecommendation(recommendation: Recommendation) {
    const result = planner.commit({ type: 'upsert-recommendation', recommendation })
    if (!result.ok) window.alert(t(locale, result.error.messageKey as Parameters<typeof t>[1]))
  }

  function deleteRecommendation(id: string) {
    planner.commit({ type: 'delete-recommendation', id })
  }

  function recordReview(reviewerName: string) {
    const result = planner.commit({ type: 'record-review', reviewerName })
    if (!result.ok) window.alert(t(locale, result.error.messageKey as Parameters<typeof t>[1]))
  }

  function applyFix(fixId: string, params: FixParams) {
    const result = planner.commit({ type: 'apply-fix', fixId, params })
    setFixPreview(null)
    setExportMessage(result.ok ? t(locale, 'fixApplied') : t(locale, 'fixFailed'))
  }

  function beginPlacement(catalogId: string) {
    if (!canEdit) return
    const entry = resolveCatalogEntry(catalogId)
    setView('2d')
    setPickingFallId(null)
    setPlacement({ catalogId, label: entry.label[locale], widthMm: entry.defaultDimensionsMm.width, depthMm: entry.defaultDimensionsMm.depth, heightMm: entry.defaultDimensionsMm.height, finish: 'oak', obstruction: entry.obstruction })
    setPanel(null)
  }

  function placeCatalogItem(center: { xMm: number; yMm: number }) {
    if (!placement) return
    const item = createCatalogItem(placement.catalogId, `item-${crypto.randomUUID()}`, placement.label, center.xMm, center.yMm, placement.finish)
    const result = planner.commit({ type: 'replace-layout', layoutId: activeLayoutId, layout: withPrimaryRoom(activeLayout, (value) => ({ ...value, items: [...value.items, item] })) })
    if (!result.ok) return
    setPlacement(null)
    planner.setSelection(item.id)
    if (window.innerWidth < 768) setPanel('inspector')
  }

  function addFixture() {
    if (!canEdit || room.fixtures.length >= 60) return
    const entry = FIXTURE_CATALOG.find((candidate) => candidate.kind === newFixture.kind)!
    const fixture = createFixture(newFixture.kind, newFixture.wall, room, `fixture-${crypto.randomUUID()}`, entry.label[locale])
    const problem = fixturePositionProblem(fixture, room)
    if (problem) { setExportMessage(t(locale, problem === 'over-opening' ? 'fixtureOverOpening' : 'fixtureOutsideWall')); return }
    const result = planner.commit({ type: 'replace-layout', layoutId: activeLayoutId, layout: withPrimaryRoom(activeLayout, (value) => ({ ...value, fixtures: [...value.fixtures, fixture] })) })
    if (!result.ok) return
    setExportMessage('')
    planner.setSelection(fixture.id)
  }

  // Fall locations are recorded against the CURRENT layout, so picking one shows that plan.
  function pickFallLocation(fallId: string | null) {
    setPickingFallId(fallId)
    if (!fallId) return
    setPlacement(null)
    setOverlayTool(null)
    planner.setActiveLayout('current')
    setView('2d')
    setPanel(null)
  }
  function placeFall(point: PointMm) {
    if (!pickingFallId) return
    const currentRoom = getPrimaryRoom(project.current)
    planner.commit({ type: 'set-resident', resident: { ...project.resident, falls: project.resident.falls.map((fall) => fall.id === pickingFallId ? { ...fall, roomId: currentRoom.id, point } : fall) } })
    setPickingFallId(null)
  }

  const checksContent = <>
    <BenchmarkBanner locale={locale} />
    <ChecksPanel results={checkResults} locale={locale} project={project} layout={activeLayout} roomType={room.type} editable={canEdit} currentSummary={currentSummary} proposedSummary={proposedSummary} hasProposed={!!project.proposed} onSelectEntities={selectCheckLocation} onNeedPrompt={focusNeedPrompt} onCreateRecommendation={createRecommendationDraft} onPreviewFix={(result, fix) => setFixPreview({ result, fix })} />
    <OverlayEditor layout={activeLayout} locale={locale} editable={canEdit} onCommit={commitLayout} onStartDrawing={startOverlayDrawing} />
    {advisorMode && <AdvisorTargets project={project} locale={locale} onCommit={(targets) => { planner.commit({ type: 'set-targets', targets }) }} />}
    {advisorMode && <BenchmarkPolicy key={`${project.id}-${project.benchmarkPolicy?.primary ?? 'none'}`} project={project} locale={locale} onChange={(primary, chosenBy) => { planner.commit({ type: 'set-benchmark-policy', primary, chosenBy }) }} />}
  </>
  const recommendationsContent = <RecommendationsPanel project={project} locale={locale} advisorMode={advisorMode} draft={recommendationDraft?.projectId === project.id ? recommendationDraft.recommendation : null} onDraftConsumed={() => setRecommendationDraft(null)} onSave={saveRecommendation} onDelete={deleteRecommendation} onReview={recordReview} onPreviewFix={(result, fix) => setFixPreview({ result, fix })} />
  const walkthroughContent = <WalkthroughPanel
    answers={project.checklist ?? []}
    roomType={getPrimaryRoom(project.current).type}
    locale={locale}
    editable={canEdit}
    onAnswer={(questionId, answer, note) => { planner.commit({ type: 'set-checklist-answer', questionId, answer, note }) }}
    onCreateRecommendation={createWalkthroughRecommendation}
  />
  const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'items', label: t(locale, 'items') }, { id: 'fixtures', label: t(locale, 'fixtures') }, { id: 'checks', label: t(locale, 'checks') },
    { id: 'recommendations', label: t(locale, 'recommendations') }, { id: 'resident', label: t(locale, 'resident') },
    { id: 'walkthrough', label: t(locale, 'walkthroughTitle') },
  ]

  return <div className="planner-shell">
    <header className="app-header">
      <button className="brand-lockup" onClick={onHome} aria-label={t(locale, 'home')}><span className="brand-mark">บ</span><span><strong>{t(locale, 'brand')}</strong><small>{t(locale, 'subtitle')}</small></span></button>
      <div className="project-header"><h1 className="project-title">{project.title}</h1></div>
      <div className="header-actions">
        <Button type="button" variant="ghost" onClick={() => planner.setLocale(locale === 'th' ? 'en' : 'th')} aria-label={t(locale, 'language')}>{locale === 'th' ? 'EN' : 'ไทย'}</Button>
        <ProjectMenu />
        <ExportMenu locale={locale} pngAvailable={pngAvailable} wallSvgAvailable={view === 'wall'} onReport={openReport} onSvg={exportSvg} onPng={() => { void exportPng() }} onWallSvg={exportWallSvg} />
        <Button type="button" variant="outline" onClick={onNewSetup}>{t(locale, 'newProject')}</Button>
      </div>
    </header>
    {planner.upgradedFromV1 && <p className="export-message upgrade-notice" role="status">{t(locale, 'upgradedNotice')} <Button type="button" variant="ghost" onClick={planner.dismissUpgradeNotice}>{t(locale, 'dismiss')}</Button></p>}
    {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
    <EditorToolbar onHome={onHome} view={view} onViewChange={changeView} viewUnavailable={viewError !== null} currentSummary={currentSummary} proposedSummary={proposedSummary} />
    <div className="workspace-grid">
      <aside className="catalog-sidebar"><CatalogPanel locale={locale} roomType={room.type} onAdd={beginPlacement} editable={canEdit} /></aside>
      <main className="canvas-column">
          {view === '3d' ? <RoomView3D key={`${project.id}-${activeLayoutId}`} layout={activeLayout} locale={locale} selectionId={selectionId} editable={canEdit} checkStatuses={entityCheckStatuses} showCheckMarks={showCheckMarks} onSelect={planner.setSelection} onMoveItem={moveFurniture3d} onReady={onSceneReady} onUnavailable={on3dUnavailable} />
          : view === 'wall' ? <WallElevation layout={activeLayout} project={project} layoutId={activeLayoutId} checkResults={checkResults} locale={locale} wall={wall} selectionId={selectionId} resident={project.resident} mobilityAids={project.household.mobilityAids} editable={canEdit} checkStatuses={entityCheckStatuses} showCheckMarks={showCheckMarks} onSelectCheckResult={selectCheckResult} onWallChange={setWall} onSelect={(id) => { planner.setSelection(id); if (id) setInspectorTab('fixtures') }} onCommitLayout={commitLayout} />
            : <PlanCanvas layout={activeLayout} project={project} layoutId={activeLayoutId} checkResults={checkResults} locale={locale} selectionId={selectionId} showDimensions={showDimensions} onToggleDimensions={planner.setShowDimensions} checkStatuses={entityCheckStatuses} roomCheckResults={roomCheckResults} showCheckMarks={showCheckMarks} onToggleCheckMarks={planner.setShowCheckMarks} onSelectCheckResult={selectCheckResult} routeTargetMm={project.targets.routeWidth?.valueMm} turningTargetMm={project.targets.turningDiameter?.valueMm} placement={placement} overlayTool={overlayTool} falls={project.resident.falls} pickingFall={pickingFallId !== null} onSelect={(id) => { planner.setSelection(id); if (id && room.fixtures.some((fixture) => fixture.id === id)) setInspectorTab('fixtures') }} onCommitLayout={commitLayout} onPlace={placeCatalogItem} onCancelPlacement={() => setPlacement(null)} onPlaceRoute={placeRoute} onPlaceTurning={placeTurning} onCancelOverlay={() => setOverlayTool(null)} onPickFall={placeFall} onCancelPickFall={() => setPickingFallId(null)} onSelectWall={showWall} />}
        {viewError && <div className="view-fallback" role="status">{t(locale, viewError === 'webgl-lost' ? 'webglLost' : 'webglFallback')}</div>}
      </main>
      <aside className="inspector-sidebar">
        <div className="inspector-tabs" role="tablist" aria-label={locale === 'th' ? 'แผงข้อมูล' : 'Inspector'}>
          {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={inspectorTab === tab.id} onClick={() => setInspectorTab(tab.id)}>{tab.label}</button>)}
        </div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'items'}>
          <section className="item-list-section"><div className="section-heading"><h2>{t(locale, 'items')}</h2><span>{room.items.length}</span></div>
            <div className="item-list">{room.items.map((item) => <button key={item.id} type="button" className={`item-list-row ${selectionId === item.id ? 'active' : ''}`} aria-pressed={selectionId === item.id} onClick={() => planner.setSelection(item.id)}><span className={`mini-item finish-${item.finish}`} /><span><strong>{item.label}</strong><small>{item.width.valueMm} × {item.depth.valueMm} mm</small></span><span aria-hidden="true">›</span></button>)}</div>
          </section>
          <ItemInspector key={selectedItem?.id ?? 'none'} item={selectedItem} layout={activeLayout} locale={locale} editable={canEdit} advisorMode={advisorMode} onCommit={commitLayout} onSelect={planner.setSelection} />
          <RoomEditor layout={activeLayout} locale={locale} editable={canEdit} advisorMode={advisorMode} selectionId={selectionId} onCommit={commitLayout} onSelect={planner.setSelection} />
        </div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'fixtures'}>
          <section className="item-list-section"><div className="section-heading"><h2>{t(locale, 'fixtures')}</h2><span>{room.fixtures.length}</span></div>
            <p className="helper-text">{t(locale, 'fixturesHelp')}</p>
            <div className="fixture-add">
              <label className="field-label">{t(locale, 'fixtureKind')}<select value={newFixture.kind} disabled={!canEdit} onChange={(event) => setNewFixture({ ...newFixture, kind: event.target.value as FixtureKind })}>{FIXTURE_CATALOG.map((entry) => <option key={entry.kind} value={entry.kind}>{entry.label[locale]}</option>)}</select></label>
              <label className="field-label">{t(locale, 'fixtureWall')}<select value={newFixture.wall} disabled={!canEdit} onChange={(event) => setNewFixture({ ...newFixture, wall: event.target.value as Wall })}>{(Object.keys(WALL_LABELS) as Wall[]).map((value) => <option key={value} value={value}>{t(locale, WALL_LABELS[value])}</option>)}</select></label>
              <Button type="button" variant="outline" disabled={!canEdit || room.fixtures.length >= 60} onClick={addFixture}>{t(locale, 'addFixture')}</Button>
            </div>
            <div className="item-list fixture-list">{room.fixtures.map((fixture) => <button key={fixture.id} type="button" className={`item-list-row ${selectionId === fixture.id ? 'active' : ''}`} aria-pressed={selectionId === fixture.id} onClick={() => planner.setSelection(fixture.id)}><span className="mini-item mini-fixture" /><span><strong>{fixture.label}</strong><small>{t(locale, WALL_LABELS[fixture.wall])} · {fixture.referenceHeight.valueMm} mm</small></span><span aria-hidden="true">›</span></button>)}</div>
          </section>
          {selectedFixture ? <FixtureInspector key={selectedFixture.id} fixture={selectedFixture} layout={activeLayout} locale={locale} editable={canEdit} advisorMode={advisorMode} onCommit={commitLayout} onSelect={planner.setSelection} onShowWall={showWall} /> : <section className="inspector-empty"><p>{t(locale, 'selectFixture')}</p></section>}
        </div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'checks'}>{checksContent}</div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'recommendations'}>{recommendationsContent}</div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'resident'}>
          <ResidentPanel project={project} locale={locale} advisorMode={advisorMode} pickingFallId={pickingFallId} onChange={(resident) => { planner.commit({ type: 'set-resident', resident }) }} onPickLocation={pickFallLocation} />
        </div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'walkthrough'}>{walkthroughContent}</div>
      </aside>
    </div>
    <nav className="mobile-actions" aria-label={locale === 'th' ? 'การทำงานบนมือถือ' : 'Mobile actions'}>
      <Button type="button" variant="outline" onClick={() => setPanel('catalog')}>{t(locale, 'catalog')}</Button>
      <Button type="button" variant="outline" onClick={() => setPanel('inspector')}>{t(locale, 'items')}</Button>
      <Button type="button" variant="outline" onClick={() => setPanel('checks')}>{t(locale, 'checks')}</Button>
      <Button type="button" variant="outline" onClick={() => setPanel('recommendations')}>{t(locale, 'recommendations')}</Button>
      <Button type="button" variant="outline" onClick={() => setPanel('resident')}>{t(locale, 'resident')}</Button>
      <Button type="button" variant="outline" onClick={() => setPanel('walkthrough')}>{t(locale, 'walkthroughTitle')}</Button>
      <Button type="button" variant="outline" onClick={planner.undo} disabled={!planner.history.past.length}>{t(locale, 'undo')}</Button>
    </nav>
    <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
      <SheetContent side="left" className="mobile-sheet"><SheetHeader><SheetTitle>{panel === 'catalog' ? t(locale, 'catalog') : panel === 'checks' ? t(locale, 'checksTitle') : panel === 'recommendations' ? t(locale, 'recommendations') : panel === 'resident' ? t(locale, 'resident') : panel === 'walkthrough' ? t(locale, 'walkthroughTitle') : t(locale, 'items')}</SheetTitle></SheetHeader>
        {panel === 'catalog' ? <CatalogPanel locale={locale} roomType={room.type} onAdd={beginPlacement} editable={canEdit} />
          : panel === 'checks' ? <div className="mobile-checks-content">{checksContent}</div>
            : panel === 'recommendations' ? recommendationsContent
              : panel === 'resident' ? <ResidentPanel project={project} locale={locale} advisorMode={advisorMode} pickingFallId={pickingFallId} onChange={(resident) => { planner.commit({ type: 'set-resident', resident }) }} onPickLocation={pickFallLocation} />
                : panel === 'walkthrough' ? walkthroughContent
                : panel === 'details' ? <div className="mobile-inspector-details"><ItemInspector item={selectedItem} layout={activeLayout} locale={locale} editable={canEdit} advisorMode={advisorMode} onCommit={commitLayout} onSelect={planner.setSelection} /><RoomEditor layout={activeLayout} locale={locale} editable={canEdit} advisorMode={advisorMode} selectionId={selectionId} onCommit={commitLayout} onSelect={planner.setSelection} /></div>
                  : <div className="mobile-inspector-list">{room.items.map((item) => <button key={item.id} type="button" className="item-list-row" onClick={() => { planner.setSelection(item.id); setPanel(null) }}>{item.label} · {item.width.valueMm} mm</button>)}</div>}
      </SheetContent>
    </Sheet>
    {reportOpen && reportData && <ReportPreview data={reportData} locale={reportOpen.locale} pngUrl={reportOpen.pngUrl} showDimensions={planner.showDimensions} showCheckMarks={planner.showCheckMarks} selectedItemId={selectionId} onClose={() => setReportOpen(null)} onToggleFallHistory={(includeFallHistory) => { planner.commit({ type: 'set-report-options', includeFallHistory }) }} />}
    {fixPreview && <FixPreview project={project} fix={fixPreview.fix} result={fixPreview.result} locale={locale} onApply={applyFix} onClose={() => setFixPreview(null)} />}
  </div>
}
