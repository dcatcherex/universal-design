import { en } from './locales/en'
import { th } from './locales/th'
import type { Locale } from './types'

export type MessageKey = keyof typeof en
export const dictionaries = { en, th } satisfies Record<Locale, Record<MessageKey, string>>
export function t(locale: Locale, key: MessageKey): string {
  return dictionaries[locale][key]
}
