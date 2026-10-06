import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs build script, no types
import { parseOfacCsv, buildSnapshot } from '../../scripts/update-ofac.mjs'

const CSV = [
  '1,"A","x",-0- ,"Digital Currency Address - ETH 0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB; Digital Currency Address - XBT 1AbCdEfGhJkLmNpQrStUvWxYz; Digital Currency Address - USDT 0x1CAb8177ACe78b1B6B1c393371F4f2dCAE40CbEB;"',
  '2,"B","y",-0- ,"Digital Currency Address - TRX TXyzAbcDefGhJkLmNpQrStUv; Digital Currency Address - XBT bc1QABCDEFGHJKLMNPQRSTUVWXYZ; Digital Currency Address - XBT 3;"',
  '3,"C","z",-0- ,"nothing here"',
].join('\r\n')

describe('parseOfacCsv', () => {
  it('extracts Digital Currency Address entries, lowercases 0x and bech32, keeps base58 exact', () => {
    const m = parseOfacCsv(CSV)
    expect(m['0x1cab8177ace78b1b6b1c393371f4f2dcae40cbeb']).toBeDefined()
    expect(m['1AbCdEfGhJkLmNpQrStUvWxYz']).toBe('XBT')
    expect(m['TXyzAbcDefGhJkLmNpQrStUv']).toBe('TRX')
    expect(m['bc1qabcdefghjklmnpqrstuvwxyz']).toBe('XBT')
    expect(Object.keys(m)).toHaveLength(4)
  })

  it('keeps every chain an EVM address is listed under, and drops truncated junk entries', () => {
    const m = parseOfacCsv(CSV)
    expect(m['0x1cab8177ace78b1b6b1c393371f4f2dcae40cbeb']).toBe('ETH/USDT')
    expect(m['3']).toBeUndefined()
  })

  it('buildSnapshot refuses an implausibly small list instead of replacing the last good one', () => {
    expect(() => buildSnapshot(CSV, '2026-10-02', 'https://x')).toThrow(/implausibly small/)
  })
})
