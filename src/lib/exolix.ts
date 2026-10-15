/**
 * Real, non-custodial swap orders via Exolix's public API (https://exolix.com/api/v2).
 * Keyless: rate, create-transaction and status endpoints work without an account,
 * and the API answers CORS for this origin. Agora Pay never holds funds or keys:
 * the payer sends to Exolix's deposit address, Exolix pays the merchant's address.
 */
export const EXOLIX_API = 'https://exolix.com/api/v2'

export interface Leg { coin: string; network: string }

/** Catalog id -> Exolix coin/network. */
export const PAY_IN_LEGS: Record<string, Leg> = {
  'eurc-base': { coin: 'EURC', network: 'BASE' }, 'eurc-eth': { coin: 'EURC', network: 'ETH' },
  'usdc-base': { coin: 'USDC', network: 'BASE' }, 'usdc-eth': { coin: 'USDC', network: 'ETH' },
  'usdc-sol': { coin: 'USDC', network: 'SOL' }, 'usdc-polygon': { coin: 'USDC', network: 'MATIC' },
  'usdc-arb': { coin: 'USDC', network: 'ARBITRUM' },
  btc: { coin: 'BTC', network: 'BTC' }, eth: { coin: 'ETH', network: 'ETH' }, xmr: { coin: 'XMR', network: 'XMR' },
  'usdt-tron': { coin: 'USDT', network: 'TRX' }, 'usdt-eth': { coin: 'USDT', network: 'ETH' },
  'usdt-sol': { coin: 'USDT', network: 'SOL' }, 'usdt-bsc': { coin: 'USDT', network: 'BSC' },
  'usdt-polygon': { coin: 'USDT', network: 'MATIC' },
  sol: { coin: 'SOL', network: 'SOL' }, ltc: { coin: 'LTC', network: 'LTC' }, trx: { coin: 'TRX', network: 'TRX' },
  doge: { coin: 'DOGE', network: 'DOGE' }, bnb: { coin: 'BNB', network: 'BSC' }, xrp: { coin: 'XRP', network: 'XRP' },
  ada: { coin: 'ADA', network: 'ADA' }, dai: { coin: 'DAI', network: 'ETH' },
}

export interface PayoutLeg extends Leg { id: string; label: string; euOk: boolean }
/** Merchant payout rails. EU: never USDT (ESMA) or XMR (AMLR). Exolix lists no EURC, so EU stablecoin payout is USDC. */
export const PAYOUT_LEGS: PayoutLeg[] = [
  { id: 'usdc-base', label: 'USDC · Base', coin: 'USDC', network: 'BASE', euOk: true },
  { id: 'usdc-eth', label: 'USDC · Ethereum', coin: 'USDC', network: 'ETH', euOk: true },
  { id: 'btc', label: 'BTC', coin: 'BTC', network: 'BTC', euOk: true },
  { id: 'eth', label: 'ETH', coin: 'ETH', network: 'ETH', euOk: true },
  { id: 'usdt-tron', label: 'USDT · Tron (non-EU only)', coin: 'USDT', network: 'TRX', euOk: false },
  { id: 'xmr', label: 'XMR (non-EU only)', coin: 'XMR', network: 'XMR', euOk: false },
]
export const payoutLegsFor = (merchantInEu: boolean) => PAYOUT_LEGS.filter((l) => l.euOk || !merchantInEu)

type Fetch = typeof fetch
const num = (v: unknown) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error('Bad number from swap API'); return n }

export interface LiveRate { rate: number; minAmount: number; maxAmount: number }

/** Live float rate: how many `to` units one `from` unit buys (after the route's fee). */
export async function liveRate(from: Leg, to: Leg, amount = 1, f: Fetch = fetch): Promise<LiveRate> {
  const q = new URLSearchParams({ coinFrom: from.coin, networkFrom: from.network, coinTo: to.coin, networkTo: to.network, amount: String(amount), rateType: 'float' })
  const res = await f(`${EXOLIX_API}/rate?${q}`)
  const body = await res.json() as Record<string, unknown>
  // Below the route minimum Exolix returns no rate; probe once at the minimum to learn the price.
  if (body.rate == null && !body.error && Number(body.minAmount) > amount) return liveRate(from, to, Number(body.minAmount) * 1.05, f)
  if (body.error || body.rate == null) throw new Error(String(body.error ?? body.message ?? 'No rate for this pair'))
  return { rate: num(body.rate), minAmount: num(body.minAmount ?? 0), maxAmount: body.maxAmount == null ? Infinity : num(body.maxAmount) }
}

/** Amount of `from` to send so the merchant gets about `payoutAmount` of `to` (2% slippage buffer for float). */
export function sendAmountFor(payoutAmount: number, rate: number, buffer = 0.02): number {
  if (!(rate > 0) || !(payoutAmount > 0)) throw new Error('Invalid amount or rate')
  return Math.ceil((payoutAmount / rate) * (1 + buffer) * 1e8) / 1e8
}

export interface SwapOrder {
  id: string
  depositAddress: string
  depositExtraId?: string
  amount: number
  coinFrom: string
  networkFrom: string
  amountTo: number
  coinTo: string
  withdrawalAddress: string
  status: string
}

const toOrder = (b: Record<string, any>): SwapOrder => ({
  id: String(b.id), depositAddress: String(b.depositAddress), depositExtraId: b.depositExtraId || undefined,
  amount: num(b.amount), coinFrom: String(b.coinFrom?.coinCode ?? b.coinFrom), networkFrom: String(b.coinFrom?.network ?? ''),
  amountTo: num(b.amountTo), coinTo: String(b.coinTo?.coinCode ?? b.coinTo), withdrawalAddress: String(b.withdrawalAddress), status: String(b.status),
})

/** Create a real swap order. No funds move until the payer sends to depositAddress. */
export async function createOrder(from: Leg, to: Leg, amount: number, withdrawalAddress: string, f: Fetch = fetch): Promise<SwapOrder> {
  if (!withdrawalAddress.trim()) throw new Error('Merchant payout address is required')
  const res = await f(`${EXOLIX_API}/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coinFrom: from.coin, networkFrom: from.network, coinTo: to.coin, networkTo: to.network, amount, withdrawalAddress: withdrawalAddress.trim(), rateType: 'float' }),
  })
  const body = await res.json() as Record<string, any>
  if (!res.ok || body.error || !body.depositAddress) throw new Error(String(body.error ?? body.message ?? `Swap API error ${res.status}`))
  return toOrder(body)
}

export async function orderStatus(id: string, f: Fetch = fetch): Promise<SwapOrder> {
  const res = await f(`${EXOLIX_API}/transactions/${encodeURIComponent(id)}`)
  const body = await res.json() as Record<string, any>
  if (!res.ok || body.error) throw new Error(String(body.error ?? `Swap API error ${res.status}`))
  return toOrder(body)
}

export const ORDER_DONE = ['success']
export const ORDER_FAILED = ['overdue', 'refunded', 'failed']
export const orderStatusLabel = (s: string) => ({ wait: 'Waiting for your deposit', confirmation: 'Deposit seen, confirming', confirmed: 'Confirmed, swapping', exchanging: 'Swapping', sending: 'Sending to merchant', success: 'Merchant paid', overdue: 'Expired, no deposit', refunded: 'Refunded', failed: 'Failed' } as Record<string, string>)[s] ?? s
