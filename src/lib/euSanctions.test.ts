import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs build script, no types
import { parseEuFsfCsv, buildEuSnapshot, extractWalletAddresses, parseCsv } from '../../scripts/update-eu-sanctions.mjs'
import { EU_LIST, OFAC_LIST, screenAddress, screenAddressAll, type OfacList } from './screening'

// Offline fixture in the shape of the EU FSF CSV (semicolon-separated, literal "\n" inside remark text).
const HEADER = 'fileGenerationDate;Entity_LogicalId;Entity_EU_ReferenceNumber;NameAlias_WholeName;NameAlias_Remark;Address_Remark'
const CSV = [
  HEADER,
  '15/10/2026;1;EU.1.1;Exchange A;"Place: X\\nKnown blockchain wallet addresses:\\nETH: 0x002471b8A185f9980708d0eAEC5B289714F56f8d\\nBTC: bc1qwtz3zv95x2flu4w26kgfepf529z50r2sqc5zml\\n3My1ffQr5qQzmq4aBFgRqwRYqfB5zPAt8t\\nTRX: TA1hsikRfsgGiW9nEBpT4tEXEySTNYLr2d";',
  '15/10/2026;2;EU.2.2;Биржа Б;;"Known blockchain wallet addresses\\nTNZxGWCwvsHr6JxQxzoeDXV5\\n97Yf7Zb7nV"',
  '15/10/2026;2;EU.2.2;Exchange B;;"Known blockchain wallet . addresses:\\nTEcuHDQthTmULe8fFLUccBPpjfXaTmJuuD"',
  '15/10/2026;3;EU.3.3;Person C;"Passport 1234567890123456789012345; wallet not mentioned with addresses";',
].join('\r\n')

describe('EU consolidated sanctions list (FSF) parser', () => {
  it('extracts wallet addresses from EU remark text, keeps chain labels and lowercases 0x and bech32', () => {
    const { addresses, fileDate } = parseEuFsfCsv(CSV)
    expect(fileDate).toBe('2026-10-15')
    expect(addresses['0x002471b8a185f9980708d0eaec5b289714f56f8d']).toBe('ETH')
    expect(addresses['bc1qwtz3zv95x2flu4w26kgfepf529z50r2sqc5zml']).toBe('BTC')
    expect(addresses['3My1ffQr5qQzmq4aBFgRqwRYqfB5zPAt8t']).toBe('BTC')
    expect(addresses['TA1hsikRfsgGiW9nEBpT4tEXEySTNYLr2d']).toBe('TRX')
    expect(addresses['TEcuHDQthTmULe8fFLUccBPpjfXaTmJuuD']).toBe('TRX')
  })

  it('joins a Tron address the EU split across two lines, and ignores text outside a wallet-address remark', () => {
    const { addresses } = parseEuFsfCsv(CSV)
    expect(addresses['TNZxGWCwvsHr6JxQxzoeDXV597Yf7Zb7nV']).toBe('TRX')
    expect(addresses['TNZxGWCwvsHr6JxQxzoeDXV5']).toBeUndefined()
    expect(addresses['1234567890123456789012345']).toBeUndefined()
    expect(Object.keys(addresses)).toHaveLength(6)
    expect(extractWalletAddresses('no marker 0x002471b8A185f9980708d0eAEC5B289714F56f8d')).toEqual([])
  })

  it('names the EU entries that carry addresses, preferring a Latin-script name', () => {
    expect(parseEuFsfCsv(CSV).entities).toEqual({ 'EU.1.1': 'Exchange A', 'EU.2.2': 'Exchange B' })
  })

  it('parses quoted CSV cells containing separators and newlines', () => {
    expect(parseCsv('a;"b;c"\r\n"d\ne";f')).toEqual([['a', 'b;c'], ['d\ne', 'f']])
  })

  it('buildEuSnapshot labels the snapshot and refuses an implausibly small list instead of replacing the last good one', () => {
    const snap = buildEuSnapshot(CSV, '2026-10-18', 'https://x')
    expect(snap.authority).toBe('EU')
    expect(snap.count).toBe(6)
    expect(snap.fileGenerationDate).toBe('2026-10-15')
    expect(snap.note).toMatch(/names and entities are not screened/i)
    expect(() => buildEuSnapshot(HEADER + '\r\n15/10/2026;1;EU.9;Z;;', '2026-10-18')).toThrow(/implausibly small/)
  })
})

describe('EU screening alongside OFAC', () => {
  const EU_ONLY = '0x3051Ca7cB7f6C599fA2f27385AD75010cf0f2bbF' // Garantex BSC address in the EU file, not in the OFAC snapshot

  it('the committed EU snapshot is loaded, labelled and sourced from the EU FSF service', () => {
    expect(EU_LIST.authority).toBe('EU')
    expect(EU_LIST.count).toBeGreaterThanOrEqual(3)
    expect(EU_LIST.source).toMatch(/^https:\/\/webgate\.ec\.europa\.eu\/fsd\/fsf\//)
    expect(EU_LIST.downloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(OFAC_LIST.addresses[EU_ONLY.toLowerCase()]).toBeUndefined()
  })

  it('warns on an address that is only on the EU list, in any letter case, and names the EU list', () => {
    const r = screenAddressAll(EU_ONLY.toUpperCase().replace('0X', '0x'))
    expect(r.status).toBe('listed')
    expect(r.message).toMatch(/appears on the public EU sanctions list/)
    expect(r.message).not.toMatch(/OFAC sanctions list/)
    expect(screenAddress(EU_ONLY, OFAC_LIST).status).toBe('not-listed')
  })

  it('names both lists when an address is on OFAC and EU', () => {
    const both = Object.keys(EU_LIST.addresses).find((a) => OFAC_LIST.addresses[a] !== undefined)!
    const r = screenAddressAll(both)
    expect(r.status).toBe('listed')
    expect(r.message).toMatch(/OFAC sanctions list/)
    expect(r.message).toMatch(/EU sanctions list/)
  })

  it('says not on either snapshot for a clean address, never clean or safe', () => {
    const r = screenAddressAll('0x00000000000000000000000000000000000000aa')
    expect(r.status).toBe('not-listed')
    expect(r.message).toMatch(/Not on the OFAC snapshot/)
    expect(r.message).toMatch(/Not on the EU snapshot/)
    expect(r.message).not.toMatch(/^\s*(clean|safe|ok|approved|verified)/i)
  })

  it('reports list not loaded if the EU list is missing, even when OFAC is loaded', () => {
    const empty: OfacList = { authority: 'EU', source: '', downloadedAt: '', count: 0, addresses: {} }
    const r = screenAddressAll('0x00000000000000000000000000000000000000aa', [OFAC_LIST, empty])
    expect(r.status).toBe('list-not-loaded')
    expect(r.message).toMatch(/EU sanctions list not loaded/)
    expect(screenAddressAll('  ').status).toBe('empty')
  })
})
