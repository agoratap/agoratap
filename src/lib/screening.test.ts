import { describe, expect, it } from 'vitest'
import { combineScreenResults, nameMatches, screenAddress, screenName, screenNameAll, type OfacList } from './screening'

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

describe('nameMatches', () => {
  it('matches a listed name in any letter case and ignores legal-form words', () => {
    expect(nameMatches('garantex', 'Garantex')).toBe(true)
    expect(nameMatches('GARANTEX', 'GARANTEX EUROPE OU')).toBe(true)
    expect(nameMatches('EXMO', 'EXMO EXCHANGE LIMITED')).toBe(true)
    expect(nameMatches('  Byex Exchange  ', 'Byex Exchange Company Limited')).toBe(true)
    expect(nameMatches('Limited', 'EXMO EXCHANGE LIMITED')).toBe(false)
    expect(nameMatches('exchange', 'Byex Exchange Company Limited')).toBe(false)
    expect(nameMatches('abc', 'EXMO EXCHANGE LIMITED')).toBe(false)
  })
})

describe('screenName', () => {
  const EU: OfacList = {
    authority: 'EU',
    source: 'https://example.invalid/eu',
    downloadedAt: '2026-10-18',
    count: 1,
    addresses: {},
    entities: { 'EU.1': 'Garantex', 'EU.2': 'Grinex' },
  }

  it('warns when a name matches an EU or UK entry that publishes wallet addresses, in any letter case', () => {
    const r = screenName('  GARANTEX  ', EU)
    expect(r.status).toBe('listed')
    expect(r.message).toMatch(/appears on the public EU sanctions list/)
    expect(r.message).toMatch(/Garantex/)
    expect(r.message).toMatch(/You decide/)
    const all = screenNameAll('exmo', [
      { authority: 'OFAC', source: '', downloadedAt: '2026-10-02', count: 1, addresses: { '0xabc': 'ETH' } },
      EU,
      { authority: 'UK', source: '', downloadedAt: '2026-10-21', count: 1, addresses: {}, entities: { RUS3602: 'EXMO EXCHANGE LIMITED' } },
    ])
    expect(all.status).toBe('listed')
    expect(all.message).toMatch(/UK sanctions list/)
    expect(all.message).toMatch(/EXMO EXCHANGE LIMITED/)
    expect(all.message).not.toMatch(/OFAC sanctions list/)
  })

  it('does not treat a legal-form word such as Limited as a name hit', () => {
    const uk: OfacList = { authority: 'UK', source: '', downloadedAt: '2026-10-21', count: 1, addresses: {}, entities: { RUS3602: 'EXMO EXCHANGE LIMITED' } }
    const r = screenName('Limited', uk)
    expect(r.status).toBe('not-listed')
    expect(r.message).toMatch(/Not on the UK snapshot/)
    expect(r.message).toMatch(/1 named entries that publish wallet addresses/)
  })

  it('reports names not loaded for an empty name snapshot instead of calling the name clean', () => {
    const empty: OfacList = { authority: 'EU', source: '', downloadedAt: '', count: 0, addresses: {}, entities: {} }
    const r = screenName('Garantex', empty)
    expect(r.status).toBe('list-not-loaded')
    expect(r.message).toMatch(/names not loaded/)
    expect(screenName('  ', EU).status).toBe('empty')
  })

  it('skips OFAC when folding name results, because the OFAC snapshot has no names', () => {
    const r = screenNameAll('Garantex', [LIST, EU])
    expect(r.status).toBe('listed')
    expect(r.message).toMatch(/EU sanctions list/)
    expect(r.message).not.toMatch(/OFAC/)
  })
})

describe('combineScreenResults', () => {
  it('warns if either the address or the name is listed, and stays empty when both are empty', () => {
    const listed = { status: 'listed' as const, chain: 'ETH', message: 'addr hit' }
    const clean = { status: 'not-listed' as const, message: 'clean' }
    const empty = { status: 'empty' as const, message: '' }
    const missing = { status: 'list-not-loaded' as const, message: 'missing' }
    expect(combineScreenResults(listed, clean).status).toBe('listed')
    expect(combineScreenResults(clean, listed).message).toMatch(/addr hit/)
    expect(combineScreenResults(empty, empty).status).toBe('empty')
    expect(combineScreenResults(clean, missing).status).toBe('list-not-loaded')
    expect(combineScreenResults(empty, clean).status).toBe('not-listed')
  })
})
