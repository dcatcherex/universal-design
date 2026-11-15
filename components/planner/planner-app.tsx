'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/planner/i18n'
import { decodeProject, MAX_PROJECT_FILE_BYTES } from '@/lib/planner/project-files'
import { PlannerProvider, usePlanner } from './planner-provider'
import { ProjectSetup } from './project-setup'
import { Workspace } from './workspace'

function PlannerExperience() {
  const planner = usePlanner()
  const [screen, setScreen] = useState<'welcome' | 'setup' | 'editor'>('welcome')
  const [fileError, setFileError] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const hasWork = planner.savedProjectAvailable || planner.project.revision > 0 || planner.saveState === 'corrupt'
  function beginSetup() {
    if (hasWork && !window.confirm(t(planner.locale, 'importConfirm'))) return
    setScreen('setup')
  }
  function openExample() {
    if (hasWork && !window.confirm(t(planner.locale, 'importConfirm'))) return
    planner.openExample()
    setScreen('editor')
  }
  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_PROJECT_FILE_BYTES) { setFileError(true); return }
    const result = decodeProject(await file.text())
    if (!result.ok) { setFileError(true); return }
    if (hasWork && !window.confirm(t(planner.locale, 'importConfirm'))) return
    planner.replaceProject(result.value)
    setFileError(false)
    setScreen('editor')
  }
  if (screen === 'setup') return <ProjectSetup onBack={() => setScreen('welcome')} onCreated={() => setScreen('editor')} />
  if (screen === 'editor') return <Workspace onHome={() => setScreen('welcome')} onNewSetup={beginSetup} />
  return <main className="welcome-page">
    <header className="welcome-header"><div className="brand-lockup"><span className="brand-mark">บ</span><span><strong>{t(planner.locale, 'brand')}</strong><small>{t(planner.locale, 'subtitle')}</small></span></div><Button type="button" variant="ghost" onClick={() => planner.setLocale(planner.locale === 'th' ? 'en' : 'th')}>{planner.locale === 'th' ? 'EN' : 'ไทย'}</Button></header>
    <section className="welcome-card"><div className="welcome-art" aria-hidden="true"><div className="welcome-window" /><div className="welcome-sofa" /><div className="welcome-table" /><span className="welcome-plant">✿</span></div><div className="welcome-copy"><p className="eyebrow">{t(planner.locale, 'brand')}</p><h1>{t(planner.locale, 'welcomeTitle')}</h1><p>{t(planner.locale, 'welcomeBody')}</p>
      <div className="welcome-actions"><Button type="button" className="primary-action large-action" onClick={beginSetup}>{t(planner.locale, 'newProject')}<span aria-hidden="true">→</span></Button><Button type="button" variant="outline" className="large-action" onClick={openExample}>{t(planner.locale, 'openExample')}<span aria-hidden="true">↗</span></Button><div className="file-action"><input ref={fileInput} type="file" accept=".json,.udhome.json,application/json" hidden onChange={importProject} /><Button type="button" variant="outline" className="large-action" onClick={() => fileInput.current?.click()}>{t(planner.locale, 'openFile')}<span aria-hidden="true">↗</span></Button></div></div>
      {fileError && <p role="alert" className="field-error">{t(planner.locale, 'importInvalid')}</p>}
      {planner.saveState === 'corrupt' && <section className="recovery-card" role="alert"><strong>{t(planner.locale, 'corruptTitle')}</strong><p>{t(planner.locale, 'corruptBody')}</p><div><Button type="button" variant="outline" onClick={planner.downloadCorruptRaw}>{t(planner.locale, 'downloadRaw')}</Button><Button type="button" variant="outline" onClick={beginSetup}>{t(planner.locale, 'startOver')}</Button></div></section>}
      {planner.saveState === 'conflict' && <section className="recovery-card" role="status"><p>{t(planner.locale, 'storageConflict')}</p><div><Button type="button" variant="outline" onClick={() => { if (planner.replaceFromStorage()) setScreen('editor') }}>{t(planner.locale, 'reloadStored')}</Button><Button type="button" variant="outline" onClick={planner.downloadProject}>{t(planner.locale, 'exportProject')}</Button></div></section>}
      {planner.savedProjectAvailable && <Button type="button" variant="ghost" onClick={() => setScreen('editor')}>{t(planner.locale, 'continueProject')} · {planner.project.title}</Button>}
    </div></section>
    <footer className="welcome-footer"><span>● {planner.locale === 'th' ? 'ข้อมูลอยู่ในอุปกรณ์ของคุณ' : 'Your project stays on this device'}</span><span>{planner.locale === 'th' ? 'หนึ่งห้องนั่งเล่นต่อหนึ่งโครงการ' : 'One living room per project'}</span></footer>
  </main>
}

export function PlannerApp() {
  return <PlannerProvider><PlannerExperience /></PlannerProvider>
}
