import { describe, expect, it } from 'vitest'
import { createFrictionCapture, EMPTY_FRICTION, FRICTION_TAGS, normalizeTags, timing } from './friction'

describe('normalizeTags', () => {
  it('dedupes and drops unknown values via the const list', () => {
    expect(normalizeTags(['too_many_steps', 'too_many_steps', 'amount_unclear'])).toEqual([
      'too_many_steps',
      'amount_unclear',
    ])
  })

  it('collapses any set containing none to none only', () => {
    expect(normalizeTags(['amount_unclear', 'none', 'tap_confusing'])).toEqual(['none'])
  })

  it('exposes the closed tag list used by the merchant UI', () => {
    expect(FRICTION_TAGS).toContain('demo_label_missed')
    expect(FRICTION_TAGS).not.toContain('free_text')
  })
})

describe('timing', () => {
  it('records a non-negative duration and caps the step name', () => {
    const row = timing('  start session  ', new Date('2026-09-30T06:00:00Z'), new Date('2026-09-30T06:00:04.400Z'))
    expect(row.step).toBe('start session')
    expect(row.durationMs).toBe(4400)
    expect(Object.isFrozen(row)).toBe(true)
  })

  it('does not go negative when clocks are inverted', () => {
    const row = timing('backwards', new Date('2026-09-30T06:00:05Z'), new Date('2026-09-30T06:00:00Z'))
    expect(row.durationMs).toBe(0)
  })
})

describe('createFrictionCapture', () => {
  it('marks empty capture as not recorded', () => {
    expect(EMPTY_FRICTION).toEqual({ recorded: false, tags: [], timings: [] })
    expect(Object.isFrozen(EMPTY_FRICTION)).toBe(true)
  })

  it('marks a tagged or timed capture as recorded without free text', () => {
    const started = new Date('2026-09-30T06:00:00Z')
    const ended = new Date('2026-09-30T06:00:12Z')
    const capture = createFrictionCapture({
      tags: ['copy_legal_heavy'],
      timings: [timing('record_complete', started, ended)],
    })
    expect(capture.recorded).toBe(true)
    expect(capture.tags).toEqual(['copy_legal_heavy'])
    expect(capture.timings[0].durationMs).toBe(12000)
    expect(JSON.stringify(capture)).not.toMatch(/customer|email|name/i)
  })
})
