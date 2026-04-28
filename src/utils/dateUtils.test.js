import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pad,
  formatDate,
  formatTime,
  formatDateTime,
  relativeLabel,
  toDatetimeLocalInput,
  fromDatetimeLocalInput,
  rangeNow,
} from './dateUtils'

describe('dateUtils', () => {
  describe('pad', () => {
    it('pads single digit', () => {
      expect(pad(0)).toBe('00')
      expect(pad(5)).toBe('05')
      expect(pad(9)).toBe('09')
    })
    it('keeps double digit', () => {
      expect(pad(10)).toBe('10')
      expect(pad(59)).toBe('59')
      expect(pad(99)).toBe('99')
    })
  })

  describe('formatDate', () => {
    it('formats DD/MM/YYYY', () => {
      const d = new Date(2026, 3, 5) // 5 abr 2026 (mês 0-indexed)
      expect(formatDate(d)).toBe('05/04/2026')
    })
    it('handles ISO string input', () => {
      // Normalizar pra UTC pra evitar timezone shift
      const iso = '2026-12-25T15:30:00Z'
      const d = new Date(iso)
      expect(formatDate(iso)).toBe(
        `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
      )
    })
  })

  describe('formatTime', () => {
    it('formats HH:MM in 24h', () => {
      const d = new Date(2026, 0, 1, 9, 5)
      expect(formatTime(d)).toBe('09:05')
    })
    it('formats midnight', () => {
      const d = new Date(2026, 0, 1, 0, 0)
      expect(formatTime(d)).toBe('00:00')
    })
    it('formats end of day', () => {
      const d = new Date(2026, 0, 1, 23, 59)
      expect(formatTime(d)).toBe('23:59')
    })
  })

  describe('formatDateTime', () => {
    it('combines date + time', () => {
      const d = new Date(2026, 5, 15, 14, 30)
      expect(formatDateTime(d)).toBe('15/06/2026 14:30')
    })
  })

  describe('relativeLabel', () => {
    beforeEach(() => {
      // Quarta 15/abr/2026 12:00 — fixed reference
      vi.setSystemTime(new Date(2026, 3, 15, 12, 0))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('today', () => {
      expect(relativeLabel(new Date(2026, 3, 15, 8, 0))).toBe('Hoje')
      expect(relativeLabel(new Date(2026, 3, 15, 23, 59))).toBe('Hoje')
    })
    it('yesterday', () => {
      expect(relativeLabel(new Date(2026, 3, 14, 12, 0))).toBe('Ontem')
    })
    it('tomorrow', () => {
      expect(relativeLabel(new Date(2026, 3, 16, 12, 0))).toBe('Amanhã')
    })
    it('within next 6 days returns weekday name', () => {
      // 17/abr/2026 = Sex, 18 = Sáb, 19 = Dom
      expect(relativeLabel(new Date(2026, 3, 17, 12, 0))).toBe('Sex')
      expect(relativeLabel(new Date(2026, 3, 18, 12, 0))).toBe('Sáb')
      expect(relativeLabel(new Date(2026, 3, 19, 12, 0))).toBe('Dom')
    })
    it('beyond 6 days returns formatDate', () => {
      expect(relativeLabel(new Date(2026, 5, 1, 12, 0))).toBe('01/06/2026')
    })
    it('past beyond yesterday returns formatDate', () => {
      expect(relativeLabel(new Date(2026, 0, 1, 12, 0))).toBe('01/01/2026')
    })
  })

  describe('toDatetimeLocalInput', () => {
    it('formats for HTML datetime-local input', () => {
      const iso = new Date(2026, 5, 15, 14, 30).toISOString()
      expect(toDatetimeLocalInput(iso)).toBe('2026-06-15T14:30')
    })
    it('uses now when no input', () => {
      vi.setSystemTime(new Date(2026, 0, 1, 10, 0))
      expect(toDatetimeLocalInput()).toBe('2026-01-01T10:00')
      vi.useRealTimers()
    })
  })

  describe('fromDatetimeLocalInput', () => {
    it('round-trip with toDatetimeLocalInput', () => {
      const original = '2026-06-15T14:30'
      const iso = fromDatetimeLocalInput(original)
      expect(toDatetimeLocalInput(iso)).toBe(original)
    })
  })

  describe('rangeNow', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date(2026, 3, 15, 12, 0))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('12h returns 6h-back start, 12h-fwd end', () => {
      const r = rangeNow('12h')
      expect(new Date(r.from).getHours()).toBe(6)
      expect(new Date(r.to).getDate()).toBe(16) // 12+12=00h next day
    })
    it('24h', () => {
      const r = rangeNow('24h')
      expect(new Date(r.from).getHours()).toBe(6)
      expect(new Date(r.to).getDate()).toBe(16)
    })
    it('48h spans 2 days fwd', () => {
      const r = rangeNow('48h')
      expect(new Date(r.to).getDate()).toBe(17)
    })
    it('7d spans week', () => {
      const r = rangeNow('7d')
      expect(new Date(r.to).getDate()).toBe(22)
    })
    it('unknown returns null both', () => {
      expect(rangeNow('xyz')).toEqual({ from: null, to: null })
      expect(rangeNow('all')).toEqual({ from: null, to: null })
    })
  })
})
