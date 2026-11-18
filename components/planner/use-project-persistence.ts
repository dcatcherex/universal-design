'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadTextFile, encodeProject, projectFilename } from '@/lib/planner/project-files'
import { defaultPreferences, loadPreferences, savePreferences, type PlannerPreferences } from '@/lib/planner/preferences'
import { loadProject, PROJECT_STORAGE_KEY, readStoredRaw, saveProject } from '@/lib/planner/storage'
import type { Project } from '@/lib/planner/types'

export type SaveState = 'loading' | 'empty' | 'saved' | 'unsaved' | 'error' | 'conflict' | 'corrupt'

export function useProjectPersistence({ project, enabled, onLoad, onPreferences }: {
  project: Project
  enabled: boolean
  onLoad(project: Project): void
  onPreferences(preferences: PlannerPreferences): void
}) {
  const [hydrated, setHydrated] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [lastSavedToken, setLastSavedToken] = useState<string | null>(null)
  const [savedProjectAvailable, setSavedProjectAvailable] = useState(false)
  const [corruptValue, setCorruptValue] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [upgradedFromV1, setUpgradedFromV1] = useState(false)
  const [preferences, setPreferences] = useState<PlannerPreferences>(defaultPreferences)
  const projectRef = useRef(project)
  const lastSavedProjectRef = useRef<Project | null>(null)
  const failedProjectRef = useRef<Project | null>(null)
  const onLoadRef = useRef(onLoad)
  const onPreferencesRef = useRef(onPreferences)
  const tokenRef = useRef<string | null>(null)
  const generationRef = useRef(0)
  useEffect(() => { projectRef.current = project }, [project])
  useEffect(() => { onLoadRef.current = onLoad }, [onLoad])
  useEffect(() => { onPreferencesRef.current = onPreferences }, [onPreferences])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      let storage: Storage
      try { storage = window.localStorage } catch {
        setSaveState('error')
        setErrorKey('storage.unavailable')
        setHydrated(true)
        return
      }
      const loadedPreferences = loadPreferences(storage)
      if (loadedPreferences.ok && loadedPreferences.value) {
        setPreferences(loadedPreferences.value)
        onPreferencesRef.current(loadedPreferences.value)
      }
      let raw: string | null = null
      try { raw = readStoredRaw(storage) } catch {
        setSaveState('error')
        setErrorKey('storage.unavailable')
        setHydrated(true)
        return
      }
      const result = loadProject(storage)
      if (cancelled) return
      if (!result.ok) {
        setSaveState(result.error.code === 'storage-corrupt' ? 'corrupt' : 'error')
        setErrorKey(result.error.messageKey)
        setCorruptValue(raw)
      } else if (result.value) {
        // A project upgraded from the v1 entry has nothing under the v2 key yet, so its first save expects no token.
        const upgraded = result.value.upgradedFromV1 === true
        tokenRef.current = upgraded ? null : result.value.writeToken
        lastSavedProjectRef.current = result.value.project
        setUpgradedFromV1(upgraded)
        setLastSavedToken(upgraded ? null : result.value.writeToken)
        setSavedProjectAvailable(true)
        onLoadRef.current(result.value.project)
        setSaveState('saved')
      } else {
        setSaveState('empty')
      }
      setHydrated(true)
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (!hydrated || !enabled || project === lastSavedProjectRef.current || project === failedProjectRef.current || saveState === 'conflict' || saveState === 'corrupt') return
    const generation = ++generationRef.current
    const markUnsaved = window.setTimeout(() => { setSaveState('unsaved'); setErrorKey(null) }, 0)
    const timeout = window.setTimeout(() => {
      let storage: Storage
      try { storage = window.localStorage } catch {
        if (generationRef.current === generation) { failedProjectRef.current = projectRef.current; setSaveState('error'); setErrorKey('storage.unavailable') }
        return
      }
      const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const result = saveProject(storage, projectRef.current, tokenRef.current, token)
      if (generationRef.current !== generation) return
      if (result.ok) {
        tokenRef.current = result.value.writeToken
        lastSavedProjectRef.current = projectRef.current
        failedProjectRef.current = null
        setLastSavedToken(result.value.writeToken)
        setSavedProjectAvailable(true)
        setSaveState('saved')
      } else {
        failedProjectRef.current = projectRef.current
        setSaveState(result.error.code === 'storage-conflict' ? 'conflict' : 'error')
        setErrorKey(result.error.messageKey)
      }
    }, 500)
    return () => { window.clearTimeout(timeout); window.clearTimeout(markUnsaved) }
  }, [project, hydrated, enabled, saveState])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PROJECT_STORAGE_KEY) return
      if (!event.newValue) {
        if (tokenRef.current) { setSaveState('conflict'); setErrorKey('storage.conflict') }
        return
      }
      const result = loadProject(window.localStorage)
      if (!result.ok) {
        setSaveState('conflict')
        setErrorKey('storage.conflict')
      } else if (result.value && result.value.writeToken !== tokenRef.current) {
        setSaveState('conflict')
        setErrorKey('storage.conflict')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (saveState !== 'unsaved' && saveState !== 'error') return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveState])

  const saveNow = useCallback(() => {
    let storage: Storage
    try { storage = window.localStorage } catch {
      failedProjectRef.current = projectRef.current
      setSaveState('error'); setErrorKey('storage.unavailable'); return false
    }
    const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const result = saveProject(storage, projectRef.current, tokenRef.current, token)
    if (!result.ok) {
      failedProjectRef.current = projectRef.current
      setSaveState(result.error.code === 'storage-conflict' ? 'conflict' : 'error')
      setErrorKey(result.error.messageKey)
      return false
    }
    tokenRef.current = result.value.writeToken
    lastSavedProjectRef.current = result.value.project
    failedProjectRef.current = null
    setLastSavedToken(result.value.writeToken)
    setSavedProjectAvailable(true)
    setSaveState('saved')
    setErrorKey(null)
    return true
  }, [])

  // Flush a pending autosave when the page unloads; the debounced save would otherwise lose the last edit on a quick reload/close.
  useEffect(() => {
    const flush = () => {
      if (!hydrated || !enabled || saveState === 'conflict' || saveState === 'corrupt') return
      if (projectRef.current === lastSavedProjectRef.current || projectRef.current === failedProjectRef.current) return
      saveNow()
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [hydrated, enabled, saveState, saveNow])

  const replaceFromStorage = useCallback(() => {
    const result = loadProject(window.localStorage)
    if (!result.ok || !result.value) return false
    tokenRef.current = result.value.writeToken
    lastSavedProjectRef.current = projectRef.current
    failedProjectRef.current = null
    setLastSavedToken(result.value.writeToken)
    setSavedProjectAvailable(true)
    onLoadRef.current(result.value.project)
    setSaveState('saved')
    setErrorKey(null)
    setCorruptValue(null)
    return true
  }, [])

  const dismissUpgradeNotice = useCallback(() => setUpgradedFromV1(false), [])

  const allowOverwrite = useCallback(() => {
    failedProjectRef.current = null
    setUpgradedFromV1(false)
    setSaveState('empty')
    setErrorKey(null)
    setCorruptValue(null)
  }, [])

  const savePreferenceValues = useCallback((value: PlannerPreferences) => {
    setPreferences(value)
    try { savePreferences(window.localStorage, value) } catch { /* preference failure never affects project save status */ }
  }, [])

  const downloadProject = useCallback(() => {
    try {
      downloadTextFile(projectFilename(projectRef.current.title), encodeProject(projectRef.current))
      return true
    } catch {
      setErrorKey('project.downloadFailed')
      return false
    }
  }, [])

  const downloadCorruptRaw = useCallback(() => {
    if (corruptValue === null) return
    downloadTextFile('baan-yoo-dee-recovery.raw.json', corruptValue)
  }, [corruptValue])

  return {
    hydrated, saveState, lastSavedToken, upgradedFromV1, dismissUpgradeNotice, savedProjectAvailable, corruptValue, errorKey, preferences,
    saveNow, replaceFromStorage, allowOverwrite, savePreferenceValues, downloadProject, downloadCorruptRaw,
  }
}
