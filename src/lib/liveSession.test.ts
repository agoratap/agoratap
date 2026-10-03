import { describe, expect, it } from 'vitest'
import { createChainReader, TRANSFER_TOPIC, type FetchLike } from './chainReader'
import { CHAINS } from './chainRequest'
import { describeState, openLiveRequest, refreshLive } from './liveSession'
import { secureRandom } from './tagging'

const M = '0x1111111111111111111111111111111111111111'
const P = '0x2222222222222222222222222222222222222222'
const TOKEN = CHAINS.baseSepolia.tokens.EURC
const pad = (a: string) => '0x' + '0'.repeat(24) + a.slice(2)
const h = (n: number) => '0x' + n.toString(16).padStart(64, '0')

// A tiny fake chain: mutable head, mutable list of logs, optional finalized.
function chain() {
  const state = { head: 1000, finalized: 900 as number | null, logs: [] as any[] }
  const mkLog = (block: number, value: bigint, hashSeed = block, tx = block) => ({ address: TOKEN, topics: [TRANSFER_TOPIC, pad(P), pad(M)], data: '0x' + value.toString(16).padStart(64, '0'), blockNumber: '0x' + block.toString(16), logIndex: '0x0', transactionHash: h(tx), blockHash: h(hashSeed + 5000), removed: false })
  const fetchFn: FetchLike = async (_u, init) => {
    const { method, params } = JSON.parse(init.body)
    let result: any
    if (method === 'eth_blockNumber') result = '0x' + state.head.toString(16)
    else if (method === 'eth_getBlockByNumber') result = state.finalized === null ? null : { number: '0x' + state.finalized.toString(16) }
    else if (method === 'eth_getLogs') { const f = parseInt(params[0].fromBlock, 16), t = parseInt(params[0].toBlock, 16); result = state.logs.filter((l) => { const b = parseInt(l.blockNumber, 16); return b >= f && b <= t }) }
    else return { ok: true, status: 200, json: async () => ({ error: { code: -32601, message: 'no' } }) }
    return { ok: true, status: 200, json: async () => ({ result }) }
  }
  return { state, mkLog, reader: createChainReader({ fetchFn, rpcUrl: 'x' }) }
}

describe('live session end to end on a fake chain', () => {
  it('refuses mainnet unless explicitly allowed', async () => {
    const c = chain()
    await expect(openLiveRequest(c.reader, { orderId: 'a', chain: 'base', merchant: M, eurAmount: 1 }, [], secureRandom)).rejects.toThrow(/Mainnet is disabled/)
  })
  it('opens at the head, avoids amounts the merchant already received, then goes unpaid -> pending -> confirmed(final)', async () => {
    const c = chain()
    c.state.logs.push(c.mkLog(950, 1_000_001n)) // history: tag 1 already used
    const live = await openLiveRequest(c.reader, { orderId: 'a', chain: 'baseSepolia', merchant: M, eurAmount: 1 }, [], () => 0)
    expect(live.request.tag).toBe(2) // random=0 would give tag 1, but history excludes it
    expect(live.window.fromBlock).toBe(1000)
    expect(live.uri).toContain(`uint256=${live.request.atomic}`)
    let s = await refreshLive(c.reader, live)
    expect(s.status).toBe('unpaid'); expect(describeState(s)).toMatch(/Waiting/)
    c.state.logs.push(c.mkLog(1002, live.request.atomic)); c.state.head = 1005
    s = await refreshLive(c.reader, live, s)
    expect(s).toMatchObject({ status: 'pending', confirmations: 4 })
    c.state.head = 1020; c.state.finalized = 1010
    s = await refreshLive(c.reader, live, s)
    expect(s).toMatchObject({ status: 'confirmed', final: true }); expect(describeState(s)).toMatch(/does not prove who/)
  })
  it('a transfer from before the request existed does not pay it', async () => {
    const c = chain()
    const live = await openLiveRequest(c.reader, { orderId: 'a', chain: 'baseSepolia', merchant: M, eurAmount: 1 }, [], () => 0.3)
    c.state.logs.push(c.mkLog(990, live.request.atomic)); c.state.head = 1100
    expect((await refreshLive(c.reader, live)).status).toBe('unpaid')
  })
  it('detects a reorg between two polls', async () => {
    const c = chain()
    const live = await openLiveRequest(c.reader, { orderId: 'a', chain: 'baseSepolia', merchant: M, eurAmount: 1 }, [], () => 0.3)
    c.state.logs.push(c.mkLog(1002, live.request.atomic)); c.state.head = 1004
    const s1 = await refreshLive(c.reader, live)
    expect(s1.status).toBe('pending')
    c.state.logs = []; c.state.head = 1006
    const s2 = await refreshLive(c.reader, live, s1)
    expect(s2.status).toBe('reorged'); expect(describeState(s2)).toMatch(/reorg/i)
  })
  it('works when the node has no finalized tag (final stays false)', async () => {
    const c = chain(); c.state.finalized = null
    const live = await openLiveRequest(c.reader, { orderId: 'a', chain: 'baseSepolia', merchant: M, eurAmount: 1 }, [], () => 0.3)
    c.state.logs.push(c.mkLog(1001, live.request.atomic)); c.state.head = 1100
    expect(await refreshLive(c.reader, live)).toMatchObject({ status: 'confirmed', final: false })
  })
  it('two identical payments become ambiguous, with a plain warning', async () => {
    const c = chain()
    const live = await openLiveRequest(c.reader, { orderId: 'a', chain: 'baseSepolia', merchant: M, eurAmount: 1 }, [], () => 0.3)
    c.state.logs.push(c.mkLog(1001, live.request.atomic, 1, 1), c.mkLog(1002, live.request.atomic, 2, 2)); c.state.head = 1100
    const s = await refreshLive(c.reader, live)
    expect(s.status).toBe('ambiguous'); expect(describeState(s)).toMatch(/Do not treat as paid/)
  })
})
