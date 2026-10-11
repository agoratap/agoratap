# Pilot onboarding

Agora Pay is **any-in → any-out**. The payer sends crypto they already hold. For an EU leg, preferred assets are USDC, EURC, BTC, and ETH. USDT is not an EU merchant payout or EU settlement rail. If a payer holds USDT, that stays optional and payer-side only: Agora Pay does not route USDT to EUR. The merchant receives on the payout rail they prefer. See [ESMA_USDT_EU_FOLD_2026-10-11.md](ESMA_USDT_EU_FOLD_2026-10-11.md). Merchants are all types: online shops, offline stores, and market stalls or street sellers. The merchant installs nothing. The primary way to pay is a QR or pay-link on a phone they already carry, not a website checkout they must host.

Agora Pay does not hold keys or funds. Do not send real money. Mainnet stays off. Nobody has to buy or fund Base to follow this pilot.

The steps below are the **optional Base Sepolia matcher** already in this app: a share link, test tokens, read-only. That matcher is one rail, not the product. Skip it if you do not have test tokens. The steps match the merchant and buyer **live test** panels and `docs/MATCHING_DESIGN.md` section 5. A phone QR and a live swap onto the merchant’s payout rail are the product direction; this walkthrough does not do either.

## Before you start

- Node.js 22 or newer. In this repository: `npm ci`, then `npm run dev`. Open the URL Vite prints. You can read the landing copy without a wallet.
- Only if you choose the optional matcher: a wallet you control, set to **Base Sepolia** (chain id 84532).
- A little test ETH for gas, and test EURC, only for that matcher. If you do not have test EURC, skip this rail. Do not switch the wallet to Base mainnet to get it. Do not buy Base.

## Merchant

1. Open **New sale**.
2. In **Live test (Base Sepolia, read-only)**, enter a receiving address you control. Do not type an address you do not control.
3. Enter a small price, for example `1`.
4. Choose **Create live test request**. The page reads recent transfers from `sepolia.base.org`. If that endpoint times out or keeps failing, it tries one public fallback (`base-sepolia-rpc.publicnode.com`) and then stops. Both see your IP address. Neither is Base mainnet. If both fail, the page says it could not read Base Sepolia. The panel shows the exact EURC amount, the share link ending in `#ref=`, and the block window.
5. Choose **Export sale backup** and keep the JSON file. It is a readable sale record. It has no wallet key. Keys stay in your wallet.

## Buyer

1. Open the wallet screen. Paste the share link into **Live test**.
2. Read the amount, the merchant address, and the network. It must say **Base Sepolia (test)**. If the page says mainnet, do not pay.
3. Choose **Open in my wallet** and confirm the transfer there. Agora Pay does not sign or send.
4. Copy the transaction hash from the wallet. Do not invent one.

## Match

1. Paste the hash into either panel and choose **Match this transaction**.
2. Expect unpaid, or ambiguous if another transfer of that amount exists, then pending while the transfer has fewer than 12 blocks, then confirmed. **Final** appears only when the node's finalized block covers the transfer.
3. A match means this amount arrived. It does not prove who paid.

## If the payment was missed

1. Choose **Import sale backup** if this device no longer shows the sale. The block window is in that file.
2. Open **Missed payment?**. Paste the sale link and the transaction hash. Choose **Check this transaction**.
3. Without the saved window the page does not decide the payment, and it does not read the chain for that check. It will not invent a transaction.

## Stop

Mainnet links are refused. Nothing in this checklist turns mainnet on, and nothing in it asks anyone to fund Base. The header reset clears practice data and the sale saved on this device. A backup file you already downloaded stays on disk. The product remains any-in → any-out for an online shop, a store, or a market stall, with a QR or pay-link and nothing to install. This checklist only walks the optional Base Sepolia matcher.
