import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { importPrices } from '../lib/planner/standards/import-prices.ts'

async function main() {
  const [, , inputArgument, version, extraArgument] = process.argv
  if (!inputArgument || !version || extraArgument) throw new Error('Usage: node scripts/import-prices.ts <input.csv> <version>')

  const inputPath = path.resolve(inputArgument)
  const basePath = path.resolve('lib/planner/standards/data/prices-2026.10.json')
  const outputPath = path.resolve('lib/planner/standards/data', `prices-${version}.json`)
  const [csvText, baseText] = await Promise.all([readFile(inputPath, 'utf8'), readFile(basePath, 'utf8')])
  const basePrices = JSON.parse(baseText) as Parameters<typeof importPrices>[1]
  const result = importPrices(csvText, basePrices, version)
  if (!result.ok) throw new Error(result.error)

  await writeFile(outputPath, `${JSON.stringify(result.value.priceList, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  console.log(`Wrote ${outputPath}`)
  for (const message of result.value.skipped) console.warn(message)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
