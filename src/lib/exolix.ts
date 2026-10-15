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

export interface PayoutLeg extends Leg { id: string; label: string; name: string }

const legId = (l: Leg) => `${l.coin}-${l.network}`.toLowerCase()
const NET_NAMES: Record<string, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BASE: 'Base', TRX: 'Tron', BSC: 'BNB Smart Chain', MATIC: 'Polygon', ARBITRUM: 'Arbitrum', XMR: 'Monero', LTC: 'Litecoin', DOGE: 'Dogecoin', ADA: 'Cardano', XRP: 'XRP Ledger' }
const mkLeg = (coin: string, network: string, name = coin, netName = NET_NAMES[network] ?? network): PayoutLeg =>
  ({ id: legId({ coin, network }), coin, network, name, label: coin === network || NET_NAMES[coin] === netName ? coin : `${coin} · ${netName}` })

/** Built-in payout rails (works offline); the full Exolix list is merged in at runtime by fetchPayoutCurrencies. */
export const SEED_PAYOUT_LEGS: PayoutLeg[] = [
  mkLeg('USDC', 'SOL', 'USD Coin'), mkLeg('USDC', 'BASE', 'USD Coin'), mkLeg('USDC', 'ETH', 'USD Coin'), mkLeg('USDC', 'MATIC', 'USD Coin'), mkLeg('USDC', 'ARBITRUM', 'USD Coin'),
  mkLeg('BTC', 'BTC', 'Bitcoin'), mkLeg('ETH', 'ETH', 'Ether'), mkLeg('ETH', 'BASE', 'Ether'), mkLeg('ETH', 'ARBITRUM', 'Ether'), mkLeg('SOL', 'SOL', 'Solana'),
  mkLeg('LTC', 'LTC', 'Litecoin'), mkLeg('DOGE', 'DOGE', 'Dogecoin'), mkLeg('TRX', 'TRX', 'TRON'), mkLeg('ADA', 'ADA', 'Cardano'),
  mkLeg('USDT', 'TRX', 'Tether'), mkLeg('USDT', 'ETH', 'Tether'), mkLeg('USDT', 'SOL', 'Tether'), mkLeg('USDT', 'BSC', 'Tether'), mkLeg('XMR', 'XMR', 'Monero'),
]

/** Merge payout legs, de-duplicated by coin+network. */
export function mergeLegs(...lists: PayoutLeg[][]): PayoutLeg[] {
  const seen = new Map<string, PayoutLeg>()
  for (const l of lists.flat()) if (!seen.has(l.id)) seen.set(l.id, l)
  return [...seen.values()]
}

export function searchLegs(legs: PayoutLeg[], query: string): PayoutLeg[] {
  const q = query.trim().toLowerCase()
  if (!q) return legs
  return legs.filter((l) => [l.coin, l.network, l.name, l.label].some((v) => v.toLowerCase().includes(q)))
}

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
/** Every coin/network Exolix supports (keyless, paginated). */
export async function fetchPayoutCurrencies(f: Fetch = fetch, pageSize = 100, maxPages = 10): Promise<PayoutLeg[]> {
  const out: PayoutLeg[] = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await f(`${EXOLIX_API}/currencies?withNetworks=true&page=${page}&size=${pageSize}`)
    const body = await res.json() as { data?: { code: string; name: string; networks?: { network: string; name: string }[] }[]; count?: number }
    for (const c of body.data ?? []) for (const n of c.networks ?? []) out.push(mkLeg(c.code, n.network, c.name, n.name))
    if (!body.data || body.data.length < pageSize || page * pageSize >= (body.count ?? 0)) break
  }
  return out
}

export const STABLE_USD = ['USDC', 'USDT', 'DAI', 'USDE', 'FDUSD', 'TUSD', 'PYUSD', 'USDP']
/** Reference EUR→USD used to size USD-priced payouts. Indicative. */
export const EUR_USD = 1.087

/** USD price of one unit of `leg`, from a live Exolix route into USDC on Ethereum. */
export async function usdPrice(leg: Leg, f: Fetch = fetch): Promise<number> {
  if (STABLE_USD.includes(leg.coin.toUpperCase())) return 1
  return (await liveRate(leg, { coin: 'USDC', network: 'ETH' }, 1, f)).rate
}

/** EUR invoice -> exact amount of the payout asset the merchant should receive. */
export function payoutAmountFor(eurAmount: number, payoutUsdPrice: number): number {
  if (!(eurAmount > 0) || !(payoutUsdPrice > 0)) throw new Error('Invalid amount or price')
  return Math.round((eurAmount * EUR_USD / payoutUsdPrice) * 1e8) / 1e8
}

export interface FixedQuote { fromAmount: number; toAmount: number; minAmount: number; withdrawMin: number; belowMin: boolean }

/** Exolix fixed-rate reverse quote: how much `from` to send so the merchant receives exactly `withdrawalAmount`. */
export async function fixedQuote(from: Leg, to: Leg, withdrawalAmount: number, f: Fetch = fetch): Promise<FixedQuote> {
  const q = new URLSearchParams({ coinFrom: from.coin, networkFrom: from.network, coinTo: to.coin, networkTo: to.network, withdrawalAmount: String(withdrawalAmount), rateType: 'fixed' })
  const res = await f(`${EXOLIX_API}/rate?${q}`)
  const body = await res.json() as Record<string, unknown>
  if (body.error || body.fromAmount == null) throw new Error(String(body.error ?? body.message ?? 'No fixed quote for this pair'))
  const fromAmount = num(body.fromAmount)
  const minAmount = num(body.minAmount ?? 0)
  const withdrawMin = num(body.withdrawMin ?? 0)
  return { fromAmount, toAmount: withdrawalAmount, minAmount, withdrawMin, belowMin: fromAmount < minAmount || withdrawalAmount < withdrawMin }
}

/** Fixed-rate order: the merchant receives exactly `withdrawalAmount` of `to`. */
export async function createFixedOrder(from: Leg, to: Leg, withdrawalAmount: number, withdrawalAddress: string, f: Fetch = fetch): Promise<SwapOrder> {
  if (!withdrawalAddress.trim()) throw new Error('Merchant payout address is required')
  const res = await f(`${EXOLIX_API}/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coinFrom: from.coin, networkFrom: from.network, coinTo: to.coin, networkTo: to.network, withdrawalAmount, withdrawalAddress: withdrawalAddress.trim(), rateType: 'fixed' }),
  })
  const body = await res.json() as Record<string, any>
  if (!res.ok || body.error || !body.depositAddress) throw new Error(String(body.error ?? body.message ?? `Swap API error ${res.status}`))
  return toOrder(body)
}

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
