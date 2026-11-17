import type { PriceList, PriceRegion } from './schema'

const COLUMNS = ['priceKey', 'region', 'materialsLow', 'materialsHigh', 'labourLow', 'labourHigh', 'jobDate', 'province', 'note']
const REGIONS = ['bangkok-vicinity', 'central', 'north', 'northeast', 'east', 'west', 'south'] as const satisfies readonly PriceRegion[]
const MINIMUM_SAMPLE_SIZE = 3

type CsvRecord = { line: number; cells: string[] }
type CsvParseResult = { ok: true; records: CsvRecord[] } | { ok: false; error: string }
type AmountRange = [number, number]
type Job = { jobDate: string; materials: AmountRange | null; labour: AmountRange | null; note: string }
type PriceGroup = { priceKey: string; region: PriceRegion; jobs: Job[] }
type ImportedEntryStats = { sampleSize: number; collectedAt: string; regions: string[]; notes: string[] }

export type ImportedPriceList = { priceList: PriceList; skipped: string[] }
export type ImportPricesResult = { ok: true; value: ImportedPriceList } | { ok: false; error: string }

function parseCsv(text: string): CsvParseResult {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const records: CsvRecord[] = []
  let cells: string[] = []
  let cell = ''
  let line = 1
  let rowLine = 1
  let inQuotes = false
  let afterQuote = false
  let hasContent = false

  const finishRecord = () => {
    records.push({ line: rowLine, cells: [...cells, cell] })
    cells = []
    cell = ''
    hasContent = false
  }

  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index++
        } else {
          inQuotes = false
          afterQuote = true
        }
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && source[index + 1] === '\n') index++
        cell += '\n'
        line++
      } else {
        cell += character
      }
      continue
    }

    if (afterQuote) {
      if (character === ',') {
        cells.push(cell)
        cell = ''
        afterQuote = false
        hasContent = true
        continue
      }
      if (character === '\r' || character === '\n') {
        if (character === '\r' && source[index + 1] === '\n') index++
        finishRecord()
        line++
        rowLine = line
        afterQuote = false
        continue
      }
      if (character === ' ' || character === '\t') continue
      return { ok: false, error: `Invalid CSV syntax at row ${rowLine}: unexpected text after a quoted field.` }
    }

    if (character === '"') {
      if (cell.length > 0) return { ok: false, error: `Invalid CSV syntax at row ${rowLine}: quote inside an unquoted field.` }
      inQuotes = true
      hasContent = true
    } else if (character === ',') {
      cells.push(cell)
      cell = ''
      hasContent = true
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && source[index + 1] === '\n') index++
      finishRecord()
      line++
      rowLine = line
    } else {
      cell += character
      if (character.trim()) hasContent = true
    }
  }

  if (inQuotes) return { ok: false, error: `Invalid CSV syntax at row ${rowLine}: quoted field was not closed.` }
  if (hasContent || cells.length > 0 || cell.length > 0 || afterQuote) finishRecord()
  return { ok: true, records }
}

function fail(error: string): ImportPricesResult {
  return { ok: false, error }
}

function parseAmount(value: string, column: string, row: number): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: `CSV row ${row}: ${column} must be a whole-baht amount.` }
  const amount = Number(trimmed)
  if (!Number.isSafeInteger(amount) || amount > Number.MAX_SAFE_INTEGER / 100) {
    return { ok: false, error: `CSV row ${row}: ${column} is too large to convert to satang.` }
  }
  return { ok: true, value: amount }
}

function parseRange(lowValue: string, highValue: string, label: string, row: number): { ok: true; value: AmountRange | null } | { ok: false; error: string } {
  const low = parseAmount(lowValue, `${label}Low`, row)
  if (!low.ok) return low
  const high = parseAmount(highValue, `${label}High`, row)
  if (!high.ok) return high
  if ((low.value === null) !== (high.value === null)) {
    return { ok: false, error: `CSV row ${row}: ${label}Low and ${label}High must both be filled or both be blank.` }
  }
  if (low.value === null || high.value === null) return { ok: true, value: null }
  if (high.value < low.value) return { ok: false, error: `CSV row ${row}: ${label}High must not be below ${label}Low.` }
  return { ok: true, value: [low.value, high.value] }
}

function parseJobDate(value: string): string | null {
  const date = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date ? date : null
}

function bandFor(jobs: Job[], field: 'materials' | 'labour'): AmountRange | null {
  const ranges = jobs.flatMap((job) => job[field] ? [job[field]!] : [])
  if (ranges.length < MINIMUM_SAMPLE_SIZE) return null
  const lows = ranges.map(([low]) => low * 100)
  const highs = ranges.map(([, high]) => high * 100)
  return [Math.min(...lows), Math.max(...highs)]
}

function isRegion(value: string): value is PriceRegion {
  return (REGIONS as readonly string[]).includes(value)
}

export function importPrices(csvText: string, basePrices: PriceList, version: string): ImportPricesResult {
  if (!version.trim() || !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(version) || version.includes('..')) {
    return fail('Version must contain only letters, numbers, dots, and hyphens, and must not contain "..".')
  }

  const parsedCsv = parseCsv(csvText)
  if (!parsedCsv.ok) return fail(parsedCsv.error)
  const [header, ...records] = parsedCsv.records
  if (!header || header.cells.map((cell) => cell.trim()).join(',') !== COLUMNS.join(',')) {
    return fail(`CSV row 1: expected header ${COLUMNS.join(',')}.`)
  }

  const priceKeys = new Set(basePrices.prices.map((price) => price.priceKey))
  const groups = new Map<string, PriceGroup>()
  let completedJobCount = 0

  for (const record of records) {
    const cells = record.cells.map((cell) => cell.trim())
    if (cells.every((cell) => !cell)) continue
    if (cells.length !== COLUMNS.length) return fail(`CSV row ${record.line}: expected ${COLUMNS.length} columns, received ${cells.length}.`)
    if (cells[8].toUpperCase().startsWith('EXAMPLE')) continue

    const [priceKey, regionText, materialsLow, materialsHigh, labourLow, labourHigh, dateText] = cells
    if (!priceKeys.has(priceKey)) return fail(`CSV row ${record.line}: unknown priceKey "${priceKey}".`)
    if (!isRegion(regionText)) return fail(`CSV row ${record.line}: unknown region "${regionText}".`)

    const materials = parseRange(materialsLow, materialsHigh, 'materials', record.line)
    if (!materials.ok) return fail(materials.error)
    const labour = parseRange(labourLow, labourHigh, 'labour', record.line)
    if (!labour.ok) return fail(labour.error)
    if (!materials.value && !labour.value) return fail(`CSV row ${record.line}: enter at least one materials or labour range.`)

    const jobDate = parseJobDate(dateText)
    if (!jobDate) return fail(`CSV row ${record.line}: jobDate must be a valid date in YYYY-MM-DD format.`)

    const groupId = `${priceKey}\u0000${regionText}`
    const group = groups.get(groupId) ?? { priceKey, region: regionText, jobs: [] }
    group.jobs.push({ jobDate, materials: materials.value, labour: labour.value, note: cells[8] })
    groups.set(groupId, group)
    completedJobCount++
  }

  if (!completedJobCount) return fail('No completed-job rows found. Example rows are ignored; add real job data before importing.')

  const prices = basePrices.prices.map((entry) => ({ ...entry, regions: { ...entry.regions } }))
  const entriesByKey = new Map(prices.map((entry) => [entry.priceKey, entry]))
  const statsByKey = new Map<string, ImportedEntryStats>()
  const skipped: string[] = []

  for (const group of groups.values()) {
    if (group.jobs.length < MINIMUM_SAMPLE_SIZE) {
      skipped.push(`${group.priceKey} / ${group.region} skipped: ${group.jobs.length} jobs; at least ${MINIMUM_SAMPLE_SIZE} required.`)
      continue
    }

    const materials = bandFor(group.jobs, 'materials')
    const labour = bandFor(group.jobs, 'labour')
    if (!materials && !labour) {
      skipped.push(`${group.priceKey} / ${group.region} skipped: at least ${MINIMUM_SAMPLE_SIZE} jobs with a complete range for materials or labour are required.`)
      continue
    }
    if (!materials) {
      const count = group.jobs.filter((job) => job.materials).length
      if (count > 0) skipped.push(`${group.priceKey} / ${group.region}: materials omitted; ${count} jobs have a complete materials range, fewer than ${MINIMUM_SAMPLE_SIZE}.`)
    }
    if (!labour) {
      const count = group.jobs.filter((job) => job.labour).length
      if (count > 0) skipped.push(`${group.priceKey} / ${group.region}: labour omitted; ${count} jobs have a complete labour range, fewer than ${MINIMUM_SAMPLE_SIZE}.`)
    }

    const entry = entriesByKey.get(group.priceKey)!
    entry.regions[group.region] = { materials, labour }

    const contributingJobs = group.jobs.filter((job) => (materials && job.materials) || (labour && job.labour))
    const collectedAt = contributingJobs.reduce((latest, job) => job.jobDate > latest ? job.jobDate : latest, '')
    const stats = statsByKey.get(group.priceKey) ?? { sampleSize: 0, collectedAt: '', regions: [], notes: [] }
    stats.sampleSize += contributingJobs.length
    if (collectedAt > stats.collectedAt) stats.collectedAt = collectedAt
    stats.regions.push(`${group.region} (${contributingJobs.length} jobs)`)
    stats.notes.push(...contributingJobs.map((job) => job.note).filter(Boolean))
    statsByKey.set(group.priceKey, stats)
  }

  for (const [priceKey, stats] of statsByKey) {
    const entry = entriesByKey.get(priceKey)!
    entry.sampleSize = stats.sampleSize
    entry.collectedAt = stats.collectedAt
    const notes = [...new Set(stats.notes)]
    entry.sourceNote = `Observed ranges imported from ${stats.sampleSize} completed jobs: ${stats.regions.join(', ')}.${notes.length ? ` Notes: ${notes.join(' | ')}` : ''}`
  }

  return {
    ok: true,
    value: {
      priceList: {
        ...basePrices,
        version,
        note: 'Regional ranges are included only when at least three job records are supplied; skipped priceKey/region pairs are unset.',
        prices,
      },
      skipped,
    },
  }
}
