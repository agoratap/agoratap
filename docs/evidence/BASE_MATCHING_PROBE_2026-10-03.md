# Base matching probe — 2026-10-03 (read-only, no funds, no keys)

Question: can `matchRequest()` be fed with real Base EURC Transfer logs from a public RPC, and does the exact-amount "tag" scheme survive real traffic?
Status: PREP evidence. Nothing here is wired into the app; the README claim table is unchanged.

Run: `node scripts/probe-base-transfers.mjs` (Node 26, public endpoint https://mainnet.base.org, head block 52,116,035, last 43,200 blocks, about 24 h). The script is hand-run, outside the app bundle, and sends no transaction.

| Measured fact | Value |
|---|---|
| RPC calls for 24 h of EURC logs | 23 |
| Wall time | about 12–13 s |
| Endpoint limit seen | `eth_getLogs` rejects ranges over 2,000 blocks (error -32614) |
| EURC Transfer events in 24 h | 52,413 (2,006 distinct recipients) |
| `matchRequest` on 3 real transfers | `matched` ×3; an unpaid request returned `unpaid` |
| Tag room | 9,999 open requests at one price and merchant, the 10,000th is refused with an error (as designed) |

## What this removes
Reading real payment logs needs no node of our own and no key. A 24 h window costs about 23 free calls, so a merchant tab polling its own window is technically feasible. UNMEASURED: rate limits under many merchants, reorg handling, finality.

## What it exposes (important)
- 46,163 of 52,413 real transfers (88%) have a value that is not a multiple of 0.01 EURC. So an odd-looking amount does not by itself identify an AgoraTap request. Matching must always use recipient plus exact amount plus time window, and must never claim who paid.
- Even among those odd-looking transfers, 771 recipient+amount pairs occurred more than once in 24 h. On real traffic, "ambiguous" is a normal result, not a rare one. The current code already reports it as ambiguous, never paid. Cause of these repeats is UNKNOWN (likely automated payers); not investigated.
- A third party can deliberately send the exact tagged amount to a merchant address. The scheme gives no protection against that. This is the known limit already written in the README; the probe confirms the chain is open to it.

## Next step this suggests
Test the per-merchant case rather than the global one: filter logs by the merchant address (topic 2), so the collision rate is measured for a single recipient. Then decide between tag matching and a reference carried by a contract/permit design. Neither is built.
