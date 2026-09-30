export const FRICTION_TAGS = [
  'amount_unclear',
  'settlement_unclear',
  'tap_confusing',
  'receipt_unclear',
  'demo_label_missed',
  'too_many_steps',
  'copy_legal_heavy',
  'none',
] as const

export type FrictionTag = (typeof FRICTION_TAGS)[number]

export interface StepTiming {
  readonly step: string
  readonly startedAt: string
  readonly endedAt: string
  readonly durationMs: number
}

export interface FrictionCaptureInput {
  tags: FrictionTag[]
  timings: StepTiming[]
}

export interface FrictionCapture {
  readonly recorded: boolean
  readonly tags: FrictionTag[]
  readonly timings: StepTiming[]
}

export function normalizeTags(tags: FrictionTag[]): FrictionTag[] {
  const unique = [...new Set(tags)].filter((tag) => FRICTION_TAGS.includes(tag))
  if (unique.includes('none')) return ['none']
  return unique
}

export function timing(step: string, startedAt: Date, endedAt: Date): StepTiming {
  const start = startedAt.toISOString()
  const end = endedAt.toISOString()
  return Object.freeze({
    step: step.trim().slice(0, 40) || 'unnamed',
    startedAt: start,
    endedAt: end,
    durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
  })
}

export function createFrictionCapture(input: FrictionCaptureInput): FrictionCapture {
  const tags = normalizeTags(input.tags)
  const timings = input.timings.map((row) => Object.freeze({ ...row }))
  return Object.freeze({
    recorded: tags.length > 0 || timings.length > 0,
    tags,
    timings,
  })
}

export const EMPTY_FRICTION = createFrictionCapture({ tags: [], timings: [] })
