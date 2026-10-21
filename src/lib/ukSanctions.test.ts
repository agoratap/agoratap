import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs build script, no types
import { parseUkSanctionsCsv, buildUkSnapshot, extractUkAddresses, base58CheckOk, bech32Ok } from '../../scripts/update-uk-sanctions.mjs'
import { EU_LIST, OFAC_LIST, UK_LIST, screenAddress, screenAddressAll, type OfacList } from './screening'

// Offline fixture in the shape of the UK Sanctions List CSV (report-date line, then header), with the glued
// addresses the real file contains (two EVM and two Tron addresses written with no separator).
const HEADER = 'Last Updated,Unique ID,Name 6,Name 1,Name type,Other Information'
const CSV = [
  'Report Date: 16-Oct-2026',
  HEADER,
  '01/01/2026,GHR0174,Byex Exchange Company Limited,,Primary Name,"Byex is associated with the following Ethereum crypto addresses: 0xD599Ac04A1C786972b81e0Fef6fb0C3e7b52f8A7 0xAE05eB856CB28c156d9722094F5eEfD5693Bc1810xAE05eB856CB28c156d9722094F5eEfD5693Bc181Byex is associated with the following Tron crypto addresses:TDpwBeBt6KPz2HJRzNNXy62gT1yU1MFLTS THGRp6CbGGhDBLGuoTZki5fpoUtR8R54DxTHGRp6CbGGhDBLGuoTZki5fpoUtR8R54Dx"',
  '01/01/2026,GHR0174,BYEX,,Alias,"Byex is associated with the following Ethereum crypto addresses: 0xD599Ac04A1C786972b81e0Fef6fb0C3e7b52f8A7"',
  '01/01/2026,RUS3602,EXMO EXCHANGE LIMITED,,Primary Name,"associated with the following crypto wallet addresses: TJqUC56SDZ373JYRurzXtMcor2HQvN9BaUTVa1p4aTVoHuF4EDGthn57FbKNbu4DRJkQ TCQqA58EmX6AnUZKPCogL2Q441B4ThbJGN"',
  '01/01/2026,RUS1421,GARANTEX EUROPE OU,,Primary Name,"Digital Currency Address: XBT 3Lpoy53K625zVeE47ZasiG5jGkAxJ27kh1\t Digital Currency Address: ETH 0x7FF9cFad3877F21d41Da833E2F775dB0569eE3D9"',
  '01/01/2026,RUS3605,RAPIRA GROUP LLC,,Primary Name,"Internet Services Sanctions: ... Digital address: bc1q72ud4m6zf5g37jkhc2ty95zm5vel9ufdxquqpm "',
  '01/01/2026,XXX0001,Person P,,Primary Name,"Passport 1Lpoy53K625zVeE47ZasiG5jGkAxJ27kh1 TDpwBeBt6KPz2HJRzNNXy62gT1yU1MFLTS no marker here"',
  '01/01/2026,XXX0002,Person Q,,Primary Name,"crypto wallet with a typo TDpwBeBt6KPz2HJRzNNXy62gT1yU1MFLTT"',
].join('\r\n')

describe('UK Sanctions List parser', () => {
  it('splits glued addresses, keeps chain labels, lowercases 0x and bech32, and reads the report date', () => {
    const { addresses, reportDate } = parseUkSanctionsCsv(CSV)
    expect(reportDate).toBe('2026-10-16')
    expect(addresses['0xae05eb856cb28c156d9722094f5eefd5693bc181']).toBe('EVM')
    expect(addresses['0xd599ac04a1c786972b81e0fef6fb0c3e7b52f8a7']).toBe('EVM')
    expect(addresses['THGRp6CbGGhDBLGuoTZki5fpoUtR8R54Dx']).toBe('TRX')
    expect(addresses['TJqUC56SDZ373JYRurzXtMcor2HQvN9BaU']).toBe('TRX')
    expect(addresses['TVa1p4aTVoHuF4EDGthn57FbKNbu4DRJkQ']).toBe('TRX')
    expect(addresses['3Lpoy53K625zVeE47ZasiG5jGkAxJ27kh1']).toBe('BTC')
    expect(addresses['0x7ff9cfad3877f21d41da833e2f775db0569ee3d9']).toBe('ETH')
    expect(addresses['bc1q72ud4m6zf5g37jkhc2ty95zm5vel9ufdxquqpm']).toBe('BTC')
    expect(Object.keys(addresses)).toHaveLength(10)
  })

  it('ignores cells without a crypto/wallet/digital-address marker and drops strings whose checksum fails', () => {
    const { addresses, entities } = parseUkSanctionsCsv(CSV)
    expect(addresses['TDpwBeBt6KPz2HJRzNNXy62gT1yU1MFLTT']).toBeUndefined()
    expect(entities['XXX0001']).toBeUndefined()
    expect(entities['XXX0002']).toBeUndefined()
    expect(extractUkAddresses('no marker 0x7FF9cFad3877F21d41Da833E2F775dB0569eE3D9')).toEqual([])
    expect(base58CheckOk('3Lpoy53K625zVeE47ZasiG5jGkAxJ27kh1')).toBe(true)
    expect(base58CheckOk('3Lpoy53K625zVeE47ZasiG5jGkAxJ27kh2')).toBe(false)
    expect(bech32Ok('bc1q72ud4m6zf5g37jkhc2ty95zm5vel9ufdxquqpm')).toBe(true)
    expect(bech32Ok('bc1q72ud4m6zf5g37jkhc2ty95zm5vel9ufdxquqpq')).toBe(false)
  })

  it('names each UK entry once, using its primary name', () => {
    expect(parseUkSanctionsCsv(CSV).entities).toEqual({
      GHR0174: 'Byex Exchange Company Limited', RUS1421: 'GARANTEX EUROPE OU', RUS3602: 'EXMO EXCHANGE LIMITED', RUS3605: 'RAPIRA GROUP LLC',
    })
  })

  it('buildUkSnapshot labels the snapshot and refuses an implausibly small list instead of replacing the last good one', () => {
    const snap = buildUkSnapshot(CSV, '2026-10-21', 'https://x')
    expect(snap.authority).toBe('UK')
    expect(snap.count).toBe(10)
    expect(snap.note).toMatch(/names and entities are not screened/i)
    expect(() => buildUkSnapshot('Report Date: 16-Oct-2026\r\n' + HEADER + '\r\n1,A,B,,Primary Name,"crypto TCQqA58EmX6AnUZKPCogL2Q441B4ThbJGN"', '2026-10-21')).toThrow(/implausibly small/)
  })
})

describe('UK screening alongside OFAC and EU', () => {
  const UK_ONLY = 'TCQqA58EmX6AnUZKPCogL2Q441B4ThbJGN' // EXMO Tron address in the UK list, not in the OFAC or EU snapshots

  it('the committed UK snapshot is loaded, labelled and sourced from the FCDO UK Sanctions List', () => {
    expect(UK_LIST.authority).toBe('UK')
    expect(UK_LIST.count).toBeGreaterThanOrEqual(10)
    expect(UK_LIST.count).toBe(Object.keys(UK_LIST.addresses).length)
    expect(UK_LIST.source).toMatch(/^https:\/\/sanctionslist\.fcdo\.gov\.uk\//)
    expect(UK_LIST.downloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(OFAC_LIST.addresses[UK_ONLY]).toBeUndefined()
    expect(EU_LIST.addresses[UK_ONLY]).toBeUndefined()
  })

  it('warns on an address that is only on the UK list and names the UK list', () => {
    const r = screenAddressAll(UK_ONLY)
    expect(r.status).toBe('listed')
    expect(r.message).toMatch(/appears on the public UK sanctions list/)
    expect(r.message).not.toMatch(/OFAC sanctions list|EU sanctions list/)
    expect(screenAddress(UK_ONLY.toLowerCase(), UK_LIST).status).toBe('not-listed') // Tron base58 is case-sensitive
  })

  it('says not on the UK snapshot for a clean address, and list not loaded if the UK list is missing', () => {
    expect(screenAddressAll('0x00000000000000000000000000000000000000aa').message).toMatch(/Not on the UK snapshot/)
    const empty: OfacList = { authority: 'UK', source: '', downloadedAt: '', count: 0, addresses: {} }
    const r = screenAddressAll('0x00000000000000000000000000000000000000aa', [OFAC_LIST, EU_LIST, empty])
    expect(r.status).toBe('list-not-loaded')
    expect(r.message).toMatch(/UK sanctions list not loaded/)
  })
})
