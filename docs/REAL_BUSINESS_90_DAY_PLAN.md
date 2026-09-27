# AgoraTap: 90-day path from demo to lawful EU business

**Decision date:** 27 September 2026
**Scope:** EU/EEA launch preparation; €0 new-venture budget; no licence; no live-money authority.
**Legal status:** Operating plan, not legal advice. National implementation, the launch Member State, final contracts and the actual flow of funds can change the perimeter. Obtain written advice from qualified counsel before any live-money test.

## 1. The decision

**[DECISION] AgoraTap will not launch as a wallet, exchange, stablecoin checkout, acquirer or “new payment network.”** For the first 90 days it will sell one narrow B2B product:

> **AgoraTap Merchant Readiness Sprint** — a fixed-price, two-week service and merchant-side software workflow that maps a small merchant’s checkout, refund, shift-close and reconciliation process; tests a clearly fictional local acceptance journey; maps future requirements against GNU Taler’s documented operator/merchant boundaries; and delivers a signed live-pilot requirements pack for a licensed/operator partner.

The enduring product wedge is the **merchant acceptance and operations layer around GNU Taler**: merchant onboarding workflow, point-of-sale interaction, order/refund handling, reconciliation exports, staff training and integration support. AgoraTap does **not** issue digital cash, run the Taler exchange, hold buyer or merchant funds, promise settlement, or substitute its own protocol for GNU Taler.

**[FACT — current state]** The repository is a local-first PWA: the buyer/merchant simulation uses `localStorage`, while the readiness session is ephemeral component state. It has no GNU Taler API integration, network order/status call, reusable authorization capability, cryptographic Taler implementation, custody, bank connection, identity controls or real settlement. “Settled” is demo state. Therefore it is not yet a payment product or a revenue-generating sandbox.

**[FACT — Taler fit]** GNU Taler describes itself as free software/open protocols in which users withdraw anonymised digital cash from an exchange and merchants redeem it for traditional money.[10] Its merchant manual says Taler is a payment system operating in a traditional banking context, not a new cryptocurrency; it expressly leaves the merchant frontend and back-office application to integrators while providing a merchant backend and REST API.[11] That unfilled merchant-side surface is AgoraTap’s wedge, not evidence of a partnership.

**90-day success definition:**

1. at least **one merchant has paid** for a readiness sprint (real service revenue, invoiced for discovery/integration work — not test transaction volume);
2. the sprint produces measured workflow evidence and a merchant-signed statement of requirements;
3. at least one additional merchant signs a paid-pilot proposal or non-binding live-pilot LOI;
4. AgoraTap has a regulator/partner-ready role, funds-flow, data-flow, controls and economics dossier; and
5. no real funds, tokens or payment credentials move through AgoraTap unless a licensed principal/operator has approved the exact architecture in writing and contracted for it.

If these conditions are not met, AgoraTap remains a demo or is killed; it does not relabel sandbox activity as traction.

---

## 2. Facts, hypotheses and non-negotiables

### Proven facts

- **[FACT]** Under PSD2, regulated payment services include execution of payment transactions, issuing payment instruments/acquiring transactions, payment initiation and money remittance. PSD2 Article 3(j) excludes certain technical services only where the provider supports payment services **without ever entering into possession of the funds**, with an express carve-out for payment-initiation and account-information services.[1]
- **[FACT]** EU electronic money is electronically stored monetary value representing a claim on the issuer, issued on receipt of funds for payments and accepted by someone other than the issuer. Member States must prohibit persons that are not e-money issuers from issuing it.[2]
- **[FACT]** MiCA defines professional custody/control of crypto-assets or access means, exchange, order execution/transmission and transfer on behalf of clients as crypto-asset services; Article 59 is the authorisation boundary. MiCA also says hardware/software providers of non-custodial wallets should not fall within its scope, but the real service and control model—not a “non-custodial” label—determines the result.[3]
- **[FACT]** The EU Transfer of Funds Regulation applies information duties to covered fund and crypto-asset transfers and applies to crypto transfers involving a CASP, including transfers to or from self-hosted addresses; it has applied since 30 December 2024.[4]
- **[FACT]** There is no general EU rule that “small payments need no KYC.” The current AML Directive’s e-money derogation is optional for Member States, risk-based and conditional; its Article 12 conditions include a non-reloadable instrument or a €150 monthly limit usable in one Member State, a €150 stored-value ceiling, goods/services-only use, no anonymous e-money funding and transaction monitoring. It does not apply to remote payment transactions over €50 per transaction.[5]
- **[FACT]** GDPR requires purpose limitation, data minimisation, storage limitation and data protection by design/default. Buyer privacy can be a product property, but it does not displace AML, sanctions or lawful-record obligations.[6]
- **[FACT]** DORA applies directly to payment institutions, e-money institutions and CASPs and makes ICT third-party risk and contractual controls relevant to a regulated partner’s diligence. AgoraTap should expect security, incident, audit, subcontracting, continuity and exit questions even when it is “only” a technology vendor.[7]
- **[FACT]** The EBA maintains a searchable central register of EU/EEA payment and e-money institutions, while legal authorisation remains with national competent authorities.[8] ESMA publishes the MiCA register, including authorised CASPs and non-compliant entities.[9]
- **[FACT]** GNU Taler’s merchant backend API already includes orders, payments, refunds, transfer/settlement reporting and merchant-facing private endpoints.[12] Its exchange API exposes KYC/AML-related limits and flows.[13] AgoraTap must integrate with these boundaries rather than inventing a parallel token or compliance model.
- **[FACT]** Taler components use LGPL, GPL and AGPL according to component type; Taler’s licensing page states that deployed modified AGPL services must make the actually deployed source available through the project’s `/agpl/` mechanism.[14]
- **[FACT]** Taler Systems SA says it has developed GNU Taler since 2016 and positions Taler around privacy by design, micropayments and regulatory compliance.[15]

### Hypotheses to test—not claims

- **[HYPOTHESIS H1]** Independent cafés, canteens and cultural venues with many low-ticket sales will pay to prepare a privacy-preserving, card-alternative acceptance flow before a live rail is available.
- **[HYPOTHESIS H2]** The pain that converts is not “crypto acceptance”; it is lower-cost low-ticket acceptance plus clean shift-close/refund/reconciliation operations and less buyer data exposure.
- **[HYPOTHESIS H3]** A merchant will pay **€350–€750** for a two-week readiness sprint if the output is operationally useful independent of launch timing.
- **[HYPOTHESIS H4]** After a licensed Taler deployment exists, a merchant will pay **€49–€99 per location/month** for the AgoraTap merchant operations layer; setup/integration can command **€500–€2,000** depending on POS complexity.
- **[HYPOTHESIS H5]** A regulated operator will engage when AgoraTap brings merchant demand, a bounded technical role, measured workflows and implementable controls—not merely a polished demo.

### Non-negotiables

1. Never call test-value activity “processed volume,” “settlement,” “revenue from payments” or a “live pilot.”
2. Never take possession of customer/merchant funds, private keys, stablecoins, wallet recovery material or credentials.
3. Never issue redeemable value, promise redemption, determine a buyer’s final eligibility, or route a real payment instruction.
4. Never claim “no KYC,” “anonymous at any amount,” “MiCA compliant,” “PSD2 exempt,” “approved by Taler,” or “partnered with Taler Systems.”
5. Never rely on a transaction cap, limited-network theory, technical-service exclusion, sandbox, “non-custodial” label or partner API as self-executing legal permission.

---

## 3. The exact operating boundary

The boundary is functional: **what AgoraTap actually does and controls**, not what its UI or contract calls it.

| Activity | Before licence/regulated principal? | Rule for the first 90 days |
|---|---:|---|
| Public demo with conspicuous TEST/DEMO labels and fictional balances | **Yes** | No real asset, account connection, payment credential or settlement claim. |
| Paid merchant interviews, workflow mapping, UX testing, staff training and integration requirements | **Yes** | Invoice for professional services through a lawful contracting entity. Obtain research consent and minimise personal data. |
| Software that creates fictional orders, simulates refunds and exports test reconciliation files | **Yes** | Test data only; do not connect to production bank/CASP/EMI endpoints. |
| Open-source evaluation against a local/test GNU Taler deployment | **Yes, technically** | Test currency only; obey component licences; do not market it as live acceptance. |
| Merchant-side software supporting a licensed operator’s payment service | **Potentially** | Only after written perimeter advice and a contract fixing AgoraTap as vendor/outsourcer or registered agent where required. The Article 3(j) technical-service exclusion is a conclusion to validate, not the launch strategy.[1] |
| Receive, hold, pool, net, safeguard or forward fiat/customer funds | **No** | Licensed principal must own the account, ledger, safeguarding and settlement obligation. |
| Issue Taler digital cash/e-money or accept funds against redeemable stored value | **No** | Reserve for an authorised credit institution/EMI/operator; EMD2 prohibits unqualified issuance.[2] |
| Accept or acquire real payment transactions, issue a payment instrument, initiate a bank payment or remit money | **No** | Requires an authorised PSP model or formal agency/sponsorship confirmed for the role.[1] |
| Custody/control keys, exchange crypto for funds/crypto, transmit orders, or transfer crypto on a client’s behalf | **No** | CASP perimeter under MiCA; use an authorised provider and keep AgoraTap outside these functions.[3] |
| Offer USDC/EURC or any stablecoin as the initial product | **No** | This adds MiCA, issuer/asset eligibility, CASP and transfer-of-funds complexity without proving the merchant wedge. Remove it from the commercial offer. |
| Determine or advertise “KYC-free thresholds” | **No** | Only the obliged/licensed entity may implement a counsel-approved risk policy. The AMLD derogation is conditional and Member-State-dependent.[5] |
| Use real customer money in a regulator or provider sandbox | **No, unless expressly authorised** | A sandbox does not itself create permission. Written terms must say who is authorised, who holds funds and what consumers are exposed to. |

### The bright-line architecture

**Permitted now**

```text
Merchant staff -> AgoraTap demo/readiness workflow -> fictional order/result
                                      |
                                      +-> test CSV + requirements + measured observations

Merchant -> ordinary invoice payment for consulting/software work -> AgoraTap contracting entity
```

**Only after contracting with an authorised principal/operator**

```text
Buyer wallet -> GNU Taler exchange/operator -> GNU Taler merchant backend -> merchant bank account
                                                    |
                                                    +-> AgoraTap merchant UI / reconciliation adapter
                                                        (no funds, no keys, no eligibility decision)
```

The principal/operator must own issuance/exchange operations, regulated onboarding/KYB/KYC/AML decisions, safeguarding, settlement, complaints allocation and regulatory reporting. AgoraTap may present partner decisions and statuses but must not silently become the decision-maker.

### CASP is optional, not the default

**[DECISION] Remove stablecoin settlement from the 90-day wedge.** Taler’s own documentation describes ordinary-currency settlement and expressly says it is not a cryptocurrency.[11] The shortest lawful path is therefore Taler merchant acceptance with a bank/EMI/Taler operator. A CASP becomes relevant only if a later, evidence-backed product adds MiCA-regulated crypto custody, exchange or transfer. Do not create CASP dependency merely to preserve the prototype’s EURC/USDC screens.

---

## 4. Offer and pricing

### Sell this now

**Merchant Readiness Sprint — hypothesis price: €500 fixed, 50% on booking, 50% on delivery.** If the first merchant rejects €500 after seeing the exact deliverables, test €350 once; do not offer free custom work.

Deliverables:

1. 60-minute owner/manager workflow interview;
2. current-state checkout/refund/shift-close map;
3. staff test using clearly fictional value;
4. reconciliation sample mapped to the merchant’s current export/accounting fields;
5. quantified baseline and test results;
6. gap/risk log covering connectivity, refunds, exceptions, support and privacy notices;
7. one-page live-pilot requirements/LOI draft naming the need for a licensed/operator partner; and
8. go/no-go recommendation.

The merchant is buying operational design and evidence. Payment is due even if no live Taler rail becomes available. That makes the revenue genuine and avoids pretending the demo itself has value movement.

### Pricing ladder to test

| Offer | Price hypothesis | What validates it | Kill signal |
|---|---:|---|---|
| Readiness Sprint | €500 fixed (€350 floor) | One paid booking without bespoke product promises | 10 qualified proposals, zero willing to pay ≥€350 |
| Second-location sprint | €250–€400 | Existing merchant wants repeatable rollout | Every location requires founder-heavy redesign |
| Production setup, only with operator | €500–€2,000 | Signed scope and repeatable connector/configuration | Integration labour exceeds gross fee twice |
| Merchant operations SaaS, only with operator | €49–€99/location/month | Merchant commits after measured pilot | Fewer than 3/5 qualified merchants accept €49/month |
| Transaction fee | **Deferred** | Partner economics and counsel support it | Do not test in first 90 days; it confuses regulated roles and unit economics |

Pricing is a test grid, not a published promise. Use the same written scope and price for comparable merchants; record objections verbatim.

---

## 5. First merchant pilot

### Merchant profile

Select **one owner-operated café, canteen, museum shop or cultural venue** with:

- one physical location and one decision-maker;
- at least ~75 low-ticket transactions on a normal day (**selection hypothesis**, not a claimed market threshold);
- an existing till/POS export and visible pain in refunds or shift close;
- willingness to run staff-only test scenarios;
- no gambling, high-risk goods, cash-to-crypto, remittance or marketplace activity; and
- no dependency on AgoraTap handling real money.

### Two-stage pilot

#### Stage A — paid readiness pilot (days 36–60; unregulated test activity)

- Duration: 10 business days.
- Participants: owner/manager plus 3–5 staff; optionally 5–10 consenting test users.
- Instrument: current local demo with fictional value, visibly labelled DEMO/NO REAL FUNDS. A separate operator-controlled GNU Taler test environment is future work and must not be represented as a capability of this repository.
- Scenarios: sale, cancelled sale, duplicate attempt, expired request, refund, lost connection, shift close and accounting export.
- Minimum sample: 30 completed staff/test-user scenarios, including at least five exception/refund scenarios.
- Data: scenario ID, timestamps, amount band, task success, error category, support intervention and reconciliation result. Do not collect names, identity documents, bank details, wallet histories or stablecoin addresses.
- Commercial truth: the merchant pays for the sprint and deliverables; simulated payment count is not revenue or TPV.

**Stage A acceptance gates:**

1. ≥90% of standard sale scenarios completed without facilitator intervention;
2. 100% of duplicate attempts visibly rejected in the test design;
3. 100% of completed test orders appear exactly once in the shift-close export;
4. staff can explain “buyer privacy, identified merchant, regulated operator” correctly in ≥80% of debriefs;
5. owner confirms one quantified operational benefit or rejects the thesis;
6. owner states a maximum acceptable setup and monthly price; and
7. signed delivery acceptance plus either a live-pilot LOI or explicit no-go reason.

#### Stage B — limited live-money pilot (not assumed inside 90 days)

Stage B starts only after all of the following exist: named authorised principal/operator; register verification; written perimeter opinion; executed agreements and responsibility matrix; merchant KYB approval; approved funds/data flows; production security review; complaints/refunds/incident procedures; consumer disclosures; test evidence; and written go-live approval. The operator—not AgoraTap—sets buyer controls and holds the settlement obligation.

---

## 6. GNU Taler / Taler Systems strategy: complement, never compete

### Positioning

**AgoraTap is the merchant-distribution and merchant-operations integrator for GNU Taler.** It should create demand, integrations, field evidence and usable merchant workflows. It should not fork the payment scheme, create an “Agora coin,” market a competing exchange, rename protocol components, or imply ownership of Taler’s privacy model.

Taler’s own merchant architecture expects merchant frontend and back-office components outside the core backend.[11] The REST API supplies the integration contract.[12] That supports a complementary role, but it does not grant endorsement, trademark permission, technical compatibility certification or commercial rights beyond the applicable licences.

### What AgoraTap should bring before requesting time

1. one paid merchant sprint and raw metrics;
2. one additional merchant LOI/proposal;
3. a two-page architecture showing AgoraTap outside exchange/funds/key custody;
4. a merchant API compatibility matrix—orders, payment status, refunds, transfers, webhooks and reconciliation;
5. exact upstream version tested and an AGPL/GPL/LGPL compliance inventory; and
6. a short list of three concrete questions, not a generic “partnership” pitch.

### The eventual ask (no contact was made in preparing this plan)

Request, in order:

1. technical compatibility review of the merchant-side boundary;
2. direction to the correct operator/bank deployment path;
3. commercial support/integration terms from Taler Systems;
4. permission for any compatibility marks or public naming; and
5. a non-exclusive route to support merchant deployments.

Offer field feedback, reproducible bug reports, merchant workflow evidence and upstreamable generic improvements. Do not ask for exclusivity, protocol control, customer ownership, free custom engineering or permission to operate an exchange. Keep proprietary value in merchant implementation, deployment operations and vertical connectors while respecting Taler component licences—especially the AGPL source-availability requirement for modified deployed services.[14]

---

## 7. The 90-day execution calendar

### Days 1–7 — narrow and make sellable

**Outcome:** one truthful offer and a bounded legal/technical dossier.

- Name the lawful contracting/invoicing entity. If none exists, do not take a deposit until a lawful national route (existing entity or registered sole-trader path) is confirmed.
- Freeze product language to “merchant readiness and integration”; remove stablecoin settlement, “no-KYC payment,” live-settlement and partnership claims from sales material.
- Produce a one-page scope, €500 proposal, invoice/deposit terms, data notice, consent script and DEMO disclosure.
- Draw current and future funds/data flows with every actor, account, key, decision and liability owner.
- Build the first responsibility matrix: issuance, funds, safeguarding, KYB/KYC/AML, sanctions, fraud, settlement, refunds, complaints, security incidents, reporting and data-controller roles.
- Select one initial EU Member State based on existing founder/entity presence and reachable merchants—not licence-shopping.
- Build a list of 25 qualifying merchants from existing networks/free directories; no paid acquisition.

**Gate D7:** if the offer cannot be sold without promising future payment processing, stop and rewrite it. If there is no lawful entity able to invoice, continue discovery but do not collect money.

### Days 8–21 — problem and price discovery

**Outcome:** evidence that the merchant operations problem exists.

- Run 10–15 structured merchant conversations; show the demo only after documenting the current workflow and costs.
- Ask for actual ranges: transactions/day, average ticket, refund/void frequency, reconciliation time, payment fees and support failures. Mark estimates separately from records.
- Present the fixed sprint scope and ask for a buying decision, not praise.
- Record all objections and denominator counts.
- In parallel, map the GNU Taler merchant API to current AgoraTap screens on paper only; no production integration and no source-code change is part of this plan.

**Gate D21:** continue only if at least 5 merchants complete discovery, at least 3 report the same costly workflow problem, and at least 2 accept a concrete follow-up proposal. Otherwise kill this segment and test one adjacent segment once (campus/canteen or cultural venue), without broadening the product.

### Days 22–35 — close real service revenue

**Outcome:** one paid sprint booking.

- Send up to 5 identical, time-bounded proposals at €500; permit one €350 first-customer price in exchange for structured access and permission to use anonymised metrics.
- Collect 50% only against a signed professional-services scope. Funds are payment for consulting/integration discovery, never customer funds for onward payment.
- Baseline the merchant’s current checkout/refund/reconciliation metrics before configuring the test.
- Verify any prospective regulated entity in the national register and EBA register; verify any CASP in ESMA’s register.[8][9]

**Gate D35:** if 5 qualified proposals produce zero paid booking and no documented procurement delay, kill the paid-readiness offer. Do not call free discovery a pilot.

### Days 36–60 — deliver the paid Stage A pilot

**Outcome:** accepted deliverables, measured results and a live-pilot decision.

- Run the 10-business-day test defined in section 5.
- Keep test data separate from any real till/payment records; export only what the merchant approved.
- Issue the final invoice and obtain delivery acceptance.
- Produce the merchant-signed requirements sheet and ask for a conditional Stage B LOI.
- Prepare the GNU Taler compatibility matrix and licence inventory from official docs.[12][13][14]

**Gate D60:** stop product work if the merchant does not accept the deliverable, standard task completion is <90%, reconciliation is not exact, or the merchant will not pay the final invoice. Fix a genuine operational defect once; do not rationalise repeated failure as “education needed.”

### Days 61–75 — package proof for operators

**Outcome:** diligence-ready, not “partnership theatre.”

- Produce a 10-page operator pack: legal entities; target Member State; exact product; role matrix; funds/data/key flows; merchant evidence; expected volumes; pricing; support model; security architecture; incident/refund/complaint flows; GDPR data inventory; deployment/licence model; and open questions.
- Define the desired regulated model: AgoraTap as ICT vendor first; agent only if the principal and counsel require it.
- Create a shortlist of 5 EBA-registered PI/EMI/credit-institution candidates with relevant permissions and 3 Taler/operator routes. A CASP shortlist is created only if the approved architecture genuinely includes MiCA crypto services.
- Prepare the limited three-question Taler Systems/GNU Taler brief in section 6. Do not publish names/logos or imply contact/approval.

**Gate D75:** if the architecture still requires AgoraTap to issue value, hold funds/keys, decide KYC or promise settlement, it fails. Redesign around the principal or keep AgoraTap as paid readiness services only.

### Days 76–90 — prove repeatability and earn the right to partner discussions

**Outcome:** second commercial signal and explicit next decision.

- Sell the same sprint to a second merchant or obtain a signed paid-pilot proposal with price and date.
- Compare delivery hours, merchant objections and reusable artifacts. Founder labour must fall on the second sprint.
- Obtain a fixed-fee quote or pro-bono eligibility decision from qualified payments counsel; do not request full advice without funding.
- With principal approval, begin—not complete—operator/Taler discussions using the prepared pack. No live-money launch is promised inside 90 days.
- Decide: continue as merchant integration business; remain a paid research/service studio; or shut down.

**Gate D90 — continue only if all are true:**

1. ≥1 paid and accepted sprint with cash collected;
2. ≥1 second paid proposal/booking or signed conditional live-pilot LOI;
3. merchant workflow evidence meets Stage A gates;
4. bounded role keeps AgoraTap outside funds, issuance and keys;
5. credible operator route exists or the service is profitable without it; and
6. expected production gross margin can exceed 60% after support and partner fees (**business hypothesis to validate**).

If #1 or #2 fails, kill the venture wedge. If #4 fails, do not proceed. If only #5 fails, keep selling truthful readiness work for at most one additional cycle; do not build a payment stack speculatively.

---

## 8. What unlocks EMI—and when relevant, CASP—discussions

A polished PWA does not unlock a regulated partner. The following proof does:

### Commercial proof

- one paid/accepted sprint and evidence of cash collected;
- second merchant at proposal/LOI stage;
- named merchant segment, current pain and buying trigger;
- measured scenario completion, refund/exception handling and exact reconciliation;
- price acceptance and support burden;
- conservative 12-month volume forecast with assumptions and downside case.

### Perimeter proof

- legal entity/UBO chart and target Member State;
- one-page “AgoraTap does / does not” role statement;
- end-to-end funds, data and cryptographic-key flows;
- RACI for KYB/KYC/AML, sanctions, safeguarding, execution, settlement, disputes, complaints, tax records and regulatory reporting;
- written position that AgoraTap never possesses customer funds or keys and does not issue value;
- list of every regulated service the principal would provide and the permissions supporting it;
- counsel questions and budget, with no reliance on a self-declared exemption.

### Technical and operational proof

- GNU Taler component/version and API compatibility matrix;
- threat model, access-control model, dependency inventory and security-review plan;
- idempotency, duplicate/replay, refund, timeout and reconciliation test results;
- uptime/support assumptions, incident classification/escalation, continuity and exit plan;
- GDPR data inventory, lawful-basis questions, retention schedule and controller/processor allocation;
- DORA-ready vendor information: subcontractors, hosting locations, audit/access rights, incident notification, recovery targets and termination/data return.[7]

### The different partner cases

**EMI/PI/bank discussion:** justified when the desired live architecture requires ordinary-currency issuance/payment services, merchant settlement, safeguarding or agency. Lead with merchant evidence and the bounded vendor role.

**Taler operator/Taler Systems discussion:** justified when AgoraTap has a merchant requirement pack and API compatibility work. Lead with distribution and merchant operations; ask for support and an operator route, not permission to compete.

**CASP discussion:** justified only if customers demonstrably require a crypto-asset leg and the approved design includes custody, exchange, order handling or transfer. Lead with the exact MiCA service and use only entities verified in ESMA/national registers.[3][9] Until then, a CASP is cost and perimeter risk, not progress.

### First diligence question to every regulated candidate

> “For this exact diagram, which legal entity is the customer-facing regulated provider; which permissions cover issuance/execution/acquiring/settlement; does AgoraTap sit as ICT vendor, outsourcer or registered agent; and what functions must AgoraTap never perform?”

Reject any answer based only on “we have an API,” “non-custodial,” “small pilot,” “sandbox,” or an unverified group licence. Verify the precise contracting entity and permissions in official registers.[8][9]

---

## 9. Kill gates summary

| Day | Evidence required | Decision if absent |
|---:|---|---|
| 7 | Truthful sellable scope; invoicing route; bounded role | Rewrite once; no deposit without lawful invoicing route |
| 21 | 5 completed interviews, 3 same-pain merchants, 2 proposal candidates | Kill segment or test one adjacent segment once |
| 35 | One signed, paid sprint from ≤5 qualified proposals | Kill paid-readiness offer; no free “pilot” |
| 60 | Accepted delivery, final invoice paid, Stage A metrics met | Stop or repair one specific defect once |
| 75 | Architecture keeps AgoraTap outside funds/issuance/keys/KYC decision | No live-money path; services only |
| 90 | Paid proof + second commercial signal + operator-ready dossier | Continue, services-only, or shut; never relabel demo activity |

## 10. Immediate next three actions

1. Approve the wedge and remove stablecoin/CASP from the initial commercial proposition.
2. Create the fixed-scope €500 Merchant Readiness Sprint sales pack and the 25-merchant target list; this requires time, not cash.
3. Run discovery and ask for payment. Do not spend on incorporation, legal advice, integrations or hosting until a lawful invoicing route and a paying merchant exist; ring-fence the first cash for jurisdiction-specific counsel and partner diligence.

No external party was contacted in producing this plan, and this plan authorises no live money movement.

## Sources

[1] https://eur-lex.europa.eu/eli/dir/2015/2366/oj/eng — PSD2 — Directive (EU) 2015/2366
[2] https://eur-lex.europa.eu/eli/dir/2009/110/oj/eng — Electronic Money Directive 2 — Directive 2009/110/EC
[3] https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng — MiCA — Regulation (EU) 2023/1114
[4] https://eur-lex.europa.eu/eli/reg/2023/1113/oj/eng — Transfer of Funds Regulation — Regulation (EU) 2023/1113
[5] https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02015L0849-20241230 — Consolidated AMLD — Directive (EU) 2015/849
[6] https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng — GDPR — Regulation (EU) 2016/679
[7] https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng — DORA — Regulation (EU) 2022/2554
[8] https://www.eba.europa.eu/risk-and-data-analysis/data/registers/payment-institutions-register — EBA register of payment and electronic money institutions
[9] https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica — ESMA MiCA register and implementation page
[10] https://docs.taler.net — GNU Taler documentation
[11] https://docs.taler.net/taler-merchant-manual.html — GNU Taler Merchant Backend Operator Manual
[12] https://docs.taler.net/core/api-merchant.html — GNU Taler Merchant Backend RESTful API
[13] https://docs.taler.net/core/api-exchange.html — GNU Taler Exchange RESTful API
[14] https://docs.taler.net/global-licensing.html — GNU Taler licensing information
[15] https://taler-systems.com/en/company.html — Taler Systems SA — Company
