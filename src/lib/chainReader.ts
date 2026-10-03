// READ-ONLY blockchain reader for ERC-20 Transfer logs on Base (EURC / USDC), through a public JSON-RPC endpoint.
// - No key, no signing, no transaction: only eth_blockNumber, eth_getLogs and eth_getBlockByNumber are ever sent.
// - Network access is INJECTED (`fetchFn`), so every test runs without a network and the app decides what to pass.
// - Logs are filtered by the node (token address + Transfer topic + recipient topic), not downloaded wholesale.
// - It returns observed facts (with block hash and log index, so a later reorg can be detected). It decides nothing:
//   matching and confirmation rules live in chainRequest.ts / confirmation.ts.
import { CHAINS, isAddress, type ChainName, type TokenSymbol, type TransferLog } from './chainRequest'

export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/** The only endpoints the app is allowed to talk to. Public, keyless, rate limited: a hand-picked list, not a user input. */
export const PUBLIC_RPC = {
  base: 'https://mainnet.base.org',
  baseSepolia: 'https://sepolia.base.org',
} as const satisfies Record<ChainName, string>

export interface FetchResponseLike {
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}
export type FetchLike = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<FetchResponseLike>

/** A transfer as seen on chain: TransferLog + the block hash and log index that identify it uniquely. */
export interface ObservedTransfer extends TransferLog {
  readonly blockHash: string
  readonly logIndex: number
  readonly from: string
}

export class ChainReadError extends Error {
  constructor(readonly code: 'rpc-error' | 'http-error' | 'bad-response' | 'bad-log' | 'bad-input' | 'budget', message: string) {
    super(message)
    this.name = 'ChainReadError'
  }
}

export interface ReaderOptions {
  readonly fetchFn: FetchLike
  readonly rpcUrl: string
  /** Widest eth_getLogs span first tried (the public Base endpoint rejects > 1000 with HTTP 413 + JSON-RPC -32614, observed 2026-10-03). */
  readonly maxRange?: number
  /** Hard cap on RPC calls per operation, so a bug or a huge window cannot hammer a free public endpoint. */
  readonly maxCalls?: number
  readonly signal?: AbortSignal
  /** On HTTP 429 / 5xx the call is retried this many times with growing pauses (public endpoints rate-limit; observed 429 on 2026-10-03). Default 4. */
  readonly retries?: number
  /** Injected pause so tests need no real time. Default: real setTimeout. */
  readonly sleep?: (ms: number) => Promise<void>
}

export interface TransferQuery {
  readonly chain: ChainName
  readonly token: TokenSymbol
  /** Recipient: filtered by the node through topic 2. */
  readonly merchant: string
  readonly fromBlock: number
  readonly toBlock: number
}

export interface ReadResult {
  readonly logs: ObservedTransfer[]
  readonly rpcCalls: number
}

const HEX = /^0x[0-9a-fA-F]*$/
const HASH = /^0x[0-9a-fA-F]{64}$/

export function addressTopic(address: string): string {
  if (!isAddress(address)) throw new ChainReadError('bad-input', 'Not a valid 0x address')
  return '0x' + '0'.repeat(24) + address.slice(2).toLowerCase()
}

function hexToInt(value: unknown, what: string): number {
  if (typeof value !== 'string' || !HEX.test(value) || value.length < 3) throw new ChainReadError('bad-response', `${what} is not a hex number`)
  const n = Number.parseInt(value, 16)
  if (!Number.isSafeInteger(n)) throw new ChainReadError('bad-response', `${what} is out of range`)
  return n
}

/** Parse one raw eth_getLogs entry. Returns null for a log the node marks as removed (reorged out). Throws on anything malformed. */
export function parseTransferLog(raw: unknown, tokenAddress: string): ObservedTransfer | null {
  if (typeof raw !== 'object' || raw === null) throw new ChainReadError('bad-log', 'Log is not an object')
  const l = raw as Record<string, unknown>
  if (l.removed === true) return null
  if (typeof l.address !== 'string' || l.address.toLowerCase() !== tokenAddress.toLowerCase()) throw new ChainReadError('bad-log', 'Log comes from a different contract than requested')
  const topics = l.topics
  if (!Array.isArray(topics) || topics.length !== 3 || topics[0] !== TRANSFER_TOPIC) throw new ChainReadError('bad-log', 'Not an ERC-20 Transfer(from,to,value) log')
  if (!topics.every((t) => typeof t === 'string' && HASH.test(t))) throw new ChainReadError('bad-log', 'Malformed topics')
  if (typeof l.data !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(l.data)) throw new ChainReadError('bad-log', 'Transfer value is not a single 32-byte word')
  if (typeof l.transactionHash !== 'string' || !HASH.test(l.transactionHash)) throw new ChainReadError('bad-log', 'Malformed transaction hash')
  if (typeof l.blockHash !== 'string' || !HASH.test(l.blockHash)) throw new ChainReadError('bad-log', 'Malformed block hash (pending log?)')
  return {
    from: '0x' + (topics[1] as string).slice(26).toLowerCase(),
    to: '0x' + (topics[2] as string).slice(26).toLowerCase(),
    value: BigInt(l.data),
    txHash: l.transactionHash.toLowerCase(),
    blockNumber: hexToInt(l.blockNumber, 'blockNumber'),
    blockHash: l.blockHash.toLowerCase(),
    logIndex: hexToInt(l.logIndex, 'logIndex'),
  }
}

const RANGE_ERROR = /range|limit|too many|exceed|too large|more than/i

export function createChainReader(opts: ReaderOptions) {
  const maxRange = opts.maxRange ?? 1000
  const maxCalls = opts.maxCalls ?? 200
  const retries = opts.retries ?? 4
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  if (!Number.isInteger(maxRange) || maxRange < 1) throw new ChainReadError('bad-input', 'maxRange must be a positive integer')

  async function rpc(state: { calls: number }, method: string, params: unknown[]): Promise<unknown> {
    let res: FetchResponseLike
    for (let attempt = 0; ; attempt++) {
      if (state.calls >= maxCalls) throw new ChainReadError('budget', `Stopped after ${maxCalls} RPC calls`)
      state.calls++ // retries count against the budget too
      res = await opts.fetchFn(opts.rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: state.calls, method, params }),
        signal: opts.signal,
      })
      if (res.ok || !(res.status === 429 || res.status >= 500) || attempt >= retries) break
      await sleep(500 * 2 ** attempt)
    }
    let body: { result?: unknown; error?: { code?: number; message?: string } }
    try {
      body = (await res.json()) as { result?: unknown; error?: { code?: number; message?: string } }
    } catch {
      if (!res.ok) throw new ChainReadError('http-error', `RPC answered HTTP ${res.status}`)
      throw new ChainReadError('bad-response', 'RPC answer is not valid JSON')
    }
    if (body !== null && typeof body === 'object' && body.error) {
      throw new ChainReadError('rpc-error', `${method}: ${body.error.code ?? ''} ${body.error.message ?? ''}`.trim())
    }
    if (!res.ok) throw new ChainReadError('http-error', `RPC answered HTTP ${res.status}`)
    if (body === null || typeof body !== 'object') throw new ChainReadError('bad-response', 'RPC answer is not an object')
    if (!('result' in body)) throw new ChainReadError('bad-response', 'RPC answer has neither result nor error')
    return body.result
  }

  async function headBlock(): Promise<{ head: number; rpcCalls: number }> {
    const state = { calls: 0 }
    const head = hexToInt(await rpc(state, 'eth_blockNumber', []), 'head block')
    return { head, rpcCalls: state.calls }
  }

  /** Newest block the node calls "finalized" (derived from L1 for Base), or null if the node does not support the tag. */
  async function finalizedBlock(): Promise<{ finalized: number | null; rpcCalls: number }> {
    const state = { calls: 0 }
    try {
      const block = (await rpc(state, 'eth_getBlockByNumber', ['finalized', false])) as { number?: unknown } | null
      if (!block || block.number === undefined) return { finalized: null, rpcCalls: state.calls }
      return { finalized: hexToInt(block.number, 'finalized block'), rpcCalls: state.calls }
    } catch (e) {
      if (e instanceof ChainReadError && e.code === 'rpc-error') return { finalized: null, rpcCalls: state.calls }
      throw e
    }
  }

  async function transfers(q: TransferQuery): Promise<ReadResult> {
    if (!Number.isInteger(q.fromBlock) || !Number.isInteger(q.toBlock) || q.fromBlock < 0 || q.toBlock < q.fromBlock) {
      throw new ChainReadError('bad-input', 'Block range is invalid')
    }
    const tokenAddress = CHAINS[q.chain].tokens[q.token]
    const recipientTopic = addressTopic(q.merchant)
    const state = { calls: 0 }
    const seen = new Set<string>()
    const logs: ObservedTransfer[] = []

    const queue: Array<[number, number]> = []
    for (let from = q.fromBlock; from <= q.toBlock; from += maxRange) queue.push([from, Math.min(from + maxRange - 1, q.toBlock)])

    while (queue.length > 0) {
      const [from, to] = queue.shift() as [number, number]
      let result: unknown
      try {
        result = await rpc(state, 'eth_getLogs', [{
          address: tokenAddress,
          topics: [TRANSFER_TOPIC, null, recipientTopic],
          fromBlock: '0x' + from.toString(16),
          toBlock: '0x' + to.toString(16),
        }])
      } catch (e) {
        // The node says the span (or the number of results) is too big: split the span in two and retry. A single block cannot be split.
        if (e instanceof ChainReadError && e.code === 'rpc-error' && RANGE_ERROR.test(e.message) && to > from) {
          const mid = from + Math.floor((to - from) / 2)
          queue.unshift([from, mid], [mid + 1, to])
          continue
        }
        throw e
      }
      if (!Array.isArray(result)) throw new ChainReadError('bad-response', 'eth_getLogs did not return a list')
      for (const raw of result) {
        const log = parseTransferLog(raw, tokenAddress)
        if (!log) continue
        if (log.to !== q.merchant.toLowerCase()) throw new ChainReadError('bad-log', 'Node returned a log for a different recipient than the filter')
        if (log.blockNumber < q.fromBlock || log.blockNumber > q.toBlock) throw new ChainReadError('bad-log', 'Node returned a log outside the requested blocks')
        const key = `${log.blockHash}:${log.logIndex}`
        if (seen.has(key)) continue
        seen.add(key)
        logs.push(log)
      }
    }
    logs.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)
    return { logs, rpcCalls: state.calls }
  }

  return { headBlock, finalizedBlock, transfers }
}

export type ChainReader = ReturnType<typeof createChainReader>
