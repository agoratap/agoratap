/**
 * Any-asset catalog and INDICATIVE swap quotes.
 * Reference rates are hard-coded sample values (EUR per unit, set 15 Oct 2026 from Exolix live quotes), not live prices.
 * No network request, no funds, no partner account. Shape mirrors a
 * LibertySwap / FixedFloat-class float quote: rate, spread fee, network fee.
 */
export type AssetKind = 'crypto' | 'fiat'
export type PayoutAsset = 'EURC' | 'USDC' | 'BTC' | 'ETH' | 'EUR' | 'USDT' | 'XMR'

export interface CatalogAsset {
  id: string
  symbol: string
  name: string
  network?: string
  kind: AssetKind
  /** Sample EUR value of 1 unit. Indicative only. */
  eurRate: number
  /** Sample network fee in units of this asset. */
  networkFee: number
  /** Present in the on-device practice wallet (EURC/USDC). */
  practice?: boolean
}

const c = (id: string, symbol: string, name: string, network: string, eurRate: number, networkFee: number, practice = false): CatalogAsset =>
  ({ id, symbol, name, network, kind: 'crypto', eurRate, networkFee, practice })
const f = (symbol: string, name: string, eurRate: number): CatalogAsset =>
  ({ id: `fiat-${symbol.toLowerCase()}`, symbol, name, kind: 'fiat', eurRate, networkFee: 0 })

export const ASSET_CATALOG: CatalogAsset[] = [
  c('eurc-base', 'EURC', 'Euro stablecoin', 'Base', 1, 0, true),
  c('usdc-base', 'USDC', 'Dollar stablecoin', 'Base', 0.92, 0, true),
  c('usdc-eth', 'USDC', 'Dollar stablecoin', 'Ethereum', 0.92, 1.5),
  c('usdc-sol', 'USDC', 'Dollar stablecoin', 'Solana', 0.92, 0.01),
  c('usdc-polygon', 'USDC', 'Dollar stablecoin', 'Polygon', 0.92, 0.05),
  c('usdc-arb', 'USDC', 'Dollar stablecoin', 'Arbitrum', 0.92, 0.1),
  c('eurc-eth', 'EURC', 'Euro stablecoin', 'Ethereum', 1, 1.4),
  c('btc', 'BTC', 'Bitcoin', 'Bitcoin', 74000, 0.00002),
  c('eth', 'ETH', 'Ether', 'Ethereum', 2170, 0.0004),
  c('xmr', 'XMR', 'Monero', 'Monero', 495, 0.0001),
  c('usdt-tron', 'USDT', 'Tether', 'Tron (TRC-20)', 0.92, 1),
  c('usdt-eth', 'USDT', 'Tether', 'Ethereum (ERC-20)', 0.92, 1.5),
  c('usdt-sol', 'USDT', 'Tether', 'Solana', 0.92, 0.01),
  c('usdt-bsc', 'USDT', 'Tether', 'BNB Smart Chain', 0.92, 0.1),
  c('usdt-polygon', 'USDT', 'Tether', 'Polygon', 0.92, 0.05),
  c('sol', 'SOL', 'Solana', 'Solana', 93, 0.00001),
  c('ltc', 'LTC', 'Litecoin', 'Litecoin', 54, 0.0001),
  c('trx', 'TRX', 'TRON', 'Tron', 0.3, 1),
  c('doge', 'DOGE', 'Dogecoin', 'Dogecoin', 0.073, 1),
  c('bnb', 'BNB', 'BNB', 'BNB Smart Chain', 520, 0.0002),
  c('xrp', 'XRP', 'XRP', 'XRP Ledger', 0.5, 0.01),
  c('ada', 'ADA', 'Cardano', 'Cardano', 0.2, 0.2),
  c('dai', 'DAI', 'Dai', 'Ethereum', 0.92, 1.5),
  f('EUR', 'Euro', 1), f('USD', 'US dollar', 0.92), f('GBP', 'British pound', 1.17), f('JPY', 'Japanese yen', 0.0062),
  f('RON', 'Romanian leu', 0.2), f('CHF', 'Swiss franc', 1.05), f('PLN', 'Polish złoty', 0.23),
]

export const FIAT_COMING_LABEL = 'card/bank via partner — coming'
export const INDICATIVE_LABEL = 'Indicative quote · sample rates, not live prices · no funds move'
/** Spread a LibertySwap / FixedFloat-class float route might charge. Sample value. */
export const SWAP_SPREAD = 0.01

export function assetLabel(a: CatalogAsset): string {
  return a.network ? `${a.symbol} · ${a.network}` : a.symbol
}

export function searchAssets(query: string, catalog: CatalogAsset[] = ASSET_CATALOG): CatalogAsset[] {
  const q = query.trim().toLowerCase()
  if (!q) return catalog
  return catalog.filter((a) => [a.symbol, a.name, a.network ?? '', a.kind === 'fiat' ? 'fiat card bank' : 'crypto']
    .some((v) => v.toLowerCase().includes(q)))
}

/** Payout assets a merchant may choose. EU: never USDT (ESMA) or XMR (AMLR). */
export function allowedPayouts(merchantInEu: boolean): PayoutAsset[] {
  return merchantInEu ? ['EURC', 'USDC', 'BTC', 'ETH', 'EUR'] : ['EURC', 'USDC', 'BTC', 'ETH', 'EUR', 'USDT', 'XMR']
}

const PAYOUT_EUR: Record<PayoutAsset, number> = { EURC: 1, EUR: 1, USDC: 0.92, USDT: 0.92, BTC: 74000, ETH: 2170, XMR: 495 }

export interface IndicativeQuote {
  from: CatalogAsset
  payout: PayoutAsset
  eurAmount: number
  payoutAmount: number
  sendAmount: number
  spreadFee: number
  networkFee: number
  indicative: true
}

const round = (v: number, dp: number) => { const m = 10 ** dp; return Math.round((v + Number.EPSILON) * m) / m }
export const decimalsFor = (eurRate: number) => eurRate >= 1000 ? 8 : eurRate >= 10 ? 6 : 2

export function indicativeQuote(from: CatalogAsset, eurAmount: number, payout: PayoutAsset, merchantInEu = true): IndicativeQuote {
  if (from.kind !== 'crypto') throw new Error(`${from.symbol}: ${FIAT_COMING_LABEL}`)
  if (!Number.isFinite(eurAmount) || eurAmount <= 0) throw new Error('Amount must be greater than zero')
  if (!allowedPayouts(merchantInEu).includes(payout)) throw new Error(`${payout} is not an allowed EU merchant payout`)
  const sameAsset = from.symbol === payout
  const dp = decimalsFor(from.eurRate)
  const base = eurAmount / from.eurRate
  const spreadFee = sameAsset ? 0 : round(base * SWAP_SPREAD, dp)
  const sendAmount = round(base + spreadFee + from.networkFee, dp)
  return {
    from, payout, eurAmount: round(eurAmount, 2),
    payoutAmount: round(eurAmount / PAYOUT_EUR[payout], decimalsFor(PAYOUT_EUR[payout])),
    sendAmount, spreadFee, networkFee: from.networkFee, indicative: true,
  }
}
