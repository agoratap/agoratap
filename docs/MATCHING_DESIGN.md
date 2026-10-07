# Matching design — decision of 2026-10-03

Scope: this document is the **Base-rail matcher** (built today on Base Sepolia). It is one optional rail. It is not the Agora Pay product definition, and it is not a Base-mainnet MVP. The product is any-in → any-out: the payer sends crypto they hold, and the merchant — online shop, offline store, or market stall — receives on the payout rail they prefer, with nothing to install and a QR or pay-link on a phone. See `docs/ARCHITECTURE.md`. Nothing here enables mainnet or asks anyone to fund Base.

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
7. The merchant panel keeps each live sale on the device (IndexedDB) and can export or import that record as JSON. The file holds the reference, address, amount, block window and any bound hash. It has no wallet key.
8. **Missed payment?** repeats the same check from a pasted sale link and transaction hash. If the saved block window is not on the device, the check does not decide the payment and does not read the chain.

Example merchant address on file for a later pilot, not a default and not enabled on mainnet: `0xCc15552e20ed43c47a1EEBf781c905Cd1117CEa3`.

Sepolia pilot, test funds only:

1. Merchant screen, live test: enter a Base Sepolia address you control and a price, then create the request.
2. Paste the share link (the one ending in `#ref=`) into the buyer screen. Open in wallet. The wallet asks for a normal EURC transfer on Base Sepolia (chain id 84532) for the exact amount shown. Confirm there, with test tokens.
3. Copy the transaction hash from the wallet.
4. Paste it into either panel and choose "Match this transaction".
5. The line moves from unpaid (or ambiguous, if another transfer of that amount exists) to pending, then to confirmed after 12 blocks. The panel polls about every 6 seconds. A bound hash is read with one `eth_getTransactionReceipt` (the Transfer logs in that receipt). The panel tries `https://sepolia.base.org` first. If that endpoint times out, drops the connection, or keeps answering HTTP 429 or 5xx after one retry, the same read is tried on `https://base-sepolia-rpc.publicnode.com`. Neither URL has an API key. Each one sees the browser's IP address. A hung attempt is abandoned after 8 seconds. If both fail, the panel shows: "Could not read Base Sepolia. The public endpoint sepolia.base.org failed, and the fallback endpoint failed too. Mainnet was not contacted. Nothing was signed or sent. Try again in a moment." A JSON-RPC error from a live node (for example a log range that is too wide) stays on that node and is not treated as an outage. Before using an endpoint, the panel reads `eth_chainId` and continues only for 84532. Chain id 8453 is refused. `https://mainnet.base.org` is not in the list, and putting it there throws before any call. The hand-run harness in section 6 does not use the fallback: it still talks only to `https://sepolia.base.org`.
6. Export the sale backup before leaving the page. If the sale is gone, import that file, open **Missed payment?**, and paste the same link and hash. Without the saved window the page will not decide the payment.

## 6. Sepolia harness run on 2026-10-06

`npm run sepolia:reference-e2e` uses the same `openLiveRequest`, share link, and `refreshLive` path as the panels. It talks only to `https://sepolia.base.org` and refuses chain id 8453. The throwaway signing key stays outside the repository.

On a pull request and on `main`, CI runs `npm test` (that includes `scripts/sepoliaE2eGuard.test.ts`) and then `npm run sepolia:reference-e2e`. With no key in the CI environment the harness exits 0 before any RPC call. The same exit 0 happens when a key is present but test EURC or Base Sepolia ETH cannot cover the sale: no transaction is signed and `run.json` is not overwritten. Set `SEPOLIA_E2E_CREATE_KEY=1` to mint a throwaway key file, or `SEPOLIA_E2E_RECORD_BLOCKED=1` to keep the older "write the blocked run and exit 2" behaviour.

A second attempt on a day that already has `run.json` writes `run-<timestamp>.json` beside it, so the first record stays. The live send still needs test ETH. `src/lib/fixtures/reference-confirm-replay.json` is a synthetic replay (not a chain receipt) of bind → pending → confirmed, including a missed hash, a wrong recipient, a wrong amount, a transfer before the window, a second equal amount that must not steal the match, two exact logs in the claimed transaction, a reorg, a head that moves backwards, and an expired window. `src/lib/referenceConfirmReplay.test.ts` plays that file through `refreshLive`. No ETH is required.

The run recorded in `docs/evidence/sepolia-e2e-2026-10-06/` did this against the live testnet:

- Chain id 84532. Test EURC `0x808456652fdb597867f38412077A9182bf77359F` returned symbol EURC and 6 decimals.
- A real inbound transfer of 20 test EURC to the throwaway payer: `0x8e1b1bf62874dd3ae2ff8180fed89aafcf74f731c23dae112f38be73ccd41676`, block 47,772,257. The receipt contains one EURC Transfer.
- A live sale was created. The share link ends in `#ref=` (32 bytes). The wallet link is the same transfer without that fragment. The panel line was unpaid: "Waiting: no matching transfer seen on chain yet."
- Opening the same flow on Base mainnet threw "Mainnet is disabled at this stage: use Base Sepolia (test funds only)".

No payment transaction was broadcast. The payer's Base Sepolia ETH balance was 0 wei, and at the gas price read then (6,000,000 wei) the harness required about 5,400,000,000,000 wei before it would sign. It did not invent a transaction. The faucet attempts and the exact next step are in `docs/evidence/sepolia-e2e-2026-10-06/REPORT.md`.
