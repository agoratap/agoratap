// Confirmation rule: turns observed transfers + the chain head into ONE state per payment request.
// Pure functions, no network, no clock. States: unpaid | pending | confirmed | ambiguous | reorged | unknown.
//
// Rules (each one is tested):
//  1. Only transfers to the merchant with the EXACT amount, inside the request's block window, count.
//  2. Two or more such transfers = ambiguous. We never pick one and never say "paid".
//  3. One transfer = pending until it has CONFIRMATIONS blocks on top (block itself counts as 1); then confirmed.
//  4. `final` is true only when the node reports a finalized block at or above the transfer's block (Base: derived from L1).
//  5. Reorg safety: the caller passes back the `seen` observation of the previous evaluation. If that exact
//     transfer (tx hash + block hash + log index) has disappeared, the state is `reorged`, whatever it was before.
//     The same tx re-included in a different block (different block hash) also counts as `reorged` once; the caller then
//     drops `previous` and the next evaluation counts confirmations from the new block.
//  6. A head that went backwards compared with the previous evaluation (lagging RPC node) gives `unknown`, never a guess.
//  7. A matched transfer is evidence that someone sent that amount, not proof of who paid (README).
import type { OpenRequest } from './chainRequest'
import type { ObservedTransfer } from './chainReader'

/** Base blocks come every ~2 s. 12 confirmations is about 24 s, enough against shallow reorgs for small retail sums; finalized is the hard line. */
export const DEFAULT_CONFIRMATIONS = 12
export const BASE_BLOCK_SECONDS = 2

export interface Observation {
  readonly txHash: string
  readonly blockHash: string
  readonly blockNumber: number
  readonly logIndex: number
  readonly head: number
}

export interface RequestWindow {
  /** First block in which a payment can count: the chain head read when the request was created (inclusive). */
  readonly fromBlock: number
  /** Last block in which a payment can count; omit for "no expiry". */
  readonly toBlock?: number
}

export type PaymentState =
  | { status: 'unpaid'; head: number; expired: boolean }
  | { status: 'pending'; confirmations: number; needed: number; seen: Observation }
  | { status: 'confirmed'; confirmations: number; final: boolean; seen: Observation }
  | { status: 'ambiguous'; txHashes: string[]; head: number }
  | { status: 'reorged'; lost: Observation; head: number }
  | { status: 'unknown'; reason: 'rpc-head-behind'; head: number }

export function blocksForSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Seconds must be greater than zero')
  return Math.ceil(seconds / BASE_BLOCK_SECONDS)
}

export function windowFrom(headAtCreation: number, ttlSeconds?: number): RequestWindow {
  if (!Number.isInteger(headAtCreation) || headAtCreation < 0) throw new Error('Head block must be a non-negative integer')
  return ttlSeconds === undefined ? { fromBlock: headAtCreation } : { fromBlock: headAtCreation, toBlock: headAtCreation + blocksForSeconds(ttlSeconds) }
}

export interface EvaluateInput {
  readonly request: OpenRequest
  readonly logs: readonly ObservedTransfer[]
  readonly head: number
  readonly window: RequestWindow
  readonly confirmations?: number
  readonly finalized?: number | null
  readonly previous?: Observation
}

const sameTransfer = (o: Observation, l: ObservedTransfer) => o.txHash === l.txHash && o.blockHash === l.blockHash && o.logIndex === l.logIndex

export function evaluatePayment(input: EvaluateInput): PaymentState {
  const { request, logs, head, window, previous } = input
  const needed = input.confirmations ?? DEFAULT_CONFIRMATIONS
  if (!Number.isInteger(needed) || needed < 1) throw new Error('Confirmations must be at least 1')
  if (!Number.isInteger(head) || head < 0) throw new Error('Head block must be a non-negative integer')

  if (previous && head < previous.head) return { status: 'unknown', reason: 'rpc-head-behind', head }

  const merchant = request.merchant.toLowerCase()
  const lastBlock = window.toBlock ?? Number.POSITIVE_INFINITY
  const hits = logs.filter((l) => l.to.toLowerCase() === merchant && l.value === request.atomic && l.blockNumber >= window.fromBlock && l.blockNumber <= lastBlock && l.blockNumber <= head)

  if (previous && !hits.some((l) => sameTransfer(previous, l))) {
    // What we saw before is gone. If a different single transfer now exists it is a NEW observation, but the loss itself is reported first.
    return { status: 'reorged', lost: previous, head }
  }

  if (hits.length === 0) return { status: 'unpaid', head, expired: head > lastBlock }
  if (hits.length > 1) return { status: 'ambiguous', txHashes: [...new Set(hits.map((h) => h.txHash))], head }

  const hit = hits[0]
  const confirmations = head - hit.blockNumber + 1
  const seen: Observation = { txHash: hit.txHash, blockHash: hit.blockHash, blockNumber: hit.blockNumber, logIndex: hit.logIndex, head }
  if (confirmations < needed) return { status: 'pending', confirmations, needed, seen }
  const final = input.finalized !== undefined && input.finalized !== null && hit.blockNumber <= input.finalized
  return { status: 'confirmed', confirmations, final, seen }
}

