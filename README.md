# AgoraTap

AgoraTap is an early, unfinished project. This page says only what the code in this repository does today. Each statement in the "What the code does today" table points to a test that checks it. Anything not in that table should be read as not done.

> **Nothing here handles real money.** There is no server, no account system, no custody and no service run by the authors. Do not send real funds because of anything you read in this repository.

## What the code does today

| # | What the code does | Checked by |
|---|---|---|
| 1 | The browser demo keeps its data in the browser's `localStorage` (key `agoratap-demo-v1`). Its source contains no `fetch`, XHR, WebSocket or web3-library call, except ONE file, `src/lib/liveFetch.ts`, which sends read-only JSON-RPC POSTs (`eth_blockNumber`, `eth_getLogs`, `eth_getBlockByNumber`) to the public Base Sepolia endpoint, and only when the user opens the live-test panel. (The installable-app service worker only caches the app's own files. The demo has one outbound link, to GNU Taler's public demo; nothing is sent with it.) | `src/lib/readmeClaims.test.ts` → "app source makes no network calls except the one read-only RPC gateway", "the gateway only allows read-only RPC methods and no signing or keys exist in app source" |
| 2 | `src/lib/chainRequest.ts` turns a euro price into an exact EURC or USDC amount on Base (EURC is the default, no exchange rate needed). | `src/lib/chainRequest.test.ts` → "converts EUR to atomic USDC", "defaults to EURC: merchant is asked for the euro amount with no exchange rate" |
| 3 | It gives two open requests for the same price different exact amounts (base amount plus a tag of 1 to 9999 micro-units). | "gives two customers paying the same price different exact amounts" |
| 4 | It builds an EIP-681 payment link addressed to the merchant's own address. | "builds an EIP-681 USDC transfer URI with chain id" |
| 5 | Given a list of transfers that you supply, it reports `matched`, `unpaid` or `ambiguous` by exact amount and recipient. Two payments of the same amount are reported as ambiguous, never as paid. | "tells which payment belongs to which order", "flags a duplicate payment of the exact same amount as ambiguous, never as paid", "ignores payments to other addresses" |
| 6 | An offer can list several accepted assets. Paying in two different assets is reported as ambiguous. The code does no conversion. | "offer: merchant accepts several assets, buyer pays in the one they hold, no conversion by us", "offer: payment in two different assets is ambiguous, not paid" |
| 7 | It rejects invalid addresses and zero or negative amounts. | "rejects bad addresses and amounts", "offer: rejects empty or duplicated asset lists" |
| 8 | `chainRequest.ts` has no private key, no seed phrase, no fee and no network call. | `src/lib/readmeClaims.test.ts` → "chainRequest has no keys, no fee and no network access" |
| 9 | The session report export is built in the browser, is labelled as demo data, and carries no free-text or personal fields. | `src/lib/pilotReport.test.ts` → "includes the snapshot, completion, generated-at time and demo label", "contains no fields beyond the local snapshot, friction capture and demo metadata" |
| 10 | `src/lib/screening.ts` compares an address to a snapshot of the public OFAC SDN digital-currency addresses (`src/data/ofacAddresses.json`, 499 addresses, downloaded 2026-10-02) and returns `listed`, `not-listed`, `list-not-loaded` or `empty`. EVM addresses match in any letter case. An empty list says `list not loaded`, never `clean`. It does no network call. | `src/lib/screening.test.ts` → "warns when an address is on the OFAC list, in any letter case", "passes an address that is not on the list, and says only that it is not on this snapshot", "reports list not loaded for an empty list instead of calling the address clean" |
| 11 | The merchant `New sale` screen has an optional address field that shows a visible warning when the address is on the snapshot. It only warns: nothing is disabled or blocked, and the address is not sent or stored. | `src/AddressCheck.test.ts` → "renders a visible warning, not a block, for a listed address", "renders list not loaded when the list is empty and never says not on the snapshot" |
| 12 | `scripts/update-ofac.mjs` is a hand-run maintenance script (not part of the app) that downloads the public OFAC list and extracts its `Digital Currency Address` entries into the snapshot file. | `src/lib/ofacParse.test.ts` → "extracts Digital Currency Address entries, lowercases 0x and bech32, keeps base58 exact" |
| 13 | `src/lib/chainReader.ts` reads ERC-20 Transfer logs for one token and one recipient through an injected `fetch`, splits too-wide ranges, drops removed logs, rejects logs from another contract/recipient/range, and stops at a call budget. It sends only read-only RPC methods. | `src/lib/chainReader.test.ts` → "asks the node for ONLY this token, Transfer events and this recipient (filtering happens at the node)", "sends only read-only RPC methods, ever", "throws when the node returns a log for another recipient or outside the range (never trusts the node blindly)", "stops at the call budget instead of hammering a free endpoint" |
| 14 | `src/lib/confirmation.ts` turns a request, its transfers and the chain head into one state: `unpaid`, `pending`, `confirmed` (with a `final` flag only if the node reports a finalized block), `ambiguous`, `reorged` or `unknown`. A transfer seen earlier that disappears is `reorged`; a head that moves backwards is `unknown`; two matching transfers are `ambiguous`. | `src/lib/confirmation.test.ts` → "pending until N confirmations (the block itself counts as 1), then confirmed", "REORG: a transfer seen earlier that vanished is reported, never silently unpaid", "two matching transfers are ambiguous, even if both are deep: never paid", "unknown (never a guess) when the head goes backwards compared to the last look" |
| 15 | `src/lib/tagging.ts` draws the per-request amount tag at random (not smallest-free) and excludes tags already used by open requests and by transfers the merchant already received on chain. | `src/lib/tagging.test.ts` → "is not guessable: the first request is NOT always base+1 (unlike smallest-free-tag)", "COLLISION: 2,000 requests at one price and merchant never share an amount", "never reuses an amount the merchant already received on chain (history)" |
| 16 | The merchant `New sale` screen and the buyer wallet screen each have a clearly labelled **live test** panel (Base Sepolia only; mainnet links are refused) wired to the modules above. The merchant panel creates a request and shows its state; the buyer panel parses a pasted payment link and shows what it asks. Neither signs, sends or holds anything. | `src/lib/liveSession.test.ts` → "refuses mainnet unless explicitly allowed", "opens at the head, avoids amounts the merchant already received, then goes unpaid -> pending -> confirmed(final)", "detects a reorg between two polls"; `src/lib/requestLink.test.ts` → "rejects other tokens, chains, extra parameters, zero amounts and junk"; `src/LivePanels.test.ts` → "merchant panel is labelled testnet read-only", "buyer panel refuses a mainnet link" |

Run all checks: `npm ci && npm test`.

## What we do not do yet

- The demo flows (balances, quotes, tap, receipts) are still fictional. Only the two "live test" panels (row 16) touch the chain, on Base Sepolia, read-only. Real mainnet use is switched off in the screens.
- The chain reader has been run once against the real public Base mainnet endpoint (see `docs/evidence/`), never against a real merchant payment. Rate limits under many users, endpoint outages and a lying RPC node are not handled beyond erroring out; one public endpoint is a single point of failure and sees the user's IP address.
- Confirmation count (12 blocks, about 24 s on Base) is a chosen default, not a measured safe value. "final" is only as good as the node's `finalized` answer.
- The amount tag does not tell who paid and cannot stop a third party from sending the exact amount (see `docs/MATCHING_DESIGN.md`). A reference-bearing design is described there and NOT built.
- Matching by exact amount can be fooled: transfers on a public chain can be made by anyone, including a third party sending the same amount. Do not treat "matched" as proof of payment from a particular person.
- Sanctions screening is a **warning only, from a snapshot**. The list is a static copy of the OFAC SDN file taken on 2026-10-02 and committed to the repository; the app never downloads it. It **may be incomplete or outdated** and is only refreshed when someone runs `node scripts/update-ofac.mjs` and commits the result. "Not on the list" is not a statement that an address is lawful or safe. Only OFAC is covered: no EU, UK or UN list, and no hack-address lists.
- Screening matches by exact address. The snapshot has 499 addresses, of which 91 are in `0x` (EVM) format (listed by OFAC as ETH, USDT, USDC or ETC). The rest are other chains (mostly Bitcoin and Tron, plus a few others such as Litecoin, Monero and Solana). The screening code compares any string exactly, but addresses of other chains are only matched if you type them in the check field; the payment code itself accepts only `0x` addresses on Base. Whether an EVM address that is listed on another EVM chain is also risky on Base is not decided by this code: it simply matches the address.
- Screening is not wired into `chainRequest.ts`. The check field in the merchant screen is separate from the fictional demo sale, and no payer address is read from the chain (see above), so nothing checks a real payer automatically.
- No unlinkable payments, no tokens, no GNU Taler integration. The text in the demo that mentions unlinkable payments describes a design goal that is not implemented.
- No custody, issuance, exchange, fiat settlement or bank connection of any kind.
- No audit, no security review, no legal review. No lawyer has signed off on anything here.
- The authors have not chosen how, or whether, this project will make money.

## Licence

No licence is granted at the moment. The code is visible but all rights are reserved until a licence is chosen. If you want to use it, ask first.

## Legal and risk

This is software under development, not a payment service, and not legal, tax or financial advice. Whether and how any such software may be offered depends on the law where it is used. That question is open and is being worked on with counsel; this repository claims no answer to it.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm ci
npm run dev       # open the URL Vite prints
npm test
npm run build
```

State is stored only in your browser. The reset icon in the header clears it.

## More

- [docs/CORE_RULE.md](docs/CORE_RULE.md): the rules that protect the project's core.
- [docs/REGULATORY_BOUNDARIES.md](docs/REGULATORY_BOUNDARIES.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): current design notes (rewritten for the non-custodial model; still working documents, not statements of legal position).
- [SECURITY.md](SECURITY.md)
