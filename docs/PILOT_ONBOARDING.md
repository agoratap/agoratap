# Pilot onboarding — 15 minutes on Base Sepolia

A stranger can walk the live-test panels in one sitting. Test tokens only. Mainnet stays off. Agora Pay does not hold keys or funds. Do not send real money.

The steps below match the merchant and buyer **live test** panels and `docs/MATCHING_DESIGN.md` section 5.

## Before you start

- Node.js 22 or newer. In this repository: `npm ci`, then `npm run dev`. Open the URL Vite prints.
- A wallet you control, set to **Base Sepolia** (chain id 84532).
- A little test ETH for gas, and test EURC. If you do not have test EURC, stop. Do not switch the wallet to Base mainnet to get it.

## Merchant

1. Open **New sale**.
2. In **Live test (Base Sepolia, read-only)**, enter a receiving address you control. Do not type an address you do not control.
3. Enter a small price, for example `1`.
4. Choose **Create live test request**. The page reads recent transfers from `sepolia.base.org`. That endpoint sees your IP address. The panel shows the exact EURC amount, the share link ending in `#ref=`, and the block window.
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

Mainnet links are refused. Nothing in this checklist turns mainnet on. The header reset clears practice data and the sale saved on this device. A backup file you already downloaded stays on disk.
