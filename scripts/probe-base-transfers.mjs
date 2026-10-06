#!/usr/bin/env node
// Hand-run, READ-ONLY feasibility probe (NOT part of the app bundle). Answers: can a public Base RPC feed
// matchRequest() with real ERC-20 Transfer logs, what does it cost, and how often does exact-amount matching collide?
// It sends no transaction and holds no key. Usage: node scripts/probe-base-transfers.mjs [blocks=43200] [rpc]
import { matchRequest, createRequest, CHAINS } from '../src/lib/chainRequest.ts'

const BLOCKS = Number(process.argv[2] || 43200) // Base ~2 s/block -> 43200 ~ 24 h
const RPC = process.argv[3] || 'https://mainnet.base.org'
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const RANGE = 2000 // the public endpoint rejects wider eth_getLogs ranges (observed -32614)

let calls = 0
async function rpc(method, params) {
  calls++
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = await r.json()
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`)
  return j.result
}

export function toLog(l) {
  return { to: '0x' + l.topics[2].slice(26), value: BigInt(l.data), txHash: l.transactionHash, blockNumber: parseInt(l.blockNumber, 16) }
}

const head = parseInt(await rpc('eth_blockNumber', []), 16)
const t0 = Date.now()
const logs = []
for (let from = head - BLOCKS; from < head; from += RANGE) {
  const to = Math.min(from + RANGE - 1, head)
  const res = await rpc('eth_getLogs', [{ address: CHAINS.base.tokens.EURC, topics: [TRANSFER], fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }])
  for (const l of res) logs.push(toLog(l))
}
const secs = (Date.now() - t0) / 1000

const byRecipientAmount = new Map()
for (const l of logs) {
  const k = l.to + ':' + l.value
  byRecipientAmount.set(k, (byRecipientAmount.get(k) || 0) + 1)
}
const dupKeys = [...byRecipientAmount.entries()].filter(([, n]) => n > 1)
const recipients = new Set(logs.map((l) => l.to))
const byAmount = new Map()
for (const l of logs) byAmount.set(String(l.value), (byAmount.get(String(l.value)) || 0) + 1)
const sameAmountAcrossRecipients = [...byAmount.values()].filter((n) => n > 1).length

// Exposure of the tag scheme: tagged amounts are base(multiple of 10000 atomic = 0.01) + 1..9999, so a real transfer can only
// be mistaken for a payment if its value is NOT a multiple of 10000. Count those, and repeats among them.
const tagLike = logs.filter((l) => l.value % 10000n !== 0n)
const tagLikePairs = new Map()
for (const l of tagLike) { const k = l.to + ':' + l.value; tagLikePairs.set(k, (tagLikePairs.get(k) || 0) + 1) }
const tagLikeRepeats = [...tagLikePairs.values()].filter((n) => n > 1).length

// Real-data exercise of matchRequest: take 3 real transfers, build the request a merchant would have had, and match.
const sample = logs.slice(0, 3).map((l) => {
  const req = { orderId: 'probe', chain: 'base', token: 'EURC', merchant: l.to, atomic: l.value, baseAtomic: l.value, tag: 0 }
  return matchRequest(req, logs).status
})
// And a request nobody paid:
const unpaid = matchRequest({ orderId: 'x', chain: 'base', token: 'EURC', merchant: '0x000000000000000000000000000000000000dEaD', atomic: 1234567n, baseAtomic: 1234560n, tag: 7 }, logs).status

// Tag-room check: with 9999 tags, can createRequest give 9999 distinct amounts for one merchant at one price?
const open = []
for (let i = 0; i < 9999; i++) open.push(createRequest({ orderId: 'o' + i, chain: 'base', merchant: '0x' + '1'.repeat(40), baseAtomic: 10_000_000n }, open))
let overflow = 'no error'
try { createRequest({ orderId: 'over', chain: 'base', merchant: '0x' + '1'.repeat(40), baseAtomic: 10_000_000n }, open) } catch (e) { overflow = e.message }

console.log(JSON.stringify({
  rpc: RPC, headBlock: head, blocksScanned: BLOCKS, rpcCalls: calls, seconds: secs,
  eurcTransfers: logs.length, distinctRecipients: recipients.size,
  recipientAmountPairsSeenMoreThanOnce: dupKeys.length,
  amountsSharedByDifferentTransfers: sameAmountAcrossRecipients,
  transfersThatLookTagged: tagLike.length, taggedLookingRecipientAmountRepeats: tagLikeRepeats,
  realDataMatchStatuses: sample, unpaidStatus: unpaid, tagRoom: { created: open.length, thenOverflow: overflow },
}, null, 2))
