# Architecture

Status: product definition updated 2026-10-07. The 2026-10-01 non-custodial notes below still describe the shipped Base matcher. They do not define the product as Base-only, and they do not define an MVP that is Base mainnet.

## Product

Agora Pay is **any-in → any-out**. The payer sends an asset they already hold. For an EU leg, preferred assets are USDC, EURC, BTC, and ETH. USDT is not an EU merchant payout or EU settlement rail. If a payer holds USDT, that stays optional and payer-side only: Agora Pay does not route USDT to EUR. The merchant receives on the payout rail they prefer. See [ESMA_USDT_EU_FOLD_2026-10-11.md](ESMA_USDT_EU_FOLD_2026-10-11.md). Merchants are all types: online shops, offline stores, and market stalls or street sellers. The merchant installs nothing. The primary experience is a QR or pay-link the seller shows on a phone, not a website checkout the merchant must host.

Agora Pay does not hold keys or funds. Mainnet is not enabled in this repository. Nobody has to fund Base to use or pilot the product.

The route class is a LibertySwap / Trocador-style path: what went in is not required to be what the merchant receives. That route is the product direction. It is not a live swap in this repository. The direct Base transfer described later is one optional rail, the matcher that is already shipped on Base Sepolia.

## Purpose (non-custodial note, 2026-10-01)

Agora Pay is a common language for **offer → authorisation → payment → proof** between two parties who have already agreed on a trade. It moves nothing itself and holds no keys.

The shipped matcher lets a buyer pay a Base Sepolia test transfer to an address the merchant already controls. That is one rail. It is not the product invariant. The product invariant is any-in → any-out onto the merchant’s preferred payout rail, for every kind of seller, with nothing to install.

## What exists today [FACT]

1. **Local practice PWA (React/Vite)** — simulated buyer/merchant flow. The storage key is `agorapay-pilot-v1` (an older `agoratap-demo-v1` record is copied once). The live-test panels make read-only Base Sepolia calls. That contact is the optional matcher, not the product, and it does not enable mainnet.
2. **Request library `src/lib/chainRequest.ts` (+ test)**
   - `createRequest` / `eip681Uri`: builds an EIP-681 payment URI for EURC or USDC on Base. Amount = base amount plus a unique micro-tag (max 9999 micro-USDC) so each open request is distinguishable.
   - `matchRequest`: given public transfer logs, finds the transfer that matches an open request.
   - `createOffer` / `matchOffer`: asset-neutral offer — the merchant lists accepted assets, the buyer pays whichever they hold.
   - No keys, no network calls, no fee in this code.

## Data flow of the optional Base matcher

This diagram is the shipped Base Sepolia rail, not the any-in → any-out product. The product way to pay is a QR or pay-link on a phone. This matcher does not draw that QR.

```text
Merchant: creates a test request (EURC on Base Sepolia, own receiving address)
   │  share link (EIP-681 + #ref=)
   ▼
Payer: opens it in their own wallet and sends the test transfer
   │  on-chain transfer, wallet → address
   ▼
Base Sepolia
   │  read-only
   ▼
Reader in this app: sees a matching test transfer → shows a state
```

- The **reader** only reads public data. It does not sign, send or hold. The merchant must be able to run it themselves or ignore it and still be paid.
- If the merchant wants a different asset or fiat, the **product direction** is an any-in → any-out route (LibertySwap / Trocador class) that pays their preferred rail. Agora Pay is not in custody of the funds. That route is not built in this repository. The diagram above is the optional Base matcher, where a test transfer lands on an address the merchant already controls.

## Trust and threat table

| Actor | Learns | Does not learn |
| --- | --- | --- |
| Merchant | Amount, asset, tx hash, payer's public address | Buyer's name or other purchases beyond what the public chain shows |
| AgoraTap hosted reader (if used) | Public chain data about merchant addresses | Keys, balances it controls (none), buyer identity |
| Public chain observers | Everything on-chain | — |

Honest limits: payments on a public chain are publicly linkable. The unique-amount tag is a matching aid, not privacy. Privacy-preserving assets and unlinkability remain research, not implemented here. Matching by amount can mis-match or be spoofed (someone paying the same tag); needs tests and a confirmation-depth rule before real use. The demo `localStorage` is readable on the device and receipts are unsigned.

## Non-goals

Custody, key management, Agora Pay holding a float or operating an exchange, relaying or broadcasting transactions from this app, stablecoin issuance, a USDT merchant payout or USDT→EUR settlement on an EU leg, a buyer-KYC gate, card networks, and refunds on behalf of anyone. (Refunds are a new payment from the merchant's own wallet.) A partner-class any-in → any-out route is the product direction. It is not built here. This app still does not sign or send, and it does not ask anyone to fund Base.

## Design principles

- Ask for every feature: *how much can happen directly between the parties without us?*
- Anything AgoraTap hosts must be optional and replaceable by the user's own copy.
- Fees are explicit; there is none on payment flow. Revenue is the accounting subscription.
- Publish an abuse policy and keep a register of what we learned and what we did.
- Do not claim legal status; see `REGULATORY_BOUNDARIES.md`.

Roadmap and decentralisation stages: [RESILIENCE_AND_DECENTRALIZATION.md](RESILIENCE_AND_DECENTRALIZATION.md).
