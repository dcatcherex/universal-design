import { evaluateLayout } from './checks'
import { getPrimaryRoom } from './layout-access'
import { getDefaultCosts } from './standards/prices'
import { getFixesForResult, getEffortTier, FIXES, type Fix, type EffortTier } from './standards/fixes'
import { getWalkthrough, type WalkthroughFinding } from './standards/checklist'
import { formatBahtAmount } from './recommendations'
import { t, type MessageKey } from './i18n'
import type { CheckResult, CostRange, Locale, Project, Recommendation } from './types'

export const EFFORT_TIERS: readonly EffortTier[] = ['no-cost', 'small-job', 'building-work']

export type ActionReference =
  | { kind: 'check'; check: CheckResult }
  | { kind: 'finding'; finding: WalkthroughFinding }
  | { kind: 'recommendation'; text: string }

export type ActionListItem = {
  id: string
  tier: EffortTier
  kind: 'fix' | 'finding' | 'recommendation'
  action: string
  nearFall: boolean
  materials: CostRange | null
  labour: CostRange | null
  reference: ActionReference
  fix?: Fix
  check?: CheckResult
  recommendation?: Recommendation
}

export type ActionGroups = Record<EffortTier, ActionListItem[]>

export const EFFORT_LABEL_KEYS: Record<EffortTier, MessageKey> = {
  'no-cost': 'effortNoCost',
  'small-job': 'effortSmallJob',
  'building-work': 'effortBuildingWork',
}

export function getActionText(item: ActionListItem, locale: Locale): string {
  if (item.fix) return item.fix.label[locale]
  if (item.kind === 'finding' && item.reference.kind === 'finding') return item.reference.finding.question.advice[locale]
  return item.recommendation?.action ?? item.action
}

export function getActionReferenceText(item: ActionListItem, locale: Locale): string {
  if (item.reference.kind === 'finding') return `${t(locale, 'actionRelatedFinding')}: ${item.reference.finding.question.text[locale]}`
  if (item.reference.kind === 'check') return `${t(locale, 'actionRelatedCheck')}: ${item.reference.check.ruleId} · ${t(locale, item.reference.check.messageKey as MessageKey)}`
  return `${t(locale, 'actionRelatedRecommendation')}: ${item.reference.text}`
}

function priceRange(range: CostRange, locale: Locale): string {
  const currency = locale === 'th' ? 'บาท' : 'THB'
  return `${formatBahtAmount(range.lowSatang, locale)}–${formatBahtAmount(range.highSatang, locale)} ${currency}`
}

export function getActionPriceText(item: ActionListItem, locale: Locale): string {
  if (!item.materials && !item.labour) return t(locale, 'noDefaultPrice')
  const materials = item.materials ? priceRange(item.materials, locale) : t(locale, 'noDefaultPrice')
  const labour = item.labour ? priceRange(item.labour, locale) : t(locale, 'noDefaultPrice')
  return `${t(locale, 'costEstimateMaterials')}: ${materials} · ${t(locale, 'costEstimateLabour')}: ${labour}`
}

function emptyGroups(): ActionGroups {
  return { 'no-cost': [], 'small-job': [], 'building-work': [] }
}

function recommendationTier(recommendation: Recommendation, finding?: WalkthroughFinding): EffortTier {
  if (finding) return finding.question.effort
  if (recommendation.fixId) {
    const fix = FIXES.fixes.find((candidate) => candidate.id === recommendation.fixId)
    if (fix) return getEffortTier(fix)
  }
  if (recommendation.workType === 'site-review') return 'building-work'
  if (recommendation.workType === 'rearrange') return 'no-cost'
  return 'small-job'
}

function relatedCheck(recommendation: Recommendation, results: CheckResult[]): CheckResult | undefined {
  if (!recommendation.ruleId) return undefined
  return results.find((result) =>
    result.layoutId === recommendation.layoutId
    && result.ruleId === recommendation.ruleId
    && (!recommendation.entityId || result.entityIds.includes(recommendation.entityId)),
  )
}

/** Builds all current suggested actions, without turning findings into benchmark checks. */
export function getActionGroups(project: Project): ActionGroups {
  const groups = emptyGroups()
  const results = [
    ...evaluateLayout(project, 'current'),
    ...(project.proposed ? evaluateLayout(project, 'proposed') : []),
  ]
  const walkthrough = getWalkthrough(project.checklist ?? [], getPrimaryRoom(project.current).type)
  const findingsById = new Map(walkthrough.findings.map((finding) => [finding.questionId, finding]))
  const recommendationsByFinding = new Map<string, Recommendation>()
  for (const recommendation of project.recommendations) {
    if (recommendation.findingQuestionId && recommendation.status !== 'completed') {
      recommendationsByFinding.set(recommendation.findingQuestionId, recommendation)
    }
  }
  const completedFindingIds = new Set(project.recommendations
    .filter((recommendation) => recommendation.findingQuestionId && recommendation.status === 'completed')
    .map((recommendation) => recommendation.findingQuestionId!))
  const appliedFixIds = new Set(project.recommendations
    .filter((recommendation) => recommendation.fixId && (recommendation.layoutId === 'proposed' || recommendation.status === 'completed'))
    .map((recommendation) => recommendation.fixId!))

  for (const check of results) {
    for (const fix of getFixesForResult(check, project)) {
      if (appliedFixIds.has(fix.id)) continue
      const cost = getDefaultCosts(fix.priceKey, project.household.provinceCode)
      groups[getEffortTier(fix)].push({
        id: `fix:${check.id}:${fix.id}`,
        tier: getEffortTier(fix),
        kind: 'fix',
        action: fix.label.en,
        nearFall: check.nearFall,
        materials: cost.materials,
        labour: cost.labour,
        reference: { kind: 'check', check },
        fix,
        check,
      })
    }
  }

  for (const finding of walkthrough.findings) {
    if (completedFindingIds.has(finding.questionId) || recommendationsByFinding.has(finding.questionId)) continue
    groups[finding.question.effort].push({
      id: `finding:${finding.questionId}`,
      tier: finding.question.effort,
      kind: 'finding',
      action: finding.question.advice.en,
      nearFall: false,
      materials: null,
      labour: null,
      reference: { kind: 'finding', finding },
    })
  }

  for (const recommendation of project.recommendations) {
    if (recommendation.status === 'completed') continue
    if (recommendation.fixId && recommendation.layoutId === 'proposed') continue
    const finding = recommendation.findingQuestionId ? findingsById.get(recommendation.findingQuestionId) : undefined
    const check = relatedCheck(recommendation, results)
    const tier = recommendationTier(recommendation, finding)
    groups[tier].push({
      id: `recommendation:${recommendation.id}`,
      tier,
      kind: 'recommendation',
      action: recommendation.action,
      nearFall: check?.nearFall ?? false,
      materials: recommendation.materials,
      labour: recommendation.labour,
      reference: finding
        ? { kind: 'finding', finding }
        : check
          ? { kind: 'check', check }
          : { kind: 'recommendation', text: recommendation.reason },
      check,
      recommendation,
    })
  }

  for (const tier of EFFORT_TIERS) {
    groups[tier].sort((a, b) => Number(b.nearFall) - Number(a.nearFall))
  }
  return groups
}
