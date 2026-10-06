#!/usr/bin/env node
// Hand-run mutation check (not part of the app): breaks one rule at a time in the source, runs the tests, and
// requires that they FAIL. A mutation that survives means a rule is not really tested. Restores every file afterwards.
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const M = [
  ['src/lib/confirmation.ts', 'confirmations < needed', 'confirmations <= needed', 'off-by-one on confirmations'],
  ['src/lib/confirmation.ts', "if (previous && !chosen.some((l) => sameTransfer(previous, l)))", 'if (false)', 'reorg detection removed'],
  ['src/lib/confirmation.ts', 'if (chosen.length > 1)', 'if (chosen.length > 2)', 'two matches no longer ambiguous'],
  ['src/lib/confirmation.ts', 'l.blockNumber >= window.fromBlock && ', '', 'window start ignored'],
  ['src/lib/confirmation.ts', 'if (previous && head < previous.head)', 'if (false)', 'lagging head not detected'],
  ['src/lib/confirmation.ts', 'hit.blockNumber <= input.finalized', 'hit.blockNumber < input.finalized', 'finalized boundary'],
  ['src/lib/confirmation.ts', ' && l.blockNumber <= head)', ')', 'transfers beyond head counted'],
  ['src/lib/tagging.ts', 'free[Math.floor(r * free.length)]', 'free[0]', 'tag no longer random (smallest-free)'],
  ['src/lib/tagging.ts', 'new Set<bigint>(ctx.history ?? [])', 'new Set<bigint>()', 'on-chain history ignored'],
  ['src/lib/tagging.ts', "r.merchant.toLowerCase() === input.merchant.toLowerCase()", 'true', 'other merchants block tags'],
  ['src/lib/chainReader.ts', 'if (l.removed === true) return null', '', 'removed logs kept'],
  ['src/lib/chainReader.ts', 'topics: [TRANSFER_TOPIC, null, recipientTopic]', 'topics: [TRANSFER_TOPIC]', 'recipient filter dropped'],
  ['src/lib/chainReader.ts', "if (log.to !== q.merchant.toLowerCase()) throw", 'if (false) throw', 'node answer trusted blindly (recipient)'],
  ['src/lib/chainReader.ts', 'if (seen.has(key)) continue', '', 'duplicates counted twice'],
  ['src/lib/chainReader.ts', "if (state.calls >= maxCalls)", 'if (false)', 'call budget removed'],
  ['src/lib/chainReader.ts', 'queue.unshift([from, mid], [mid + 1, to])', 'throw e', 'range split removed'],
  ['src/lib/chainReader.ts', 'res.status === 429 || res.status >= 500', 'false', 'rate-limit retry removed'],
  ['src/lib/liveSession.ts', "if (chain === 'base' && !allowMainnet)", 'if (false)', 'mainnet guard removed'],
  ['src/lib/requestLink.ts', 'if (atomic <= 0n) throw', 'if (false) throw', 'zero amount accepted in link'],
  ['src/lib/liveFetch.ts', "'eth_blockNumber', 'eth_getLogs', 'eth_getBlockByNumber', 'eth_getTransactionReceipt'", "'eth_blockNumber', 'eth_getLogs', 'eth_getBlockByNumber', 'eth_getTransactionReceipt', 'eth_sendRawTransaction'", 'write method allowed'],
  ['src/LivePanels.tsx', 'const testnetOnly = parsed !== null && parsed.chain !== CHAIN', 'const testnetOnly = false', 'buyer panel accepts mainnet link'],
]
let survived = 0
for (const [file, from, to, name] of M) {
  const orig = readFileSync(file, 'utf8')
  if (!orig.includes(from)) { console.log(`SKIP (pattern missing) ${name}`); survived++; continue }
  writeFileSync(file, orig.replace(from, to))
  const r = spawnSync('npx', ['vitest', 'run'], { encoding: 'utf8' })
  writeFileSync(file, orig)
  const caught = r.status !== 0
  if (!caught) survived++
  console.log(`${caught ? 'CAUGHT  ' : 'SURVIVED'} ${name}`)
}
console.log(`\n${M.length - survived}/${M.length} mutations caught`)
process.exit(survived ? 1 : 0)
