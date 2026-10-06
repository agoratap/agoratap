// Buyer-side payment reference. Documented in docs/MATCHING_DESIGN.md section 4 as the option that needs no contract,
// no relayer and no custody. A plain ERC-20 `transfer` has no memo field. Every Transfer log does carry a transaction
// hash. The sale embeds a stable 32-byte reference in the share link, after `#`, so a wallet that opens the EIP-681
// link still encodes `transfer(address,uint256)` and nothing else. The buyer or the merchant binds that on-chain
// hash to the reference. Matching then follows the hash. The amount tag is only the backup when no hash is bound.
import { eip681Uri, type OpenRequest } from './chainRequest'

export const REFERENCE_RE = /^0x[0-9a-fA-F]{64}$/
const TX_HASH_RE = /^0x[0-9a-f]{64}$/

export function createReference(fill?: (bytes: Uint8Array) => void): string {
  const bytes = new Uint8Array(32)
  if (fill) fill(bytes)
  else crypto.getRandomValues(bytes)
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

/** Share link: EIP-681 transfer plus `#ref=<32 bytes>`. The fragment is not a transfer argument. */
export function paymentRequestLink(req: OpenRequest): string {
  const uri = eip681Uri(req)
  if (req.reference === undefined || req.reference === '') return uri
  if (!REFERENCE_RE.test(req.reference)) throw new Error('Payment reference is not valid')
  return `${uri}#ref=${req.reference.toLowerCase()}`
}

export function normalizeTxHash(value: string): string {
  const tx = value.trim().toLowerCase()
  if (!TX_HASH_RE.test(tx)) throw new Error('Transaction hash must be 0x and 64 hex characters')
  return tx
}

export interface TxClaim {
  readonly reference: string
  readonly txHash: string
}

/** One transaction can satisfy only one payment reference. Re-binding the same reference is allowed. */
export function assertClaimFree(reference: string, txHash: string, claims: readonly TxClaim[]): void {
  if (!REFERENCE_RE.test(reference)) throw new Error('Payment reference is not valid')
  const tx = normalizeTxHash(txHash)
  const ref = reference.toLowerCase()
  const other = claims.find((c) => c.txHash.toLowerCase() === tx && c.reference.toLowerCase() !== ref)
  if (other) throw new Error('This transaction is already matched to another payment reference')
}
