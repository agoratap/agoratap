// MATCHING DESIGN DECISION (2026-10-03), from the real-chain probe in docs/evidence/:
//   A plain ERC-20 transfer carries no order reference, and 771 recipient+amount pairs repeated in 24 h on real EURC traffic.
//   So exact amount can never prove WHO paid, only that an amount arrived. We keep "tag in the amount" (no contract, no custody,
//   no server) but harden it:
//   1. the tag is drawn at RANDOM from the free tags (the smallest-free tag is guessable: order #1 is always base+1);
//   2. amounts that already hit this merchant recently (on-chain history) are excluded from the draw;
//   3. a payment only counts inside the request's block window (see confirmation.ts);
//   4. two matching transfers are always `ambiguous`, never "paid";
//   5. the transfer's own transaction hash is the on-chain id. Binding it to a stable payment reference is built
//      (reference.ts). EIP-3009 and a router contract are not: docs/MATCHING_DESIGN.md.
// Pure functions. The random source is injected so the tests are deterministic.
import { MAX_TAG, isAddress, type ChainName, type OpenRequest, type TokenSymbol } from './chainRequest'

export type Random = () => number // uniform in [0, 1)

export const secureRandom: Random = () => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] / 2 ** 32
}

export interface TagContext {
  readonly random: Random
  /** Atomic amounts already received by this merchant for this token in the lookback window (taken from chain logs). */
  readonly history?: readonly bigint[]
}

export function createUnpredictableRequest(
  input: { orderId: string; chain: ChainName; token?: TokenSymbol; merchant: string; baseAtomic: bigint },
  open: readonly OpenRequest[],
  ctx: TagContext,
): OpenRequest {
  if (!isAddress(input.merchant)) throw new Error('Merchant address is not a valid 0x address')
  if (input.baseAtomic <= 0n) throw new Error('Amount must be greater than zero')
  const token: TokenSymbol = input.token ?? 'EURC'
  const taken = new Set<bigint>(ctx.history ?? [])
  for (const r of open) {
    if (r.chain === input.chain && r.token === token && r.merchant.toLowerCase() === input.merchant.toLowerCase()) taken.add(r.atomic)
  }
  const free: number[] = []
  for (let tag = 1; tag <= MAX_TAG; tag++) if (!taken.has(input.baseAtomic + BigInt(tag))) free.push(tag)
  if (free.length === 0) throw new Error('No free tag at this amount; close some requests or wait for older payments to age out')
  const r = ctx.random()
  if (!Number.isFinite(r) || r < 0 || r >= 1) throw new Error('Random source must return a number in [0, 1)')
  const tag = free[Math.floor(r * free.length)]
  return { ...input, token, atomic: input.baseAtomic + BigInt(tag), tag }
}
