#!/usr/bin/env node
// Offline maintenance script (NOT part of the app bundle, never run in the browser).
// Downloads the public OFAC SDN list and writes the "Digital Currency Address" entries to
// src/data/ofacAddresses.json, which is committed as a static snapshot.
// Usage: node scripts/update-ofac.mjs [--from-file path/to/sdn.csv]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const OFAC_URL = 'https://sanctionslistservice.ofac.treas.gov/api/download/sdn.csv'
const MIN_PLAUSIBLE = 10
const MIN_ADDRESS_LENGTH = 20

// EVM addresses and bech32 (case-insensitive formats) are lowercased; base58 and others are case-sensitive.
export function normalize(address) {
  const a = String(address || '').trim()
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return a.toLowerCase()
  if (/^(bc1|ltc1)/i.test(a)) return a.toLowerCase()
  return a
}

// OFAC puts addresses in the remarks field: "Digital Currency Address - XBT 1abc...;"
export function parseOfacCsv(text) {
  const found = {}
  const re = /Digital Currency Address - ([A-Z0-9]+) ([A-Za-z0-9]+)/g
  let m
  while ((m = re.exec(String(text || '')))) {
    if (m[2].length < MIN_ADDRESS_LENGTH) continue // the source contains truncated junk such as "XBT 3"; it would match nothing real
    const key = normalize(m[2])
    const chains = found[key] ? found[key].split('/') : []
    if (!chains.includes(m[1])) found[key] = [...chains, m[1]].join('/') // same 0x address can be listed as ETH, USDT, USDC, ETC
  }
  return found
}

export function buildSnapshot(csvText, date, source = OFAC_URL) {
  const addresses = parseOfacCsv(csvText)
  const count = Object.keys(addresses).length
  if (count < MIN_PLAUSIBLE) throw new Error(`implausibly small list (${count}); not replacing last good list`)
  const sorted = Object.fromEntries(Object.entries(addresses).sort(([a], [b]) => a.localeCompare(b)))
  return {
    note: 'Snapshot of public OFAC SDN digital-currency addresses. May be incomplete or outdated. Not legal advice. Absence from this list does not mean an address is lawful or safe.',
    source,
    downloadedAt: date,
    count,
    addresses: sorted,
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const out = resolve(here, '../src/data/ofacAddresses.json')
  const fromFile = process.argv.indexOf('--from-file')
  const csv = fromFile > -1
    ? readFileSync(process.argv[fromFile + 1], 'utf8')
    : execFileSync('curl', ['-fsSL', '--max-time', '120', OFAC_URL], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const snapshot = buildSnapshot(csv, new Date().toISOString().slice(0, 10))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n')
  const evm = Object.keys(snapshot.addresses).filter((a) => /^0x[0-9a-f]{40}$/.test(a)).length
  console.log(`wrote ${out}: ${snapshot.count} addresses (${evm} EVM-format 0x), downloaded ${snapshot.downloadedAt}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
