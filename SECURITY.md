# Security Policy

## Prototype status

AgoraTap is a local, simulated prototype. Do not use it with real funds, private keys, seed phrases, identity documents, production credentials, personal data, or real merchant records. There is no backend, authorization service, blockchain integration, encryption-at-rest layer, or regulated payment provider.

The product *aims* at unlinkable buyer credentials and no routine buyer KYC in-threshold. This codebase does not implement that security property.

## Data handling

Demo balances, payment requests, and receipts are stored as readable JSON in browser `localStorage`. Any script running on the same origin could read or change them. The CSV export is a merchant settlement trail generated locally and is not signed. The Merchant pilot session report (JSON/CSV) is likewise generated locally, unsigned, DEMO-labelled, and not legal or regulatory evidence. Reset clears the AgoraTap storage key; browser/download history and downloaded files are outside the app's control.

## Threat model (production target)

Protect against: merchant-side buyer profiling, card-network transaction graphs, payment replay/double-spend, POS tampering, and credential theft.

Do **not** treat privacy features as cover for sanctions or AML evasion. Production screening belongs at licensed edges and lawful thresholds, without handing merchants a reusable shopper identity.

## Production security requirements

A production design requires independent threat modeling and security review covering:

- audited privacy-preserving payment protocol (blinding / unlinkable tokens) and cryptographic implementation;
- secure wallet key storage, device binding, recovery and revocation;
- replay/double-spend prevention and offline-risk limits;
- authenticated merchant devices and signed, idempotent requests;
- tamper-evident *merchant* audit logs, retention controls and least-privilege access;
- custody and signing infrastructure with HSM/MPC controls;
- sanctions/AML/fraud controls designed to minimize unnecessary buyer data;
- secure provider APIs, webhook verification and settlement reconciliation;
- dependency/SBOM management, SAST, secrets scanning and incident response;
- GDPR data mapping, deletion/retention policy, DPIA, and breach procedures.

PWA caching must never cache secrets, live balances, signed credentials, or regulated personal data without an explicit secure design.

## Reporting

Do not submit real secrets or personal data in a report. For this private prototype, report issues to the repository owner through the repository's private security channel. There is currently no bug bounty or production service-level commitment.
