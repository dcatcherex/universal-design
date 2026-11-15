import { describe, expect, it } from 'vitest'
import { en } from '../../lib/planner/locales/en'
import { th } from '../../lib/planner/locales/th'

describe('locale dictionaries', () => {
  it('contains the same complete set of typed UI keys in Thai and English', () => {
    expect(Object.keys(th).sort()).toEqual(Object.keys(en).sort())
  })
})
