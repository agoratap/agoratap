// Address screening against a STATIC snapshot of the public OFAC SDN digital-currency list.
// Pure functions, no network access: the snapshot (src/data/ofacAddresses.json) is refreshed offline
// with scripts/update-ofac.mjs and committed. WARN ONLY: nothing here blocks anything; the merchant decides.
import snapshot from '../data/ofacAddresses.json'

export interface OfacList {
  readonly source: string
  readonly downloadedAt: string
  readonly count: number
  /** normalised address -> chain label(s) as written by OFAC, e.g. "ETH/USDT" */
  readonly addresses: Readonly<Record<string, string>>
}

export const OFAC_LIST: OfacList = snapshot as OfacList

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
  if (!list || Object.keys(list.addresses).length === 0) {
    return { status: 'list-not-loaded', message: 'Sanctions list not loaded: this address was NOT checked.' }
  }
  const chain = Object.prototype.hasOwnProperty.call(list.addresses, normalized) ? list.addresses[normalized] : undefined
  if (chain !== undefined) {
    return {
      status: 'listed',
      chain,
      message: `Warning: this address appears on the public OFAC sanctions list (${chain}, snapshot ${list.downloadedAt}). You decide whether to accept it. Consider legal advice.`,
    }
  }
  return {
    status: 'not-listed',
    message: `Not on the OFAC snapshot of ${list.downloadedAt} (${list.count} addresses). The snapshot may be incomplete or outdated; this is not a statement that the address is lawful or safe.`,
  }
}
