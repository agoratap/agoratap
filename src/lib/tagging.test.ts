import { describe, expect, it } from 'vitest'
import { createUnpredictableRequest, secureRandom, type Random } from './tagging'
import { MAX_TAG, type OpenRequest } from './chainRequest'

const M = '0x1111111111111111111111111111111111111111'
const base = 3_500_000n
const mk = (open: OpenRequest[], random: Random, history: bigint[] = [], id = 'o') =>
  createUnpredictableRequest({ orderId: id, chain: 'baseSepolia', merchant: M, baseAtomic: base }, open, { random, history })

// small deterministic PRNG so collision tests are reproducible
function lcg(seed: number): Random { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 } }

describe('unpredictable tag matching design', () => {
  it('draws a tag inside 1..MAX_TAG, so the overpay is at most 0.009999', () => {
    for (const r of [0, 0.5, 0.999999]) {
      const q = mk([], () => r)
      expect(q.tag).toBeGreaterThanOrEqual(1)
      expect(q.tag).toBeLessThanOrEqual(MAX_TAG)
      expect(q.atomic).toBe(base + BigInt(q.tag))
    }
    expect(mk([], () => 0).tag).toBe(1)
    expect(mk([], () => 0.999999999).tag).toBe(MAX_TAG)
  })
  it('is not guessable: the first request is NOT always base+1 (unlike smallest-free-tag)', () => {
    const tags = new Set<number>()
    for (let i = 1; i <= 200; i++) tags.add(mk([], lcg(i)).tag)
    expect(tags.size).toBeGreaterThan(150)
  })
  it('COLLISION: 2,000 requests at one price and merchant never share an amount', () => {
    const rnd = lcg(42)
    const open: OpenRequest[] = []
    for (let i = 0; i < 2000; i++) open.push(mk(open, rnd, [], 'o' + i))
    expect(new Set(open.map((o) => o.atomic)).size).toBe(2000)
  })
  it('COLLISION: with 9,998 of 9,999 tags used, the only free tag is always the one drawn; then the room is empty', () => {
    const used = Array.from({ length: MAX_TAG }, (_, i) => base + BigInt(i + 1)).filter((a) => a !== base + 1234n)
    for (const r of [0, 0.5, 0.999999]) expect(mk([], () => r, used).tag).toBe(1234)
    const last = mk([], () => 0.3, used)
    expect(() => mk([last], () => 0.3, used)).toThrow(/No free tag/)
  })
  it('never reuses an amount the merchant already received on chain (history)', () => {
    const history = Array.from({ length: 9000 }, (_, i) => base + BigInt(i + 1)) // tags 1..9000 already seen
    for (let i = 1; i <= 100; i++) expect(mk([], lcg(i), history).tag).toBeGreaterThan(9000)
    const full = Array.from({ length: MAX_TAG }, (_, i) => base + BigInt(i + 1))
    expect(() => mk([], lcg(1), full)).toThrow(/No free tag/)
  })
  it('only same chain + token + merchant count as taken; other merchants and tokens do not block', () => {
    const other: OpenRequest = { orderId: 'x', chain: 'baseSepolia', token: 'EURC', merchant: '0x2222222222222222222222222222222222222222', atomic: base + 1n, baseAtomic: base, tag: 1 }
    expect(mk([other], () => 0).tag).toBe(1)
    const usdc: OpenRequest = { ...other, merchant: M, token: 'USDC' }
    expect(mk([usdc], () => 0).tag).toBe(1)
    const same: OpenRequest = { ...other, merchant: M.toUpperCase().replace('0X', '0x') }
    expect(mk([same], () => 0).tag).toBe(2)
  })
  it('rejects a bad random source, bad address and zero amount', () => {
    expect(() => mk([], () => 1)).toThrow(/Random/)
    expect(() => mk([], () => -0.1)).toThrow(/Random/)
    expect(() => mk([], () => NaN)).toThrow(/Random/)
    expect(() => createUnpredictableRequest({ orderId: 'x', chain: 'base', merchant: '0x1', baseAtomic: 1n }, [], { random: () => 0 })).toThrow()
    expect(() => createUnpredictableRequest({ orderId: 'x', chain: 'base', merchant: M, baseAtomic: 0n }, [], { random: () => 0 })).toThrow()
  })
  it('secureRandom returns values in [0,1)', () => {
    for (let i = 0; i < 200; i++) { const r = secureRandom(); expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(1) }
  })
})
