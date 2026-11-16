import { migrateProject } from './migrate'
import { validateProject } from './schema'
import type { Project, Result } from './types'

export const PROJECT_STORAGE_KEY = 'baan-yoo-dee.project.v2'
/** Read only, to upgrade an earlier project. Never written or removed, so the old data stays recoverable. */
export const LEGACY_PROJECT_STORAGE_KEY = 'baan-yoo-dee.project.v1'
export const PREFERENCES_STORAGE_KEY = 'baan-yoo-dee.preferences.v1'
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
export type SavedEnvelope = { storageVersion: 1; writeToken: string; project: Project }
/** `upgradedFromV1` means the project came from the v1 entry and has not been saved under the v2 key yet. */
export type LoadedEnvelope = SavedEnvelope & { upgradedFromV1?: boolean }

function storageError<T>(code: string, messageKey: string, paths: string[] = []): Result<T> {
  return { ok: false, error: { code, messageKey, paths } }
}

function decodeEnvelope(raw: string, readProject: (value: unknown) => Result<Project>): Result<SavedEnvelope> {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return storageError('storage-corrupt', 'storage.corrupt', ['storage'])
  }
  if (typeof value !== 'object' || value === null || !('storageVersion' in value) || !('writeToken' in value) || !('project' in value)) {
    return storageError('storage-corrupt', 'storage.corrupt', ['storage'])
  }
  if (value.storageVersion !== 1) return storageError('storage-version', 'storage.unsupportedVersion', ['storageVersion'])
  if (typeof value.writeToken !== 'string' || value.writeToken.length === 0) return storageError('storage-corrupt', 'storage.corrupt', ['writeToken'])
  const project = readProject(value.project)
  if (!project.ok) return storageError('storage-corrupt', 'storage.invalidProject', project.error.paths)
  return { ok: true, value: { storageVersion: 1, writeToken: value.writeToken, project: project.value } }
}

/** The raw text the next `loadProject` would read: the v2 entry, or the v1 entry when there is no v2 one. */
export function readStoredRaw(storage: StoragePort): string | null {
  return storage.getItem(PROJECT_STORAGE_KEY) ?? storage.getItem(LEGACY_PROJECT_STORAGE_KEY)
}

export function loadProject(storage: StoragePort): Result<LoadedEnvelope | null> {
  let raw: string | null
  let legacyRaw: string | null = null
  try {
    raw = storage.getItem(PROJECT_STORAGE_KEY)
    if (raw === null) legacyRaw = storage.getItem(LEGACY_PROJECT_STORAGE_KEY)
  } catch {
    return storageError('storage-unavailable', 'storage.unavailable', ['storage'])
  }
  if (raw !== null) return decodeEnvelope(raw, validateProject)
  if (legacyRaw === null) return { ok: true, value: null }
  // Upgrade in memory only. Autosave will write the v2 key; the v1 entry is left exactly as it was.
  const legacy = decodeEnvelope(legacyRaw, migrateProject)
  if (!legacy.ok) return legacy
  return { ok: true, value: { ...legacy.value, upgradedFromV1: true } }
}

export function saveProject(storage: StoragePort, project: Project, expectedToken: string | null, newToken: string): Result<SavedEnvelope> {
  const validated = validateProject(project)
  if (!validated.ok) return { ok: false, error: { ...validated.error, code: 'invalid-project' } }
  if (!newToken.trim() || newToken === expectedToken) return storageError('invalid-write-token', 'storage.invalidWriteToken', ['writeToken'])
  let raw: string | null
  try {
    raw = storage.getItem(PROJECT_STORAGE_KEY)
  } catch {
    return storageError('storage-unavailable', 'storage.unavailable', ['storage'])
  }
  let current: SavedEnvelope | null = null
  if (raw !== null) {
    const parsed = decodeEnvelope(raw, validateProject)
    if (!parsed.ok) return parsed
    current = parsed.value
  }
  const currentToken = current?.writeToken ?? null
  if (currentToken !== expectedToken) return storageError('storage-conflict', 'storage.conflict', ['writeToken'])
  if (currentToken === newToken) return storageError('invalid-write-token', 'storage.invalidWriteToken', ['writeToken'])
  const envelope: SavedEnvelope = { storageVersion: 1, writeToken: newToken, project: validated.value }
  try {
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    return storageError('storage-write-failed', 'storage.writeFailed', ['storage'])
  }
  return { ok: true, value: envelope }
}
