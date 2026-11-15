import { describe, expect, it } from 'vitest'
import { createExampleProject } from '../../lib/planner/fixtures'
import { loadProject, PROJECT_STORAGE_KEY, saveProject, type StoragePort } from '../../lib/planner/storage'

const now = '2026-09-28T10:00:00.000Z'

function memoryStorage(initial: string | null = null, fail: 'get' | 'set' | null = null): StoragePort & { value: string | null } {
  return {
    value: initial,
    getItem(key) { if (fail === 'get') throw new Error('storage unavailable'); return key === PROJECT_STORAGE_KEY ? this.value : null },
    setItem(key, value) { if (fail === 'set') throw new Error('quota exceeded'); if (key === PROJECT_STORAGE_KEY) this.value = value },
  }
}

describe('local project storage', () => {
  it('loads an empty store and saves the first valid project with its token', () => {
    const storage = memoryStorage()
    const project = createExampleProject(now)
    expect(loadProject(storage)).toEqual({ ok: true, value: null })
    const result = saveProject(storage, project, null, 'token-1')
    expect(result).toMatchObject({ ok: true, value: { writeToken: 'token-1', project } })
    expect(loadProject(storage)).toMatchObject({ ok: true, value: { writeToken: 'token-1' } })
  })
  it('detects a stale token and leaves existing content unchanged', () => {
    const storage = memoryStorage()
    const project = createExampleProject(now)
    saveProject(storage, project, null, 'token-1')
    const before = storage.value
    const result = saveProject(storage, { ...project, title: 'Changed' }, 'stale-token', 'token-2')
    expect(result).toMatchObject({ ok: false, error: { code: 'storage-conflict' } })
    expect(storage.value).toBe(before)
  })
  it('does not claim save success when storage is unavailable or over quota', () => {
    const project = createExampleProject(now)
    expect(saveProject(memoryStorage(null, 'get'), project, null, 'token-1').ok).toBe(false)
    expect(saveProject(memoryStorage(null, 'set'), project, null, 'token-1')).toMatchObject({ ok: false, error: { code: 'storage-write-failed' } })
  })
  it('preserves malformed storage and refuses to overwrite it', () => {
    const storage = memoryStorage('{ malformed')
    expect(loadProject(storage)).toMatchObject({ ok: false, error: { code: 'storage-corrupt' } })
    const before = storage.value
    expect(saveProject(storage, createExampleProject(now), null, 'token-1').ok).toBe(false)
    expect(storage.value).toBe(before)
  })
  it('rejects unsupported storage envelope versions', () => {
    const storage = memoryStorage(JSON.stringify({ storageVersion: 9, writeToken: 'future', project: createExampleProject(now) }))
    expect(loadProject(storage)).toMatchObject({ ok: false, error: { code: 'storage-version' } })
  })
})
