import type { PilotSession } from './pilot'

export const PILOT_REPORT_DEMO_LABEL = 'DEMO - fictional data, no real funds, not legal/regulatory evidence'

export interface PilotCompletion {
  /** ISO timestamp recorded when the tester pressed "Record scenario complete"; null if not recorded. */
  readonly completedAt: string | null
}

export interface PilotSessionReport {
  readonly label: typeof PILOT_REPORT_DEMO_LABEL
  readonly reportType: 'agoratap-merchant-pilot-session'
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly session: {
    readonly id: string
    readonly scenario: string
    readonly fictionalAmountMinor: number
    readonly fictionalAmountEur: string
    readonly currency: 'EUR'
    readonly startedAt: string
    readonly environment: PilotSession['environment']
  }
  readonly completion: {
    readonly status: 'completed' | 'not_recorded'
    readonly completedAt: string | null
    readonly durationSeconds: number | null
  }
  readonly friction: {
    readonly recorded: false
    readonly note: string
  }
  readonly boundaries: readonly string[]
}

const BOUNDARIES = [
  'Built entirely in this browser from local state; no network request was made.',
  'Fictional amount only. No real funds, payment, settlement or custody occurred.',
  'No GNU Taler order was created, inspected or paid.',
  'Contains no buyer, customer or personal data.',
  'Unsigned local file. Not legal, audit or regulatory evidence.',
] as const

export function buildPilotSessionReport(
  session: PilotSession,
  completion: PilotCompletion,
  generatedAt: Date = new Date(),
): PilotSessionReport {
  const completedAt = completion.completedAt
  let durationSeconds: number | null = null
  if (completedAt) {
    const elapsed = Date.parse(completedAt) - Date.parse(session.startedAt)
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('Completion time must be a valid time after the session start')
    durationSeconds = Math.round(elapsed / 1000)
  }

  return Object.freeze({
    label: PILOT_REPORT_DEMO_LABEL,
    reportType: 'agoratap-merchant-pilot-session' as const,
    schemaVersion: 1 as const,
    generatedAt: generatedAt.toISOString(),
    session: Object.freeze({
      id: session.id,
      scenario: session.scenario,
      fictionalAmountMinor: session.amountMinor,
      fictionalAmountEur: (session.amountMinor / 100).toFixed(2),
      currency: 'EUR' as const,
      startedAt: session.startedAt,
      environment: session.environment,
    }),
    completion: Object.freeze({
      status: completedAt ? 'completed' as const : 'not_recorded' as const,
      completedAt,
      durationSeconds,
    }),
    friction: Object.freeze({
      recorded: false as const,
      note: 'This app version does not capture friction notes; record observations separately without customer details.',
    }),
    boundaries: Object.freeze([...BOUNDARIES]),
  })
}

export function pilotReportToJson(report: PilotSessionReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

/** Quote a CSV cell and neutralise spreadsheet formula injection from free-text fields. */
export function csvCell(value: string | number | boolean | null): string {
  let text = value === null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text
}

export function pilotReportToCsv(report: PilotSessionReport): string {
  const rows: Array<[string, string | number | boolean | null]> = [
    ['label', report.label],
    ['report_type', report.reportType],
    ['schema_version', report.schemaVersion],
    ['generated_at', report.generatedAt],
    ['session_id', report.session.id],
    ['scenario', report.session.scenario],
    ['fictional_amount_eur', report.session.fictionalAmountEur],
    ['currency', report.session.currency],
    ['started_at', report.session.startedAt],
    ['environment', report.session.environment],
    ['completion_status', report.completion.status],
    ['completed_at', report.completion.completedAt],
    ['duration_seconds', report.completion.durationSeconds],
    ['friction_recorded', report.friction.recorded],
    ['friction_note', report.friction.note],
    ...report.boundaries.map((boundary, index): [string, string] => [`boundary_${index + 1}`, boundary]),
  ]
  return `${['field,value', ...rows.map(([field, value]) => `${field},${csvCell(value)}`)].join('\n')}\n`
}
