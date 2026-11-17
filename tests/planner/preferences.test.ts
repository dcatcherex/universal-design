import { describe, expect, it } from 'vitest'
import { loadPreferences, savePreferences, defaultPreferences } from '../../lib/planner/preferences'
import { PREFERENCES_STORAGE_KEY, type StoragePort } from '../../lib/planner/storage'

function storage(value: string | null = null): StoragePort & { raw: string | null } {
  return {
    raw: value,
    getItem(key) { return key === PREFERENCES_STORAGE_KEY ? this.raw : null },
    setItem(key, raw) { if (key === PREFERENCES_STORAGE_KEY) this.raw = raw },
  }
}

describe('view preferences', () => {
  it('saves and reloads language, mode, layout and editor display choices', () => {
    const store = storage()
    const value = { ...defaultPreferences, locale: 'en' as const, mode: 'advisor' as const, activeLayoutId: 'proposed' as const, gridSnapMm: 10 as const, showDimensions: false, showCheckMarks: false }
    expect(savePreferences(store, value)).toEqual({ ok: true, value })
    expect(loadPreferences(store)).toEqual({ ok: true, value })
  })
  it('defaults dimensions and check marks on when loading older preference records', () => {
    const olderPreferences = {
      version: defaultPreferences.version,
      locale: defaultPreferences.locale,
      mode: defaultPreferences.mode,
      activeLayoutId: defaultPreferences.activeLayoutId,
      gridSnapMm: defaultPreferences.gridSnapMm,
      showMeasurements: defaultPreferences.showMeasurements,
      showOverlays: defaultPreferences.showOverlays,
    }
    expect(loadPreferences(storage(JSON.stringify(olderPreferences)))).toEqual({ ok: true, value: defaultPreferences })
  })
  it('treats malformed or unsupported preferences as invalid and does not crash startup', () => {
    expect(loadPreferences(storage('{ broken')).ok).toBe(false)
    expect(loadPreferences(storage(JSON.stringify({ ...defaultPreferences, version: 9 }))).ok).toBe(false)
  })
})
