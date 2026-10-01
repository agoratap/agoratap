# Regulatory Boundaries

Status: rewritten 2026-10-01 to match the Principal's confirmed intent (`apex-state/AGORA_PRINCIPAL_INTENT.md`). This replaces the earlier licensed-CASP/EMI + merchant-KYB model. This is not legal advice and claims no approval in any jurisdiction. Every legal statement carries a label: **FACT** (verifiable in code or an official text), **INTERPRETATION** (reasoned, not confirmed), **COUNSEL** (open question for a crypto-specialised lawyer).

## 1. What AgoraTap is and is not

- **Is:** an open, non-custodial standard and software for asset-neutral payment requests. The merchant lists the assets they accept; the buyer pays with whatever they hold, from their own wallet, directly to the merchant's address.
- **Is not:** a payment processor, custodian, exchange, issuer, relay, or bank. AgoraTap never holds keys, never holds or moves funds, never converts, never relays a transaction. **[FACT, code]** `src/lib/chainRequest.ts` contains no keys, no network calls and no fee; the payer's wallet sends.
- Conversion is always the choice of the party who wants a different asset, done through that party's own provider, outside AgoraTap.
- Current repo state **[FACT]**: `main` is a local demo plus the request-building library. No live money flows through anything in this repository.

## 2. Revenue model (decided)

- Revenue is a **subscription for the accounting/reconciliation layer** (matching payments to sales, exports, reports). **[Principal decision 2026-10-01]**
- **No fee on payment flow.** No percentage, no per-transaction charge, no spread. AgoraTap earns nothing from the movement of value itself.
- **[INTERPRETATION]** A flat subscription not tied to volume is easier to defend as "selling software" than a per-flow fee. **[COUNSEL]** confirm, including VAT/tax treatment of the subscription.

## 3. Chain-reading and "paid" status

AgoraTap's reporting service reads public chain data and shows "paid" when a matching transfer exists. Matching uses the base amount plus a unique micro-tag **[FACT, code]**.

- **[INTERPRETATION]** This is functionally what a block explorer does: it reads public data and reports it; it does not instruct, execute, hold or transmit anything. We rate this the lowest-risk component of the project.
- **[COUNSEL]** Does a *hosted* service that reads the chain and reports "paid" to a merchant, for a subscription, change the classification vs. an explorer? Would it change if the merchant runs the reader themselves (self-hosted) rather than us?
- Design response regardless of the answer: keep the reader replaceable and self-hostable by the merchant; AgoraTap's hosted copy must be optional, never required for the merchant to receive funds.

## 4. Scope questions for counsel (not conclusions)

| # | Question | Label |
|---|---|---|
| 1 | Does non-custodial software that standardises offer/authorisation/proof, never touching keys or funds, fall outside MiCA crypto-asset services (Art. 3, incl. "transfer services on behalf of clients")? MiCA recital text says non-custodial wallet *software* providers are outside scope, but the real service model decides, not the label. | COUNSEL |
| 2 | AMLR (EU) 2024/1624, applying mainly from 10 Jul 2027: recital 160 exempts hardware/software providers and self-hosted wallets without access/control. A recital is not an operative article. | INTERPRETATION until confirmed |
| 3 | TFR (EU) 2023/1113 applies to transfers to/from self-hosted addresses *when a CASP is involved*. Pure wallet-to-wallet without a CASP is not treated the same. | INTERPRETATION (strong) |
| 4 | When a *merchant* converts to fiat through a CASP, TFR/KYB falls on that CASP-merchant relationship, not on AgoraTap or on the buyer's self-hosted payment. | INTERPRETATION |
| 5 | Is the merchant (accepting crypto directly) an obliged entity or subject to local tax/AML duties (Cyprus/EU)? | COUNSEL |
| 6 | Entity and jurisdiction of the operator; personal exposure of the founder vs. the entity. | COUNSEL |
| 7 | GDPR/ePrivacy for the hosted reader: what data, how long. Design target: none about buyers beyond public chain data. | COUNSEL |

## 5. Abuse and sanctions posture

- AgoraTap does not operate payments and so cannot freeze or reverse them. This is stated publicly.
- Published abuse policy (see `apex-state/research/trocador-model-and-abuse-policy-2026-10-01.md` §3): abuse reports are logged; credible reports about a merchant address lead to removal of that address from the hosted reader/directory and to a written entry in an internal register of what was learned and done. Valid legal process is answered; the data held is minimal by design.
- **[COUNSEL]** whether sanctions screening of merchant addresses in the hosted service is required, recommended or counter-productive.

## 6. Claims we do not make

- No "anonymous", "untraceable" or "KYC-free" claims. Public chains are public.
- No "licensed", "approved" or "compliant" claim in any jurisdiction before counsel's written opinion.
- No partner logo or integration claim without a signed agreement.
- "Non-custodial" is a description of the design, not a legal conclusion.

## 7. Gate

Before any real-money pilot: counsel produces a written perimeter and responsibility matrix (see `RESILIENCE_AND_DECENTRALIZATION.md`, review gate). Until then: demo and testnet/own-funds tests only.
