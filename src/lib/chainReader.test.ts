import { describe, expect, it } from 'vitest'
import { ChainReadError, TRANSFER_TOPIC, addressTopic, createChainReader, parseTransferLog, type FetchLike } from './chainReader'
import { CHAINS } from './chainRequest'

const MERCHANT = '0x1111111111111111111111111111111111111111'
const PAYER = '0x2222222222222222222222222222222222222222'
const TOKEN = CHAINS.baseSepolia.tokens.EURC
const pad = (a: string) => '0x' + '0'.repeat(24) + a.slice(2).toLowerCase()
const h = (n: number) => '0x' + n.toString(16).padStart(64, '0')
const hex = (n: number) => '0x' + n.toString(16)

function rawLog(o: { block: number; index?: number; value: bigint; to?: string; tx?: number; blockHash?: number; removed?: boolean; address?: string }) {
  return {
    address: o.address ?? TOKEN, topics: [TRANSFER_TOPIC, pad(PAYER), pad(o.to ?? MERCHANT)],
    data: '0x' + o.value.toString(16).padStart(64, '0'), blockNumber: hex(o.block), logIndex: hex(o.index ?? 0),
    transactionHash: h(o.tx ?? o.block * 10 + (o.index ?? 0) + 1), blockHash: h(o.blockHash ?? 1000 + o.block), removed: o.removed ?? false,
  }
}

type Handler = (method: string, params: any[]) => unknown
function fakeFetch(handler: Handler, calls: Array<{ method: string; params: any[] }> = []): FetchLike {
  return async (_url, init) => {
    const { method, params } = JSON.parse(init.body)
    calls.push({ method, params })
    let out: any
    try { out = { result: handler(method, params) } } catch (e: any) { out = { error: { code: e.code ?? -32000, message: e.message } } }
    return { ok: true, status: 200, json: async () => out }
  }
}
const reader = (f: FetchLike, extra: object = {}) => createChainReader({ fetchFn: f, rpcUrl: 'https://rpc.invalid', sleep: async () => {}, ...extra })

describe('chainReader: parsing', () => {
  it('parses a Transfer log into amount, parties, block and log identity', () => {
    const t = parseTransferLog(rawLog({ block: 5, index: 3, value: 1_234_567n }), TOKEN)!
    expect(t).toMatchObject({ to: MERCHANT, from: PAYER, value: 1_234_567n, blockNumber: 5, logIndex: 3, blockHash: h(1005) })
  })
  it('drops a log the node marks as removed (reorged out)', () => {
    expect(parseTransferLog(rawLog({ block: 5, value: 1n, removed: true }), TOKEN)).toBeNull()
  })
  it('rejects logs from another contract, other event shapes, bad data and pending logs', () => {
    expect(() => parseTransferLog(rawLog({ block: 5, value: 1n, address: CHAINS.baseSepolia.tokens.USDC }), TOKEN)).toThrow(ChainReadError)
    expect(() => parseTransferLog({ ...rawLog({ block: 5, value: 1n }), topics: [h(7), pad(PAYER), pad(MERCHANT)] }, TOKEN)).toThrow(/Transfer/)
    expect(() => parseTransferLog({ ...rawLog({ block: 5, value: 1n }), topics: [TRANSFER_TOPIC, pad(PAYER)] }, TOKEN)).toThrow() // ERC-721 style / short
    expect(() => parseTransferLog({ ...rawLog({ block: 5, value: 1n }), data: '0x12' }, TOKEN)).toThrow(/32-byte/)
    expect(() => parseTransferLog({ ...rawLog({ block: 5, value: 1n }), blockHash: null }, TOKEN)).toThrow(/block hash/)
    expect(() => parseTransferLog(null, TOKEN)).toThrow()
  })
  it('builds the recipient topic and refuses bad addresses', () => {
    expect(addressTopic('0xAbCdEf0000000000000000000000000000000001')).toBe(pad('0xabcdef0000000000000000000000000000000001'))
    expect(() => addressTopic('0x12')).toThrow(ChainReadError)
  })
})

describe('chainReader: reading', () => {
  it('asks the node for ONLY this token, Transfer events and this recipient (filtering happens at the node)', async () => {
    const calls: any[] = []
    const r = reader(fakeFetch(() => [], calls))
    await r.transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 10, toBlock: 20 })
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('eth_getLogs')
    expect(calls[0].params[0]).toEqual({ address: TOKEN, topics: [TRANSFER_TOPIC, null, pad(MERCHANT)], fromBlock: '0xa', toBlock: '0x14' })
  })
  it('sends only read-only RPC methods, ever', async () => {
    const calls: any[] = []
    const r = reader(fakeFetch((m) => (m === 'eth_blockNumber' ? '0x10' : m === 'eth_getBlockByNumber' ? { number: '0x8' } : []), calls))
    await r.headBlock(); await r.finalizedBlock(); await r.transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 5 })
    expect(new Set(calls.map((c) => c.method))).toEqual(new Set(['eth_blockNumber', 'eth_getBlockByNumber', 'eth_getLogs']))
    expect(calls.some((c) => /send|sign|submit|personal|unlock/i.test(c.method))).toBe(false)
  })
  it('splits a window into node-sized slices', async () => {
    const calls: any[] = []
    const r = reader(fakeFetch(() => [], calls), { maxRange: 100 })
    const res = await r.transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 249 })
    expect(res.rpcCalls).toBe(3)
    expect(calls.map((c) => [c.params[0].fromBlock, c.params[0].toBlock])).toEqual([['0x0', '0x63'], ['0x64', '0xc7'], ['0xc8', '0xf9']])
  })
  it('halves the span and retries when the node rejects a range, then returns all logs sorted and deduplicated', async () => {
    const f = fakeFetch((_m, p) => {
      const from = parseInt(p[0].fromBlock, 16), to = parseInt(p[0].toBlock, 16)
      if (to - from + 1 > 50) throw Object.assign(new Error('block range too large'), { code: -32614 })
      return [rawLog({ block: 70, value: 2n }), rawLog({ block: 10, value: 1n })].filter((l) => parseInt(l.blockNumber, 16) >= from && parseInt(l.blockNumber, 16) <= to)
    })
    const res = await reader(f).transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 99 })
    expect(res.logs.map((l) => l.blockNumber)).toEqual([10, 70])
  })
  it('parses an HTTP 413 JSON-RPC range error and splits like the real Base public endpoint', async () => {
    const spans: number[] = []
    const f: FetchLike = async (_url, init) => {
      const { params } = JSON.parse(init.body)
      const from = parseInt(params[0].fromBlock, 16), to = parseInt(params[0].toBlock, 16)
      const span = to - from + 1; spans.push(span)
      if (span > 50) return { ok: false, status: 413, json: async () => ({ error: { code: -32614, message: 'eth_getLogs is limited to a 50 range' } }) }
      return { ok: true, status: 200, json: async () => ({ result: [] }) }
    }
    const res = await reader(f).transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 99 })
    expect(res.logs).toEqual([])
    expect(spans).toEqual([100, 50, 50])
  })
  it('does not double count a log returned by two overlapping slices', async () => {
    const res = await reader(fakeFetch(() => [rawLog({ block: 3, value: 9n }), rawLog({ block: 3, value: 9n })])).transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 10 })
    expect(res.logs).toHaveLength(1)
  })
  it('keeps two distinct transfers of the same amount in one block (different log index)', async () => {
    const res = await reader(fakeFetch(() => [rawLog({ block: 3, index: 0, value: 9n }), rawLog({ block: 3, index: 1, value: 9n })])).transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 10 })
    expect(res.logs).toHaveLength(2)
  })
  it('throws when the node returns a log for another recipient or outside the range (never trusts the node blindly)', async () => {
    await expect(reader(fakeFetch(() => [rawLog({ block: 3, value: 9n, to: PAYER })])).transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 10 })).rejects.toThrow(/different recipient/)
    await expect(reader(fakeFetch(() => [rawLog({ block: 30, value: 9n })])).transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 10 })).rejects.toThrow(/outside/)
  })
  it('stops at the call budget instead of hammering a free endpoint', async () => {
    const r = reader(fakeFetch(() => []), { maxRange: 1, maxCalls: 5 })
    await expect(r.transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 99 })).rejects.toMatchObject({ code: 'budget' })
  })
  it('reports HTTP failure, RPC error and garbage answers as distinct errors', async () => {
    const http: FetchLike = async () => ({ ok: false, status: 429, json: async () => ({}) })
    await expect(reader(http).headBlock()).rejects.toMatchObject({ code: 'http-error' })
    await expect(reader(fakeFetch(() => { throw new Error('boom') })).headBlock()).rejects.toMatchObject({ code: 'rpc-error' })
    const junk: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ jsonrpc: '2.0' }) })
    await expect(reader(junk).headBlock()).rejects.toMatchObject({ code: 'bad-response' })
    await expect(reader(fakeFetch(() => 'nonsense')).headBlock()).rejects.toMatchObject({ code: 'bad-response' })
    await expect(reader(fakeFetch(() => 'not-a-list')).transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 0, toBlock: 1 })).rejects.toMatchObject({ code: 'bad-response' })
  })
  it('rejects an inverted block range and a bad merchant before any network call', async () => {
    const calls: any[] = []
    const r = reader(fakeFetch(() => [], calls))
    await expect(r.transfers({ chain: 'baseSepolia', token: 'EURC', merchant: MERCHANT, fromBlock: 9, toBlock: 3 })).rejects.toMatchObject({ code: 'bad-input' })
    await expect(r.transfers({ chain: 'baseSepolia', token: 'EURC', merchant: '0xnope', fromBlock: 1, toBlock: 3 })).rejects.toMatchObject({ code: 'bad-input' })
    expect(calls).toHaveLength(0)
  })
  it('reads the finalized block when the node has the tag, and returns null when it does not', async () => {
    expect((await reader(fakeFetch(() => ({ number: '0x2a' }))).finalizedBlock()).finalized).toBe(42)
    expect((await reader(fakeFetch(() => { throw new Error('invalid block tag') })).finalizedBlock()).finalized).toBeNull()
    expect((await reader(fakeFetch(() => null)).finalizedBlock()).finalized).toBeNull()
  })
  it('retries HTTP 429 with growing pauses, then succeeds; retries count against the call budget', async () => {
    const pauses: number[] = []
    let n = 0
    const f: FetchLike = async () => (++n <= 2 ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ result: '0x10' }) })
    const r = createChainReader({ fetchFn: f, rpcUrl: 'x', sleep: async (ms) => { pauses.push(ms) } })
    const res = await r.headBlock()
    expect(res).toEqual({ head: 16, rpcCalls: 3 })
    expect(pauses).toEqual([500, 1000])
    const always429: FetchLike = async () => ({ ok: false, status: 429, json: async () => ({}) })
    await expect(createChainReader({ fetchFn: always429, rpcUrl: 'x', sleep: async () => {}, retries: 2 }).headBlock()).rejects.toMatchObject({ code: 'http-error' })
    await expect(createChainReader({ fetchFn: always429, rpcUrl: 'x', sleep: async () => {}, retries: 50, maxCalls: 3 }).headBlock()).rejects.toMatchObject({ code: 'budget' })
  })
  it('does not retry a client error such as HTTP 400', async () => {
    let n = 0
    const f: FetchLike = async () => { n++; return { ok: false, status: 400, json: async () => ({}) } }
    await expect(reader(f).headBlock()).rejects.toMatchObject({ code: 'http-error' })
    expect(n).toBe(1)
  })
})
