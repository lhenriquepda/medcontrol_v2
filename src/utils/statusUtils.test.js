import { describe, it, expect } from 'vitest'
import { STATUS_CONFIG, statusLabel } from './statusUtils'

describe('statusUtils', () => {
  it('STATUS_CONFIG has 5 statuses', () => {
    expect(Object.keys(STATUS_CONFIG)).toEqual(['done', 'skipped', 'overdue', 'pending', 'cancelled'])
  })

  it('each status has label, icon, iconName, color', () => {
    Object.values(STATUS_CONFIG).forEach((s) => {
      expect(s).toHaveProperty('label')
      expect(s).toHaveProperty('icon')
      expect(s).toHaveProperty('iconName')
      expect(s).toHaveProperty('color')
    })
  })

  it('statusLabel resolves known status', () => {
    expect(statusLabel('done')).toBe('Tomada')
    expect(statusLabel('skipped')).toBe('Pulada')
    expect(statusLabel('overdue')).toBe('Atrasada')
    expect(statusLabel('pending')).toBe('Pendente')
    expect(statusLabel('cancelled')).toBe('Cancelada')
  })

  it('statusLabel falls back to raw value for unknown', () => {
    expect(statusLabel('xyz')).toBe('xyz')
    expect(statusLabel('')).toBe('')
  })
})
