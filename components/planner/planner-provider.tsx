'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ProjectCommand } from '@/lib/planner/commands'
import { createBathroomExampleProject, createEmptyProject, createExampleProject } from '@/lib/planner/fixtures'
import { commitCommand, createHistory, redo as historyRedo, undo as historyUndo, type HistoryState } from '@/lib/planner/history'
import { defaultPreferences, type PlannerPreferences } from '@/lib/planner/preferences'
import { useProjectPersistence, type SaveState } from './use-project-persistence'
import { getPrimaryRoom, layoutEntityIds } from '@/lib/planner/layout-access'
import type { Layout, LayoutId, Locale, Project, Result, RoomType } from '@/lib/planner/types'

type PlannerContextValue = {
  project: Project
  activeLayoutId: LayoutId
  activeLayout: Layout
  locale: Locale
  showDimensions: boolean
  showCheckMarks: boolean
  mode: 'family' | 'advisor'
  selectionId: string | null
  editingCurrent: boolean
  history: HistoryState
  saveState: SaveState
  savedProjectAvailable: boolean
  errorKey: string | null
  /** True until dismissed when the open project was upgraded from an earlier version's saved data. */
  upgradedFromV1: boolean
  dismissUpgradeNotice(): void
  saveNow(): boolean
  downloadProject(): boolean
  downloadCorruptRaw(): void
  replaceFromStorage(): boolean
  commit(command: ProjectCommand): Result<Project>
  undo(): void
  redo(): void
  replaceProject(project: Project): void
  beginNewProject(project: Project): void
  openExample(roomType?: RoomType): void
  setActiveLayout(id: LayoutId): void
  setSelection(id: string | null): void
  setLocale(locale: Locale): void
  setShowDimensions(show: boolean): void
  setShowCheckMarks(show: boolean): void
  setMode(mode: 'family' | 'advisor'): void
  setEditingCurrent(value: boolean): void
}

const PlannerContext = createContext<PlannerContextValue | null>(null)
const bootstrapTime = '2026-09-28T00:00:00.000Z'

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState(() => createHistory(createEmptyProject('new-project', bootstrapTime)))
  const [activeLayoutId, setActiveLayoutIdState] = useState<LayoutId>('current')
  const [locale, setLocaleState] = useState<Locale>('th')
  const [mode, setMode] = useState<'family' | 'advisor'>('family')
  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [editingCurrent, setEditingCurrent] = useState(false)
  const [persistenceEnabled, setPersistenceEnabled] = useState(false)
  const project = history.present
  const activeLayout = activeLayoutId === 'current' ? project.current : project.proposed ?? project.current
  const loadedPreferences = useRef<PlannerPreferences>(defaultPreferences)

  const onLoadProject = useCallback((next: Project) => {
    setHistory(createHistory(next))
    setActiveLayoutIdState(loadedPreferences.current.activeLayoutId === 'proposed' && next.proposed ? 'proposed' : 'current')
    setSelectionId(null)
    setEditingCurrent(false)
  }, [])
  const onLoadPreferences = useCallback((preferences: PlannerPreferences) => {
    loadedPreferences.current = preferences
    setLocaleState(preferences.locale)
    setMode(preferences.mode)
  }, [])
  const persistence = useProjectPersistence({ project, enabled: persistenceEnabled, onLoad: onLoadProject, onPreferences: onLoadPreferences })
  const allowOverwrite = persistence.allowOverwrite

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const commit = useCallback((command: ProjectCommand): Result<Project> => {
    if (command.type === 'replace-layout' && command.layoutId === 'current' && project.proposed && !editingCurrent) {
      return { ok: false, error: { code: 'current-readonly', messageKey: 'project.currentReadOnly', paths: ['current'] } }
    }
    const result = commitCommand(history, command, new Date().toISOString())
    if (result.ok) {
      setHistory(result.value)
      if (result.value.present !== history.present) setPersistenceEnabled(true)
    }
    return result.ok ? { ok: true, value: result.value.present } : result
  }, [history, project.proposed, editingCurrent])

  const replaceProject = useCallback((next: Project) => {
    allowOverwrite()
    setHistory(createHistory(next))
    setPersistenceEnabled(true)
    setActiveLayoutIdState('current')
    setSelectionId(null)
    setEditingCurrent(false)
  }, [allowOverwrite])

  const beginNewProject = useCallback((next: Project) => replaceProject(next), [replaceProject])
  const openExample = useCallback((roomType: RoomType = 'living') => replaceProject((roomType === 'bathroom' ? createBathroomExampleProject : createExampleProject)(new Date().toISOString(), locale)), [locale, replaceProject])
  const undo = useCallback(() => setHistory((state) => historyUndo(state, new Date().toISOString())), [])
  const redo = useCallback(() => setHistory((state) => historyRedo(state, new Date().toISOString())), [])
  const setActiveLayout = (id: LayoutId) => {
    if (id === 'proposed' && !project.proposed) return
    setActiveLayoutIdState(id)
    const target = id === 'current' ? project.current : project.proposed
    if (!selectionId || !target || !layoutEntityIds(target).has(selectionId)) setSelectionId(null)
    if (id !== 'current') setEditingCurrent(false)
    persistence.savePreferenceValues({ ...persistence.preferences, activeLayoutId: id })
  }

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale)
    persistence.savePreferenceValues({ ...persistence.preferences, locale: nextLocale })
  }
  const setPlannerMode = (nextMode: 'family' | 'advisor') => {
    setMode(nextMode)
    persistence.savePreferenceValues({ ...persistence.preferences, mode: nextMode })
  }
  const setShowDimensions = (show: boolean) => persistence.savePreferenceValues({ ...persistence.preferences, showDimensions: show })
  const setShowCheckMarks = (show: boolean) => persistence.savePreferenceValues({ ...persistence.preferences, showCheckMarks: show })

  const value: PlannerContextValue = {
    project, activeLayoutId, activeLayout, locale, showDimensions: persistence.preferences.showDimensions, showCheckMarks: persistence.preferences.showCheckMarks, mode, selectionId, editingCurrent, history,
    saveState: persistence.saveState, savedProjectAvailable: persistence.savedProjectAvailable, errorKey: persistence.errorKey,
    upgradedFromV1: persistence.upgradedFromV1, dismissUpgradeNotice: persistence.dismissUpgradeNotice,
    saveNow: persistence.saveNow, downloadProject: persistence.downloadProject, downloadCorruptRaw: persistence.downloadCorruptRaw, replaceFromStorage: persistence.replaceFromStorage,
    commit, undo, redo,
    replaceProject, beginNewProject, openExample, setActiveLayout, setSelection: setSelectionId,
    setLocale, setShowDimensions, setShowCheckMarks, setMode: setPlannerMode, setEditingCurrent,
  }

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner(): PlannerContextValue {
  const context = useContext(PlannerContext)
  if (!context) throw new Error('usePlanner must be used inside PlannerProvider')
  return context
}

export function newProjectDraft(title: string, room: { widthMm: number; depthMm: number; heightMm: number }, now: string, roomType: RoomType = 'living'): Project {
  const project = createEmptyProject(`project-${crypto.randomUUID()}`, now, roomType)
  project.title = title
  const space = getPrimaryRoom(project.current)
  space.shape.width.valueMm = room.widthMm
  space.shape.depth.valueMm = room.depthMm
  space.height.valueMm = room.heightMm
  return project
}
