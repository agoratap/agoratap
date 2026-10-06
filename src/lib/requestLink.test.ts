import { describe, expect, it } from 'vitest'
import { parseRequestLink } from './requestLink'
import { eip681Uri, type OpenRequest } from './chainRequest'

const M = '0x1111111111111111111111111111111111111111'
const r: OpenRequest = { orderId: 'A', chain: 'baseSepolia', token: 'EURC', merchant: M, atomic: 1_000_042n, baseAtomic: 1_000_000n, tag: 42 }

describe('payment link parsing', () => {
  it('round-trips what eip681Uri builds, for every chain and token', () => {
    for (const chain of ['base', 'baseSepolia'] as const) for (const token of ['EURC', 'USDC'] as const) {
      const q = { ...r, chain, token }
      expect(parseRequestLink(eip681Uri(q))).toEqual({ chain, token, merchant: M, atomic: 1_000_042n })
    }
  })
  it('rejects other tokens, chains, extra parameters, zero amounts and junk', () => {
    const ok = eip681Uri(r)
    expect(() => parseRequestLink(ok.replace('0x808456652fdb597867f38412077A9182bf77359F', '0x' + '9'.repeat(40)))).toThrow(/Unknown token/)
    expect(() => parseRequestLink(ok.replace('@84532', '@1'))).toThrow(/Unknown token or chain/)
    expect(() => parseRequestLink(ok + '&data=0x')).toThrow(/not an Agora Pay/i)
    expect(() => parseRequestLink(ok.replace('uint256=1000042', 'uint256=0'))).toThrow(/greater than zero/)
    expect(() => parseRequestLink(ok.replace('/transfer', '/approve'))).toThrow()
    expect(() => parseRequestLink('https://evil.example/' + ok)).toThrow()
    expect(() => parseRequestLink('')).toThrow()
  })
})
