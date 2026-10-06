// Live (testnet, read-only) orchestration: open a request at the current chain head, then poll the chain for it.
// No key, no signing, no custody. Network comes only through the injected reader. Base MAINNET is refused unless
// the caller explicitly sets allowMainnet (the app screens never do: this stage is Base Sepolia only, no real funds).
import { eip681Uri, toAtomicEurc, type ChainName, type OpenRequest } from './chainRequest'
import type { ChainReader } from './chainReader'
import { evaluatePayment, windowFrom, type Observation, type PaymentState, type RequestWindow } from './confirmation'
import { createUnpredictableRequest, type Random } from './tagging'

/** How far back we look at what the merchant already received, to avoid reusing an amount. 43,200 blocks is about 24 h on Base. */
export const HISTORY_LOOKBACK_BLOCKS = 43_200

export interface LiveRequest {
  readonly request: OpenRequest
  readonly window: RequestWindow
  readonly uri: string
  readonly confirmations: number
}

function guardChain(chain: ChainName, allowMainnet: boolean) {
  if (chain === 'base' && !allowMainnet) throw new Error('Mainnet is disabled at this stage: use Base Sepolia (test funds only)')
}

export async function openLiveRequest(
  reader: ChainReader,
  input: { orderId: string; chain: ChainName; merchant: string; eurAmount: number; ttlSeconds?: number; confirmations?: number; allowMainnet?: boolean },
  open: readonly OpenRequest[],
  random: Random,
): Promise<LiveRequest> {
  guardChain(input.chain, input.allowMainnet ?? false)
  const baseAtomic = toAtomicEurc(input.eurAmount)
  const { head } = await reader.headBlock()
  const past = await reader.transfers({ chain: input.chain, token: 'EURC', merchant: input.merchant, fromBlock: Math.max(0, head - HISTORY_LOOKBACK_BLOCKS), toBlock: head })
  const request = createUnpredictableRequest(
    { orderId: input.orderId, chain: input.chain, token: 'EURC', merchant: input.merchant, baseAtomic },
    open,
    { random, history: past.logs.map((l) => l.value) },
  )
  return { request, window: windowFrom(head, input.ttlSeconds), uri: eip681Uri(request), confirmations: input.confirmations ?? 12 }
}

export function observationOf(state: PaymentState): Observation | undefined {
  return state.status === 'pending' || state.status === 'confirmed' ? state.seen : undefined
}

/** One poll. Pass the previous state so a disappearing transfer is reported as `reorged`, not silently as unpaid. */
export async function refreshLive(reader: ChainReader, live: LiveRequest, previous?: PaymentState, allowMainnet = false): Promise<PaymentState> {
  guardChain(live.request.chain, allowMainnet)
  const { head } = await reader.headBlock()
  const { finalized } = await reader.finalizedBlock()
  const { logs } = await reader.transfers({ chain: live.request.chain, token: live.request.token, merchant: live.request.merchant, fromBlock: live.window.fromBlock, toBlock: head })
  const prevObs = previous ? observationOf(previous) : undefined
  return evaluatePayment({ request: live.request, logs, head, window: live.window, confirmations: live.confirmations, finalized, previous: prevObs })
}

/** Plain-language line for a screen. Never says "paid by X": only that an amount arrived. */
export function describeState(state: PaymentState): string {
  switch (state.status) {
    case 'unpaid': return state.expired ? 'Request expired without a matching transfer.' : 'Waiting: no matching transfer seen on chain yet.'
    case 'pending': return `Transfer seen, ${state.confirmations} of ${state.needed} confirmations. Not final yet.`
    case 'confirmed': return state.final ? 'Confirmed and final on chain. Someone sent this exact amount; it does not prove who.' : `Confirmed (${state.confirmations} blocks), not yet final. Someone sent this exact amount; it does not prove who.`
    case 'ambiguous': return `Ambiguous: ${state.txHashes.length} transfers match this amount. Do not treat as paid; check by hand.`
    case 'reorged': return 'The transfer we saw disappeared from the chain (reorg). Not paid until it is seen again.'
    case 'unknown': return 'The data source is behind what we saw before. No decision yet; try again.'
  }
}
