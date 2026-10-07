// Live (testnet, read-only) orchestration: open a request at the current chain head, then poll the chain for it.
// No key, no signing, no custody. Network comes only through the injected reader. Base MAINNET is refused unless
// the caller explicitly sets allowMainnet (the app screens never do). The screens use the Base Sepolia matcher only. That matcher is one optional rail, not the product. No real funds.
import { toAtomicEurc, type ChainName, type OpenRequest } from './chainRequest'
import type { ChainReader } from './chainReader'
import { evaluatePayment, windowFrom, type Observation, type PaymentState, type RequestWindow } from './confirmation'
import { assertClaimFree, createReference, normalizeTxHash, paymentRequestLink, type TxClaim } from './reference'
import { createUnpredictableRequest, type Random } from './tagging'

/** How far back we look at what the merchant already received, to avoid reusing an amount. 43,200 blocks is about 24 h on Base. */
export const HISTORY_LOOKBACK_BLOCKS = 43_200

export interface LiveRequest {
  readonly request: OpenRequest
  readonly window: RequestWindow
  /** Share link, including `#ref=` when the request has a reference. */
  readonly uri: string
  readonly confirmations: number
  /** Transaction hash bound to `request.reference`. Primary match key. */
  readonly claimedTxHash?: string
}

function guardChain(chain: ChainName, allowMainnet: boolean) {
  if (chain === 'base' && !allowMainnet) throw new Error('Mainnet is disabled at this stage: use Base Sepolia (test funds only)')
}

export async function openLiveRequest(
  reader: ChainReader,
  input: { orderId: string; chain: ChainName; merchant: string; eurAmount: number; ttlSeconds?: number; confirmations?: number; allowMainnet?: boolean; reference?: string; fillReference?: (bytes: Uint8Array) => void },
  open: readonly OpenRequest[],
  random: Random,
): Promise<LiveRequest> {
  guardChain(input.chain, input.allowMainnet ?? false)
  const baseAtomic = toAtomicEurc(input.eurAmount)
  const { head } = await reader.headBlock()
  const past = await reader.transfers({ chain: input.chain, token: 'EURC', merchant: input.merchant, fromBlock: Math.max(0, head - HISTORY_LOOKBACK_BLOCKS), toBlock: head })
  const tagged = createUnpredictableRequest(
    { orderId: input.orderId, chain: input.chain, token: 'EURC', merchant: input.merchant, baseAtomic },
    open,
    { random, history: past.logs.map((l) => l.value) },
  )
  const request: OpenRequest = { ...tagged, reference: input.reference ?? createReference(input.fillReference) }
  return { request, window: windowFrom(head, input.ttlSeconds), uri: paymentRequestLink(request), confirmations: input.confirmations ?? 12 }
}

/** Bind a transaction hash to this request's reference. The same hash cannot pay a different reference. */
export function bindLiveClaim(live: LiveRequest, txHash: string, otherClaims: readonly TxClaim[] = []): LiveRequest {
  if (!live.request.reference) throw new Error('This request has no payment reference')
  const claimedTxHash = normalizeTxHash(txHash)
  assertClaimFree(live.request.reference, claimedTxHash, otherClaims)
  return { ...live, claimedTxHash }
}

export function observationOf(state: PaymentState): Observation | undefined {
  return state.status === 'pending' || state.status === 'confirmed' ? state.seen : undefined
}

/** One poll. Pass the previous state so a disappearing transfer is reported as `reorged`, not silently as unpaid. */
export async function refreshLive(reader: ChainReader, live: LiveRequest, previous?: PaymentState, allowMainnet = false): Promise<PaymentState> {
  guardChain(live.request.chain, allowMainnet)
  const { head } = await reader.headBlock()
  const { finalized } = await reader.finalizedBlock()
  const read = live.claimedTxHash
    ? await reader.transfersInTransaction({ chain: live.request.chain, token: live.request.token, txHash: live.claimedTxHash })
    : await reader.transfers({ chain: live.request.chain, token: live.request.token, merchant: live.request.merchant, fromBlock: live.window.fromBlock, toBlock: head })
  const { logs } = read
  const prevObs = previous ? observationOf(previous) : undefined
  return evaluatePayment({ request: live.request, logs, head, window: live.window, confirmations: live.confirmations, finalized, previous: prevObs, claimedTxHash: live.claimedTxHash })
}

/** Plain-language line for a screen. Never says "paid by X": only that an amount arrived. */
export function describeState(state: PaymentState): string {
  switch (state.status) {
    case 'unpaid':
      if (state.claimMissed) return 'That transaction does not pay this reference (wrong amount, recipient, or not in the request window yet).'
      return state.expired ? 'Request expired without a matching transfer.' : 'Waiting: no matching transfer seen on chain yet.'
    case 'pending':
      return state.via === 'reference'
        ? `Transaction reference matched, ${state.confirmations} of ${state.needed} confirmations. Not final yet. It does not prove who paid.`
        : `Transfer seen, ${state.confirmations} of ${state.needed} confirmations. Not final yet.`
    case 'confirmed':
      if (state.via === 'reference') {
        return state.final
          ? 'Confirmed and final on chain by transaction reference. Someone sent this exact amount; it does not prove who.'
          : `Confirmed (${state.confirmations} blocks) by transaction reference, not yet final. Someone sent this exact amount; it does not prove who.`
      }
      return state.final ? 'Confirmed and final on chain. Someone sent this exact amount; it does not prove who.' : `Confirmed (${state.confirmations} blocks), not yet final. Someone sent this exact amount; it does not prove who.`
    case 'ambiguous': return `Ambiguous: ${state.txHashes.length} transfers match this amount. Paste the transaction hash for this payment reference. Do not treat as paid; check by hand.`
    case 'reorged': return 'The transfer we saw disappeared from the chain (reorg). Not paid until it is seen again.'
    case 'unknown': return 'The data source is behind what we saw before. No decision yet; try again.'
  }
}
