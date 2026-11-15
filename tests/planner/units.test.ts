import { describe, expect, it } from 'vitest'
import { formatLength, parseLength } from '../../lib/planner/units'

describe('length unit conversion', () => {
  it.each([['90', 'cm', 900], ['๙๐', 'cm', 900], ['1.25', 'm', 1250]] as const)('parses %s %s as integer millimetres', (input, unit, expected) => {
    expect(parseLength(input, unit)).toEqual({ ok: true, value: expected })
  })
  it.each(['', 'NaN', '1,200', '-2', 'Infinity'])('rejects ambiguous or invalid input %s', (input) => {
    expect(parseLength(input, 'cm').ok).toBe(false)
  })
  it.each([['cm', 1234], ['m', 1234]] as const)('formats and parses %s within one millimetre', (unit, mm) => {
    const formatted = formatLength(mm, unit, 'en')
    const parsed = parseLength(formatted, unit)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(Math.abs(parsed.value - mm)).toBeLessThanOrEqual(1)
  })
})
