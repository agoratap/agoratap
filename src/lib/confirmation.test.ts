import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIRMATIONS, blocksForSeconds, evaluatePayment, windowFrom, type PaymentState } from './confirmation'
import type { ObservedTransfer } from './chainReader'
import type { OpenRequest } from './chainRequest'

const MERCHANT = '0x1111111111111111111111111111111111111111'
const req: OpenRequest = { orderId: 'A', chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, atomic: 1_000_042n, baseAtomic: 1_000_000n, tag: 42 }
const h = (n: number) => '0x' + n.toString(16).padStart(64, '0')
const log = (block: number, o: Partial<ObservedTransfer> = {}): ObservedTransfer => ({ from: '0x2222222222222222222222222222222222222222', to: MERCHANT, value: 1_000_042n, txHash: h(block * 10), blockNumber: block, blockHash: h(9000 + block), logIndex: 0, ...o })
const win = windowFrom(100)
const ev = (logs: ObservedTransfer[], head: number, extra: Partial<Parameters<typeof evaluatePayment>[0]> = {}) => evaluatePayment({ request: req, logs, head, window: win, ...extra })
const seen = (s: PaymentState) => (s.status === 'pending' || s.status === 'confirmed' ? s.seen : undefined)

describe('confirmation rule', () => {
  it('unpaid when nothing matches; expired only after the window closes', () => {
    expect(ev([], 110)).toEqual({ status: 'unpaid', head: 110, expired: false })
    const w = windowFrom(100, 60) // 30 blocks
    expect(w.toBlock).toBe(130)
    expect(evaluatePayment({ request: req, logs: [], head: 130, window: w })).toMatchObject({ status: 'unpaid', expired: false })
    expect(evaluatePayment({ request: req, logs: [], head: 131, window: w })).toMatchObject({ status: 'unpaid', expired: true })
  })
  it('pending until N confirmations (the block itself counts as 1), then confirmed', () => {
    const n = DEFAULT_CONFIRMATIONS
    const at = (head: number) => ev([log(105)], head)
    expect(at(105)).toMatchObject({ status: 'pending', confirmations: 1, needed: n })
    expect(at(105 + n - 2)).toMatchObject({ status: 'pending', confirmations: n - 1 })
    expect(at(105 + n - 1)).toMatchObject({ status: 'confirmed', confirmations: n })
    expect(at(500)).toMatchObject({ status: 'confirmed' })
  })
  it('honours a custom confirmation count and refuses nonsense counts', () => {
    expect(ev([log(105)], 105, { confirmations: 1 })).toMatchObject({ status: 'confirmed', confirmations: 1 })
    expect(() => ev([log(105)], 105, { confirmations: 0 })).toThrow()
  })
  it('final only when the node reports a finalized block at or above the transfer', () => {
    expect(ev([log(105)], 200, { finalized: 104 })).toMatchObject({ status: 'confirmed', final: false })
    expect(ev([log(105)], 200, { finalized: 105 })).toMatchObject({ status: 'confirmed', final: true })
    expect(ev([log(105)], 200, { finalized: null })).toMatchObject({ final: false })
    expect(ev([log(105)], 200)).toMatchObject({ final: false })
  })
  it('ignores wrong amount, wrong recipient, and transfers before or after the window', () => {
    expect(ev([log(105, { value: 1_000_041n })], 200).status).toBe('unpaid')
    expect(ev([log(105, { to: '0x3333333333333333333333333333333333333333' })], 200).status).toBe('unpaid')
    expect(ev([log(99)], 200).status).toBe('unpaid') // before the request existed
    const w = windowFrom(100, 20) // ends at 110
    expect(evaluatePayment({ request: req, logs: [log(111)], head: 200, window: w }).status).toBe('unpaid')
    expect(evaluatePayment({ request: req, logs: [log(110)], head: 200, window: w }).status).toBe('confirmed')
  })
  it('matches the merchant address in any letter case', () => {
    expect(ev([log(105, { to: MERCHANT.toUpperCase().replace('0X', '0x') })], 200).status).toBe('confirmed')
  })
  it('two matching transfers are ambiguous, even if both are deep: never paid', () => {
    const r = ev([log(105), log(106)], 500)
    expect(r.status).toBe('ambiguous')
    if (r.status === 'ambiguous') expect(r.txHashes).toHaveLength(2)
  })
  it('primary match is the transaction reference: the same amount twice is ambiguous until the tx hash selects one', () => {
    const first = log(105)
    const second = log(106)
    expect(ev([first, second], 110).status).toBe('ambiguous')
    const picked = ev([first, second], 110, { claimedTxHash: first.txHash })
    expect(picked).toMatchObject({ status: 'pending', via: 'reference', confirmations: 6 })
    if (picked.status === 'pending') expect(picked.seen.txHash).toBe(first.txHash)
    const missed = ev([first, second], 200, { claimedTxHash: h(1) })
    expect(missed).toMatchObject({ status: 'unpaid', claimMissed: true })
    const wrongAmount = ev([log(105, { txHash: h(4), value: 1n }), second], 200, { claimedTxHash: h(4) })
    expect(wrongAmount).toMatchObject({ status: 'unpaid', claimMissed: true })
    expect(ev([first], 200, { claimedTxHash: first.txHash.toUpperCase() })).toMatchObject({ status: 'confirmed', via: 'reference' })
  })
  it('a transfer past the head we hold is not counted (lagging node)', () => {
    expect(ev([log(120)], 110).status).toBe('unpaid')
  })
  it('REORG: a transfer seen earlier that vanished is reported, never silently unpaid', () => {
    const first = ev([log(105)], 108)
    expect(first.status).toBe('pending')
    const after = ev([], 109, { previous: seen(first) })
    expect(after).toMatchObject({ status: 'reorged' })
    if (after.status === 'reorged') expect(after.lost.txHash).toBe(h(1050))
  })
  it('REORG: the same tx re-included in a different block is reported once, then counted fresh from the new block', () => {
    const first = ev([log(105)], 130)
    expect(first.status).toBe('confirmed')
    const moved = log(112, { txHash: h(1050), blockHash: h(7777) })
    expect(ev([moved], 131, { previous: seen(first) }).status).toBe('reorged')
    expect(ev([moved], 131)).toMatchObject({ status: 'confirmed', confirmations: 20 })
    expect(ev([moved], 115)).toMatchObject({ status: 'pending', confirmations: 4 })
  })
  it('REORG: confirmations are never inherited from the lost block', () => {
    const first = ev([log(105)], 130)
    const fresh = log(129, { txHash: h(5555), blockHash: h(8888) })
    const next = ev([fresh], 131) // no previous passed: new observation
    expect(next).toMatchObject({ status: 'pending', confirmations: 3 })
    expect(first).toMatchObject({ status: 'confirmed' })
  })
  it('unknown (never a guess) when the head goes backwards compared to the last look', () => {
    const first = ev([log(105)], 130)
    expect(ev([log(105)], 120, { previous: seen(first) })).toEqual({ status: 'unknown', reason: 'rpc-head-behind', head: 120 })
  })
  it('a stable observation keeps counting up with the same previous', () => {
    const first = ev([log(105)], 108)
    const next = ev([log(105)], 130, { previous: seen(first) })
    expect(next).toMatchObject({ status: 'confirmed', confirmations: 26 })
  })
  it('seconds to blocks (Base ~2 s), rounding up', () => {
    expect(blocksForSeconds(60)).toBe(30)
    expect(blocksForSeconds(61)).toBe(31)
    expect(() => blocksForSeconds(0)).toThrow()
    expect(() => windowFrom(-1)).toThrow()
  })
})
