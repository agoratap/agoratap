#!/usr/bin/env node
// Offline maintenance script (NOT part of the app bundle, never run in the browser).
// Downloads the public UK Sanctions List (FCDO; the single UK source since OFSI's Consolidated List closed in Jan 2026,
// it also carries the UN designations the UK implements) and writes the crypto addresses the UK writes into its free-text
// fields to src/data/ukSanctionsAddresses.json, which is committed as a static snapshot.
// The UK file has no dedicated crypto field. Addresses appear in free text, sometimes glued together with no separator
// ("...Bc1810xAE05...", "...54DxTHGR..."), so the extractor scans for fixed-shape addresses and keeps a base58 or bech32
// candidate only if its checksum is valid. Only cells that mention crypto / wallet / digital (currency) address are read.
// Names and entities are NOT screened. If the download fails or the result is implausible, the last good snapshot is kept.
// Usage: node scripts/update-uk-sanctions.mjs [--from-file path/to/UK-Sanctions-List.csv]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalize } from './update-ofac.mjs'
import { parseCsv } from './update-eu-sanctions.mjs'

export const UK_LIST_URL = 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv'
const MIN_PLAUSIBLE = 10
const TRIGGER = /crypto|wallet|digital (?:currency )?address/i
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
// 0x+40 hex | Tron T+33 | BTC legacy 1/3 (26-35) | bech32 bc1
const CANDIDATE = /0x[0-9a-fA-F]{40}|T[1-9A-HJ-NP-Za-km-z]{33}|[13][1-9A-HJ-NP-Za-km-z]{25,34}|bc1[02-9ac-hj-np-z]{8,87}/g

const sha256 = (b) => createHash('sha256').update(b).digest()

/** Base58Check: the last 4 bytes are the first 4 bytes of sha256(sha256(payload)). */
export function base58CheckOk(s) {
  let n = 0n
  for (const c of s) { const v = B58.indexOf(c); if (v < 0) return false; n = n * 58n + BigInt(v) }
  let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex
  const lead = s.match(/^1*/)[0].length
  const bytes = Buffer.concat([Buffer.alloc(lead), Buffer.from(n === 0n ? '' : hex, 'hex')])
  if (bytes.length < 5) return false
  const body = bytes.subarray(0, -4)
  return sha256(sha256(body)).subarray(0, 4).equals(bytes.subarray(-4))
}

/** BIP-173 / BIP-350 checksum (bech32 or bech32m) for a "bc1..." string. */
export function bech32Ok(s) {
  const str = s.toLowerCase()
  const pos = str.lastIndexOf('1')
  const hrp = str.slice(0, pos)
  const data = [...str.slice(pos + 1)].map((c) => BECH32.indexOf(c))
  if (pos < 1 || data.length < 6 || data.some((v) => v < 0)) return false
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31), ...data]) {
    const top = chk >>> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= G[i]
  }
  return chk === 1 || chk === 0x2bc830a3
}

function chainOf(address) {
  if (address.startsWith('0x')) return 'EVM'
  if (address.startsWith('T')) return 'TRX'
  return 'BTC'
}

/** Valid crypto addresses in one free-text cell; [] unless the cell mentions crypto/wallet/digital address. */
export function extractUkAddresses(cell) {
  const text = String(cell || '')
  if (!TRIGGER.test(text)) return []
  const out = []
  for (const m of text.matchAll(CANDIDATE)) {
    let a = m[0]
    if (a.startsWith('bc1')) {
      // a bech32 run may swallow following text: shorten until the checksum holds (min 14 chars)
      while (a.length >= 14 && !bech32Ok(a)) a = a.slice(0, -1)
      if (a.length < 14) continue
    } else if (!a.startsWith('0x')) {
      // legacy BTC length varies: try the longest valid prefix
      let ok = false
      for (let len = a.length; len >= 26 && !ok; len--) if (base58CheckOk(a.slice(0, len))) { a = a.slice(0, len); ok = true }
      if (!ok) continue
    }
    const before = text.slice(Math.max(0, m.index - 12), m.index)
    const label = before.match(/\b(ETH|BNB|BSC|USDT|USDC|TRX|BTC|XBT|LTC)\b\s*:?\s*$/)
    out.push({ address: a, chain: label ? (label[1] === 'XBT' ? 'BTC' : label[1]) : chainOf(a) })
  }
  return out
}

/** UK Sanctions List CSV (line 1 "Report Date: ...", line 2 header) -> { addresses, entities: Unique ID -> name, reportDate } */
export function parseUkSanctionsCsv(text) {
  const rows = parseCsv(text, ',')
  let reportDate = ''
  const first = (rows[0] || [])[0] || ''
  const rd = first.match(/Report Date:\s*(\d{1,2})-([A-Za-z]{3})-(\d{4})/)
  if (rd) {
    const mon = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(rd[2]) / 3 + 1
    reportDate = `${rd[3]}-${String(mon).padStart(2, '0')}-${rd[1].padStart(2, '0')}`
  }
  const hi = rows.findIndex((r) => r.includes('Unique ID'))
  const header = rows[hi] || []
  const idCol = header.indexOf('Unique ID')
  const nameCol = header.indexOf('Name 6')
  const typeCol = header.indexOf('Name type')
  const addresses = {}
  const entities = {}
  for (const row of rows.slice(hi + 1)) {
    const id = idCol > -1 ? row[idCol] : ''
    let found = false
    for (const cell of row) {
      for (const { address, chain } of extractUkAddresses(cell)) {
        const key = normalize(address)
        const chains = addresses[key] ? addresses[key].split('/') : []
        if (!chains.includes(chain)) addresses[key] = [...chains, chain].join('/')
        found = true
      }
    }
    if (found && id && (!entities[id] || row[typeCol] === 'Primary Name')) {
      const name = [row[header.indexOf('Name 1')], row[nameCol]].filter((x) => x && x.trim()).join(' ').trim()
      entities[id] = name || entities[id] || ''
    }
  }
  return { addresses, entities, reportDate }
}

export function buildUkSnapshot(csvText, date, source = UK_LIST_URL) {
  const { addresses, entities, reportDate } = parseUkSanctionsCsv(csvText)
  const count = Object.keys(addresses).length
  if (count < MIN_PLAUSIBLE) throw new Error(`implausibly small list (${count}); not replacing last good list`)
  const sorted = Object.fromEntries(Object.entries(addresses).sort(([a], [b]) => a.localeCompare(b)))
  return {
    note: 'Snapshot of crypto addresses written in the public UK Sanctions List (FCDO, which includes the UN designations the UK implements). The UK list has no dedicated crypto field; only checksum-valid addresses found in its free text are included. Names and entities are not screened. May be incomplete or outdated. Not legal advice. Absence from this list does not mean an address is lawful or safe.',
    authority: 'UK',
    source,
    downloadedAt: date,
    reportDate,
    count,
    entities: Object.fromEntries(Object.entries(entities).sort(([a], [b]) => a.localeCompare(b))),
    addresses: sorted,
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const out = resolve(here, '../src/data/ukSanctionsAddresses.json')
  const fromFile = process.argv.indexOf('--from-file')
  let snapshot
  try {
    const csv = fromFile > -1
      ? readFileSync(process.argv[fromFile + 1], 'utf8')
      : execFileSync('curl', ['-fsSL', '--max-time', '180', UK_LIST_URL], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    snapshot = buildUkSnapshot(csv, new Date().toISOString().slice(0, 10))
  } catch (e) {
    console.error(`UK list update failed (${e.message}); kept the last good snapshot at ${out}`)
    process.exit(1)
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n')
  console.log(`wrote ${out}: ${snapshot.count} addresses from ${Object.keys(snapshot.entities).length} UK entries, UK report of ${snapshot.reportDate}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
