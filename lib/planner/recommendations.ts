import { t, type MessageKey } from './i18n'
import type { CheckResult, CostRange, Locale, Recommendation } from './types'

export type CostSummary = { lowSatang: number; highSatang: number; missingComponents: number; includedCount: number }

export function summarizeCosts(recommendations: Recommendation[]): CostSummary {
  const included = recommendations.filter((recommendation) => recommendation.status === 'accepted' || recommendation.status === 'completed')
  const summary = included.reduce<CostSummary>((total, recommendation) => {
    for (const component of [recommendation.materials, recommendation.labour] as (CostRange | null)[]) {
      if (!component) {
        total.missingComponents += 1
        continue
      }
      total.lowSatang += component.lowSatang
      total.highSatang += component.highSatang
    }
    return total
  }, { lowSatang: 0, highSatang: 0, missingComponents: 0, includedCount: included.length })
  return summary
}

export function buildRecommendationDraft(result: CheckResult, locale: Locale): Pick<Recommendation, 'title' | 'reason' | 'action'> {
  return {
    title: `${t(locale, 'recommendationDraftTitle')} · ${result.ruleId}`,
    reason: t(locale, result.messageKey as MessageKey),
    action: t(locale, 'recommendationDraftAction'),
  }
}

export function parseBahtAmount(value: string): number | null {
  const normalized = value.trim().replace(/[๐-๙]/g, (digit) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit)))
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null
  const [baht, satang = ''] = normalized.split('.')
  const total = Number(baht) * 100 + Number(satang.padEnd(2, '0'))
  return Number.isSafeInteger(total) && total <= 1_000_000_000_000 ? total : null
}

export function formatBahtAmount(satang: number, locale: Locale): string {
  return (satang / 100).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', { useGrouping: false, minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 })
}
