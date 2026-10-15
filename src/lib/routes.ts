/**
 * Route selection for a pay-in leg -> merchant payout leg. All providers are keyless and need no account.
 *  - direct:  payer asset == payout asset on the same chain. Plain transfer to the merchant; no swap, no minimum.
 *  - maya:    MAYAChain native swap (public mayanode). Low minimums; payer wallet must attach the memo.
 *  - thor:    THORChain native swap (public Liquify thornode gateway). Low minimums; payer wallet must attach the memo.
 *  - exolix:  custodial-swap service with deposit address (no memo), minimum ~ $48 per order.
 * Routes are tried in parallel and ordered by lowest minimum (USD).
 */
import { fixedQuote, liveRate, type Leg } from './exolix'

export type RouteId = 'direct' | 'maya' | 'thor' | 'exolix'
export const THOR_API = 'https://gateway.liquify.com/chain/thorchain_api/thorchain'
export const MAYA_API = 'https://mayanode.mayachain.info/mayachain'

const key = (l: Leg) => `${l.coin}/${l.network}`.toUpperCase()

export const THOR_ASSETS: Record<string, string> = {
  'BTC/BTC': 'BTC.BTC', 'ETH/ETH': 'ETH.ETH', 'ETH/BASE': 'BASE.ETH', 'LTC/LTC': 'LTC.LTC', 'DOGE/DOGE': 'DOGE.DOGE', 'BCH/BCH': 'BCH.BCH',
  'SOL/SOL': 'SOL.SOL', 'XRP/XRP': 'XRP.XRP', 'TRX/TRX': 'TRON.TRX', 'BNB/BSC': 'BSC.BNB', 'AVAX/AVAXC': 'AVAX.AVAX', 'ATOM/ATOM': 'GAIA.ATOM', 'ZEC/ZEC': 'ZEC.ZEC',
  'USDC/ETH': 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48', 'USDC/BASE': 'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',
  'USDC/BSC': 'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D', 'USDC/AVAXC': 'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
  'USDT/ETH': 'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7', 'USDT/BSC': 'BSC.USDT-0X55D398326F99059FF775485246999027B3197955',
  'USDT/TRX': 'TRON.USDT-TR7NHQJEKQXGTCI8Q8ZY4PL8OTSZGJLJ6T', 'DAI/ETH': 'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F',
}
export const MAYA_ASSETS: Record<string, string> = {
  'BTC/BTC': 'BTC.BTC', 'ETH/ETH': 'ETH.ETH', 'ETH/ARBITRUM': 'ARB.ETH', 'DASH/DASH': 'DASH.DASH', 'ZEC/ZEC': 'ZEC.ZEC', 'ADA/ADA': 'ADA.ADA',
  'USDC/ARBITRUM': 'ARB.USDC-0XAF88D065E77C8CC2239327C5EDB3A432268E5831', 'USDT/ARBITRUM': 'ARB.USDT-0XFD086BC7CD5C481DCC9C85EBE478A1C0B69FCBB9',
  'USDC/ETH': 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48', 'USDT/ETH': 'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
}

export interface RouteQuote {
  route: RouteId
  label: string
  /** Amount of the pay-in asset to send. */
  sendAmount: number
  /** Amount the merchant should receive (expected for native swaps, exact for direct/exolix fixed). */
  receiveAmount: number
  /** Route minimum in pay-in units, and in USD. */
  minIn: number
  minUsd: number
  ok: boolean
  note: string
  /** Present when a destination address was given. */
  depositAddress?: string
  memo?: string
  expiry?: number
}

type Fetch = typeof fetch
const ROUTE_LABEL: Record<RouteId, string> = { direct: 'Direct transfer', maya: 'MAYAChain', thor: 'THORChain', exolix: 'Exolix' }
export const sameLeg = (a: Leg, b: Leg) => key(a) === key(b)

export function directQuote(from: Leg, to: Leg, receive: number, destination = ''): RouteQuote | null {
  if (!sameLeg(from, to)) return null
  return { route: 'direct', label: ROUTE_LABEL.direct, sendAmount: receive, receiveAmount: receive, minIn: 0, minUsd: 0, ok: true, note: 'Same asset and chain: pay the merchant address directly. No swap, no minimum, no middleman.', depositAddress: destination || undefined }
}

/** THOR/Maya quote. Forward: `sendAmount` of the pay-in asset. Amounts use 1e8 base units on both chains. */
export async function nativeQuote(route: 'thor' | 'maya', from: Leg, to: Leg, sendAmount: number, fromUsd: number, destination = '', f: Fetch = fetch): Promise<RouteQuote | null> {
  const table = route === 'thor' ? THOR_ASSETS : MAYA_ASSETS
  const a = table[key(from)], b = table[key(to)]
  if (!a || !b || a === b) return null
  const q = new URLSearchParams({ from_asset: a, to_asset: b, amount: String(Math.round(sendAmount * 1e8)) })
  if (destination) q.set('destination', destination)
  const res = await f(`${route === 'thor' ? THOR_API : MAYA_API}/quote/swap?${q}`)
  const body = await res.json() as Record<string, any>
  if (body.error || body.message || body.expected_amount_out == null) {
    const msg = String(body.error ?? body.message ?? 'no quote')
    const m = /recommended_min_amount_in[^0-9]*([0-9]+)/.exec(msg) ?? /less than[^0-9]*([0-9]+)/.exec(msg)
    const minIn = m ? Number(m[1]) / 1e8 : Infinity
    return { route, label: ROUTE_LABEL[route], sendAmount, receiveAmount: 0, minIn, minUsd: minIn * fromUsd, ok: false, note: msg.slice(0, 160) }
  }
  const minIn = Number(body.recommended_min_amount_in ?? 0) / 1e8
  const ok = sendAmount >= minIn
  return {
    route, label: ROUTE_LABEL[route], sendAmount, receiveAmount: Number(body.expected_amount_out) / 1e8, minIn, minUsd: minIn * fromUsd, ok,
    note: ok ? 'Native swap. Your wallet must send with the memo shown; without it funds can be lost.' : `Below route minimum ${minIn}`,
    depositAddress: body.inbound_address, memo: body.memo, expiry: body.expiry,
  }
}

export async function exolixQuote(from: Leg, to: Leg, receive: number, fromUsd: number, f: Fetch = fetch): Promise<RouteQuote> {
  try {
    const q = await fixedQuote(from, to, receive, f)
    return { route: 'exolix', label: ROUTE_LABEL.exolix, sendAmount: q.fromAmount, receiveAmount: receive, minIn: q.minAmount, minUsd: q.minAmount * fromUsd, ok: !q.belowMin, note: q.belowMin ? `Below Exolix minimum ${q.minAmount}` : 'Deposit address, no memo needed. Exact amount to merchant.' }
  } catch (e) {
    return { route: 'exolix', label: ROUTE_LABEL.exolix, sendAmount: 0, receiveAmount: 0, minIn: Infinity, minUsd: Infinity, ok: false, note: (e as Error).message }
  }
}

/** Order: usable routes first, then by lowest minimum (USD). */
export const rankRoutes = (qs: (RouteQuote | null)[]) => (qs.filter(Boolean) as RouteQuote[])
  .sort((x, y) => Number(y.ok) - Number(x.ok) || x.minUsd - y.minUsd)

export interface QuoteInput { from: Leg; to: Leg; receive: number; fromUsd: number; toUsd: number; destination?: string }

/** All routes for one payment, ranked. `receive` is the payout amount the merchant should get. */
export async function quoteAllRoutes({ from, to, receive, fromUsd, toUsd, destination = '' }: QuoteInput, f: Fetch = fetch): Promise<RouteQuote[]> {
  const direct = directQuote(from, to, receive, destination)
  if (direct) return [direct]
  // Native swaps are forward-quoted: size the input from USD prices plus a 3% fee buffer.
  const sendEst = Math.ceil((receive * toUsd / fromUsd) * 1.03 * 1e8) / 1e8
  const settled = await Promise.allSettled([
    nativeQuote('maya', from, to, sendEst, fromUsd, destination, f),
    nativeQuote('thor', from, to, sendEst, fromUsd, destination, f),
    exolixQuote(from, to, receive, fromUsd, f),
  ])
  return rankRoutes(settled.map((s) => s.status === 'fulfilled' ? s.value : null))
}

export { liveRate }
