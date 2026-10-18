#!/usr/bin/env node
// Offline maintenance script (NOT part of the app bundle, never run in the browser).
// Downloads the public EU consolidated financial sanctions list (EU Financial Sanctions Files, FSF)
// and writes the blockchain wallet addresses that the EU writes into its remark fields to
// src/data/euSanctionsAddresses.json, which is committed as a static snapshot.
// The EU file has no dedicated crypto-address field: addresses appear as free text such as
// "Known blockchain wallet addresses:\nETH: 0x...\nBTC: bc1...". Only those are extracted.
// Names and entities are NOT screened (the OFAC module does not screen names either).
// If the download fails or yields an implausible result, the last good snapshot is kept untouched.
// Usage: node scripts/update-eu-sanctions.mjs [--from-file path/to/eu.csv]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalize } from './update-ofac.mjs'

export const EU_FSF_URL = 'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw'
const MIN_PLAUSIBLE = 3
const MARKER = /wallet[\s.]*address(?:es)?\s*:?/i
const FORMATS = [
  [/^0x[0-9a-fA-F]{40}$/, 'EVM'],
  [/^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'TRX'],
  [/^bc1[02-9ac-hj-np-z]{11,71}$/i, 'BTC'],
  [/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/, 'BTC'],
]

/** Minimal RFC 4180-style parser for the semicolon-separated FSF CSV (quoted fields may contain ; and newlines). */
export function parseCsv(text, sep = ';') {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const s = String(text || '').replace(/^\uFEFF/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function formatOf(address) {
  for (const [re, chain] of FORMATS) if (re.test(address)) return chain
  return undefined
}

/** Addresses written after a "wallet addresses" marker in one remark cell. Joins an address the EU split across two lines. */
export function extractWalletAddresses(cell) {
  const text = String(cell || '').replace(/\\n/g, '\n')
  const at = text.search(MARKER)
  if (at < 0) return []
  const lines = text.slice(at).replace(MARKER, '\n').split(/\n/).map((l) => l.trim()).filter(Boolean)
  const out = []
  let pending = null // a fragment that is not yet a valid address
  for (const line of lines) {
    const m = line.match(/^(?:([A-Z]{2,6})\s*:\s*)?([A-Za-z0-9]+)[\s;).,]*$/)
    if (!m) { pending = null; continue }
    const [, label, token] = m
    const candidate = pending && !label ? pending.token + token : token
    const chain = formatOf(candidate)
    if (chain) { out.push({ address: candidate, chain: (pending && !label ? pending.label : label) || chain }); pending = null; continue }
    pending = !label && pending ? null : { token, label }
    if (pending && formatOf(pending.token)) pending = null
  }
  return out
}

/** EU FSF CSV text -> { addresses: normalised address -> chain label(s), entities: EU reference -> name, fileDate } */
export function parseEuFsfCsv(text) {
  const rows = parseCsv(text)
  const header = rows[0] || []
  const col = (name) => header.indexOf(name)
  const refCol = col('Entity_EU_ReferenceNumber')
  const nameCol = col('NameAlias_WholeName')
  const dateCol = col('fileGenerationDate')
  const addresses = {}
  const refs = new Set()
  const names = {}
  let fileDate = ''
  for (const row of rows.slice(1)) {
    if (!fileDate && dateCol > -1 && row[dateCol]) fileDate = row[dateCol]
    const ref = refCol > -1 ? row[refCol] : ''
    const name = nameCol > -1 ? row[nameCol] : ''
    if (ref && name) (names[ref] ||= []).push(name)
    for (const cell of row) {
      for (const { address, chain } of extractWalletAddresses(cell)) {
        const key = normalize(address)
        const chains = addresses[key] ? addresses[key].split('/') : []
        if (!chains.includes(chain)) addresses[key] = [...chains, chain].join('/')
        if (ref) refs.add(ref)
      }
    }
  }
  const entities = {}
  for (const ref of [...refs].sort()) {
    const all = names[ref] || []
    entities[ref] = all.find((n) => /^[\x20-\x7E]+$/.test(n)) || all[0] || ''
  }
  const d = fileDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return { addresses, entities, fileDate: d ? `${d[3]}-${d[2]}-${d[1]}` : fileDate }
}

export function buildEuSnapshot(csvText, date, source = EU_FSF_URL) {
  const { addresses, entities, fileDate } = parseEuFsfCsv(csvText)
  const count = Object.keys(addresses).length
  if (count < MIN_PLAUSIBLE) throw new Error(`implausibly small list (${count}); not replacing last good list`)
  const sorted = Object.fromEntries(Object.entries(addresses).sort(([a], [b]) => a.localeCompare(b)))
  return {
    note: 'Snapshot of blockchain wallet addresses written in the public EU consolidated financial sanctions list (FSF). The EU list has no dedicated crypto field; only addresses in its remark text are included. Names and entities are not screened. May be incomplete or outdated. Not legal advice. Absence from this list does not mean an address is lawful or safe.',
    authority: 'EU',
    source,
    downloadedAt: date,
    fileGenerationDate: fileDate,
    count,
    entities,
    addresses: sorted,
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const out = resolve(here, '../src/data/euSanctionsAddresses.json')
  const fromFile = process.argv.indexOf('--from-file')
  let snapshot
  try {
    const csv = fromFile > -1
      ? readFileSync(process.argv[fromFile + 1], 'utf8')
      : execFileSync('curl', ['-fsSL', '--max-time', '180', EU_FSF_URL], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    snapshot = buildEuSnapshot(csv, new Date().toISOString().slice(0, 10))
  } catch (e) {
    console.error(`EU list update failed (${e.message}); kept the last good snapshot at ${out}`)
    process.exit(1)
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n')
  console.log(`wrote ${out}: ${snapshot.count} addresses from ${Object.keys(snapshot.entities).length} EU entries, EU file of ${snapshot.fileGenerationDate}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
