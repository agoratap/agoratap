// Address screening against STATIC snapshots of public sanctions lists:
// - OFAC SDN digital-currency addresses (src/data/ofacAddresses.json, scripts/update-ofac.mjs)
// - blockchain wallet addresses written in the EU consolidated financial sanctions list
//   (src/data/euSanctionsAddresses.json, scripts/update-eu-sanctions.mjs). Addresses only; EU names/entities are not screened.
// Pure functions, no network access: snapshots are refreshed offline and committed. WARN ONLY: nothing here blocks anything; the merchant decides.
import snapshot from '../data/ofacAddresses.json'
import euSnapshot from '../data/euSanctionsAddresses.json'

export interface OfacList {
  /** Who publishes the list, used in messages. Defaults to OFAC when absent. */
  readonly authority?: string
  readonly source: string
  readonly downloadedAt: string
  readonly count: number
  /** normalised address -> chain label(s) as written by OFAC, e.g. "ETH/USDT" */
  readonly addresses: Readonly<Record<string, string>>
}

export const OFAC_LIST: OfacList = { authority: 'OFAC', ...(snapshot as OfacList) }
/** EU consolidated financial sanctions list: only the wallet addresses the EU writes in its remark text. */
export const EU_LIST: OfacList = euSnapshot as OfacList
export const DEFAULT_LISTS: readonly OfacList[] = [OFAC_LIST, EU_LIST]

export type ScreenResult =
  | { status: 'empty'; message: string }
  | { status: 'list-not-loaded'; message: string }
  | { status: 'listed'; chain: string; message: string }
  | { status: 'not-listed'; message: string }

/** EVM (0x) and bech32 (bc1/ltc1) are case-insensitive; base58 and others are case-sensitive. Must match scripts/update-ofac.mjs. */
export function normalizeAddress(address: string): string {
  const a = String(address ?? '').trim()
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return a.toLowerCase()
  if (/^(bc1|ltc1)/i.test(a)) return a.toLowerCase()
  return a
}

export function screenAddress(address: string, list: OfacList = OFAC_LIST): ScreenResult {
  const normalized = normalizeAddress(address)
  if (!normalized) return { status: 'empty', message: '' }
  const who = list?.authority ?? 'OFAC'
  if (!list || Object.keys(list.addresses).length === 0) {
    const name = list?.authority ? `${list.authority} sanctions list` : 'Sanctions list'
    return { status: 'list-not-loaded', message: `${name} not loaded: this address was NOT checked.` }
  }
  const chain = Object.prototype.hasOwnProperty.call(list.addresses, normalized) ? list.addresses[normalized] : undefined
  if (chain !== undefined) {
    return {
      status: 'listed',
      chain,
      message: `Warning: this address appears on the public ${who} sanctions list (${chain}, snapshot ${list.downloadedAt}). You decide whether to accept it. Consider legal advice.`,
    }
  }
  return {
    status: 'not-listed',
    message: `Not on the ${who} snapshot of ${list.downloadedAt} (${list.count} addresses). The snapshot may be incomplete or outdated; this is not a statement that the address is lawful or safe.`,
  }
}

/**
 * Screens one address against several lists (default: OFAC + EU) and folds the results into one.
 * Any hit -> listed (every hit is named). Any list missing -> list-not-loaded (never reads as clean).
 * Otherwise not-listed, naming each snapshot.
 */
export function screenAddressAll(address: string, lists: readonly OfacList[] = DEFAULT_LISTS): ScreenResult {
  if (!normalizeAddress(address)) return { status: 'empty', message: '' }
  if (lists.length === 0) return { status: 'list-not-loaded', message: 'Sanctions list not loaded: this address was NOT checked.' }
  const results = lists.map((list) => screenAddress(address, list))
  const listed = results.filter((r): r is Extract<ScreenResult, { status: 'listed' }> => r.status === 'listed')
  if (listed.length > 0) {
    return { status: 'listed', chain: listed.map((r) => r.chain).join(', '), message: listed.map((r) => r.message).join(' ') }
  }
  if (results.some((r) => r.status === 'list-not-loaded')) {
    return { status: 'list-not-loaded', message: results.map((r) => r.message).join(' ') }
  }
  return { status: 'not-listed', message: results.map((r) => r.message).join(' ') }
}
