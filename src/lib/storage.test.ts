import { describe, expect, it } from 'vitest'
import { LEGACY_STORAGE_KEY, STORAGE_KEY, resolveStoredRecord } from './storage'

describe('stored practice-screen record', () => {
  it('keeps the new key and does not copy when both exist', () => {
    expect(STORAGE_KEY).toBe('agorapay-pilot-v1')
    expect(LEGACY_STORAGE_KEY).toBe('agoratap-demo-v1')
    expect(resolveStoredRecord('{"balances":1}', '{"balances":0}')).toEqual({ raw: '{"balances":1}', copyLegacy: false })
  })

  it('reads the old key once when the new key is missing', () => {
    expect(resolveStoredRecord(null, '{"balances":0}')).toEqual({ raw: '{"balances":0}', copyLegacy: true })
  })

  it('starts empty when neither key is present', () => {
    expect(resolveStoredRecord(null, null)).toEqual({ raw: null, copyLegacy: false })
  })
})
