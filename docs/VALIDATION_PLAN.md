# Validation Plan

> Product under test, as of 2026-10-07: **any-in → any-out**. The payer sends crypto they already hold. For an EU leg, preferred payout assets are USDC, EURC, BTC, and ETH. USDT is not an EU merchant payout or EU settlement rail. See `docs/ESMA_USDT_EU_FOLD_2026-10-11.md`. The merchant receives on the payout rail they prefer. Merchants are online shops, offline stores, and market stalls or street sellers. The merchant installs nothing. The primary experience is a QR or pay-link on a phone, not a website checkout. The Base Sepolia matcher is one optional rail, not a Base-mainnet MVP. Do not recruit a pilot that requires anyone to fund Base. The phases below are an older usability plan. They are not the product definition.

## Objective

Test whether buyers understand and value *unlinkable spend without routine KYC* (within lawful thresholds), and whether merchants accept remaining identified/auditable while shoppers are not — without presenting a prototype as a live financial service. Read that objective as one question inside the any-in → any-out product above, not as a Base-only checkout.

## Phase 1 — Usability prototype

Recruit 8–12 buyers and 5–8 small merchants. Use fictional scenarios and the DEMO build only.

Measure:

- buyer task completion: choose asset → interpret quote → tap → find receipt;
- merchant task completion: enter amount → choose settlement → request → export receipts;
- quote comprehension (rate, conversion fee, payment fee, merchant amount);
- understanding that **no routine buyer KYC is the design target, not a legal guarantee**;
- understanding that the **merchant stays identified** and receipts are a merchant audit trail;
- ability to distinguish AgoraTap from a Visa-style crypto card;
- time to complete, critical errors and confidence rating;
- merchant preference between EURC and fiat settlement, with reason.

Exit criteria: ≥80% unassisted completion on both core flows; ≥80% correctly answer quote and privacy-boundary questions; no participant mistakes the demo for real funds or for guaranteed anonymity after onboarding.

## Phase 2 — Desirability and operations

Run 15–20 structured interviews using neutral questions. Do not collect money or promise launch terms. Test fee sensitivity with clearly hypothetical ranges. Map merchant reconciliation, refunds, shift close and accounting needs. Validate whether “no routine buyer KYC” increases trust or creates compliance concern once lawful thresholds and sanctions/AML-at-the-edge are explained.

Exit criteria: at least five merchants request a follow-up pilot conversation and identify a concrete current pain; buyer preference persists after lawful-control boundaries are explained.

## Phase 3 — Partner and legal discovery

Obtain written perimeter analysis from qualified counsel on: in-threshold buyer privacy, merchant KYB, sanctions screening without a shopper graph, and transfer-of-funds / AML package implications. Request technical/commercial discovery with licensed CASP/EMI and SEPA-capable partners. Build a responsibility matrix for onboarding, safeguarding, custody, screening, fraud, disputes, support, reporting and data-controller roles.

No live pilot proceeds without approved architecture, signed regulated partners, security review, data-protection assessment and testable consumer disclosures.

## Phase 4 — Sandbox

Integrate only provider sandboxes and test assets. Add signed/idempotent requests, replay prevention, reconciliation, observability and failure states. Conduct threat modeling, penetration testing, protocol review and incident exercises. Define refunds and exception handling before any limited live-money proposal.

## Evidence discipline

Keep participant consent, scripts, raw observations and decision logs. Report denominator and failures, not only positive quotes. Do not publish testimonials, logos, partnerships, conversion rates, savings or compliance claims without verifiable evidence and permission.
