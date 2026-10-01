# AgoraTap

AgoraTap is an early, unfinished project. This page says only what the code in this repository does today. Each statement in the "What the code does today" table points to a test that checks it. Anything not in that table should be read as not done.

> **Nothing here handles real money.** There is no server, no account system, no custody and no service run by the authors. Do not send real funds because of anything you read in this repository.

## What the code does today

| # | What the code does | Checked by |
|---|---|---|
| 1 | The browser demo keeps its data in the browser's `localStorage` (key `agoratap-demo-v1`) and its source contains no `fetch`, XHR, WebSocket or web3-library calls. (The installable-app service worker only caches the app's own files. The demo has one outbound link, to GNU Taler's public demo; nothing is sent with it.) | `src/lib/readmeClaims.test.ts` → "app source makes no network calls" |
| 2 | `src/lib/chainRequest.ts` turns a euro price into an exact EURC or USDC amount on Base (EURC is the default, no exchange rate needed). | `src/lib/chainRequest.test.ts` → "converts EUR to atomic USDC", "defaults to EURC: merchant is asked for the euro amount with no exchange rate" |
| 3 | It gives two open requests for the same price different exact amounts (base amount plus a tag of 1 to 9999 micro-units). | "gives two customers paying the same price different exact amounts" |
| 4 | It builds an EIP-681 payment link addressed to the merchant's own address. | "builds an EIP-681 USDC transfer URI with chain id" |
| 5 | Given a list of transfers that you supply, it reports `matched`, `unpaid` or `ambiguous` by exact amount and recipient. Two payments of the same amount are reported as ambiguous, never as paid. | "tells which payment belongs to which order", "flags a duplicate payment of the exact same amount as ambiguous, never as paid", "ignores payments to other addresses" |
| 6 | An offer can list several accepted assets. Paying in two different assets is reported as ambiguous. The code does no conversion. | "offer: merchant accepts several assets, buyer pays in the one they hold, no conversion by us", "offer: payment in two different assets is ambiguous, not paid" |
| 7 | It rejects invalid addresses and zero or negative amounts. | "rejects bad addresses and amounts", "offer: rejects empty or duplicated asset lists" |
| 8 | `chainRequest.ts` has no private key, no seed phrase, no fee and no network call. | `src/lib/readmeClaims.test.ts` → "chainRequest has no keys, no fee and no network access" |
| 9 | The session report export is built in the browser, is labelled as demo data, and carries no free-text or personal fields. | `src/lib/pilotReport.test.ts` → "includes the snapshot, completion, generated-at time and demo label", "contains no fields beyond the local snapshot, friction capture and demo metadata" |

Run all checks: `npm ci && npm test`.

## What we do not do yet

- The browser demo screens are **not connected** to `chainRequest.ts`. The buyer and merchant screens show fictional balances and fictional receipts.
- Nothing reads the blockchain. `matchRequest` only compares a list you give it. How that list is obtained is not built.
- No confirmation rule exists. A payment is not checked for finality or reorgs.
- Matching by exact amount can be fooled: transfers on a public chain can be made by anyone, including a third party sending the same amount. Do not treat "matched" as proof of payment from a particular person.
- No screening of addresses against sanctions lists exists.
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
