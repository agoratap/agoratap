# Lawful Resilience and Decentralization Path

## Mandate

AgoraTap should be lawful without being needlessly obedient to the most restrictive implementation of a rule. The product should preserve buyer privacy and open access as far as applicable law permits, challenge unclear or disproportionate constraints through lawful process, and remain portable when a jurisdiction makes the model impossible.

This is an engineering and counsel brief, not legal advice. It does not authorize concealment, sanctions evasion, obstruction of lawful process, or operating a regulated service without the required authorization.

## Decision order

For each material constraint:

1. **Minimize scope:** keep AgoraTap outside regulated custody, issuance, exchange, payment initiation and settlement wherever the product can remain a technical integration layer.
2. **Interpret precisely:** ask qualified counsel for the narrowest defensible reading, the evidence required, and the exact boundary that triggers authorization.
3. **Design around the boundary lawfully:** separate protocol, operator, merchant and regulated-edge responsibilities so one obligation does not contaminate the whole product.
4. **Challenge or change:** use consultation, industry coalitions, administrative review, litigation or legislative advocacy where proportionate.
5. **Move the operator:** if the model remains lawfully impossible, compare jurisdictions and relocate before launch or migration—not after a breach.
6. **Decentralize the choke point:** when a central operator is the remaining avoidable control or failure point, replace it with an open protocol and multiple independent operators.

## Portability requirements

- No permanent dependency on one bank, card network, custodian, cloud, domain registrar, app store or licensed partner.
- Protocol and data formats are open and versioned; merchants can export operational data and switch operators.
- Buyer payment credentials do not contain a reusable merchant-visible identity.
- Regulated compliance records remain at the regulated edge, purpose-limited and separate from merchant purchase data.
- Operator configuration, jurisdiction-specific policy and settlement adapters remain replaceable modules rather than protocol rules.
- Production keys, funds and legal control are never concentrated in a single personal account or in Bogdan's name without a documented reason and risk sign-off.

## Decentralization ladder

### Stage 0 — Local readiness

AgoraTap controls only a local UX and merchant-readiness prototype. Fictional session facts are created in the browser; the app supplies no protocol-connectivity evidence and sends no user-entered values to GNU Taler. GNU Taler's official public demo is available only as a separate fixed external link. No real funds, credentials or customer data.

### Stage 1 — Federated operators

Multiple independent merchant backends or licensed operators implement the same open interface. A merchant can migrate without replacing its checkout integration. AgoraTap sells integration and support, not control over money.

### Stage 2 — User-selectable issuer and settlement edge

The wallet and merchant can choose among compatible issuers/operators. Discovery lists are signed and replaceable. No single AgoraTap service is required for authorization.

### Stage 3 — Self-hostable critical path

Open-source, reproducible components let qualified operators run the payment-critical services. AgoraTap may host convenience services, but their failure cannot invalidate existing wallets, receipts or merchant exports.

### Stage 4 — Distributed governance where justified

Protocol changes require transparent versioning and multi-party governance. Introduce this only if operator capture is a measured risk; governance tokens or a blockchain are not decentralization by themselves.

## Triggers to advance a stage

Advance only when evidence shows at least one real choke point:

- a partner can unilaterally terminate all merchants;
- one jurisdiction can disable every operator;
- one hosting or domain dependency can stop payment authorization;
- one company can rewrite privacy guarantees without user or merchant exit;
- qualified counterparties refuse adoption because AgoraTap is a single point of control.

Do not decentralize merely for branding. Every stage adds operational, security, governance and support costs.

## Tom Hagen review gate

Before real-money work, counsel must produce a written perimeter and responsibility matrix covering the chosen jurisdictions, operator role, buyer thresholds, merchant KYB, sanctions/AML boundaries, data retention, outsourcing, consumer protection, incident handling and migration rights. Each conclusion must distinguish fact, legal opinion, unresolved question and launch blocker.

The review objective is dual: maximize lawful product freedom and minimize personal, criminal, regulatory, custody and continuity risk. If those objectives conflict, the system changes structure or jurisdiction before it exposes users, merchants or the principal.
