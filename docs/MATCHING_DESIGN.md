# Matching design — decision of 2026-10-03

Status: amount-tag rules below stay in force as the secondary signal. The buyer-side reference in section 4 is now built for Base Sepolia (`src/lib/reference.ts`, wired through `confirmation.ts` and the live panels). EIP-3009 and a router contract are still not built.

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

## 4. Reference-bearing alternatives
| Option | Gives | Cost / risk |
|---|---|---|
| EIP-3009 `transferWithAuthorization` (USDC and EURC both implement it) with `nonce` = hash(orderId) | A reference on chain, tied to the buyer's signed authorisation | Needs a relayer/submitter to send it (or the buyer's own wallet to call it). Relaying means someone pays gas and holds a role: touches the core (non-custodial, no server that decides). Needs Bogdan's written decision. |
| Small router contract: `pay(token, merchant, amount, orderRef)` emitting an event | Reference on chain, exact match, no amount tag | A deployed contract = audit, key for deployment, legal review; changes the "tool, not operator" posture. Needs Bogdan's written decision and money for audit. |
| Buyer-side proof: buyer pastes the tx hash back to the merchant | Binds a payer claim to a transfer | **Built** for Base Sepolia. See section 5. Manual step, zero new infrastructure, no custody. |

EIP-3009 and a router contract still need Bogdan's written decision. They are not in this slice. The amount tag stays, as a backup only.

## 5. Built slice — reference on the share link, transaction hash on the transfer (2026-10-06)

A plain `transfer(address,uint256)` still cannot carry a memo, and a wallet that follows EIP-681 will not append one. What every ERC-20 Transfer log already carries is its transaction hash. That hash is the on-chain id.

1. Creating a live sale draws a stable 32-byte reference once and puts it on the share link as a fragment: `ethereum:<token>@84532/transfer?address=<merchant>&uint256=<atomic>#ref=<32 bytes>`.
2. The wallet link is the same URI without `#ref=`. The fragment is not a transfer argument. Query-string `&ref=` is rejected, so it cannot be mistaken for calldata.
3. Primary match: the buyer or the merchant pastes the transaction hash. Only a Transfer log with that hash, the merchant as recipient, the exact amount, and inside the request's block window counts. A second transfer of the same amount does not. One hash cannot be bound to two references.
4. Secondary match: if no hash is bound, the amount tag still applies. Two transfers of that amount stay `ambiguous` until a hash selects one.
5. States stay `unpaid` → `pending` (under 12 blocks) → `confirmed`. `final` still depends on the node's finalized block. A match still does not prove who paid.
6. Base mainnet is refused. Nothing is signed or sent from this app.

Example merchant address on file for a later pilot, not a default and not enabled on mainnet: `0xCc15552e20ed43c47a1EEBf781c905Cd1117CEa3`.

Sepolia demo, test funds only:

1. Merchant screen, live test: enter a Base Sepolia address you control and a price, then create the request.
2. Paste the share link (the one ending in `#ref=`) into the buyer screen. Open in wallet. The wallet asks for a normal EURC transfer on Base Sepolia (chain id 84532) for the exact amount shown. Confirm there, with test tokens.
3. Copy the transaction hash from the wallet.
4. Paste it into either panel and choose "Match this transaction".
5. The line moves from unpaid (or ambiguous, if another transfer of that amount exists) to pending, then to confirmed after 12 blocks. The panel polls about every 6 seconds. A bound hash is read with one `eth_getTransactionReceipt` (the Transfer logs in that receipt). It only reads `sepolia.base.org`.
