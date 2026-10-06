import { describe, expect, it } from 'vitest'
import { createChainReader, TRANSFER_TOPIC, type FetchLike } from './chainReader'
import { CHAINS } from './chainRequest'
import { eip681Uri } from './chainRequest'
import { describeState, bindLiveClaim, openLiveRequest, refreshLive } from './liveSession'

/** Merchant address on file for a later pilot. Used here as a Sepolia example only. Mainnet stays refused. */
const PILOT = '0xCc15552e20ed43c47a1EEBf781c905Cd1117CEa3'
const PAYER = '0x2222222222222222222222222222222222222222'
const TOKEN = CHAINS.baseSepolia.tokens.EURC
const pad = (a: string) => '0x' + '0'.repeat(24) + a.slice(2).toLowerCase()
const h = (n: number) => '0x' + n.toString(16).padStart(64, '0')

function chain() {
  const calls: string[] = []
  const state = { head: 1000, finalized: 900 as number | null, logs: [] as Record<string, unknown>[] }
  const mkLog = (block: number, value: bigint, tx: number) => ({
    address: TOKEN,
    topics: [TRANSFER_TOPIC, pad(PAYER), pad(PILOT)],
    data: '0x' + value.toString(16).padStart(64, '0'),
    blockNumber: '0x' + block.toString(16),
    logIndex: '0x0',
    transactionHash: h(tx),
    blockHash: h(5000 + tx),
    removed: false,
  })
  const fetchFn: FetchLike = async (_u, init) => {
    const { method, params } = JSON.parse(init.body) as { method: string; params: [{ fromBlock: string; toBlock: string }] }
    calls.push(method)
    let result: unknown
    if (method === 'eth_blockNumber') result = '0x' + state.head.toString(16)
    else if (method === 'eth_getBlockByNumber') result = state.finalized === null ? null : { number: '0x' + state.finalized.toString(16) }
    else if (method === 'eth_getLogs') {
      const from = parseInt(params[0].fromBlock, 16)
      const to = parseInt(params[0].toBlock, 16)
      result = state.logs.filter((l) => {
        const b = parseInt(String(l.blockNumber), 16)
        return b >= from && b <= to
      })
    } else if (method === 'eth_getTransactionReceipt') {
      const hash = String(params[0]).toLowerCase()
      const logs = state.logs.filter((l) => String(l.transactionHash).toLowerCase() === hash)
      result = logs.length === 0 ? null : { status: '0x1', logs }
    } else return { ok: true, status: 200, json: async () => ({ error: { code: -32601, message: 'method not allowed' } }) }
    return { ok: true, status: 200, json: async () => ({ result }) }
  }
  return { state, mkLog, calls, reader: createChainReader({ fetchFn, rpcUrl: 'http://injected.invalid', maxRange: 1000, maxCalls: 80 }) }
}

describe('reference matching against injected logs', () => {
  it('refuses mainnet for the documented pilot address', async () => {
    const c = chain()
    await expect(openLiveRequest(c.reader, { orderId: 'pilot', chain: 'base', merchant: PILOT, eurAmount: 1 }, [], () => 0)).rejects.toThrow(/Mainnet is disabled/)
    expect(c.calls).toEqual([])
  })

  it('injected chain: reference match goes unpaid, then pending, then confirmed while a second identical amount is ignored', async () => {
    const c = chain()
    const live = await openLiveRequest(
      c.reader,
      { orderId: 'sale-1', chain: 'baseSepolia', merchant: PILOT, eurAmount: 1, fillReference: (b) => b.fill(0x11) },
      [],
      () => 0,
    )
    expect(live.request.merchant).toBe(PILOT)
    expect(live.request.reference).toBe('0x' + '11'.repeat(32))
    expect(live.uri.endsWith(`#ref=${live.request.reference}`)).toBe(true)
    expect(eip681Uri(live.request)).not.toContain('#')

    let s = await refreshLive(c.reader, live)
    expect(s.status).toBe('unpaid')
    expect(describeState(s)).toMatch(/Waiting/)

    c.state.logs.push(c.mkLog(1001, live.request.atomic, 11), c.mkLog(1003, live.request.atomic, 22))
    c.state.head = 1006
    s = await refreshLive(c.reader, live)
    expect(s.status).toBe('ambiguous')

    const missed = await refreshLive(c.reader, bindLiveClaim(live, h(99)))
    expect(missed).toMatchObject({ status: 'unpaid', claimMissed: true })
    expect(describeState(missed)).toMatch(/does not pay this reference/)

    const bound = bindLiveClaim(live, h(11))
    s = await refreshLive(c.reader, bound)
    expect(s).toMatchObject({ status: 'pending', via: 'reference', confirmations: 6 })
    if (s.status === 'pending') expect(s.seen.txHash).toBe(h(11))
    expect(describeState(s)).toMatch(/Transaction reference matched/)

    c.state.head = 1020
    c.state.finalized = 1010
    s = await refreshLive(c.reader, bound, s)
    expect(s).toMatchObject({ status: 'confirmed', final: true, via: 'reference' })
    if (s.status === 'confirmed') expect(s.seen.txHash).toBe(h(11))
    expect(describeState(s)).toMatch(/does not prove who/)

    const other = await openLiveRequest(
      c.reader,
      { orderId: 'sale-2', chain: 'baseSepolia', merchant: PILOT, eurAmount: 1, fillReference: (b) => b.fill(0x22) },
      [live.request],
      () => 0,
    )
    expect(() => bindLiveClaim(other, h(11), [{ reference: live.request.reference!, txHash: h(11) }])).toThrow(/another payment reference/)
    expect(c.calls.every((m) => m === 'eth_blockNumber' || m === 'eth_getLogs' || m === 'eth_getBlockByNumber' || m === 'eth_getTransactionReceipt')).toBe(true)
    expect(c.calls).toContain('eth_getTransactionReceipt')
  })
})