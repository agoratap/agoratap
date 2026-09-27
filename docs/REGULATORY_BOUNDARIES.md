# Regulatory Boundaries

This document frames questions for qualified counsel and regulated partners; it is not legal advice and does not claim approval in any jurisdiction.

## Clear prototype boundary

AgoraTap currently moves no money and provides no payment, custody, exchange, issuance, transfer, banking, or identity service. All assets, quotes, transfers and SEPA status labels are seeded or calculated demo data. Nothing here is a legal anonymity guarantee.

## Core product claim (design target, not current law)

- **Merchant:** remains identified. Production requires KYC/KYB, beneficial-owner checks, sanctions screening, risk classification, ongoing monitoring, and an auditable settlement trail.
- **Buyer:** should not undergo *routine* identity collection for everyday payments *within lawful risk/value thresholds*. The buyer spends unlinkable payment credentials/tokens. This is the differentiator — not an optional extra.
- **Not a guarantee:** thresholds, when identity *is* required, how sanctions lists are applied without rebuilding a shopper profile, and responses to valid legal process all require counsel and licensed partners. This demo implements none of that.

Do not read “no routine buyer KYC” as “no AML,” “no sanctions screening,” or “anonymous for any amount.” Privacy for ordinary low-risk spend is compatible with controls at the edges. Evasion is out of scope.

## Production path

A credible EU launch path would require a jurisdiction-by-jurisdiction perimeter assessment and likely partnerships with licensed entities:

- a licensed CASP for relevant crypto-asset custody/exchange/transfer functions;
- an EMI, payment institution, credit institution, or appropriately sponsored program for e-money/payment services and safeguarding;
- a bank or payment partner for SEPA Instant reachability and reconciliation;
- regulated stablecoin issuers/assets accepted under the applicable framework.

Exact roles determine licensing, agency, outsourcing and liability. Provider logos or partnerships must not be claimed before signed agreements and diligence.

## Merchant obligations

Merchants would undergo KYC/KYB, beneficial-owner checks, sanctions screening, risk classification and ongoing monitoring. Acceptance devices and settlement accounts must be bound to the verified merchant. Records, refunds, complaints, tax evidence and suspicious-activity processes need defined ownership. The merchant audit trail records *merchant* activity and settlement, not a reusable buyer identity.

## Buyer privacy and controls

The design goal is purchase unlinkability and *no routine buyer identity collection in-threshold*. It is not exemption from law.

Production controls may include:

- published risk/value thresholds above which additional buyer checks apply;
- regulated funding-edge controls that do not leak a shopper graph to merchants;
- velocity/value monitoring at protocol boundaries rather than merchant-visible profiles;
- sanctions screening designed to avoid creating a checkout identity unless legally required;
- freezes, escalation and response to valid legal process.

Controls should avoid exposing a reusable buyer identity or full wallet history to the merchant.

## Why this is not a Visa crypto card

Visa (and similar) crypto cards convert an asset into a card authorization. The card network still sees merchant, amount, time and a persistent PAN/token. That is buyer transaction profiling by a network, and often by the acquirer. AgoraTap’s design target is:

- no card-network authorization;
- no merchant-side buyer profiling;
- unlinkable one-time payment credentials.

Card networks may still appear *upstream* if a buyer later chooses a card-funded on-ramp. That on-ramp is outside the proposed payment proof and must be disclosed honestly.

## Rails and claims

- AgoraTap proposes **no card-network authorization** at checkout.
- **SEPA remains part of the system when a merchant chooses fiat settlement.** “Card-network-free” does not mean “bank-rail-free.”
- EUR stablecoin settlement is not the same as legal-tender bank money and must be described accurately.
- Privacy, speed, finality, fee and availability claims require measured evidence and legal review.

## Additional workstreams

MiCA/crypto-asset classification, PSD2/PSD3/PSR perimeter, AML package/transfer-of-funds obligations, e-money analysis, DORA/outsourcing, GDPR/ePrivacy, consumer rights, tax/accounting, sanctions, competition and accessibility all require specialist review before a pilot. The applicable framework will depend on product structure and launch date.
