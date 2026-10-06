# Base Sepolia reference match — 2026-10-06

Outcome: **blocked before the payment transfer**. The harness created a real Base Sepolia sale and recorded a real test-EURC funding transfer. It did not sign a payment, and it did not invent a transaction hash.

Machine-readable result: [`run.json`](run.json), produced by `npm run sepolia:reference-e2e` at `2026-10-06T19:29:17.270Z`.

## What the chain showed

Reads and the would-be broadcast use only `https://sepolia.base.org`. The node returned chain id **84532**.

| Fact | Value |
|---|---|
| Test EURC | `0x808456652fdb597867f38412077A9182bf77359F` (symbol EURC, 6 decimals, read from the contract) |
| Payer (throwaway, key not in git) | `0x549b0C9384524fcA789B1Ca755A71085231249B9` |
| EURC balance | 20.000000 |
| ETH balance | 0 wei |
| Gas price | 6,000,000 wei |
| ETH the harness required before signing | 5,400,000,000,000 wei (about 0.0000054 ETH) |
| Head when the sale was opened | 47,773,334 |

Inbound EURC, re-read from the transaction receipt (`eth_getTransactionReceipt` returned one Transfer):

- Transaction: [`0x8e1b1bf62874dd3ae2ff8180fed89aafcf74f731c23dae112f38be73ccd41676`](https://sepolia.basescan.org/tx/0x8e1b1bf62874dd3ae2ff8180fed89aafcf74f731c23dae112f38be73ccd41676)
- Block 47,772,257, status success
- From `0xfaec9cdc3ef75713b48f46057b98ba04885e3391` (Circle's testnet faucet) to the payer
- Value 20.000000 EURC (`20000000` atomic)

That funding transfer is not a payment match. It is how the payer received test EURC.

## What the matching path did

The harness called the same functions as the live panels (`openLiveRequest`, `paymentRequestLink` via that opener, `parseRequestLink`, `walletTransferUri`, `refreshLive`).

Sale left **unpaid** (no payment was sent):

- Merchant: `0x6B21cD62408419e64DE6A073F44D7B8a71B716e2`
- Exact amount: 0.103724 EURC (price 0.10 plus tag 3724)
- Reference: `0x76b0ca959af5d52cf7edcd9b6ca200f804c1c9136207ae52cc0034316ae96e3e`
- Share link ends in `#ref=` plus that reference
- Wallet link is the same EIP-681 transfer with the fragment removed
- Block window: 47,773,336 to 47,775,136 (one hour)
- Panel line: "Waiting: no matching transfer seen on chain yet."

Opening the same flow with chain `base` (mainnet) threw: `Mainnet is disabled at this stage: use Base Sepolia (test funds only)`. The harness never calls `https://mainnet.base.org`. `mainnetEnabled` in the JSON is false. No product flag was changed.

## Why it stopped

A plain ERC-20 `transfer` is paid for by the sender. The payer has test EURC and no Base Sepolia ETH, so the harness refused to sign. Sites tried for test ETH, from this environment, none of which produced a transaction:

| Source | Result |
|---|---|
| Circle faucet, EURC on Base | Succeeded. 20 test EURC. Transaction above. |
| QuickNode Base Sepolia | Rejected: "Invalid ETH mainnet balance." Not using real mainnet funds to pass that check. |
| ethfaucet.com Base Sepolia | Stuck on BringID ("Failed to fetch" / "Checking eligibility"). |
| Coinbase CDP faucet | Login required. No account was created. |
| thirdweb Base Sepolia | Claim is behind "Connect Wallet". No key was pasted into the site. |
| Superchain faucet (`console.optimism.io/faucet`, Base Sepolia) | "Sign in to use the faucet." No account was created. |
| pk910 Ethereum Sepolia PoW faucet | Captcha succeeded, then `[IPINFO_RESTRICTION] IP Blocked: You're connecting from a hosting IP range.` This faucet is also L1 Sepolia, not Base. |
| `https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet` | 404. |
| `https://www.ethereum-ecosystem.com/faucets/base-sepolia` | Deployment disabled (HTTP 402). |
| Bware Labs faucet | HTTP 530 from this network. |

## Next unlock

Send Base Sepolia ETH (testnet only) to `0x549b0C9384524fcA789B1Ca755A71085231249B9`. About 0.00001 ETH covers the transfer at the gas price above. The EURC is already at that address. Then, with the throwaway key still only in `/tmp/agorapay-sepolia-e2e.key` or in `SEPOLIA_PAYER_KEY` (never committed):

```bash
npm run sepolia:reference-e2e
```

The script creates a new sale, sends one or two exact EURC transfers from that key, binds the first transaction hash, and polls `refreshLive` until the state is `confirmed` with `via: "reference"` (or records `pending` if 12 blocks have not elapsed). A second equal amount is sent when the balance allows, so the amount-tag path is `ambiguous` until the hash selects one. One hash cannot be bound to a second reference.

Do not send mainnet ETH. Do not point the harness at another chain. Do not commit the key.

## Follow-up the same day — still no payment

A later run from a cloud VM, with no access to the key for `0x549b0C9384524fcA789B1Ca755A71085231249B9`, did not broadcast a payment either. Machine-readable notes: [`faucet-attempt.json`](faucet-attempt.json). Nothing in that file is a payment transaction hash.

Re-read from `https://sepolia.base.org` (chain id 84532):

| Address | Role | ETH | Test EURC |
|---|---|---|---|
| `0x549b0C9384524fcA789B1Ca755A71085231249B9` | Earlier payer. Key is not on this machine. | 0 wei | 20.000000 (unchanged) |
| `0xBeC2bba3ad994BF909807a087bba8F210AC59e5f` | New throwaway. Key only in `/tmp` on that VM, not in git. | 0 wei | 0 |

Faucet attempts from that VM, for the new address, none of which produced Base Sepolia ETH:

| Source | Result |
|---|---|
| OriginTrail `POST /faucet/fund` mode `v10_base_sepolia` | HTTP 200. The ETH leg failed inside their faucet: their sender did not have enough gas (`have 686384993744341 want 1000550000000000`). No ETH arrived. A separate TRAC transfer did land (see the JSON). TRAC is not gas and not EURC, and it is not an Agora Pay payment. |
| Circle public faucet `POST /api/graphql` `RequestToken` EURC on BASE, no captcha token | `RECAPTCHA_ERROR`. No account was created and no EURC was sent. |
| QuickNode `POST /drip` form, chain `base`, network `sepolia`, address filled, empty auth token | Page text: "Invalid ETH mainnet balance." Mainnet funds were not sent to satisfy that check. |
| Google Cloud Base Sepolia faucet | Page sends the browser to a Google sign-in and loads reCAPTCHA Enterprise. No account was created. |
| Coinbase CDP faucet URL | HTTP 307. No account was created. |
| Bware Labs | HTTP 530. |
| ethereum-ecosystem.com Base Sepolia | HTTP 402. |
| `faucet.zalalena.com/base` | HTTP 502. |
| `learnweb3.io` and `faucet.triangleplatform.com` | HTTP 503. |
| `faucet.paradigm.xyz` | DNS did not resolve. |

Live send stays skipped. The harness now exits 0 in that situation instead of writing over this folder. `npm test` replays bind → confirmed from `src/lib/fixtures/reference-confirm-replay.json` without ETH. That replay is synthetic. It does not replace a confirmed Sepolia payment.
