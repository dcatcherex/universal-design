import type { Locale, Result } from './types'

function normalizeDigits(value: string): string {
  return value.replace(/[๐-๙]/g, (digit) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)))
}

export function parseLength(text: string, unit: 'cm' | 'm'): Result<number> {
  const normalized = normalizeDigits(text.trim())
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return { ok: false, error: { code: 'invalid-length', messageKey: 'validation.invalidLength', paths: ['length'] } }
  }
  const multiplier = unit === 'cm' ? 10 : 1000
  const value = Number(normalized) * multiplier
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value))) {
    return { ok: false, error: { code: 'invalid-length', messageKey: 'validation.invalidLength', paths: ['length'] } }
  }
  return { ok: true, value: Math.round(value) }
}

export function formatLength(mm: number, unit: 'cm' | 'm', locale: Locale): string {
  const divisor = unit === 'cm' ? 10 : 1000
  const fractionDigits = unit === 'cm' ? 1 : 3
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  }).format(mm / divisor)
}
