# Architecture

## Purpose

AgoraTap tests an interaction model, not a production payment protocol. The app is a single React PWA. All state and every transition are local and simulated.

**Product invariant:** the merchant is identified and auditable; the buyer spends unlinkable payment credentials and should not undergo routine identity collection within lawful risk/value thresholds. That invariant is a design target. This repository does not implement the cryptography or legal controls that would make it real.

## Prototype components

1. **Buyer wallet UI** — seeded EURC/USDC balances, asset selection, deterministic quote logic, tap simulation, receipt and privacy explainer.
2. **Merchant till UI** — amount and settlement selection, payment-request state, completion simulation and merchant receipts.
3. **Domain logic** — pure TypeScript functions validate amounts, calculate quotes, create requests, complete payments, freeze pilot-session snapshots and render CSV.
4. **Persistence** — one versioned `localStorage` record for the simulated buyer/merchant flow. Reset restores seeded data. Merchant-pilot sessions are held only in component memory and disappear on refresh.
5. **Merchant readiness UI** — creates a fictional, immutable session card for local usability testing. It has no live order or payment status.
6. **PWA shell** — web manifest and generated service worker cache static app assets.

The app has no private GNU Taler API adapter and sends no order, authorization capability or user-entered pilot data to GNU Taler. The buyer/merchant simulation shares local state. A fixed external link opens GNU Taler's separate official public demo without query parameters or entered values; that external site is not an AgoraTap integration.

## Immediate business wedge

AgoraTap starts as the **merchant acceptance and checkout-integration layer**, not as an issuer, exchange, custodian or settlement provider. The first evidence product is a structured local merchant usability session with fictional value: can staff create a scenario, can a shopper understand the simulated flow, and can both understand the receipt and privacy boundary? Only measured merchant pull advances the product toward a paid integration pilot and an operator-controlled GNU Taler test environment.

## Production direction

```text
Buyer wallet (unlinkable one-time tokens; no routine KYC in-threshold)
  │ blinded / unlinkable payment credential
  ▼
Issuer / exchange layer ◄── licensed CASP / EMI (funding edge, controls at lawful boundaries)
  │ spend validation, replay prevention, no reusable shopper identifier
  ▼
Merchant acceptance (KYB-identified merchant)
  │ signed proof of amount — not a buyer profile
  ▼
Merchant POS ── settlement choice ──> EUR stablecoin custody  or  SEPA Instant
```

A real design should separate:

- **Funding identity** (if any, at regulated edges and above thresholds) from **individual purchase disclosure**.
- **Payment proof** from **settlement instruction** so merchant settlement preference does not identify the buyer.
- **Protocol data** from regulated compliance records with purpose limitation and retention.

## Threat model (design target)

| Actor | Should learn | Should not learn |
| --- | --- | --- |
| Merchant | Amount, payment proof, own KYB identity, settlement status | Buyer name, reusable wallet ID, funding history, other purchases |
| Card network | Nothing — there is no card-network authorization | Buyer PAN, merchant category graph, location trail |
| Issuer / exchange | That a valid token was spent, replay prevention, threshold/sanctions signals | A merchant-visible shopping profile; purchases linkable to each other beyond protocol necessity |
| Settlement partner | Merchant account, amount, timing needed to move money | Buyer identity for ordinary in-threshold payments |
| Attacker with POS logs | Merchant-side amounts and proofs | A graph of who bought what across shops |

This is why AgoraTap is not a Visa crypto card: those products still sit on card authorization. The network can profile the buyer even if the funding asset is a stablecoin.

Honest limits of this demo: localStorage is readable on-device; receipts are unsigned; there is no blinding, no double-spend prevention, no NFC channel binding, and no real screening. “Settled” means only that demo state advanced.

## Trust boundaries

- Buyer device ↔ issuer: credential issuance, recovery, key compromise, threshold controls.
- Buyer device ↔ merchant: proximity/channel binding, request integrity, amount confirmation, relay/replay attacks.
- Merchant ↔ acquirer: merchant identity, device enrollment, signed receipts, refunds and disputes.
- Acquirer ↔ settlement partner: liquidity, finality, reconciliation, safeguarding and operational resilience.

## Non-goals of this repository

No implementation of GNU Taler, NFC, offline payment, blockchain, custody, stablecoin issuance, exchange, KYC/KYB, sanctions screening, fraud scoring, refunds, disputes or bank APIs.

## Design principles for a later system

- Minimize linkable buyer data; no reusable merchant-facing identifiers.
- Preserve amount/merchant consent at signing time.
- Make fees, exchange rates, expiry and settlement status explicit.
- Use idempotent state machines and cryptographically verifiable receipts.
- Prefer licensed providers over building regulated custody or fiat movement in-house.
- Treat SEPA as an optional fiat settlement rail, not as the buyer authorization network.
- Do not treat privacy as a way around sanctions or AML obligations.

The staged resilience and decentralization roadmap is maintained in [RESILIENCE_AND_DECENTRALIZATION.md](RESILIENCE_AND_DECENTRALIZATION.md).
