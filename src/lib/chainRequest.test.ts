import { describe, expect, it } from 'vitest'
import { createRequest, eip681Uri, formatUsdc, isAddress, matchRequest, toAtomicEurc, toAtomicUsdc, MAX_TAG, type OpenRequest } from './chainRequest'

const MERCHANT = '0x1111111111111111111111111111111111111111'
const base = toAtomicUsdc(3.5, 1.1) // EUR 3.50 at 1.10 USD/EUR = 3.85 USDC

describe('chain payment request', () => {
  it('converts EUR to atomic USDC', () => {
    expect(base).toBe(3_850_000n)
    expect(formatUsdc(base)).toBe('3.850000')
  })

  it('gives two customers paying the same price different exact amounts', () => {
    const a = createRequest({ orderId: 'A', chain: 'baseSepolia', token: 'USDC', merchant: MERCHANT, baseAtomic: base }, [])
    const b = createRequest({ orderId: 'B', chain: 'baseSepolia', token: 'USDC', merchant: MERCHANT, baseAtomic: base }, [a])
    expect(a.atomic).not.toBe(b.atomic)
    expect(b.atomic - base).toBeLessThanOrEqual(BigInt(MAX_TAG))
  })

  it('tells which payment belongs to which order', () => {
    const a = createRequest({ orderId: 'A', chain: 'baseSepolia', token: 'USDC', merchant: MERCHANT, baseAtomic: base }, [])
    const b = createRequest({ orderId: 'B', chain: 'baseSepolia', token: 'USDC', merchant: MERCHANT, baseAtomic: base }, [a])
    const logs = [{ to: MERCHANT, value: b.atomic, txHash: '0xbbb', blockNumber: 2 }]
    expect(matchRequest(a, logs)).toEqual({ status: 'unpaid' })
    expect(matchRequest(b, logs)).toEqual({ status: 'matched', txHash: '0xbbb', blockNumber: 2 })
  })

  it('flags a duplicate payment of the exact same amount as ambiguous, never as paid', () => {
    const a = createRequest({ orderId: 'A', chain: 'base', merchant: MERCHANT, baseAtomic: base }, [])
    const logs = [
      { to: MERCHANT, value: a.atomic, txHash: '0x1', blockNumber: 1 },
      { to: MERCHANT, value: a.atomic, txHash: '0x2', blockNumber: 2 },
    ]
    expect(matchRequest(a, logs).status).toBe('ambiguous')
  })

  it('ignores payments to other addresses', () => {
    const a = createRequest({ orderId: 'A', chain: 'base', merchant: MERCHANT, baseAtomic: base }, [])
    const other = '0x2222222222222222222222222222222222222222'
    expect(matchRequest(a, [{ to: other, value: a.atomic, txHash: '0x3', blockNumber: 3 }])).toEqual({ status: 'unpaid' })
  })

  it('builds an EIP-681 USDC transfer URI with chain id', () => {
    const a: OpenRequest = { orderId: 'A', chain: 'baseSepolia', token: 'USDC', merchant: MERCHANT, atomic: 3_850_001n, baseAtomic: base, tag: 1 }
    expect(eip681Uri(a)).toBe(`ethereum:0x036CbD53842c5426634e7929541eC2318f3dCF7e@84532/transfer?address=${MERCHANT}&uint256=3850001`)
  })

  it('rejects bad addresses and amounts', () => {
    expect(isAddress('0x123')).toBe(false)
    expect(() => createRequest({ orderId: 'X', chain: 'base', merchant: '0x123', baseAtomic: base }, [])).toThrow()
    expect(() => toAtomicUsdc(0, 1.1)).toThrow()
  })

  it('defaults to EURC: merchant is asked for the euro amount with no exchange rate', () => {
    const eur = toAtomicEurc(3.5)
    expect(eur).toBe(3_500_000n)
    const a = createRequest({ orderId: 'E', chain: 'baseSepolia', merchant: MERCHANT, baseAtomic: eur }, [])
    expect(a.token).toBe('EURC')
    expect(eip681Uri(a)).toContain('0x808456652fdb597867f38412077A9182bf77359F@84532/transfer')
  })

  it('keeps EURC and USDC requests separate when amounts coincide', () => {
    const u = createRequest({ orderId: 'U', chain: 'base', token: 'USDC', merchant: MERCHANT, baseAtomic: 1_000_000n }, [])
    const e = createRequest({ orderId: 'E', chain: 'base', token: 'EURC', merchant: MERCHANT, baseAtomic: 1_000_000n }, [u])
    expect(e.tag).toBe(1)
  })
})
