import { z } from 'zod'
import { BENCHMARK_KEYS } from './benchmark-keys'

const bilingual = z.object({ th: z.string(), en: z.string() })
const benchmarkId = z.enum(['th-public-building', 'th-dop-home'])
const roomType = z.enum(['living', 'bathroom'])

const checklistArea = z.enum(['floors', 'lighting', 'bathroom', 'furniture', 'emergency', 'entrance'])
const checklistReview = z.object({
  status: z.enum(['pending', 'reviewed']),
  reviewer: z.string().optional(),
  reviewedAt: z.string().optional(),
}).superRefine((review, ctx) => {
  if (review.status === 'reviewed' && (!review.reviewer || !review.reviewedAt)) {
    ctx.addIssue({ code: 'custom', message: 'Reviewed checklist content needs reviewer and reviewedAt' })
  }
})
export const checklistDatasetSchema = z.object({
  datasetVersion: z.string().min(1),
  sources: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1), publisher: z.string().min(1),
    url: z.string().url(), licenceNote: z.string().min(1),
  })).min(1),
  questions: z.array(z.object({
    id: z.string().min(1), area: checklistArea, roomTypes: z.array(roomType).min(1),
    text: bilingual, why: bilingual, hazardAnswer: z.enum(['yes', 'no']),
    advice: bilingual, effort: z.enum(['no-cost', 'small-job', 'building-work']),
    sourceId: z.string().min(1), sourceRef: z.string().min(1),
    review: checklistReview,
  })),
}).superRefine((dataset, ctx) => {
  const sourceIds = new Set<string>()
  for (const source of dataset.sources) {
    if (sourceIds.has(source.id)) ctx.addIssue({ code: 'custom', message: `Duplicate checklist source ${source.id}` })
    sourceIds.add(source.id)
  }
  const questionIds = new Set<string>()
  for (const question of dataset.questions) {
    if (questionIds.has(question.id)) ctx.addIssue({ code: 'custom', message: `Duplicate checklist question ${question.id}` })
    questionIds.add(question.id)
    if (!sourceIds.has(question.sourceId)) ctx.addIssue({ code: 'custom', message: `Unknown source ${question.sourceId} for ${question.id}` })
  }
})
export type ChecklistDataset = z.infer<typeof checklistDatasetSchema>
export type ChecklistQuestion = ChecklistDataset['questions'][number]

export const benchmarkValueSchema = z.object({
  key: z.enum(BENCHMARK_KEYS),
  benchmarkId,
  sourceId: z.string().min(1),
  clause: z.string(),
  comparison: z.enum(['min', 'max', 'range', 'allowed-values', 'required']),
  minMm: z.number().int().positive().optional(),
  maxMm: z.number().int().positive().optional(),
  allowed: z.array(z.string().min(1)).min(1).optional(),
  appliesWhen: z.object({ roomTypes: z.array(roomType).optional(), mobilityAids: z.array(z.string()).optional() }).optional(),
  /** An explicit "this benchmark has no value for this key", with the reason shown to the user. */
  notApplicableReason: bilingual.optional(),
  note: bilingual,
  review: z.object({ status: z.enum(['pending', 'reviewed']), reviewer: z.string().optional(), reviewedAt: z.string().optional() }),
}).superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message: `${value.key} / ${value.benchmarkId}: ${message}` })
  if (value.notApplicableReason) {
    if (value.minMm !== undefined || value.maxMm !== undefined || value.allowed) issue('a not-applicable entry must not carry a value')
    return
  }
  if (!value.clause.trim()) issue('a value needs a clause or page reference')
  if (value.comparison === 'min' && value.minMm === undefined) issue('min comparison needs minMm')
  if (value.comparison === 'max' && value.maxMm === undefined) issue('max comparison needs maxMm')
  if (value.comparison === 'range' && (value.minMm === undefined || value.maxMm === undefined || value.minMm > value.maxMm)) issue('range comparison needs minMm <= maxMm')
  if (value.comparison === 'allowed-values' && !value.allowed) issue('allowed-values comparison needs allowed')
  if (value.review.status === 'reviewed' && (!value.review.reviewer || !value.review.reviewedAt)) issue('a reviewed value needs reviewer and reviewedAt')
})

export const benchmarkDatasetSchema = z.object({
  datasetVersion: z.string().min(1),
  sources: z.array(z.object({
    id: z.string().min(1), benchmarkId, title: z.string().min(1), edition: z.string(), url: z.string().url(), applicability: bilingual,
  })),
  values: z.array(benchmarkValueSchema),
}).superRefine((dataset, ctx) => {
  const sources = new Map(dataset.sources.map((source) => [source.id, source]))
  const seen = new Set<string>()
  for (const value of dataset.values) {
    const pair = `${value.key}|${value.benchmarkId}`
    if (seen.has(pair)) ctx.addIssue({ code: 'custom', message: `Duplicate benchmark value ${pair}` })
    seen.add(pair)
    const source = sources.get(value.sourceId)
    if (!source) ctx.addIssue({ code: 'custom', message: `Unknown source ${value.sourceId} for ${pair}` })
    else if (source.benchmarkId !== value.benchmarkId) ctx.addIssue({ code: 'custom', message: `Source ${value.sourceId} belongs to another benchmark than ${pair}` })
  }
})

export type BenchmarkValue = z.infer<typeof benchmarkValueSchema>
export type BenchmarkDataset = z.infer<typeof benchmarkDatasetSchema>
export type BenchmarkSource = BenchmarkDataset['sources'][number]

export const PRICE_REGIONS = ['bangkok-vicinity', 'central', 'north', 'northeast', 'east', 'west', 'south'] as const
export type PriceRegion = (typeof PRICE_REGIONS)[number]

export const provincesSchema = z.object({
  source: z.string().min(1),
  provinces: z.array(z.object({ code: z.string().regex(/^\d{2}$/), th: z.string().min(1), en: z.string().min(1), region: z.enum(PRICE_REGIONS) })),
}).superRefine((data, ctx) => {
  const codes = new Set<string>()
  for (const province of data.provinces) {
    if (codes.has(province.code)) ctx.addIssue({ code: 'custom', message: `Duplicate province code ${province.code}` })
    codes.add(province.code)
  }
})
export type Province = z.infer<typeof provincesSchema>['provinces'][number]

const ruleIdSchema = z.enum(['G01', 'G02', 'G03', 'G04', 'G05', 'M01', 'D01', 'D02', 'D03', 'H01', 'H02', 'H03', 'B01', 'B02', 'B03', 'B04', 'B05', 'B06'])
const benchmarkKey = z.enum(BENCHMARK_KEYS)

/** What applying a fix changes in the Proposed layout. Spec §10. */
export const fixEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move-item') }),
  z.object({ kind: z.literal('remove-item') }),
  z.object({ kind: z.literal('replace-item'), catalogId: z.string().min(1) }),
  z.object({ kind: z.literal('set-door-operation'), operation: z.enum(['sliding', 'hinged-out']) }),
  z.object({ kind: z.literal('set-threshold'), valueMm: z.literal(0) }),
  z.object({ kind: z.literal('set-door-width'), fromBenchmark: z.literal('door.clearWidth') }),
  z.object({ kind: z.literal('set-handle'), type: z.literal('lever'), fromBenchmark: z.literal('door.handleHeight') }),
  z.object({
    kind: z.literal('add-fixture'),
    fixtureKind: z.enum(['grab-bar-horizontal', 'grab-bar-vertical', 'grab-bar-fold-down', 'switch', 'socket', 'shelf', 'basin']),
    placement: z.enum(['beside-toilet', 'selected-wall']), fromBenchmark: benchmarkKey.optional(),
  }),
  z.object({ kind: z.literal('set-fixture-height'), fromBenchmark: benchmarkKey.optional(), fromResidentReach: z.boolean().optional() }),
  z.object({ kind: z.literal('set-seat-height'), fromBenchmark: z.literal('toilet.seatHeight') }),
  z.object({ kind: z.literal('set-floor-surface'), slipResistance: z.literal('slip-resistant') }),
  z.object({ kind: z.literal('note-only') }),
])

export const fixLibrarySchema = z.object({
  version: z.string().min(1),
  fixes: z.array(z.object({
    id: z.string().min(1), label: bilingual, description: bilingual, ruleIds: z.array(ruleIdSchema).min(1),
    workType: z.enum(['rearrange', 'purchase', 'building-work', 'site-review']),
    effort: z.enum(['no-cost', 'small-job', 'building-work']).optional(),
    effect: fixEffectSchema, priceKey: z.string().min(1).nullable(),
    grantCategories: z.array(z.enum(['older-persons-home', 'disability-home'])),
    needsProfessional: z.boolean(),
  })),
}).superRefine((library, ctx) => {
  const ids = new Set<string>()
  for (const fix of library.fixes) {
    if (ids.has(fix.id)) ctx.addIssue({ code: 'custom', message: `Duplicate fix id ${fix.id}` })
    ids.add(fix.id)
  }
})
export type FixLibrary = z.infer<typeof fixLibrarySchema>
export type Fix = FixLibrary['fixes'][number]
export type FixEffect = z.infer<typeof fixEffectSchema>

const satangBand = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).refine((band) => band[1] >= band[0], 'High must not be below low')
const costBand = z.object({ materials: satangBand.nullable(), labour: satangBand.nullable() })
export const priceListSchema = z.object({
  version: z.string().min(1),
  note: z.string().optional(),
  prices: z.array(z.object({
    priceKey: z.string().min(1), unit: z.enum(['per-item', 'per-door', 'per-m2', 'per-job']), label: bilingual,
    national: costBand.nullable(), regions: z.partialRecord(z.enum(PRICE_REGIONS), costBand),
    sourceNote: z.string().min(1), collectedAt: z.string().nullable(), sampleSize: z.number().int().nonnegative(),
  })),
}).superRefine((list, ctx) => {
  const keys = new Set<string>()
  for (const price of list.prices) {
    if (keys.has(price.priceKey)) ctx.addIssue({ code: 'custom', message: `Duplicate price key ${price.priceKey}` })
    keys.add(price.priceKey)
    if ((price.national || Object.keys(price.regions).length > 0) && !price.collectedAt) ctx.addIssue({ code: 'custom', message: `${price.priceKey}: a price needs the date it was collected` })
  }
})
export type PriceList = z.infer<typeof priceListSchema>
export type PriceEntry = PriceList['prices'][number]
export type CostBand = z.infer<typeof costBand>
