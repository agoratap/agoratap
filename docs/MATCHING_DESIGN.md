# Matching design — decision of 2026-10-03

Status: DECIDED for the read-only testnet stage. Built: `src/lib/tagging.ts`, `confirmation.ts`, `chainReader.ts`. Not built: the reference-bearing design in section 4.

## 1. The problem, with real numbers
A plain ERC-20 `transfer` has no order reference. On Base mainnet EURC, read from the public endpoint on 2026-10-03 (`docs/evidence/`):
- 52,413 transfers in 24 h; 771 recipient+amount pairs occurred more than once (global probe).
- Per recipient (10 recipients measured by node-side filtering, `live-read-check-2026-10-03.json`): the busy ones had 6 to 175 amounts that repeat inside 24 h. 3 of the 10 had 0 or 1 repeats.
So with an amount that is just the price, "ambiguous" is normal. The tag exists for that reason.

## 2. Decision for this stage: random tag + on-chain history + block window + ambiguity rule
1. Amount = price + a tag of 1..9,999 micro-EURC (at most 0.009999 EURC, under 1 cent), **drawn at random** from the tags that are still free. Old rule (smallest free tag) made order #1 always `price+1`, which anyone can guess and send.
2. A tag is free only if no open request of the same merchant/token uses it **and** the merchant has not received that exact amount in the last 24 h (read from chain at request time).
3. A payment only counts if it lands in the request's block window (from the head at creation, to expiry if set).
4. Two transfers that match = `ambiguous`. Never "paid", never pick one.
5. `confirmed` needs 12 blocks (default), `final` is shown only if the node's `finalized` block covers it.

Measured with real histories: 200 fresh requests per recipient × 10 recipients = 2,000 draws, 0 collisions with that recipient's 24 h history (by construction, tested also with mutations).

## 3. What this does NOT solve (said plainly)
- It does not prove who paid. Anyone can send the exact amount to the merchant (griefing, or false "paid"). The amount is public once the buyer's wallet shows it.
- Tag room is 9,999 per merchant, token and price. A busy merchant at one fixed price exhausts it; the code then refuses (error) rather than reuse.
- Real finality on Base mainnet was observed to lag the head: the `finalized` block was 515 blocks (about 17 minutes) behind the head in the run of 2026-10-03; a transfer with 92 confirmations was still not `final`. So "confirmed" (12 blocks) and "final" are different and the screen shows which.
- 12 confirmations is a chosen default (about 24 s), not a measured safe value.

## 4. Reference-bearing alternatives (documented, not built)
| Option | Gives | Cost / risk |
|---|---|---|
| EIP-3009 `transferWithAuthorization` (USDC and EURC both implement it) with `nonce` = hash(orderId) | A reference on chain, tied to the buyer's signed authorisation | Needs a relayer/submitter to send it (or the buyer's own wallet to call it). Relaying means someone pays gas and holds a role: touches the core (non-custodial, no server that decides). Needs Bogdan's written decision. |
| Small router contract: `pay(token, merchant, amount, orderRef)` emitting an event | Reference on chain, exact match, no amount tag | A deployed contract = audit, key for deployment, legal review; changes the "tool, not operator" posture. Needs Bogdan's written decision and money for audit. |
| Buyer-side proof: buyer pastes the tx hash back to the merchant | Binds a payer claim to a transfer | Manual, but zero new infrastructure. Could be added now as a UI step (not built). |

Recommendation: keep the tag scheme for the testnet/pilot stage (it stays inside the frozen core), measure with a real pilot merchant, and decide on EIP-3009 vs a router only when real ambiguity numbers from a pilot exist. Moving to either option is a CORE_RULE decision for Bogdan.
