'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { decodeProject, MAX_PROJECT_FILE_BYTES } from '@/lib/planner/project-files'
import { t } from '@/lib/planner/i18n'
import { usePlanner } from './planner-provider'

export function ProjectMenu() {
  const planner = usePlanner()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_PROJECT_FILE_BYTES) { setMessage(t(planner.locale, 'importInvalid')); return }
    const result = decodeProject(await file.text())
    if (!result.ok) { setMessage(t(planner.locale, 'importInvalid')); return }
    if (!window.confirm(t(planner.locale, 'importConfirm'))) return
    planner.replaceProject(result.value)
    setMessage('')
  }
  const saveStateText = planner.saveState === 'saved' ? t(planner.locale, 'saved')
    : planner.saveState === 'unsaved' || planner.saveState === 'loading' ? t(planner.locale, planner.saveState === 'loading' ? 'saving' : 'unsaved')
      : planner.saveState === 'conflict' ? t(planner.locale, 'storageConflict')
        : planner.saveState === 'error' ? t(planner.locale, 'saveError') : t(planner.locale, 'unsaved')
  return <div className="project-menu-wrap">
    <input ref={fileInput} type="file" accept=".json,.udhome.json,application/json" hidden onChange={importFile} />
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" aria-label={t(planner.locale, 'projectFiles')}>{t(planner.locale, 'projectFiles')}</Button>} />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => { const okay = planner.saveNow(); if (okay) setMessage(t(planner.locale, 'saved')) }}>{t(planner.locale, 'saveProject')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { if (!planner.downloadProject()) setMessage(t(planner.locale, 'downloadFailed')) }}>{t(planner.locale, 'exportProject')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => fileInput.current?.click()}>{t(planner.locale, 'importProject')}</DropdownMenuItem>
        {planner.saveState === 'conflict' && <DropdownMenuItem onClick={() => { if (!planner.replaceFromStorage()) setMessage(t(planner.locale, 'storageConflict')) }}>{localeText(planner.locale)}</DropdownMenuItem>}
        {planner.saveState === 'error' && <DropdownMenuItem onClick={planner.downloadProject}>{t(planner.locale, 'saveError')}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    <span className={`save-state save-state-${planner.saveState}`} aria-live="polite"><i />{saveStateText}</span>
    {message && <span className="menu-message" role="status">{message}</span>}
  </div>
}

function localeText(locale: 'th' | 'en'): string {
  return locale === 'th' ? 'โหลดฉบับที่บันทึกไว้' : 'Reload saved project'
}
