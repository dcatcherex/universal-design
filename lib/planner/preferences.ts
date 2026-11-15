import { z } from 'zod'
import type { LayoutId, Locale, Result } from './types'
import { PREFERENCES_STORAGE_KEY, type StoragePort } from './storage'

export type PlannerPreferences = {
  version: 1
  locale: Locale
  mode: 'family' | 'advisor'
  activeLayoutId: LayoutId
  gridSnapMm: 10 | 50
  showMeasurements: boolean
  showOverlays: boolean
}

export const defaultPreferences: PlannerPreferences = {
  version: 1, locale: 'th', mode: 'family', activeLayoutId: 'current', gridSnapMm: 50, showMeasurements: true, showOverlays: true,
}

const preferencesSchema = z.object({
  version: z.literal(1), locale: z.enum(['th', 'en']), mode: z.enum(['family', 'advisor']),
  activeLayoutId: z.enum(['current', 'proposed']), gridSnapMm: z.union([z.literal(10), z.literal(50)]),
  showMeasurements: z.boolean(), showOverlays: z.boolean(),
})

export function loadPreferences(storage: StoragePort): Result<PlannerPreferences | null> {
  let raw: string | null
  try { raw = storage.getItem(PREFERENCES_STORAGE_KEY) } catch {
    return { ok: false, error: { code: 'preferences-unavailable', messageKey: 'storage.preferencesUnavailable', paths: ['preferences'] } }
  }
  if (!raw) return { ok: true, value: null }
  try {
    const parsed = preferencesSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return { ok: false, error: { code: 'preferences-invalid', messageKey: 'storage.preferencesInvalid', paths: parsed.error.issues.map((issue) => issue.path.join('.')) } }
    return { ok: true, value: parsed.data }
  } catch {
    return { ok: false, error: { code: 'preferences-invalid', messageKey: 'storage.preferencesInvalid', paths: ['preferences'] } }
  }
}

export function savePreferences(storage: StoragePort, preferences: PlannerPreferences): Result<PlannerPreferences> {
  const parsed = preferencesSchema.safeParse(preferences)
  if (!parsed.success) return { ok: false, error: { code: 'preferences-invalid', messageKey: 'storage.preferencesInvalid', paths: parsed.error.issues.map((issue) => issue.path.join('.')) } }
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(parsed.data))
    return { ok: true, value: parsed.data }
  } catch {
    return { ok: false, error: { code: 'preferences-write-failed', messageKey: 'storage.preferencesWriteFailed', paths: ['preferences'] } }
  }
}
