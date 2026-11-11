// Address and name screening against STATIC snapshots of public sanctions lists:
// - OFAC SDN digital-currency addresses (src/data/ofacAddresses.json, scripts/update-ofac.mjs). Addresses only.
// - blockchain wallet addresses written in the EU consolidated financial sanctions list
//   (src/data/euSanctionsAddresses.json, scripts/update-eu-sanctions.mjs), plus the names of those EU entries that publish wallet addresses. The rest of the EU name list is not in this snapshot.
// - crypto addresses written in the UK Sanctions List (FCDO; includes UN designations the UK implements)
//   (src/data/ukSanctionsAddresses.json, scripts/update-uk-sanctions.mjs), plus the names of those UK entries that publish wallet addresses. The rest of the UK name list is not in this snapshot.
// Pure functions, no network access: snapshots are refreshed offline and committed. WARN ONLY: nothing here blocks anything; the merchant decides.
import snapshot from '../data/ofacAddresses.json'
import euSnapshot from '../data/euSanctionsAddresses.json'
import ukSnapshot from '../data/ukSanctionsAddresses.json'

export interface OfacList {
  /** Who publishes the list, used in messages. Defaults to OFAC when absent. */
  readonly authority?: string
  readonly source: string
  readonly downloadedAt: string
  readonly count: number
  /** normalised address -> chain label(s) as written by OFAC, e.g. "ETH/USDT" */
  readonly addresses: Readonly<Record<string, string>>
  /** list reference -> display name, for entries that publish wallet addresses (EU/UK). */
  readonly entities?: Readonly<Record<string, string>>
  /** optional normalised name -> display name; when absent, names are taken from entities. */
  readonly names?: Readonly<Record<string, string>>
}

export const OFAC_LIST: OfacList = { authority: 'OFAC', ...(snapshot as OfacList) }
/** EU consolidated financial sanctions list: only the wallet addresses the EU writes in its remark text. */
export const EU_LIST: OfacList = euSnapshot as OfacList
/** UK Sanctions List (FCDO): only the crypto addresses the UK writes in its free text. */
export const UK_LIST: OfacList = ukSnapshot as OfacList
export const DEFAULT_LISTS: readonly OfacList[] = [OFAC_LIST, EU_LIST, UK_LIST]

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
 * Screens one address against several lists (default: OFAC + EU + UK) and folds the results into one.
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

const NAME_STOP = new Set(['limited', 'company', 'group', 'exchange', 'europe', 'llc', 'ltd', 'ou', 'inc', 'the', 'and', 'of', 'co', 'uab', 'oy', 'ag', 'sa', 'gmbh'])

/** Lowercase, strip marks and punctuation, collapse whitespace. Used only for name screening. */
export function normalizeName(name: string): string {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function distinctiveTokens(normalized: string): string[] {
  return normalized.split(' ').filter((t) => t.length >= 4 && !NAME_STOP.has(t))
}

/** True when a typed query refers to a listed display name: exact match, or all distinctive tokens of one appear in the other. Legal-form words such as Limited are ignored. Queries shorter than 4 characters only match exactly. */
export function nameMatches(query: string, listed: string): boolean {
  const q = normalizeName(query)
  const l = normalizeName(listed)
  if (!q || !l) return false
  if (q === l) return true
  const qDist = distinctiveTokens(q)
  const lDist = distinctiveTokens(l)
  if (qDist.length === 0 || lDist.length === 0) return false
  const hasAll = (need: string[], have: string[]) => need.every((t) => have.includes(t))
  return hasAll(qDist, lDist) || hasAll(lDist, qDist)
}

/** A list is a name source when it carries entities or names (OFAC address snapshots do not). */
export function hasNameSource(list: OfacList): boolean {
  return list?.entities !== undefined || list?.names !== undefined
}

/** Display names available for screening on one list, de-duplicated by normalised form. */
export function listedNames(list: OfacList): { key: string; display: string }[] {
  const out: { key: string; display: string }[] = []
  const seen = new Set<string>()
  const add = (display: string, key?: string) => {
    const k = key || normalizeName(display)
    if (!k || seen.has(k)) return
    seen.add(k)
    out.push({ key: k, display })
  }
  if (list?.names) for (const [key, display] of Object.entries(list.names)) add(display, key)
  else for (const display of Object.values(list?.entities ?? {})) add(display)
  return out
}

export function screenName(name: string, list: OfacList): ScreenResult {
  const raw = String(name ?? '').trim()
  if (!raw) return { status: 'empty', message: '' }
  const who = list?.authority ?? 'OFAC'
  const names = listedNames(list)
  if (!hasNameSource(list) || names.length === 0) {
    const label = list?.authority ? `${list.authority} sanctions list` : 'Sanctions list'
    return { status: 'list-not-loaded', message: `${label} names not loaded: this name was NOT checked.` }
  }
  const hits = names.filter((n) => nameMatches(raw, n.display))
  if (hits.length > 0) {
    const shown = [...new Set(hits.map((h) => h.display))].join(', ')
    return {
      status: 'listed',
      chain: shown,
      message: `Warning: this name appears on the public ${who} sanctions list (${shown}, snapshot ${list.downloadedAt}). You decide whether to accept it. Consider legal advice.`,
    }
  }
  return {
    status: 'not-listed',
    message: `Not on the ${who} snapshot of ${list.downloadedAt} (${names.length} named entries that publish wallet addresses). The snapshot may be incomplete or outdated; this is not a statement that the name is lawful or safe.`,
  }
}

/**
 * Screens one name against the lists that carry a name snapshot (default: EU + UK; OFAC is addresses only).
 * Any hit -> listed (every hit is named). A name-source list that is empty -> list-not-loaded (never reads as clean).
 */
export function screenNameAll(name: string, lists: readonly OfacList[] = DEFAULT_LISTS): ScreenResult {
  if (!String(name ?? '').trim()) return { status: 'empty', message: '' }
  const nameLists = lists.filter(hasNameSource)
  if (nameLists.length === 0) return { status: 'list-not-loaded', message: 'Sanctions name list not loaded: this name was NOT checked.' }
  const results = nameLists.map((list) => screenName(name, list))
  const listed = results.filter((r): r is Extract<ScreenResult, { status: 'listed' }> => r.status === 'listed')
  if (listed.length > 0) {
    return { status: 'listed', chain: listed.map((r) => r.chain).join(', '), message: listed.map((r) => r.message).join(' ') }
  }
  if (results.some((r) => r.status === 'list-not-loaded')) {
    return { status: 'list-not-loaded', message: results.map((r) => r.message).join(' ') }
  }
  return { status: 'not-listed', message: results.map((r) => r.message).join(' ') }
}

/** Fold address and name results: a hit on either warns; a missing list never reads as clean; both empty stays empty. */
export function combineScreenResults(...results: ScreenResult[]): ScreenResult {
  const nonempty = results.filter((r) => r.status !== 'empty')
  if (nonempty.length === 0) return { status: 'empty', message: '' }
  const listed = nonempty.filter((r): r is Extract<ScreenResult, { status: 'listed' }> => r.status === 'listed')
  if (listed.length > 0) {
    return { status: 'listed', chain: listed.map((r) => r.chain).join(', '), message: listed.map((r) => r.message).join(' ') }
  }
  if (nonempty.some((r) => r.status === 'list-not-loaded')) {
    return { status: 'list-not-loaded', message: nonempty.map((r) => r.message).join(' ') }
  }
  return { status: 'not-listed', message: nonempty.map((r) => r.message).join(' ') }
}
