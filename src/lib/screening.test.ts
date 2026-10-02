import { describe, expect, it } from 'vitest'
import { screenAddress, type OfacList } from './screening'

const LISTED = '0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB'
const CLEAN = '0x00000000000000000000000000000000000000aa'
const BTC = 'bc1qlistedexampleaddress000000000000000000'
const LIST: OfacList = {
  source: 'https://example.invalid/sdn.csv',
  downloadedAt: '2026-10-02',
  count: 2,
  addresses: { [LISTED.toLowerCase()]: 'ETH', [BTC]: 'XBT' },
}
const EMPTY: OfacList = { source: '', downloadedAt: '', count: 0, addresses: {} }

describe('screenAddress', () => {
  it('warns when an address is on the OFAC list, in any letter case', () => {
    for (const variant of [LISTED, LISTED.toLowerCase(), '0x' + LISTED.slice(2).toUpperCase(), `  ${LISTED}\n`]) {
      const r = screenAddress(variant, LIST)
      expect(r.status).toBe('listed')
      if (r.status === 'listed') expect(r.chain).toBe('ETH')
    }
  })

  it('passes an address that is not on the list, and says only that it is not on this snapshot', () => {
    const r = screenAddress(CLEAN, LIST)
    expect(r.status).toBe('not-listed')
    expect(r.message).toMatch(/not on/i)
    expect(r.message).toMatch(/snapshot|2026-10-02/i)
    expect(r.message).toMatch(/not a statement .* lawful or safe/i)
    expect(r.message).not.toMatch(/^\s*(clean|safe|ok|approved|verified)/i)
  })

  it('reports list not loaded for an empty list instead of calling the address clean', () => {
    const r = screenAddress(CLEAN, EMPTY)
    expect(r.status).toBe('list-not-loaded')
    expect(r.message).toMatch(/list not loaded/i)
    expect(screenAddress(LISTED, EMPTY).status).toBe('list-not-loaded')
  })

  it('returns empty for blank input and does not warn', () => {
    expect(screenAddress('   ', LIST).status).toBe('empty')
  })

  it('matches non-EVM entries exactly, without folding case for case-sensitive formats', () => {
    const l: OfacList = { ...LIST, addresses: { '1AbCdEfGhJkLmNpQrStUvWxYz12345678': 'XBT' } }
    expect(screenAddress('1AbCdEfGhJkLmNpQrStUvWxYz12345678', l).status).toBe('listed')
    expect(screenAddress('1abcdefghjklmnpqrstuvwxyz12345678', l).status).toBe('not-listed')
    expect(screenAddress(BTC.toUpperCase(), LIST).status).toBe('listed') // bech32 is case-insensitive
  })

  it('the committed snapshot is loaded, labelled and contains EVM addresses', async () => {
    const { OFAC_LIST } = await import('./screening')
    expect(OFAC_LIST.count).toBeGreaterThan(100)
    expect(OFAC_LIST.source).toMatch(/^https:\/\/sanctionslistservice\.ofac\.treas\.gov\//)
    expect(OFAC_LIST.downloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Object.keys(OFAC_LIST.addresses).some((a) => /^0x[0-9a-f]{40}$/.test(a))).toBe(true)
    const known = Object.keys(OFAC_LIST.addresses).find((a) => /^0x[0-9a-f]{40}$/.test(a))!
    expect(screenAddress(known.toUpperCase().replace('0X', '0x')).status).toBe('listed')
  })
})
