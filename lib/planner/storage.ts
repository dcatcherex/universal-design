import { validateProject } from './schema'
import type { Project, Result } from './types'

export const PROJECT_STORAGE_KEY = 'baan-yoo-dee.project.v1'
export const PREFERENCES_STORAGE_KEY = 'baan-yoo-dee.preferences.v1'
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
export type SavedEnvelope = { storageVersion: 1; writeToken: string; project: Project }

function storageError<T>(code: string, messageKey: string, paths: string[] = []): Result<T> {
  return { ok: false, error: { code, messageKey, paths } }
}

function decodeEnvelope(raw: string): Result<SavedEnvelope> {
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
  const project = validateProject(value.project)
  if (!project.ok) return storageError('storage-corrupt', 'storage.invalidProject', project.error.paths)
  return { ok: true, value: { storageVersion: 1, writeToken: value.writeToken, project: project.value } }
}

export function loadProject(storage: StoragePort): Result<SavedEnvelope | null> {
  let raw: string | null
  try {
    raw = storage.getItem(PROJECT_STORAGE_KEY)
  } catch {
    return storageError('storage-unavailable', 'storage.unavailable', ['storage'])
  }
  if (raw === null) return { ok: true, value: null }
  return decodeEnvelope(raw)
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
    const parsed = decodeEnvelope(raw)
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
