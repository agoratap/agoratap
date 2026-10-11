# Security Policy

## Prototype status

Agora Pay is an early pilot with local practice screens. Do not use it with real funds, private keys, seed phrases, identity documents, production credentials, personal data, or real merchant records. There is no backend, authorization service, encryption-at-rest layer, or regulated payment provider. The only chain contact in the app is a read-only Base Sepolia matcher. That matcher is one optional rail, not a Base-mainnet product, and mainnet is not enabled.

The product is any-in → any-out: the payer sends crypto they hold, and the merchant receives on their preferred payout rail. For an EU leg, preferred assets are USDC, EURC, BTC, and ETH. USDT is not an EU merchant payout or EU settlement rail. If a payer holds USDT, that stays optional and payer-side only: Agora Pay does not route USDT to EUR. See `docs/ESMA_USDT_EU_FOLD_2026-10-11.md`. Merchants include online shops, offline stores, and market stalls, and they install nothing. The primary experience is a QR or pay-link on a phone. This codebase does not implement that route. It also *aims* at unlinkable buyer credentials and no routine buyer KYC in-threshold, and it does not implement that security property.

## Data handling

Demo balances, payment requests, and receipts are stored as readable JSON in browser `localStorage`. Any script running on the same origin could read or change them. The CSV export is a merchant settlement trail generated locally and is not signed. The Merchant pilot session report (JSON/CSV) is likewise generated locally, unsigned, DEMO-labelled, and not legal or regulatory evidence. Friction capture is closed-choice tags plus client-side step timing only — no free text, no customer or personal data. Reset clears the Agora Pay storage key (`agorapay-pilot-v1`) and the previous key (`agoratap-demo-v1`) if it is still present.

A live test sale (receiving address, amount, payment reference, block window, and any bound transaction hash) is also kept in this browser's IndexedDB and can be exported or imported as readable JSON (`agorapay.merchant-session`, version 1). That file does not contain a wallet key, seed, or secret. It is not encrypted and not signed. Anyone with the file can see the sale. Import refuses a Base mainnet sale and refuses a file that contains key material. Reset clears the on-device copy. A file already downloaded stays on disk; browser download history is outside the app's control.

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
