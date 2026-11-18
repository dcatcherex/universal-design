import { en } from './locales/en'
import { th } from './locales/th'
import type { Confidence, Locale } from './types'

export type MessageKey = keyof typeof en
export const dictionaries = { en, th } satisfies Record<Locale, Record<MessageKey, string>>
export function t(locale: Locale, key: MessageKey): string {
  return dictionaries[locale][key]
}

const CONFIDENCE_KEYS: Record<Confidence, MessageKey> = {
  estimated: 'confidenceEstimated',
  measured: 'confidenceMeasured',
  'advisor-verified': 'confidenceVerified',
}
export function confidenceLabel(locale: Locale, confidence: Confidence): string {
  return t(locale, CONFIDENCE_KEYS[confidence])
}
