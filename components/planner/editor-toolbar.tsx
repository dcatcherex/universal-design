'use client'

import { Button } from '@/components/ui/button'
import { t } from '@/lib/planner/i18n'
import { usePlanner } from './planner-provider'

export type WorkspaceView = '2d' | 'wall' | '3d'

export function EditorToolbar({ onHome, view, onViewChange, viewUnavailable }: { onHome(): void; view: WorkspaceView; onViewChange(view: WorkspaceView): void; viewUnavailable: boolean }) {
  const planner = usePlanner()
  const { locale, activeLayoutId, project } = planner
  const proposalExists = !!project.proposed
  function createOrResetProposal() {
    if (proposalExists && !window.confirm(t(locale, 'resetProposalConfirm'))) return
    planner.commit({ type: proposalExists ? 'reset-proposal' : 'create-proposal' })
  }
  return <div className="editor-toolbar">
    <div className="layout-switch" role="group" aria-label={locale === 'th' ? 'เลือกแผนผัง' : 'Choose layout'}>
      <Button type="button" variant={activeLayoutId === 'current' ? 'secondary' : 'ghost'} aria-pressed={activeLayoutId === 'current'} onClick={() => planner.setActiveLayout('current')}>{t(locale, 'current')}</Button>
      {proposalExists && <Button type="button" variant={activeLayoutId === 'proposed' ? 'secondary' : 'ghost'} aria-pressed={activeLayoutId === 'proposed'} onClick={() => planner.setActiveLayout('proposed')}>{t(locale, 'proposed')}</Button>}
    </div>
    <div className="toolbar-actions">
      <Button type="button" variant="outline" onClick={onHome}>{t(locale, 'home')}</Button>
      {activeLayoutId === 'current' && proposalExists && <Button type="button" variant={planner.editingCurrent ? 'secondary' : 'outline'} onClick={() => planner.setEditingCurrent(!planner.editingCurrent)}>{t(locale, 'editCurrent')}</Button>}
      {!proposalExists && <Button type="button" className="primary-action" onClick={createOrResetProposal}>{t(locale, 'proposal')}</Button>}
      {proposalExists && activeLayoutId === 'proposed' && <Button type="button" variant="outline" onClick={createOrResetProposal}>{t(locale, 'resetProposal')}</Button>}
      <Button type="button" variant="outline" aria-label={t(locale, 'undo')} title={t(locale, 'undo')} disabled={!planner.history.past.length} onClick={planner.undo}>↶ <span>{t(locale, 'undo')}</span></Button>
      <Button type="button" variant="outline" aria-label={t(locale, 'redo')} title={t(locale, 'redo')} disabled={!planner.history.future.length} onClick={planner.redo}>↷ <span>{t(locale, 'redo')}</span></Button>
      <div className="view-switch" role="group" aria-label={locale === 'th' ? 'มุมมองแผนผัง' : 'Plan view'}>
        <Button type="button" variant={view === '2d' ? 'secondary' : 'ghost'} aria-pressed={view === '2d'} onClick={() => onViewChange('2d')}>{t(locale, 'view2d')}</Button>
        <Button type="button" variant={view === 'wall' ? 'secondary' : 'ghost'} aria-pressed={view === 'wall'} onClick={() => onViewChange('wall')}>{t(locale, 'wallView')}</Button>
        <Button type="button" variant={view === '3d' ? 'secondary' : 'ghost'} aria-pressed={view === '3d'} disabled={viewUnavailable} onClick={() => onViewChange('3d')}>{t(locale, 'view3d')}</Button>
      </div>
    </div>
    <div className="mode-switch" role="group" aria-label={locale === 'th' ? 'โหมด' : 'Mode'}>
      <Button type="button" variant={planner.mode === 'family' ? 'secondary' : 'ghost'} aria-pressed={planner.mode === 'family'} onClick={() => planner.setMode('family')}>{t(locale, 'family')}</Button>
      <Button type="button" variant={planner.mode === 'advisor' ? 'secondary' : 'ghost'} aria-pressed={planner.mode === 'advisor'} onClick={() => planner.setMode('advisor')}>{t(locale, 'advisor')}</Button>
    </div>
  </div>
}
