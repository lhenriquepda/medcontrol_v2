import { describe, it, expect } from 'vitest'
import { TIER_LABELS, TIER_COLORS_SUBTLE, TIER_COLORS_BOLD } from './tierUtils'

describe('tierUtils', () => {
  const tiers = ['free', 'plus', 'pro', 'admin']

  it('TIER_LABELS has all 4 tiers', () => {
    expect(Object.keys(TIER_LABELS)).toEqual(tiers)
    expect(TIER_LABELS.free).toBe('Free')
    expect(TIER_LABELS.plus).toBe('PLUS')
    expect(TIER_LABELS.pro).toBe('PRO')
    expect(TIER_LABELS.admin).toBe('Admin')
  })

  it('TIER_COLORS_SUBTLE has all 4 tiers + dark variants', () => {
    tiers.forEach((tier) => {
      expect(TIER_COLORS_SUBTLE[tier]).toMatch(/bg-/)
      expect(TIER_COLORS_SUBTLE[tier]).toMatch(/text-/)
      expect(TIER_COLORS_SUBTLE[tier]).toMatch(/dark:/)
    })
  })

  it('TIER_COLORS_BOLD has all 4 tiers', () => {
    tiers.forEach((tier) => {
      expect(TIER_COLORS_BOLD[tier]).toMatch(/bg-/)
      expect(TIER_COLORS_BOLD[tier]).toMatch(/text-/)
    })
  })
})
