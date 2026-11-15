import { evaluateLayout } from '../checks'
import { getReviewStatus } from '../history'
import { summarizeCosts } from '../recommendations'
import type { CheckResult, HouseholdBrief, Layout, LayoutId, Locale, Project, Recommendation, ReviewReceipt } from '../types'

export type ReportPlan = { layoutId: LayoutId; label: string; layout: Layout | null; checks: CheckResult[] }
export type ReportData = {
  projectId: string
  projectRevision: number
  title: string
  province: string
  brief: HouseholdBrief
  plans: { current: ReportPlan; proposed: ReportPlan }
  recommendations: Recommendation[]
  costs: ReturnType<typeof summarizeCosts>
  budgetSatang: number | null
  review: { status: ReturnType<typeof getReviewStatus>; receipt: ReviewReceipt | null }
}

export function buildReportData(project: Project, locale: Locale): ReportData {
  const currentLabel = locale === 'th' ? 'ก่อนปรับปรุง' : 'Current plan'
  const proposedLabel = project.proposed ? (locale === 'th' ? 'หลังปรับปรุง' : 'Proposed plan') : (locale === 'th' ? 'ยังไม่ได้สร้างแผนเสนอ' : 'Proposed plan not created')
  const current = structuredClone(project.current)
  const proposed = project.proposed ? structuredClone(project.proposed) : null
  return {
    projectId: project.id,
    projectRevision: project.revision,
    title: project.title,
    province: project.household.province,
    brief: structuredClone(project.household),
    plans: {
      current: { layoutId: 'current', label: currentLabel, layout: current, checks: evaluateLayout(project, 'current') },
      proposed: { layoutId: 'proposed', label: proposedLabel, layout: proposed, checks: proposed ? evaluateLayout(project, 'proposed') : [] },
    },
    recommendations: structuredClone(project.recommendations),
    costs: summarizeCosts(project.recommendations),
    budgetSatang: project.household.budgetSatang,
    review: { status: getReviewStatus(project), receipt: project.review ? structuredClone(project.review) : null },
  }
}
