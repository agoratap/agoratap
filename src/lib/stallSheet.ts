// Printable market-stall sheet. The QR encodes an https pay-link for this merchant.
// EU copy prefers USDC, EURC, BTC and ETH. The sheet does not advertise other stablecoins.
// Base is not encoded in the link: it stays an optional rail, not the thing the buyer must hold.

export const STALL_INSTRUCTION_RO = 'Scanează și plătește cu ce crypto ai'
export const STALL_INSTRUCTION_EN = 'Scan and pay with any crypto you hold'
export const STALL_ASSET_LINE = 'Prefer USDC, EURC, BTC or ETH.'
export const STALL_ANY_IN = 'any-in → any-out'
export const STALL_ROUTE_LINE = `${STALL_ANY_IN}. You pay with crypto you hold. The merchant receives on the payout rail they prefer.`
export const STALL_BASE_LINE = 'Base is an optional rail only. You do not need to fund Base.'
export const STALL_PILOT_LINE = 'Early pilot — no live funds. Nothing to install.'

const NAME_MAX = 80

export function normalizeMerchantName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) throw new Error('Merchant name is required')
  if (trimmed.length > NAME_MAX) throw new Error('Merchant name is too long')
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error('Merchant name has invalid characters')
  return trimmed
}

/** https pay-link a phone can open. The fragment and any previous query are dropped so the QR is only this merchant. */
export function stallPayLink(merchantName: string, pageHref: string): string {
  const name = normalizeMerchantName(merchantName)
  let page: URL
  try {
    page = new URL(pageHref)
  } catch {
    throw new Error('Pay-link page address is not a URL')
  }
  if (page.protocol !== 'https:' && page.protocol !== 'http:') throw new Error('Pay-link must be an http(s) URL')
  page.hash = ''
  page.search = ''
  page.searchParams.set('pay', name)
  return page.toString()
}

export function merchantNameFromPayLink(payLink: string): string {
  let url: URL
  try {
    url = new URL(payLink)
  } catch {
    throw new Error('Pay-link is not a URL')
  }
  return merchantNameFromSearch(url.search)
}

export function merchantNameFromSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const name = params.get('pay')
  if (!name) throw new Error('Pay-link has no merchant name')
  return normalizeMerchantName(name)
}

export function stallRouteFromLocation(loc: { hash: string; search: string }): 'stall' | 'pay' | null {
  const hash = loc.hash.replace(/^#/, '')
  if (hash === 'stall') return 'stall'
  if (hash !== '') return null
  const pay = new URLSearchParams(loc.search.startsWith('?') ? loc.search.slice(1) : loc.search).get('pay')
  if (pay && pay.trim()) return 'pay'
  return null
}

/** Next address bar value when the screen changes. Stall is `#stall`. Leaving that screen, or a `?pay=` link, clears both. */
export function nextStallLocation(href: string, screen: 'stall' | 'pay' | 'other'): string {
  const url = new URL(href)
  if (screen === 'stall') {
    url.hash = 'stall'
    url.searchParams.delete('pay')
    return url.toString()
  }
  if (screen !== 'pay' && (url.hash === '#stall' || url.searchParams.has('pay'))) {
    url.hash = ''
    url.searchParams.delete('pay')
  }
  return url.toString()
}

export function browserPageHref(): string {
  if (typeof location === 'undefined') return 'https://agora-pay.example/agoratap/'
  return location.href
}

export function payMerchantFromLocation(): string {
  if (typeof location === 'undefined') return ''
  return new URLSearchParams(location.search).get('pay') ?? ''
}

export function initialStallScreen(): 'stall' | 'pay' | null {
  if (typeof location === 'undefined') return null
  return stallRouteFromLocation({ hash: location.hash, search: location.search })
}
