import { describe, it, expect } from 'vitest'
import { validateSos } from './dosesService'

describe('validateSos', () => {
  it('returns ok when no rule for med', () => {
    const r = validateSos({
      rules: [{ medName: 'Outro', minIntervalHours: 4, maxDosesIn24h: 6 }],
      history: [],
      medName: 'Aspirina',
      scheduledAt: new Date().toISOString(),
    })
    expect(r.ok).toBe(true)
  })

  it('returns ok when no history', () => {
    const r = validateSos({
      rules: [{ medName: 'Aspirina', minIntervalHours: 4, maxDosesIn24h: 6 }],
      history: [],
      medName: 'Aspirina',
      scheduledAt: new Date().toISOString(),
    })
    expect(r.ok).toBe(true)
  })

  describe('minIntervalHours', () => {
    it('blocks if last dose less than min interval ago', () => {
      const now = new Date()
      const lastDose = new Date(now.getTime() - 2 * 36e5) // 2h atrás
      const r = validateSos({
        rules: [{ medName: 'Dipirona', minIntervalHours: 4 }],
        history: [
          { medName: 'Dipirona', status: 'done', actualTime: lastDose.toISOString() },
        ],
        medName: 'Dipirona',
        scheduledAt: now.toISOString(),
      })
      expect(r.ok).toBe(false)
      expect(r.reason).toMatch(/4h não respeitado/)
      expect(r.nextAt).toBeInstanceOf(Date)
    })

    it('allows if last dose >= min interval ago', () => {
      const now = new Date()
      const lastDose = new Date(now.getTime() - 5 * 36e5) // 5h atrás
      const r = validateSos({
        rules: [{ medName: 'Dipirona', minIntervalHours: 4 }],
        history: [
          { medName: 'Dipirona', status: 'done', actualTime: lastDose.toISOString() },
        ],
        medName: 'Dipirona',
        scheduledAt: now.toISOString(),
      })
      expect(r.ok).toBe(true)
    })

    it('case-insensitive medName matching', () => {
      const r = validateSos({
        rules: [{ medName: 'DIPIRONA', minIntervalHours: 4 }],
        history: [
          {
            medName: 'dipirona',
            status: 'done',
            actualTime: new Date(Date.now() - 1 * 36e5).toISOString(),
          },
        ],
        medName: 'Dipirona',
        scheduledAt: new Date().toISOString(),
      })
      expect(r.ok).toBe(false)
    })
  })

  describe('maxDosesIn24h', () => {
    it('blocks when limit reached', () => {
      const now = new Date()
      const history = [
        { medName: 'Med', status: 'done', actualTime: new Date(now.getTime() - 1 * 36e5).toISOString() },
        { medName: 'Med', status: 'done', actualTime: new Date(now.getTime() - 5 * 36e5).toISOString() },
        { medName: 'Med', status: 'done', actualTime: new Date(now.getTime() - 10 * 36e5).toISOString() },
      ]
      const r = validateSos({
        rules: [{ medName: 'Med', maxDosesIn24h: 3 }],
        history,
        medName: 'Med',
        scheduledAt: now.toISOString(),
      })
      expect(r.ok).toBe(false)
      expect(r.reason).toMatch(/3 doses em 24h/)
      expect(r.nextAt).toBeInstanceOf(Date)
    })

    it('allows when under limit', () => {
      const now = new Date()
      const history = [
        { medName: 'Med', status: 'done', actualTime: new Date(now.getTime() - 5 * 36e5).toISOString() },
        { medName: 'Med', status: 'done', actualTime: new Date(now.getTime() - 10 * 36e5).toISOString() },
      ]
      const r = validateSos({
        rules: [{ medName: 'Med', maxDosesIn24h: 3 }],
        history,
        medName: 'Med',
        scheduledAt: now.toISOString(),
      })
      expect(r.ok).toBe(true)
    })

    it('only counts done doses (skipped/pending excluded)', () => {
      const now = new Date()
      const history = [
        { medName: 'Med', status: 'done', actualTime: new Date(now.getTime() - 1 * 36e5).toISOString() },
        { medName: 'Med', status: 'skipped', scheduledAt: new Date(now.getTime() - 5 * 36e5).toISOString() },
        { medName: 'Med', status: 'pending', scheduledAt: new Date(now.getTime() - 10 * 36e5).toISOString() },
      ]
      const r = validateSos({
        rules: [{ medName: 'Med', maxDosesIn24h: 2 }],
        history,
        medName: 'Med',
        scheduledAt: now.toISOString(),
      })
      // Apenas 1 done → ok
      expect(r.ok).toBe(true)
    })

    it('only counts within 24h window', () => {
      const now = new Date()
      const history = [
        { medName: 'Med', status: 'done', actualTime: new Date(now.getTime() - 1 * 36e5).toISOString() },
        // 30h atrás — fora da janela
        { medName: 'Med', status: 'done', actualTime: new Date(now.getTime() - 30 * 36e5).toISOString() },
      ]
      const r = validateSos({
        rules: [{ medName: 'Med', maxDosesIn24h: 2 }],
        history,
        medName: 'Med',
        scheduledAt: now.toISOString(),
      })
      // Apenas 1 dentro de 24h → ok
      expect(r.ok).toBe(true)
    })
  })
})
