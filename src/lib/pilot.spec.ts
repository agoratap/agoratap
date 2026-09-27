import { describe, expect, it } from 'vitest'
import { createPilotSession } from './pilot'

describe('createPilotSession', () => {
  it('captures normalized local session facts in an immutable snapshot', () => {
    const session = createPilotSession(
      { amount: '12.50', scenario: '  Standard counter sale  ' },
      () => 'pilot-123',
      new Date('2026-09-27T12:00:00Z'),
    )

    expect(session).toEqual({
      id: 'pilot-123',
      amountMinor: 1250,
      scenario: 'Standard counter sale',
      startedAt: '2026-09-27T12:00:00.000Z',
      environment: 'LOCAL_SIMULATION',
    })
    expect(Object.isFrozen(session)).toBe(true)
  })

  it.each(['', '0', '0.00', '-1', '1.001', '1,00', 'not-a-number'])(
    'rejects invalid fictional amount %j instead of rounding it',
    (amount) => {
      expect(() => createPilotSession({ amount, scenario: 'Sale' })).toThrow('Enter a positive amount with at most two decimal places')
    },
  )

  it('requires a scenario label', () => {
    expect(() => createPilotSession({ amount: '1.00', scenario: '   ' })).toThrow('Scenario label is required')
  })

  it('caps scenario length at 80 characters', () => {
    const session = createPilotSession({ amount: '1.00', scenario: `${'a'.repeat(80)} overflow` })
    expect(session.scenario).toHaveLength(80)
    expect(session.scenario).toBe('a'.repeat(80))
  })
})
