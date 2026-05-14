import { describe, it, expect, beforeEach } from 'vitest'
import { inDnd } from './notifications/prefs'

describe('notifications', () => {
  describe('inDnd', () => {
    it('returns false when DND disabled', () => {
      expect(inDnd('2026-04-15T03:00:00Z', { dndEnabled: false })).toBe(false)
      expect(inDnd('2026-04-15T03:00:00Z', { dndEnabled: undefined })).toBe(false)
      expect(inDnd('2026-04-15T03:00:00Z', null)).toBe(false)
      expect(inDnd('2026-04-15T03:00:00Z', undefined)).toBe(false)
    })

    describe('window NOT crossing midnight (e.g. 09:00-17:00)', () => {
      const prefs = { dndEnabled: true, dndStart: '09:00', dndEnd: '17:00' }

      it('inside window returns true', () => {
        const d = new Date('2026-04-15T00:00:00Z')
        d.setHours(10, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(true)
      })

      it('exactly at start returns true', () => {
        const d = new Date()
        d.setHours(9, 0, 0, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(true)
      })

      it('exactly at end is false (exclusive)', () => {
        const d = new Date()
        d.setHours(17, 0, 0, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(false)
      })

      it('before start returns false', () => {
        const d = new Date()
        d.setHours(8, 59)
        expect(inDnd(d.toISOString(), prefs)).toBe(false)
      })

      it('after end returns false', () => {
        const d = new Date()
        d.setHours(20, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(false)
      })
    })

    describe('window CROSSING midnight (e.g. 23:00-07:00)', () => {
      const prefs = { dndEnabled: true, dndStart: '23:00', dndEnd: '07:00' }

      it('exactly at start (23:00) returns true', () => {
        const d = new Date()
        d.setHours(23, 0, 0, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(true)
      })

      it('late night (after start, before midnight)', () => {
        const d = new Date()
        d.setHours(23, 59)
        expect(inDnd(d.toISOString(), prefs)).toBe(true)
      })

      it('early morning (before end)', () => {
        const d = new Date()
        d.setHours(3, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(true)
      })

      it('exactly at end (07:00) returns false (exclusive)', () => {
        const d = new Date()
        d.setHours(7, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(false)
      })

      it('outside window (10:00) returns false', () => {
        const d = new Date()
        d.setHours(10, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(false)
      })

      it('outside window (22:59 — 1 min antes de start) returns false', () => {
        const d = new Date()
        d.setHours(22, 59)
        expect(inDnd(d.toISOString(), prefs)).toBe(false)
      })
    })

    describe('default values', () => {
      it('uses defaults 23:00-07:00 when start/end ausentes', () => {
        const prefs = { dndEnabled: true }
        const d = new Date()
        d.setHours(3, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(true)
      })
    })

    describe('edge cases', () => {
      it('window 00:00 a 00:00 (zero-length, never DND)', () => {
        const prefs = { dndEnabled: true, dndStart: '00:00', dndEnd: '00:00' }
        const d = new Date()
        d.setHours(12, 0)
        // start=end=0 → start <= end → mins >= 0 && mins < 0 → false
        expect(inDnd(d.toISOString(), prefs)).toBe(false)
      })

      it('window 12:00 a 12:00 zero-length never DND', () => {
        const prefs = { dndEnabled: true, dndStart: '12:00', dndEnd: '12:00' }
        const d = new Date()
        d.setHours(12, 0)
        expect(inDnd(d.toISOString(), prefs)).toBe(false)
      })
    })
  })
})
