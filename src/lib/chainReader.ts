// READ-ONLY blockchain reader for ERC-20 Transfer logs on Base (EURC / USDC), through a public JSON-RPC endpoint.
// - No key, no signing, no transaction: eth_blockNumber, eth_getLogs, eth_getBlockByNumber and
//   eth_getTransactionReceipt. eth_chainId is sent only when a reader is asked to confirm Base Sepolia.
// - Network access is INJECTED (`fetchFn`), so every test runs without a network and the app decides what to pass.
// - Logs are filtered by the node (token address + Transfer topic + recipient topic), not downloaded wholesale.
// - It returns observed facts (with block hash and log index, so a later reorg can be detected). It decides nothing:
//   matching and confirmation rules live in chainRequest.ts / confirmation.ts.
import { CHAINS, isAddress, type ChainName, type TokenSymbol, type TransferLog } from './chainRequest'
import { normalizeTxHash } from './reference'

export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/**
 * Keyless public Base Sepolia endpoints, primary first. No API keys.
 * Mainnet is not in this list. The pages app reads these; the Sepolia harness stays on the primary only.
 */
export const SEPOLIA_RPC_URLS = [
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
] as const

/** The only endpoints the app is allowed to talk to. Public, keyless, rate limited: a hand-picked list, not a user input. */
export const PUBLIC_RPC = {
  base: 'https://mainnet.base.org',
  baseSepolia: SEPOLIA_RPC_URLS[0],
} as const satisfies Record<ChainName, string>

/** Shown when every configured Base Sepolia URL has failed. Mainnet is not implied and is not contacted. */
export const SEPOLIA_RPC_FAILURE_COPY =
  'Could not read Base Sepolia. The public endpoint sepolia.base.org failed, and the fallback endpoint failed too. Mainnet was not contacted. Nothing was signed or sent. Try again in a moment.'

/** Rejects a Sepolia fallback list that is missing the official primary, carries a key, or points at Base mainnet. */
export function assertSepoliaFallbackList(urls: readonly string[]): readonly string[] {
  if (urls.length < 2) throw new ChainReadError('bad-input', 'Base Sepolia needs https://sepolia.base.org and at least one public fallback')
  for (const [index, url] of urls.entries()) {
    let parsed: URL
    try { parsed = new URL(url) } catch { throw new ChainReadError('bad-input', 'RPC URL is not valid') }
    const pathOk = parsed.pathname === '/' || parsed.pathname === ''
    if (parsed.protocol !== 'https:' || !pathOk || parsed.username !== '' || parsed.password !== '' || parsed.search !== '' || parsed.hash !== '') {
      throw new ChainReadError('bad-input', 'RPC URLs must be keyless https endpoints with no query string')
    }
    if (parsed.hostname === 'mainnet.base.org') {
      throw new ChainReadError('bad-input', 'Mainnet is disabled at this stage: use Base Sepolia (test funds only)')
    }
    if (index === 0 && parsed.hostname !== 'sepolia.base.org') {
      throw new ChainReadError('bad-input', 'Primary RPC must be https://sepolia.base.org')
    }
  }
  return urls
}

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
  /**
   * When set, these URLs are tried in order after the current one fails at the transport layer
   * (timeout, network error, or HTTP 429/5xx once its retries are used). The first must be
   * https://sepolia.base.org. Mainnet hosts are refused before any call. A JSON-RPC error stays
   * on the URL that returned it.
   */
  readonly rpcUrls?: readonly string[]
  /** Abandon one attempt after this many milliseconds, then try the next URL. 0 or omitted: no timeout. */
  readonly timeoutMs?: number
  /** When set, the first successful contact to a URL must return this chain id (Base Sepolia is 84532). Chain id 8453 is refused. */
  readonly expectChainId?: number
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
  const timeoutMs = opts.timeoutMs ?? 0
  const endpoints = opts.rpcUrls && opts.rpcUrls.length > 0 ? [...opts.rpcUrls] : [opts.rpcUrl]
  if (opts.rpcUrls && opts.rpcUrls.length > 0) assertSepoliaFallbackList(endpoints)
  if (!Number.isInteger(maxRange) || maxRange < 1) throw new ChainReadError('bad-input', 'maxRange must be a positive integer')
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) throw new ChainReadError('bad-input', 'timeoutMs must be a non-negative integer')

  let preferred = 0
  const chainOk = new Set<string>()

  async function fetchAt(url: string, body: string): Promise<FetchResponseLike> {
    const init = { method: 'POST' as const, headers: { 'content-type': 'application/json' }, body }
    if (timeoutMs < 1) return opts.fetchFn(url, { ...init, signal: opts.signal })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onParent = () => controller.abort()
    opts.signal?.addEventListener('abort', onParent)
    try {
      return await opts.fetchFn(url, { ...init, signal: controller.signal })
    } catch (error) {
      if (opts.signal?.aborted) throw error
      if (controller.signal.aborted) throw new ChainReadError('http-error', `RPC timed out after ${timeoutMs}ms`)
      throw error
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onParent)
    }
  }

  /** One URL, including its HTTP 429/5xx retries. Does not switch URLs. */
  async function call(state: { calls: number }, url: string, method: string, params: unknown[]): Promise<unknown> {
    let res: FetchResponseLike | undefined
    for (let attempt = 0; ; attempt++) {
      if (state.calls >= maxCalls) throw new ChainReadError('budget', `Stopped after ${maxCalls} RPC calls`)
      state.calls++ // retries count against the budget too
      res = await fetchAt(url, JSON.stringify({ jsonrpc: '2.0', id: state.calls, method, params }))
      if (res.ok || !(res.status === 429 || res.status >= 500) || attempt >= retries) break
      await sleep(500 * 2 ** attempt)
    }
    if (!res) throw new ChainReadError('http-error', 'RPC did not answer')
    let body: { result?: unknown; error?: { code?: number; message?: string } }
    try {
      body = (await res.json()) as { result?: unknown; error?: { code?: number; message?: string } }
    } catch {
      if (!res.ok) throw new ChainReadError('http-error', `RPC answered HTTP ${res.status}`)
      throw new ChainReadError('bad-response', 'RPC answer is not valid JSON')
    }
    if (body !== null && typeof body === 'object' && body.error) {
      // A 429/5xx is an endpoint failure even when the body is a JSON-RPC error. HTTP 413 stays an rpc-error so a too-wide log range can be split.
      if (res.status === 429 || res.status >= 500) throw new ChainReadError('http-error', `RPC answered HTTP ${res.status}`)
      throw new ChainReadError('rpc-error', `${method}: ${body.error.code ?? ''} ${body.error.message ?? ''}`.trim())
    }
    if (!res.ok) throw new ChainReadError('http-error', `RPC answered HTTP ${res.status}`)
    if (body === null || typeof body !== 'object') throw new ChainReadError('bad-response', 'RPC answer is not an object')
    if (!('result' in body)) throw new ChainReadError('bad-response', 'RPC answer has neither result nor error')
    return body.result
  }

  async function ensureChain(state: { calls: number }, url: string): Promise<void> {
    if (opts.expectChainId === undefined || chainOk.has(url)) return
    const id = hexToInt(await call(state, url, 'eth_chainId', []), 'chain id')
    if (id === CHAINS.base.id) throw new ChainReadError('rpc-error', 'Mainnet is disabled at this stage: use Base Sepolia (test funds only)')
    if (id !== opts.expectChainId) throw new ChainReadError('rpc-error', `Refusing chain id ${id}. This pilot reads Base Sepolia (${opts.expectChainId}) only.`)
    chainOk.add(url)
  }

  function endpointFailure(error: unknown): boolean {
    if (!(error instanceof ChainReadError)) return true
    if (/Mainnet is disabled|Refusing chain id/.test(error.message)) return true
    if (error.code === 'bad-response') return true
    if (error.code !== 'http-error') return false
    const status = Number(error.message.match(/HTTP (\d+)/)?.[1])
    if (!Number.isInteger(status)) return true
    return status === 408 || status === 429 || status >= 500
  }

  function chainRefusal(error: unknown): boolean {
    return error instanceof ChainReadError && /Mainnet is disabled|Refusing chain id/.test(error.message)
  }

  async function rpc(state: { calls: number }, method: string, params: unknown[]): Promise<unknown> {
    let last: unknown
    for (let n = 0; n < endpoints.length; n++) {
      const index = (preferred + n) % endpoints.length
      const url = endpoints[index]
      try {
        await ensureChain(state, url)
        const result = await call(state, url, method, params)
        preferred = index
        return result
      } catch (error) {
        last = error
        const more = n < endpoints.length - 1
        if (more && endpointFailure(error)) continue
        if (!more && endpoints.length > 1 && endpointFailure(error) && !chainRefusal(error)) {
          throw new ChainReadError(error instanceof ChainReadError ? error.code : 'http-error', SEPOLIA_RPC_FAILURE_COPY)
        }
        throw error
      }
    }
    throw last
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
      // A node that does not support the finalized tag answers with an RPC error. A chain-id refusal must still surface.
      if (e instanceof ChainReadError && e.code === 'rpc-error' && !/Mainnet is disabled|Refusing chain id/.test(e.message)) {
        return { finalized: null, rpcCalls: state.calls }
      }
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

  /** Transfer logs inside one transaction. Used when a payment reference is bound to a hash, so the read is one receipt, not a day of logs. */
  async function transfersInTransaction(q: { chain: ChainName; token: TokenSymbol; txHash: string }): Promise<ReadResult> {
    const txHash = normalizeTxHash(q.txHash)
    const tokenAddress = CHAINS[q.chain].tokens[q.token].toLowerCase()
    const state = { calls: 0 }
    const receipt = await rpc(state, 'eth_getTransactionReceipt', [txHash])
    if (receipt === null) return { logs: [], rpcCalls: state.calls }
    if (typeof receipt !== 'object') throw new ChainReadError('bad-response', 'Transaction receipt is not an object')
    const rec = receipt as { status?: unknown; logs?: unknown }
    if (rec.status === '0x0') return { logs: [], rpcCalls: state.calls }
    if (!Array.isArray(rec.logs)) throw new ChainReadError('bad-response', 'Transaction receipt has no log list')
    const logs: ObservedTransfer[] = []
    for (const raw of rec.logs) {
      if (typeof raw !== 'object' || raw === null) throw new ChainReadError('bad-log', 'Log is not an object')
      const item = raw as { address?: unknown; topics?: unknown }
      if (typeof item.address !== 'string' || item.address.toLowerCase() !== tokenAddress) continue
      if (!Array.isArray(item.topics) || item.topics[0] !== TRANSFER_TOPIC) continue
      const log = parseTransferLog(raw, tokenAddress)
      if (log) logs.push(log)
    }
    logs.sort((a, b) => a.logIndex - b.logIndex)
    return { logs, rpcCalls: state.calls }
  }

  return { headBlock, finalizedBlock, transfers, transfersInTransaction }
}

/** Browser live panels: primary sepolia.base.org, one keyless fallback, 8s timeout, chain id 84532 required. */
export function createSepoliaPanelReader(
  fetchFn: FetchLike,
  extra: Partial<Omit<ReaderOptions, 'fetchFn' | 'rpcUrl' | 'rpcUrls' | 'expectChainId'>> = {},
) {
  assertSepoliaFallbackList(SEPOLIA_RPC_URLS)
  return createChainReader({
    timeoutMs: 8_000,
    retries: 1,
    maxRange: 501,
    maxCalls: 120,
    ...extra,
    fetchFn,
    rpcUrl: SEPOLIA_RPC_URLS[0],
    rpcUrls: SEPOLIA_RPC_URLS,
    expectChainId: CHAINS.baseSepolia.id,
  })
}

export type ChainReader = ReturnType<typeof createChainReader>
