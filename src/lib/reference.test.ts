import { describe, expect, it } from 'vitest'
import { eip681Uri, type OpenRequest } from './chainRequest'
import { parseRequestLink, walletTransferUri } from './requestLink'
import { assertClaimFree, createReference, normalizeTxHash, paymentRequestLink } from './reference'

const M = '0x1111111111111111111111111111111111111111'
const ref = '0x' + 'ab'.repeat(32)
const req: OpenRequest = { orderId: 'A', chain: 'baseSepolia', token: 'EURC', merchant: M, atomic: 1_000_042n, baseAtomic: 1_000_000n, tag: 42, reference: ref }

describe('payment reference', () => {
  it('embeds a stable reference in the share link and keeps the wallet link a plain EIP-681 transfer', () => {
    const again = createReference((b) => b.fill(0x11))
    expect(again).toBe(createReference((b) => b.fill(0x11)))
    expect(again).toHaveLength(66)
    expect(createReference((b) => b.fill(0x22))).not.toBe(again)

    const link = paymentRequestLink(req)
    expect(link).toBe(`${eip681Uri(req)}#ref=${ref}`)
    expect(eip681Uri(req)).not.toContain('#')
    expect(parseRequestLink(link)).toMatchObject({ chain: 'baseSepolia', token: 'EURC', merchant: M, atomic: 1_000_042n, reference: ref })
    expect(walletTransferUri(link)).toBe(eip681Uri(req))
    expect(walletTransferUri(link)).not.toContain('ref=')

    expect(() => parseRequestLink(eip681Uri(req) + '&ref=' + ref)).toThrow(/not an Agora Pay/i)
    expect(() => parseRequestLink(eip681Uri(req) + '#ref=0x1234')).toThrow(/not valid/)
    expect(() => paymentRequestLink({ ...req, reference: '0x1234' })).toThrow(/not valid/)
    expect(normalizeTxHash(ref.toUpperCase())).toBe(ref)
    expect(() => normalizeTxHash('0x1234')).toThrow(/64 hex/)
    expect(() => assertClaimFree(ref, ref, [{ reference: '0x' + 'cd'.repeat(32), txHash: ref }])).toThrow(/another payment reference/)
    expect(() => assertClaimFree(ref, ref, [{ reference: ref, txHash: ref }])).not.toThrow()
  })
})
