import { describe, expect, it } from 'vitest'
import { createPilotSession } from './pilot'
import { buildPilotSessionReport, csvCell, PILOT_REPORT_DEMO_LABEL, pilotReportToCsv, pilotReportToJson } from './pilotReport'

const session = createPilotSession(
  { amount: '12.50', scenario: 'Standard counter sale' },
  () => 'pilot-123',
  new Date('2026-09-27T12:00:00Z'),
)
const generatedAt = new Date('2026-09-27T12:10:00Z')

describe('buildPilotSessionReport', () => {
  it('includes the snapshot, completion, generated-at time and demo label', () => {
    const report = buildPilotSessionReport(session, { completedAt: '2026-09-27T12:03:30.000Z' }, generatedAt)
    expect(report.label).toBe('DEMO - fictional data, no real funds, not legal/regulatory evidence')
    expect(report.generatedAt).toBe('2026-09-27T12:10:00.000Z')
    expect(report.session).toEqual({
      id: 'pilot-123',
      scenario: 'Standard counter sale',
      fictionalAmountMinor: 1250,
      fictionalAmountEur: '12.50',
      currency: 'EUR',
      startedAt: '2026-09-27T12:00:00.000Z',
      environment: 'LOCAL_SIMULATION',
    })
    expect(report.completion).toEqual({ status: 'completed', completedAt: '2026-09-27T12:03:30.000Z', durationSeconds: 210 })
    expect(report.friction.recorded).toBe(false)
    expect(Object.isFrozen(report)).toBe(true)
    expect(Object.isFrozen(report.session)).toBe(true)
  })

  it('marks completion as not recorded when the scenario was not completed', () => {
    const report = buildPilotSessionReport(session, { completedAt: null }, generatedAt)
    expect(report.completion).toEqual({ status: 'not_recorded', completedAt: null, durationSeconds: null })
  })

  it('rejects a completion time before the session start', () => {
    expect(() => buildPilotSessionReport(session, { completedAt: '2026-09-27T11:59:00.000Z' }, generatedAt))
      .toThrow('Completion time must be a valid time after the session start')
  })

  it('contains no fields beyond the local snapshot and demo metadata', () => {
    const report = buildPilotSessionReport(session, { completedAt: null }, generatedAt)
    expect(Object.keys(report).sort()).toEqual(['boundaries', 'completion', 'friction', 'generatedAt', 'label', 'reportType', 'schemaVersion', 'session'])
  })
})

describe('pilot report serialisation', () => {
  const report = buildPilotSessionReport(session, { completedAt: '2026-09-27T12:03:30.000Z' }, generatedAt)

  it('serialises JSON that round-trips and leads with the demo label', () => {
    const json = pilotReportToJson(report)
    expect(JSON.parse(json)).toEqual(report)
    expect(json.indexOf('"label"')).toBeLessThan(json.indexOf('"session"'))
  })

  it('serialises a readable field/value CSV with the demo label first', () => {
    const lines = pilotReportToCsv(report).trim().split('\n')
    expect(lines[0]).toBe('field,value')
    expect(lines[1]).toBe(`label,"${PILOT_REPORT_DEMO_LABEL}"`)
    expect(lines).toContain('generated_at,2026-09-27T12:10:00.000Z')
    expect(lines).toContain('session_id,pilot-123')
    expect(lines).toContain('fictional_amount_eur,12.50')
    expect(lines).toContain('completion_status,completed')
    expect(lines).toContain('duration_seconds,210')
  })

  it('escapes commas, quotes and spreadsheet formulas in the scenario label', () => {
    const risky = createPilotSession({ amount: '1.00', scenario: '=HYPERLINK("x"), test' }, () => 'p', new Date('2026-09-27T12:00:00Z'))
    const csv = pilotReportToCsv(buildPilotSessionReport(risky, { completedAt: null }, generatedAt))
    expect(csv).toContain(`scenario,"'=HYPERLINK(""x""), test"`)
    expect(csvCell(null)).toBe('')
    expect(csvCell('-1')).toBe("'-1")
  })
})
