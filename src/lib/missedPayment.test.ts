import { describe, expect, it } from 'vitest'
import { createChainReader, TRANSFER_TOPIC, type FetchLike } from './chainReader'
import { CHAINS, eip681Uri } from './chainRequest'
import { openLiveRequest, type LiveRequest } from './liveSession'
import { MISSED_PAYMENT_GUIDE, checkMissedPayment } from './missedPayment'
import { paymentRequestLink } from './reference'

const M = '0x1111111111111111111111111111111111111111'
const P = '0x2222222222222222222222222222222222222222'
const TOKEN = CHAINS.baseSepolia.tokens.EURC
const pad = (a: string) => '0x' + '0'.repeat(24) + a.slice(2).toLowerCase()
const h = (n: number) => '0x' + n.toString(16).padStart(64, '0')

function chain() {
  const calls: string[] = []
  const state = { head: 1000, finalized: 900 as number | null, logs: [] as Record<string, unknown>[] }
  const mkLog = (block: number, value: bigint, tx: number, to = M) => ({
    address: TOKEN,
    topics: [TRANSFER_TOPIC, pad(P), pad(to)],
    data: '0x' + value.toString(16).padStart(64, '0'),
    blockNumber: '0x' + block.toString(16),
    logIndex: '0x0',
    transactionHash: h(tx),
    blockHash: h(5000 + tx),
    removed: false,
  })
  const fetchFn: FetchLike = async (_u, init) => {
    const body = JSON.parse(init.body) as { method: string; params: [string | { fromBlock: string; toBlock: string }] }
    calls.push(body.method)
    let result: unknown
    if (body.method === 'eth_blockNumber') result = '0x' + state.head.toString(16)
    else if (body.method === 'eth_getBlockByNumber') result = state.finalized === null ? null : { number: '0x' + state.finalized.toString(16) }
    else if (body.method === 'eth_getLogs') {
      const filter = body.params[0] as { fromBlock: string; toBlock: string }
      const from = parseInt(filter.fromBlock, 16)
      const to = parseInt(filter.toBlock, 16)
      result = state.logs.filter((l) => {
        const b = parseInt(String(l.blockNumber), 16)
        return b >= from && b <= to
      })
    } else if (body.method === 'eth_getTransactionReceipt') {
      const hash = String(body.params[0]).toLowerCase()
      const logs = state.logs.filter((l) => String(l.transactionHash).toLowerCase() === hash)
      result = logs.length === 0 ? null : { status: '0x1', logs }
    } else return { ok: true, status: 200, json: async () => ({ error: { code: -32601, message: 'method not allowed' } }) }
    return { ok: true, status: 200, json: async () => ({ result }) }
  }
  return { state, mkLog, calls, reader: createChainReader({ fetchFn, rpcUrl: 'http://injected.invalid', maxRange: 1000, maxCalls: 80 }) }
}

describe('missed payment check', () => {
  it('states the matching rules from the design note', () => {
    const text = MISSED_PAYMENT_GUIDE.join(' ')
    expect(text).toMatch(/#ref=/)
    expect(text).toMatch(/transaction hash/)
    expect(text).toMatch(/read-only/i)
    expect(text).toMatch(/Nothing is signed or sent/)
    expect(text).toMatch(/does not hold keys or funds/)
    expect(text).toMatch(/Base mainnet is refused/)
    expect(text).toMatch(/exact amount/)
    expect(text).toMatch(/block inside the sale window/)
    expect(text).toMatch(/second transfer of the same amount does not count/)
    expect(text).toMatch(/pending/)
    expect(text).toMatch(/Confirmed is not the same as final/)
    expect(text).toMatch(/does not prove who paid/)
    expect(text).toMatch(/does not decide the payment/)
  })

  it('checks a pasted hash against the saved window and ignores a second equal amount', async () => {
    const c = chain()
    const live = await openLiveRequest(c.reader, { orderId: 'sale-1', chain: 'baseSepolia', merchant: M, eurAmount: 1, fillReference: (b) => b.fill(0x11) }, [], () => 0)
    c.state.logs.push(c.mkLog(1001, live.request.atomic, 11), c.mkLog(1003, live.request.atomic, 22))
    c.state.head = 1006
    const report = await checkMissedPayment(c.reader, { saleLink: live.uri, txHash: h(11), sales: [live] })
    expect(report.outcome).toBe('checked')
    if (report.outcome !== 'checked') return
    expect(report.state).toMatchObject({ status: 'pending', via: 'reference' })
    if (report.state.status === 'pending') expect(report.state.seen.txHash).toBe(h(11))
    expect(report.message).toMatch(/does not prove who paid/)
    expect(report.sales[0].claimedTxHash).toBe(h(11))
    expect(c.calls).toContain('eth_getTransactionReceipt')
    expect(c.calls.every((method) => method === 'eth_blockNumber' || method === 'eth_getLogs' || method === 'eth_getBlockByNumber' || method === 'eth_getTransactionReceipt')).toBe(true)
  })

  it('does not decide the payment when the block window is missing, and does not read the chain', async () => {
    const c = chain()
    const live = await openLiveRequest(c.reader, { orderId: 'sale-1', chain: 'baseSepolia', merchant: M, eurAmount: 1, fillReference: (b) => b.fill(0x11) }, [], () => 0)
    const before = c.calls.length
    const report = await checkMissedPayment(c.reader, { saleLink: live.uri, txHash: h(11), sales: [] })
    expect(report.outcome).toBe('window-unknown')
    if (report.outcome !== 'window-unknown') return
    expect(report.message).toMatch(/does not decide the payment/)
    expect(report.message).not.toMatch(/\b(confirmed|paid)\b/i)
    expect(c.calls.length).toBe(before)
  })

  it('refuses a mainnet link before any chain read', async () => {
    const c = chain()
    const before = c.calls.length
    const link = eip681Uri({ orderId: 'm', chain: 'base', token: 'EURC', merchant: M, atomic: 1_000_000n, baseAtomic: 1_000_000n, tag: 0 }) + '#ref=0x' + 'ab'.repeat(32)
    const report = await checkMissedPayment(c.reader, { saleLink: link, txHash: h(1), sales: [] })
    expect(report.outcome).toBe('refused-mainnet')
    if (report.outcome !== 'refused-mainnet') return
    expect(report.message).toMatch(/Base mainnet/)
    expect(report.message).toMatch(/Nothing was sent/)
    expect(c.calls.length).toBe(before)
  })

  it('does not read the chain when the link disagrees with the saved sale or the hash is already bound', async () => {
    const c = chain()
    const live = await openLiveRequest(c.reader, { orderId: 'sale-1', chain: 'baseSepolia', merchant: M, eurAmount: 1, fillReference: (b) => b.fill(0x11) }, [], () => 0)
    const otherMerchant = '0x3333333333333333333333333333333333333333'
    const mismatched: LiveRequest = { ...live, request: { ...live.request, merchant: otherMerchant } }
    const before = c.calls.length
    const mismatch = await checkMissedPayment(c.reader, { saleLink: live.uri, txHash: h(11), sales: [mismatched] })
    expect(mismatch.outcome).toBe('mismatch')
    expect(c.calls.length).toBe(before)

    const otherRef = '0x' + '22'.repeat(32)
    const otherRequest = { ...live.request, orderId: 'sale-2', reference: otherRef }
    const other: LiveRequest = { ...live, request: otherRequest, uri: paymentRequestLink(otherRequest), claimedTxHash: h(11) }
    await expect(checkMissedPayment(c.reader, { saleLink: live.uri, txHash: h(11), sales: [live, other] })).rejects.toThrow(/another payment reference/)
    expect(c.calls.length).toBe(before)
  })
})
