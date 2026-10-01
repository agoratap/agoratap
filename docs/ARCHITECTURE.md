# Architecture

Status: rewritten 2026-10-01 to the non-custodial model. Earlier text described an issuer/exchange layer with a licensed CASP/EMI and KYB-identified merchants; that is no longer the design.

## Purpose

AgoraTap is a common language for **offer → authorisation → payment → proof** between two parties who have already agreed on a trade. It moves nothing itself.

**Product invariant:** the buyer pays from their own wallet directly to the merchant's address, in an asset they choose from the merchant's accepted list. AgoraTap holds no keys, holds no funds, converts nothing, relays nothing.

## What exists today [FACT]

1. **Local demo (React/Vite PWA)** — simulated buyer/merchant flow, one versioned `localStorage` record (`agoratap-demo-v1`), merchant-readiness session in memory only. No network calls.
2. **Request library `src/lib/chainRequest.ts` (+ test)**
   - `createRequest` / `eip681Uri`: builds an EIP-681 payment URI for EURC or USDC on Base. Amount = base amount plus a unique micro-tag (max 9999 micro-USDC) so each open request is distinguishable.
   - `matchRequest`: given public transfer logs, finds the transfer that matches an open request.
   - `createOffer` / `matchOffer`: asset-neutral offer — the merchant lists accepted assets, the buyer pays whichever they hold.
   - No keys, no network calls, no fee in this code.

## Data flow (design)

```text
Merchant: creates offer (accepted assets, amount, own receiving address)
   │  link / QR (EIP-681)
   ▼
Buyer: opens in own wallet, picks an accepted asset, signs and sends himself
   │  on-chain transfer, wallet → wallet
   ▼
Public chain
   │  read-only
   ▼
Reader (optional, replaceable, self-hostable): sees matching transfer → shows "paid"
   ▼
Accounting layer (the paid product): reconciliation, exports, reports
```

- The **reader** only reads public data. It does not sign, send or hold. The merchant must be able to run it themselves or ignore it and still be paid.
- If the merchant wants a different asset or fiat, **they** convert, on their side, through a provider they choose. AgoraTap is not in that path.

## Trust and threat table

| Actor | Learns | Does not learn |
| --- | --- | --- |
| Merchant | Amount, asset, tx hash, payer's public address | Buyer's name or other purchases beyond what the public chain shows |
| AgoraTap hosted reader (if used) | Public chain data about merchant addresses | Keys, balances it controls (none), buyer identity |
| Public chain observers | Everything on-chain | — |

Honest limits: payments on a public chain are publicly linkable. The unique-amount tag is a matching aid, not privacy. Privacy-preserving assets and unlinkability remain research, not implemented here. Matching by amount can mis-match or be spoofed (someone paying the same tag); needs tests and a confirmation-depth rule before real use. The demo `localStorage` is readable on the device and receipts are unsigned.

## Non-goals

Custody, key management, exchange/conversion, relaying or broadcasting transactions, stablecoin issuance, buyer KYC, merchant KYB, card networks, bank APIs, refunds on behalf of anyone. (Refunds are a new payment from the merchant's own wallet.)

## Design principles

- Ask for every feature: *how much can happen directly between the parties without us?*
- Anything AgoraTap hosts must be optional and replaceable by the user's own copy.
- Fees are explicit; there is none on payment flow. Revenue is the accounting subscription.
- Publish an abuse policy and keep a register of what we learned and what we did.
- Do not claim legal status; see `REGULATORY_BOUNDARIES.md`.

Roadmap and decentralisation stages: [RESILIENCE_AND_DECENTRALIZATION.md](RESILIENCE_AND_DECENTRALIZATION.md).
