// Support-desk stub for a sale the till did not show as matched.
// Same rules as docs/MATCHING_DESIGN.md section 5: transaction hash, merchant, exact amount, block window.
// Read-only. No custody. Base mainnet is refused before any chain read.
// If the block window is not in the on-device backup, this check does not decide the payment.
import type { ChainReader } from './chainReader'
import { describeState, refreshLive, bindLiveClaim, type LiveRequest } from './liveSession'
import { claimsFromSales } from './merchantSession'
import type { PaymentState } from './confirmation'
import { parseRequestLink } from './requestLink'
import { normalizeTxHash } from './reference'

export const MISSED_PAYMENT_GUIDE = [
  'Paste the sale link (it ends in #ref=) and the transaction hash from the buyer wallet.',
  'This check is read-only. Nothing is signed or sent. Agora Pay does not hold keys or funds.',
  'Base mainnet is refused. Only Base Sepolia is read.',
  'A match needs that hash, this merchant as recipient, the exact amount, and a block inside the sale window.',
  'One hash binds to one sale reference. A second transfer of the same amount does not count.',
  'Under 12 blocks the state stays pending. Confirmed is not the same as final.',
  'A match shows that this amount arrived. It does not prove who paid.',
  'The block window is saved with the sale. Import the backup if this device does not have it. Without that window this check does not decide the payment.',
] as const

const MAINNET_MESSAGE = 'This link is for Base mainnet (real funds). This check only reads Base Sepolia. Nothing was sent.'
const WINDOW_UNKNOWN = 'The block window for this sale is not on this device. Import the backup saved when the request was created. Without that window this check does not decide the payment.'
const MISMATCH = 'This link does not match the sale saved on this device (address, token or amount). Nothing was decided.'

export type MissedPaymentReport =
  | { outcome: 'refused-mainnet'; message: string }
  | { outcome: 'window-unknown'; message: string }
  | { outcome: 'mismatch'; message: string }
  | { outcome: 'checked'; message: string; reference: string; state: PaymentState; sales: LiveRequest[] }

export async function checkMissedPayment(
  reader: ChainReader,
  input: { saleLink: string; txHash: string; sales: readonly LiveRequest[] },
): Promise<MissedPaymentReport> {
  const parsed = parseRequestLink(input.saleLink)
  if (parsed.chain !== 'baseSepolia') return { outcome: 'refused-mainnet', message: MAINNET_MESSAGE }
  if (!parsed.reference) throw new Error('This sale link has no payment reference. Use the link that ends in #ref=.')
  const txHash = normalizeTxHash(input.txHash)
  const sale = input.sales.find((item) => item.request.reference?.toLowerCase() === parsed.reference)
  if (!sale) return { outcome: 'window-unknown', message: WINDOW_UNKNOWN }
  if (
    sale.request.chain !== 'baseSepolia' ||
    sale.request.token !== parsed.token ||
    sale.request.merchant.toLowerCase() !== parsed.merchant.toLowerCase() ||
    sale.request.atomic !== parsed.atomic
  ) {
    return { outcome: 'mismatch', message: MISMATCH }
  }
  const bound = bindLiveClaim(sale, txHash, claimsFromSales(input.sales))
  const state = await refreshLive(reader, bound)
  const sales = input.sales.map((item) => item.request.reference?.toLowerCase() === parsed.reference ? bound : item)
  return { outcome: 'checked', message: describeState(state), reference: parsed.reference, state, sales }
}
