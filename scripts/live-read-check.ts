// Hand-run, READ-ONLY check of the real modules against the real public Base MAINNET RPC (no key, no tx, no funds).
// Build+run: npx rolldown scripts/live-read-check.ts -f esm -o /tmp/lrc.mjs && node /tmp/lrc.mjs
// It measures, per merchant (recipient filtered at the node), how often the same amount repeats, and runs the real
// confirmation rule on a real transfer.
import { createChainReader, PUBLIC_RPC, TRANSFER_TOPIC } from '../src/lib/chainReader'
import { CHAINS } from '../src/lib/chainRequest'
import { evaluatePayment, windowFrom } from '../src/lib/confirmation'
import { createUnpredictableRequest } from '../src/lib/tagging'

let httpCalls = 0
const fetchFn = async (url: string, init: any) => { httpCalls++; return fetch(url, init) }
const reader = createChainReader({ fetchFn: fetchFn as any, rpcUrl: PUBLIC_RPC.base, maxCalls: 400 })
const t0 = Date.now()
const { head } = await reader.headBlock()
const { finalized } = await reader.finalizedBlock()
const BLOCKS = 43_200
// 1) find busy recipients: one bounded unfiltered slice (2,000 blocks, ~1h), same as the earlier probe; used only to pick candidates.
const sliceFrom = head - 2000
const raw = await (await fetch(PUBLIC_RPC.base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getLogs', params: [{ address: CHAINS.base.tokens.EURC, topics: [TRANSFER_TOPIC], fromBlock: '0x' + sliceFrom.toString(16), toBlock: '0x' + head.toString(16) }] }) })).json() as any
httpCalls++
const counts = new Map<string, number>()
for (const l of raw.result) { const to = '0x' + l.topics[2].slice(26); counts.set(to, (counts.get(to) ?? 0) + 1) }
const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a]) => a)
const mid = [...counts.entries()].filter(([, n]) => n >= 2 && n <= 5).slice(0, 4).map(([a]) => a)
const out: any[] = []
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
for (const merchant of [...top, ...mid]) {
  await pause(1500)
  const r = await reader.transfers({ chain: 'base', token: 'EURC', merchant, fromBlock: head - BLOCKS, toBlock: head })
  const byAmt = new Map<bigint, number>()
  for (const l of r.logs) byAmt.set(l.value, (byAmt.get(l.value) ?? 0) + 1)
  const repeated = [...byAmt.values()].filter((n) => n > 1).length
  const distinct = byAmt.size
  // with the unpredictable tag: how often would a fresh request at 5.00 EURC collide with history? (should be 0 by construction)
  let collisions = 0
  const history = r.logs.map((l) => l.value)
  for (let i = 0; i < 200; i++) { const q = createUnpredictableRequest({ orderId: 'x', chain: 'base', merchant, baseAtomic: 5_000_000n }, [], { random: Math.random, history }); if (history.includes(q.atomic)) collisions++ }
  out.push({ merchant: merchant.slice(0, 10) + '…', transfers24h: r.logs.length, distinctAmounts: distinct, amountsSeenMoreThanOnce: repeated, freshRequestCollisionsOf200: collisions, rpcCalls: r.rpcCalls })
}
// 2) run the real confirmation rule on the newest real transfer of the busiest merchant
const m0 = top[0]
const recent = await reader.transfers({ chain: 'base', token: 'EURC', merchant: m0, fromBlock: head - 300, toBlock: head })
let rule: any = 'no transfer in last 300 blocks for that merchant'
if (recent.logs.length) {
  const t = recent.logs[recent.logs.length - 1]
  const req = { orderId: 'r', chain: 'base' as const, token: 'EURC' as const, merchant: m0, atomic: t.value, baseAtomic: t.value, tag: 0 }
  const s1 = evaluatePayment({ request: req, logs: recent.logs.filter((l) => l.value === t.value), head, window: windowFrom(head - 300), finalized })
  rule = { status: s1.status, confirmations: (s1 as any).confirmations, final: (s1 as any).final, note: 'amount may repeat -> ambiguous is legitimate' }
}
console.log(JSON.stringify({ rpc: PUBLIC_RPC.base, head, finalized, merchantsMeasured: out.length, httpCalls, seconds: (Date.now() - t0) / 1000, perMerchant: out, confirmationRuleOnRealTransfer: rule }, null, 2))
