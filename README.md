# AgoraTap

A mobile-first PWA prototype for card-network-free everyday payments. AgoraTap explores a GNU Taler-inspired interaction: a buyer spends unlinkable payment tokens without routine identity collection, and an identified merchant settles in EUR stablecoin or simulated SEPA Instant.

**Core differentiator:** no routine buyer KYC. Merchant remains identified and auditable. Buyer privacy is a design target requiring counsel and licensed partners — not a current legal guarantee.

> **DEMO ONLY.** No real funds move. No blockchain transaction, banking instruction, identity check, or regulatory approval exists in this repository.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

Verification:

```bash
npm test
npm run build
npm run preview
```

Reset all saved demo balances, requests, and receipts with the reset icon in the header. State is stored only in browser `localStorage` under `agoratap-demo-v1`.

## Evidence mode

AgoraTap is a **local product and merchant-readiness simulation**. Buyer balances, quotes, NFC-style interaction, settlement choices, pilot-session facts and receipts are fictional browser state. The app does not call a GNU Taler merchant API, create an order, hold a credential or prove protocol connectivity.

The Merchant pilot screen captures an immutable local snapshot—fictional amount, scenario label, session ID and start time—so the displayed facts cannot drift with later input. It also links to GNU Taler's separate official public demo using a fixed URL that includes none of the entered values.

### Export session report

Once a pilot session is started, **Export session report** on the Merchant pilot screen downloads two files built entirely in the browser from local state: `agoratap-DEMO-pilot-session-<id>.json` and a readable field/value `.csv`. Both carry the label **"DEMO - fictional data, no real funds, not legal/regulatory evidence"**, a `generatedAt` timestamp, the snapshot facts (session ID, scenario label, fictional amount, start time, environment), and completion status/time/duration if "Record scenario complete" was pressed. Friction notes are not captured by this version and are marked as not recorded. The export makes no network request, is unsigned, and contains no buyer or personal data; the CSV neutralises spreadsheet formulas in the scenario label. Some browsers ask permission before allowing the second download.

The immediate business wedge is **merchant payment-acceptance readiness and workflow evidence**: run a structured local checkout usability session, record completion and friction, and earn the right to discuss a paid integration pilot. GNU Taler integration is future work that requires an operator-controlled test environment and a server-side boundary for private APIs. AgoraTap does not offer custody, issuance, exchange or settlement.

## What the MVP demonstrates

- **Buyer:** seeded EURC/USDC balances, demo funding, asset selection, explicit rate and fee quote, simulated NFC tap, receipt, and privacy explainer (unlinkable tokens vs Visa-style crypto cards).
- **Merchant:** EUR amount entry, per-sale settlement choice, payment request, simulated completion, daily receipt list, and DEMO-marked CSV audit export of *merchant* settlement — not a buyer identity trail.
- **Explainer:** product thesis, threat model, and architecture/regulatory boundary map.
- **PWA:** installable manifest and service worker generated with `vite-plugin-pwa`.
- **Logic:** tested quote calculation, validation, payment lifecycle, CSV export, and pilot session report (JSON/CSV) building.

## Thesis

Everyday payments should not require the buyer to present a reusable identity or card credential. Card authorization, merchant acceptance, buyer privacy, and fiat settlement do not need to be one indivisible system.

AgoraTap’s design target:

- **Buyer:** unlinkable one-time payment credentials/tokens. No routine identity collection within lawful risk/value thresholds.
- **Merchant:** KYB-identified, auditable, chooses EUR stablecoin or SEPA Instant settlement via licensed partners.
- **Network:** no card-network authorization at checkout.

This is **not** a Visa crypto card. Crypto cards still authorize through a card network; the network (and often the acquirer) can build a buyer transaction graph. AgoraTap aims for no card network, no merchant-side buyer profiling, and payments that do not link together.

Removing card-network authorization does **not** remove regulation, merchant KYB, sanctions/AML at lawful boundaries, or fiat rails. **SEPA remains for fiat settlement.** Privacy is not sanctions or AML evasion.

## Architecture

The prototype is deliberately local:

```text
Buyer UI ── one-time demo payment proof ──> Merchant UI
    │                                           │
localStorage                               localStorage / CSV
                                           (merchant audit, not buyer ID)

Production edges: licensed CASP/EMI  → privacy-preserving issuer/exchange
                  → merchant acquirer (KYB) → EUR stablecoin or SEPA Instant
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for trust boundaries and production direction, and [docs/RESILIENCE_AND_DECENTRALIZATION.md](docs/RESILIENCE_AND_DECENTRALIZATION.md) for the lawful-resistance, jurisdiction-portability and staged decentralization path.

## Boundaries

This is an interaction and product-thesis prototype, not a payment system. It does not implement GNU Taler cryptography, custody, stablecoin transfers, NFC hardware, identity verification, AML/sanctions controls, fraud controls, bank connectivity, or final settlement. It makes no claim of regulatory approval or guaranteed anonymity.

A lawful production path would require, at minimum:

- **merchant KYC/KYB** and ongoing monitoring (merchant stays identified);
- **buyer privacy within lawful thresholds** — no routine buyer identity collection for everyday low-risk spend; not a guarantee that identity is never collected above those thresholds or under legal process;
- licensed CASP/EMI/payment partners for custody, issuance, exchange and money movement;
- sanctions/AML controls designed so they do not recreate a merchant-visible buyer profile;
- security, safeguarding, operational-resilience and consumer-protection programs;
- no card-network authorization at checkout, while recognizing that **SEPA remains for fiat settlement**.

See [docs/REGULATORY_BOUNDARIES.md](docs/REGULATORY_BOUNDARIES.md), [SECURITY.md](SECURITY.md), and [docs/VALIDATION_PLAN.md](docs/VALIDATION_PLAN.md).

## Technology

Vite, React, TypeScript, Vitest, Lucide, and `vite-plugin-pwa`. CI runs `npm ci`, `npm test`, and `npm run build` on every push and pull request.
