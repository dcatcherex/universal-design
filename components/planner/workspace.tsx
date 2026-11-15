'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CATALOG, getCatalogEntry } from '@/lib/planner/catalog'
import { t } from '@/lib/planner/i18n'
import { usePlanner } from './planner-provider'
import { EditorToolbar } from './editor-toolbar'
import { CatalogPanel } from './catalog-panel'
import { ItemInspector } from './item-inspector'
import { PlanCanvas } from './plan-canvas'
import { ProjectMenu } from './project-menu'
import type { FurnitureItem } from '@/lib/planner/types'
import { RoomEditor } from './room-editor'
import type { SceneHandle } from './room-view-3d'
import { evaluateLayout } from '@/lib/planner/checks'
import { ChecksPanel } from './checks-panel'
import { OverlayEditor } from './overlay-editor'
import { AdvisorTargets } from './advisor-targets'
import { RecommendationsPanel } from './recommendations-panel'
import { buildRecommendationDraft } from '@/lib/planner/recommendations'
import type { CheckResult, Recommendation } from '@/lib/planner/types'
import { ExportMenu } from './export-menu'
import { ReportPreview } from './report-preview'
import { buildReportData, type ReportData } from '@/lib/planner/exports/report-data'
import { createPlanSvg } from '@/lib/planner/exports/plan-svg'
import { downloadBlob, downloadText, safeDownloadName } from '@/lib/planner/exports/download'

const RoomView3D = dynamic(() => import('./room-view-3d').then((module) => module.RoomView3D), {
  ssr: false,
  loading: () => <div className="scene-loading" role="status">Loading 3D view…</div>,
})

type Panel = 'catalog' | 'inspector' | 'checks' | 'recommendations' | null

export function Workspace({ onHome, onNewSetup }: { onHome(): void; onNewSetup(): void }) {
  const planner = usePlanner()
  const { project, activeLayout, activeLayoutId, locale, selectionId } = planner
  const [panel, setPanel] = useState<Panel>(null)
  const [inspectorTab, setInspectorTab] = useState<'items' | 'checks' | 'recommendations'>('items')
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [overlayTool, setOverlayTool] = useState<'route' | 'turning' | null>(null)
  const [recommendationDraft, setRecommendationDraft] = useState<{ projectId: string; recommendation: Recommendation } | null>(null)
  const [reportSnapshot, setReportSnapshot] = useState<{ data: ReportData; locale: typeof locale; pngUrl: string | null } | null>(null)
  const [exportMessage, setExportMessage] = useState('')
  const [viewError, setViewError] = useState<string | null>(null)
  const [sceneHandle, setSceneHandle] = useState<SceneHandle | null>(null)
  const [placement, setPlacement] = useState<{ catalogId: string; label: string; widthMm: number; depthMm: number; heightMm: number; finish: FurnitureItem['finish']; obstruction: FurnitureItem['obstruction'] } | null>(null)
  const selectedItem = useMemo(() => activeLayout.items.find((item) => item.id === selectionId), [activeLayout.items, selectionId])
  const checkResults = useMemo(() => evaluateLayout(project, activeLayoutId), [project, activeLayoutId])
  const canEdit = activeLayoutId === 'proposed' || !project.proposed || planner.editingCurrent
  const pngAvailable = view === '3d' && !!sceneHandle && viewError === null

  useEffect(() => () => { if (reportSnapshot?.pngUrl) URL.revokeObjectURL(reportSnapshot.pngUrl) }, [reportSnapshot])
  const on3dUnavailable = useCallback((reason: string) => {
    setViewError(reason)
    setSceneHandle(null)
    setView('2d')
  }, [])

  function changeView(nextView: '2d' | '3d') {
    setSceneHandle(null)
    setView(nextView)
  }

  async function openReport() {
    const data = buildReportData(structuredClone(project), locale)
    let pngUrl: string | null = null
    if (pngAvailable && sceneHandle) {
      try { pngUrl = URL.createObjectURL(await sceneHandle.capturePng()) }
      catch { setExportMessage(t(locale, 'exportFailed')) }
    }
    setReportSnapshot({ data, locale, pngUrl })
  }

  function exportSvg() {
    try {
      const svg = createPlanSvg(activeLayout, { locale, layoutLabel: t(locale, activeLayoutId), showOverlays: true })
      downloadText(svg, 'image/svg+xml;charset=utf-8', `${safeDownloadName(project.title)}-${activeLayoutId}.svg`)
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

  function commitLayout(layout: typeof activeLayout) {
    const result = planner.commit({ type: 'replace-layout', layoutId: activeLayoutId, layout })
    if (!result.ok) window.alert(t(locale, 'openingInvalid'))
  }

  function startOverlayDrawing(tool: 'route' | 'turning') {
    if (!canEdit) return
    setView('2d')
    setInspectorTab('checks')
    setOverlayTool(tool)
    setPanel(null)
  }

  function placeRoute(points: { xMm: number; yMm: number }[]) {
    if (activeLayout.routes.length >= 20 || points.length < 2) return
    const next = structuredClone(activeLayout)
    next.routes.push({ id: `route-${crypto.randomUUID()}`, label: t(locale, 'routeOverlay'), points, widthMm: null })
    const result = planner.commit({ type: 'replace-layout', layoutId: activeLayoutId, layout: next })
    if (!result.ok) window.alert(t(locale, 'overlayInputError'))
    setOverlayTool(null)
  }

  function placeTurning(center: { xMm: number; yMm: number }) {
    if (activeLayout.turningAreas.length >= 20) return
    const next = structuredClone(activeLayout)
    next.turningAreas.push({ id: `turning-${crypto.randomUUID()}`, label: t(locale, 'turningOverlay'), center, diameterMm: null })
    const result = planner.commit({ type: 'replace-layout', layoutId: activeLayoutId, layout: next })
    if (!result.ok) window.alert(t(locale, 'overlayInputError'))
    setOverlayTool(null)
  }

  function selectCheckLocation(result: CheckResult) {
    setView('2d')
    setInspectorTab('checks')
    planner.setActiveLayout(result.layoutId)
    const targetLayout = result.layoutId === 'current' ? project.current : project.proposed
    const selected = result.entityIds.find((id) => targetLayout?.items.some((item) => item.id === id))
      ?? result.entityIds.find((id) => targetLayout?.routes.some((route) => route.id === id))
      ?? result.entityIds.find((id) => targetLayout?.turningAreas.some((area) => area.id === id))
      ?? result.entityIds.find((id) => targetLayout?.openings.some((opening) => opening.id === id))
      ?? null
    planner.setSelection(selected)
    setPanel(window.innerWidth < 768 ? 'checks' : null)
    window.requestAnimationFrame(() => {
      const mobileOverlay = document.querySelector<HTMLElement>('.mobile-checks-content #overlay-instructions')
      if (!result.entityIds.length) (mobileOverlay ?? document.getElementById('overlay-instructions'))?.focus()
      else if (targetLayout?.openings.some((opening) => opening.id === selected)) document.getElementById('room-editor')?.focus()
    })
  }

  function createRecommendationDraft(result: CheckResult) {
    const text = buildRecommendationDraft(result, locale)
    const recommendation: Recommendation = {
      id: `recommendation-${crypto.randomUUID()}`,
      layoutId: result.layoutId,
      ...(result.entityIds[0] ? { entityId: result.entityIds[0] } : {}),
      ...text,
      priority: 'next', workType: 'site-review', status: 'proposed', advisorNote: '', materials: null, labour: null,
    }
    setRecommendationDraft({ projectId: project.id, recommendation })
    planner.setActiveLayout(result.layoutId)
    setInspectorTab('recommendations')
    if (window.innerWidth < 768) setPanel('recommendations')
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

  function beginPlacement(catalogId: string) {
    if (!canEdit) return
    const entry = getCatalogEntry(catalogId) ?? CATALOG[9]
    setPlacement({ catalogId, label: entry.label[locale], widthMm: entry.defaultDimensionsMm.width, depthMm: entry.defaultDimensionsMm.depth, heightMm: entry.defaultDimensionsMm.height, finish: 'oak', obstruction: entry.obstruction })
    setPanel(null)
  }

  function placeCatalogItem(center: { xMm: number; yMm: number }) {
    if (!placement) return
    const item: FurnitureItem = {
      id: `item-${crypto.randomUUID()}`, catalogId: placement.catalogId, label: placement.label, center,
      width: { valueMm: placement.widthMm, confidence: 'estimated' },
      depth: { valueMm: placement.depthMm, confidence: 'estimated' },
      height: { valueMm: placement.heightMm, confidence: 'estimated' },
      rotationDeg: 0, finish: placement.finish, obstruction: placement.obstruction,
    }
    const next = structuredClone(activeLayout)
    next.items.push(item)
    const result = planner.commit({ type: 'replace-layout', layoutId: activeLayoutId, layout: next })
    if (!result.ok) return
    setPlacement(null)
    planner.setSelection(item.id)
    if (window.innerWidth < 768) setPanel('inspector')
  }

  return <div className="planner-shell">
    <header className="app-header">
      <button className="brand-lockup" onClick={onHome} aria-label={t(locale, 'home')}><span className="brand-mark">บ</span><span><strong>{t(locale, 'brand')}</strong><small>{t(locale, 'subtitle')}</small></span></button>
      <div className="project-header"><h1 className="project-title">{project.title}</h1></div>
      <div className="header-actions">
        <Button type="button" variant="ghost" onClick={() => planner.setLocale(locale === 'th' ? 'en' : 'th')} aria-label={t(locale, 'language')}>{locale === 'th' ? 'EN' : 'ไทย'}</Button>
        <ProjectMenu />
        <ExportMenu locale={locale} pngAvailable={pngAvailable} onReport={openReport} onSvg={exportSvg} onPng={() => { void exportPng() }} />
        <Button type="button" variant="outline" onClick={onNewSetup}>{t(locale, 'newProject')}</Button>
      </div>
    </header>
    {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
    <EditorToolbar onHome={onHome} view={view} onViewChange={changeView} viewUnavailable={viewError !== null} />
    <div className="workspace-grid">
      <aside className="catalog-sidebar"><CatalogPanel locale={locale} onAdd={beginPlacement} editable={canEdit} /></aside>
      <main className="canvas-column">
        {view === '3d' ? <RoomView3D key={`${project.id}-${activeLayoutId}`} layout={activeLayout} locale={locale} selectionId={selectionId} onSelect={planner.setSelection} onReady={onSceneReady} onUnavailable={on3dUnavailable} /> : <PlanCanvas layout={activeLayout} locale={locale} selectionId={selectionId} routeTargetMm={project.targets.routeWidth?.valueMm} turningTargetMm={project.targets.turningDiameter?.valueMm} placement={placement} overlayTool={overlayTool} onSelect={planner.setSelection} onCommitLayout={commitLayout} onPlace={placeCatalogItem} onCancelPlacement={() => setPlacement(null)} onPlaceRoute={placeRoute} onPlaceTurning={placeTurning} onCancelOverlay={() => setOverlayTool(null)} />}
        {viewError && <div className="view-fallback" role="status">{t(locale, viewError === 'webgl-lost' ? 'webglLost' : 'webglFallback')}</div>}
      </main>
      <aside className="inspector-sidebar">
        <div className="inspector-tabs" role="tablist" aria-label={locale === 'th' ? 'แผงข้อมูล' : 'Inspector'}>
          <button type="button" role="tab" aria-selected={inspectorTab === 'items'} onClick={() => setInspectorTab('items')}>{t(locale, 'items')}</button>
          <button type="button" role="tab" aria-selected={inspectorTab === 'checks'} onClick={() => setInspectorTab('checks')}>{t(locale, 'checks')}</button>
          <button type="button" role="tab" aria-selected={inspectorTab === 'recommendations'} onClick={() => setInspectorTab('recommendations')}>{t(locale, 'recommendations')}</button>
        </div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'items'}>
          <section className="item-list-section"><div className="section-heading"><h2>{t(locale, 'items')}</h2><span>{activeLayout.items.length}</span></div>
            <div className="item-list">{activeLayout.items.map((item) => <button key={item.id} type="button" className={`item-list-row ${selectionId === item.id ? 'active' : ''}`} aria-pressed={selectionId === item.id} onClick={() => planner.setSelection(item.id)}><span className={`mini-item finish-${item.finish}`} /><span><strong>{item.label}</strong><small>{item.width.valueMm} × {item.depth.valueMm} mm</small></span><span aria-hidden="true">›</span></button>)}</div>
          </section>
          <ItemInspector key={selectedItem?.id ?? 'none'} item={selectedItem} layout={activeLayout} locale={locale} editable={canEdit} onCommit={commitLayout} onSelect={planner.setSelection} />
          <RoomEditor layout={activeLayout} locale={locale} editable={canEdit} onCommit={commitLayout} />
          <div className="later-note"><strong>{t(locale, 'notEvaluated')}</strong><p>{t(locale, 'nextMilestone')}</p></div>
        </div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'checks'}>
          <ChecksPanel results={checkResults} locale={locale} onSelectEntities={selectCheckLocation} onCreateRecommendation={createRecommendationDraft} />
          <OverlayEditor layout={activeLayout} locale={locale} editable={canEdit} onCommit={commitLayout} onStartDrawing={startOverlayDrawing} />
          {planner.mode === 'advisor' && <AdvisorTargets project={project} locale={locale} onCommit={(targets) => { planner.commit({ type: 'set-targets', targets }) }} />}
        </div>
        <div className="inspector-scroll" hidden={inspectorTab !== 'recommendations'}>
          <RecommendationsPanel project={project} locale={locale} advisorMode={planner.mode === 'advisor'} draft={recommendationDraft?.projectId === project.id ? recommendationDraft.recommendation : null} onDraftConsumed={() => setRecommendationDraft(null)} onSave={saveRecommendation} onDelete={deleteRecommendation} onReview={recordReview} />
        </div>
      </aside>
    </div>
    <nav className="mobile-actions" aria-label={locale === 'th' ? 'การทำงานบนมือถือ' : 'Mobile actions'}>
      <Button type="button" variant="outline" onClick={() => setPanel('catalog')}>{t(locale, 'catalog')}</Button>
      <Button type="button" variant="outline" onClick={() => setPanel('inspector')}>{t(locale, 'items')}</Button>
      <Button type="button" variant="outline" onClick={() => setPanel('checks')}>{t(locale, 'checks')}</Button>
      <Button type="button" variant="outline" onClick={() => setPanel('recommendations')}>{t(locale, 'recommendations')}</Button>
      <Button type="button" variant="outline" onClick={planner.undo} disabled={!planner.history.past.length}>{t(locale, 'undo')}</Button>
    </nav>
    <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
      <SheetContent side="left" className="mobile-sheet"><SheetHeader><SheetTitle>{panel === 'catalog' ? t(locale, 'catalog') : panel === 'checks' ? t(locale, 'checksTitle') : panel === 'recommendations' ? t(locale, 'recommendations') : t(locale, 'items')}</SheetTitle></SheetHeader>
        {panel === 'catalog' ? <CatalogPanel locale={locale} onAdd={beginPlacement} editable={canEdit} /> : panel === 'checks' ? <div className="mobile-checks-content"><ChecksPanel results={checkResults} locale={locale} onSelectEntities={selectCheckLocation} onCreateRecommendation={createRecommendationDraft} /><OverlayEditor layout={activeLayout} locale={locale} editable={canEdit} onCommit={commitLayout} onStartDrawing={startOverlayDrawing} />{planner.mode === 'advisor' && <AdvisorTargets project={project} locale={locale} onCommit={(targets) => { planner.commit({ type: 'set-targets', targets }) }} />}</div> : panel === 'recommendations' ? <RecommendationsPanel project={project} locale={locale} advisorMode={planner.mode === 'advisor'} draft={recommendationDraft?.projectId === project.id ? recommendationDraft.recommendation : null} onDraftConsumed={() => setRecommendationDraft(null)} onSave={saveRecommendation} onDelete={deleteRecommendation} onReview={recordReview} /> : <div className="mobile-inspector-list">{activeLayout.items.map((item) => <button key={item.id} type="button" className="item-list-row" onClick={() => { planner.setSelection(item.id); setPanel(null) }}>{item.label} · {item.width.valueMm} mm</button>)}</div>}
      </SheetContent>
    </Sheet>
    {reportSnapshot && <ReportPreview data={reportSnapshot.data} locale={reportSnapshot.locale} pngUrl={reportSnapshot.pngUrl} onClose={() => setReportSnapshot(null)} />}
  </div>
}
