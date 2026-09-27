export interface PilotSessionInput {
  amount: string
  scenario: string
}

export interface PilotSession {
  readonly id: string
  readonly amountMinor: number
  readonly scenario: string
  readonly startedAt: string
  readonly environment: 'LOCAL_SIMULATION'
}

export function createPilotSession(
  input: PilotSessionInput,
  createId: () => string = () => crypto.randomUUID(),
  startedAt: Date = new Date(),
): PilotSession {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input.amount)) {
    throw new Error('Enter a positive amount with at most two decimal places')
  }

  const [units, decimals = ''] = input.amount.split('.')
  const amountMinor = Number(units) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Enter a positive amount with at most two decimal places')
  }

  const scenario = input.scenario.trim().slice(0, 80)
  if (!scenario) throw new Error('Scenario label is required')

  return Object.freeze({
    id: createId(),
    amountMinor,
    scenario,
    startedAt: startedAt.toISOString(),
    environment: 'LOCAL_SIMULATION' as const,
  })
}
