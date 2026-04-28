import { describe, it, expect } from 'vitest'
import { generateDoses } from './generateDoses'

const baseTreatment = {
  id: 't1',
  patientId: 'p1',
  medName: 'Med',
  unit: '1 cap',
  startDate: '2026-04-15T08:00:00.000Z',
  durationDays: 3,
}

describe('generateDoses', () => {
  describe('mode=interval', () => {
    it('generates doses at fixed intervalHours steps', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'interval',
        intervalHours: 8,
        firstDoseTime: '08:00',
      })
      // 3 days * 24h / 8h = 9 doses
      expect(doses).toHaveLength(9)
      expect(doses[0].patientId).toBe('p1')
      expect(doses[0].treatmentId).toBe('t1')
      expect(doses[0].medName).toBe('Med')
      expect(doses[0].status).toBe('pending')
      expect(doses[0].type).toBe('scheduled')
    })

    it('respects firstDoseTime', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'interval',
        intervalHours: 12,
        firstDoseTime: '20:00',
      })
      const first = new Date(doses[0].scheduledAt)
      expect(first.getHours()).toBe(20)
      expect(first.getMinutes()).toBe(0)
    })

    it('default intervalHours=8 when invalid', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'interval',
        intervalHours: 0, // invalid → fallback 8 (Math.max(1, ...))
        firstDoseTime: '08:00',
        durationDays: 1,
      })
      // 24h / 8h = 3 doses
      expect(doses).toHaveLength(3)
    })

    it('intervalHours minimum 1 (Math.max clamp)', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'interval',
        intervalHours: -5, // negative → Math.max(1, -5) = 1
        firstDoseTime: '08:00',
        durationDays: 1,
      })
      expect(doses).toHaveLength(24) // 24h / 1h step = 24 doses
    })

    it('default firstDoseTime=08:00 when missing', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'interval',
        intervalHours: 24,
        durationDays: 1,
        // firstDoseTime undefined
      })
      const first = new Date(doses[0].scheduledAt)
      expect(first.getHours()).toBe(8)
    })

    it('all doses have status=pending and type=scheduled', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'interval',
        intervalHours: 12,
      })
      expect(doses.every((d) => d.status === 'pending')).toBe(true)
      expect(doses.every((d) => d.type === 'scheduled')).toBe(true)
      expect(doses.every((d) => d.actualTime === null)).toBe(true)
    })
  })

  describe('mode=times', () => {
    it('generates 1 dose per time per day', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'times',
        dailyTimes: ['08:00', '14:00', '20:00'],
      })
      // 3 days * 3 times = 9 doses
      expect(doses).toHaveLength(9)
    })

    it('sorts dailyTimes ascending', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'times',
        dailyTimes: ['20:00', '08:00', '14:00'], // unsorted input
        durationDays: 1,
      })
      const hours = doses.map((d) => new Date(d.scheduledAt).getHours())
      expect(hours).toEqual([8, 14, 20])
    })

    it('handles single dailyTime', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'times',
        dailyTimes: ['09:30'],
        durationDays: 5,
      })
      expect(doses).toHaveLength(5)
      doses.forEach((d) => {
        const dt = new Date(d.scheduledAt)
        expect(dt.getHours()).toBe(9)
        expect(dt.getMinutes()).toBe(30)
      })
    })

    it('handles empty dailyTimes', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'times',
        dailyTimes: [],
        durationDays: 3,
      })
      expect(doses).toHaveLength(0)
    })

    it('different days have correct date offsets', () => {
      const doses = generateDoses({
        ...baseTreatment,
        mode: 'times',
        dailyTimes: ['12:00'],
        durationDays: 3,
      })
      const days = doses.map((d) => new Date(d.scheduledAt).getDate())
      expect(days).toEqual([15, 16, 17]) // start 15-abr
    })
  })

  describe('field mapping', () => {
    it('preserves treatmentId mapping (from .id)', () => {
      const doses = generateDoses({
        ...baseTreatment,
        id: 'abc-123',
        mode: 'interval',
        intervalHours: 24,
        durationDays: 1,
      })
      expect(doses[0].treatmentId).toBe('abc-123')
    })

    it('preserves patientId, medName, unit', () => {
      const doses = generateDoses({
        ...baseTreatment,
        patientId: 'patient-X',
        medName: 'Aspirina',
        unit: '500mg',
        mode: 'times',
        dailyTimes: ['08:00'],
        durationDays: 1,
      })
      expect(doses[0].patientId).toBe('patient-X')
      expect(doses[0].medName).toBe('Aspirina')
      expect(doses[0].unit).toBe('500mg')
    })
  })
})
