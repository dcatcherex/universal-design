import { evaluateLayout, sortCheckResults } from '../checks'
import { getReviewStatus } from '../history'
import { summarizeCosts } from '../recommendations'
import { BENCHMARKS, type BenchmarkSource } from '../standards/benchmarks'
import { getProvince } from '../standards/provinces'
import type { CheckResult, FallRecord, HouseholdBrief, Layout, LayoutId, Locale, Project, Recommendation, ResidentProfile, ReviewReceipt, RoomType } from '../types'

export type ReportPlan = { layoutId: LayoutId; label: string; layout: Layout | null; checks: CheckResult[] }
export type ReportData = {
  projectId: string
  projectRevision: number
  title: string
  province: string
  roomType: RoomType
  brief: HouseholdBrief
  /** Body measurements that explain the reach and wheelchair checks. Fall history is separate. */
  residentNeeds: Omit<ResidentProfile, 'falls'>
  /** null unless the user chose to include fall history: it is health information. */
  falls: FallRecord[] | null
  plans: { current: ReportPlan; proposed: ReportPlan }
  recommendations: Recommendation[]
  costs: ReturnType<typeof summarizeCosts>
  budgetSatang: number | null
  review: { status: ReturnType<typeof getReviewStatus>; receipt: ReviewReceipt | null }
  benchmarks: { datasetVersion: string; sources: BenchmarkSource[]; primary: Project['benchmarkPolicy'] }
  disclaimer: string
}

/** Spec §7.4. Shown in the report, the checks panel and the export dialog. */
export const DISCLAIMER: Record<Locale, string> = {
  en: 'These results compare entered measurements with reference benchmarks. They are not a certification. The Ministerial Regulation applies to public buildings, not private homes. Consult a licensed architect or engineer for structural work or work that needs a permit.',
  th: 'ผลการตรวจนี้เป็นการเปรียบเทียบค่าที่บันทึกกับเกณฑ์อ้างอิงเท่านั้น ไม่ใช่การรับรอง กฎกระทรวงฯ บังคับใช้กับอาคารสาธารณะ ไม่ใช่บ้านพักอาศัยส่วนบุคคล งานโครงสร้างหรืองานที่ต้องขออนุญาตควรปรึกษาสถาปนิกหรือวิศวกรที่มีใบอนุญาต',
}

/** True when the project holds body or fall data, so an exported file contains health information. */
export function hasHealthData(project: Project): boolean {
  const resident = project.resident
  return resident.standingHeight !== null || resident.reach !== null || resident.wheelchair !== null || resident.strongerHand !== 'unknown' || resident.falls.length > 0
}

export function buildReportData(project: Project, locale: Locale): ReportData {
  const currentLabel = locale === 'th' ? 'ก่อนปรับปรุง' : 'Current plan'
  const proposedLabel = project.proposed ? (locale === 'th' ? 'หลังปรับปรุง' : 'Proposed plan') : (locale === 'th' ? 'ยังไม่ได้สร้างแผนเสนอ' : 'Proposed plan not created')
  const current = structuredClone(project.current)
  const proposed = project.proposed ? structuredClone(project.proposed) : null
  const province = getProvince(project.household.provinceCode)
  const { falls, ...residentNeeds } = structuredClone(project.resident)
  return {
    projectId: project.id,
    projectRevision: project.revision,
    title: project.title,
    province: province ? province[locale] : project.household.province,
    roomType: current.floors[0].rooms[0].type,
    brief: structuredClone(project.household),
    residentNeeds,
    falls: project.report.includeFallHistory ? falls : null,
    plans: {
      current: { layoutId: 'current', label: currentLabel, layout: current, checks: sortCheckResults(evaluateLayout(project, 'current')) },
      proposed: { layoutId: 'proposed', label: proposedLabel, layout: proposed, checks: proposed ? sortCheckResults(evaluateLayout(project, 'proposed')) : [] },
    },
    recommendations: structuredClone(project.recommendations),
    costs: summarizeCosts(project.recommendations),
    budgetSatang: project.household.budgetSatang,
    review: { status: getReviewStatus(project), receipt: project.review ? structuredClone(project.review) : null },
    benchmarks: { datasetVersion: BENCHMARKS.datasetVersion, sources: structuredClone(BENCHMARKS.sources), primary: project.benchmarkPolicy ? structuredClone(project.benchmarkPolicy) : null },
    disclaimer: DISCLAIMER[locale],
  }
}
