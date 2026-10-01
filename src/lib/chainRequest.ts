// Non-custodial payment request for EURC (default, = euro) or USDC on Base (EIP-681). The payer's own wallet sends; we never relay. No keys, no funds, no network calls here.
// A plain ERC-20 transfer carries no order reference, so each open request gets a UNIQUE amount:
// the base amount plus 1..MAX_TAG micro-USDC (<= 0.01 USDC overpay). Matching is by exact amount.

export const CHAINS = {
  base: { id: 8453, tokens: { USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', EURC: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42' } },
  baseSepolia: { id: 84532, tokens: { USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', EURC: '0x808456652fdb597867f38412077A9182bf77359F' } },
} as const
export type ChainName = keyof typeof CHAINS
export type TokenSymbol = 'USDC' | 'EURC'

export const USDC_DECIMALS = 6
export const MAX_TAG = 9999 // micro-USDC, i.e. at most 0.009999 USDC extra

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

export function isAddress(value: string): boolean {
  return ADDRESS.test(value)
}

/** EURC amount in atomic units (6 decimals): 1 EURC = 1 EUR, no rate needed. Merchant receives euro value. */
export function toAtomicEurc(eurAmount: number): bigint {
  if (!Number.isFinite(eurAmount) || eurAmount <= 0) throw new Error('Amount must be greater than zero')
  return BigInt(Math.round(eurAmount * 10 ** USDC_DECIMALS))
}

/** USDC amount in atomic units (6 decimals) for a EUR price. eurUsd = USD per 1 EUR; USDC assumed = 1 USD. */
export function toAtomicUsdc(eurAmount: number, eurUsd: number): bigint {
  if (!Number.isFinite(eurAmount) || eurAmount <= 0) throw new Error('Amount must be greater than zero')
  if (!Number.isFinite(eurUsd) || eurUsd <= 0) throw new Error('Rate must be greater than zero')
  return BigInt(Math.round(eurAmount * eurUsd * 10 ** USDC_DECIMALS))
}

export interface OpenRequest {
  readonly orderId: string
  readonly chain: ChainName
  readonly token: TokenSymbol
  readonly merchant: string
  readonly atomic: bigint // exact amount the payer must send, tag included
  readonly baseAtomic: bigint
  readonly tag: number
}

/** Pick the smallest tag (1..MAX_TAG) that keeps the final amount unique among open requests. */
export function createRequest(
  input: { orderId: string; chain: ChainName; token?: TokenSymbol; merchant: string; baseAtomic: bigint },
  open: readonly OpenRequest[],
): OpenRequest {
  if (!isAddress(input.merchant)) throw new Error('Merchant address is not a valid 0x address')
  if (input.baseAtomic <= 0n) throw new Error('Amount must be greater than zero')
  const token: TokenSymbol = input.token ?? 'EURC'
  const taken = new Set(open.filter((r) => r.chain === input.chain && r.token === token && r.merchant.toLowerCase() === input.merchant.toLowerCase()).map((r) => r.atomic))
  for (let tag = 1; tag <= MAX_TAG; tag++) {
    const atomic = input.baseAtomic + BigInt(tag)
    if (!taken.has(atomic)) return { ...input, token, atomic, tag }
  }
  throw new Error('Too many open requests at this amount; close some first')
}

export function formatUsdc(atomic: bigint): string {
  const s = atomic.toString().padStart(USDC_DECIMALS + 1, '0')
  return `${s.slice(0, -USDC_DECIMALS)}.${s.slice(-USDC_DECIMALS)}`
}

/** EIP-681 ERC-20 transfer request URI. Wallet support varies: always show address+amount as fallback. */
export function eip681Uri(req: OpenRequest): string {
  const c = CHAINS[req.chain]
  return `ethereum:${c.tokens[req.token]}@${c.id}/transfer?address=${req.merchant}&uint256=${req.atomic.toString()}`
}

export interface TransferLog {
  readonly to: string
  readonly value: bigint
  readonly txHash: string
  readonly blockNumber: number
}

export type MatchResult =
  | { status: 'matched'; txHash: string; blockNumber: number }
  | { status: 'ambiguous'; txHashes: string[] }
  | { status: 'unpaid' }

/** Match chain Transfer logs (already filtered to the USDC contract) to one open request by exact amount + recipient. */
export function matchRequest(req: OpenRequest, logs: readonly TransferLog[]): MatchResult {
  const hits = logs.filter((l) => l.to.toLowerCase() === req.merchant.toLowerCase() && l.value === req.atomic)
  if (hits.length === 0) return { status: 'unpaid' }
  if (hits.length > 1) return { status: 'ambiguous', txHashes: hits.map((h) => h.txHash) }
  return { status: 'matched', txHash: hits[0].txHash, blockNumber: hits[0].blockNumber }
}
