import { describe, expect, it } from 'vitest'
import { ASSET_CATALOG, FIAT_COMING_LABEL, allowedPayouts, indicativeQuote, searchAssets } from './anyAsset'

const byId = (id: string) => ASSET_CATALOG.find((a) => a.id === id)!

describe('any-asset catalog', () => {
  it('lists the core pay-in assets and networks', () => {
    for (const id of ['btc', 'eth', 'xmr', 'usdt-tron', 'usdt-eth', 'usdt-sol', 'usdt-bsc', 'usdt-polygon', 'usdc-eth', 'usdc-sol', 'eurc-base', 'sol', 'ltc', 'trx', 'doge', 'bnb'])
      expect(byId(id)).toBeDefined()
    for (const sym of ['EUR', 'USD', 'JPY', 'GBP', 'RON']) expect(ASSET_CATALOG.some((a) => a.kind === 'fiat' && a.symbol === sym)).toBe(true)
  })
  it('keeps EURC and USDC as the practice wallet assets', () => {
    expect(ASSET_CATALOG.filter((a) => a.practice).map((a) => a.symbol).sort()).toEqual(['EURC', 'USDC'])
  })
  it('searches by symbol, name and network', () => {
    expect(searchAssets('tron').map((a) => a.id)).toContain('usdt-tron')
    expect(searchAssets('monero').map((a) => a.id)).toEqual(['xmr'])
    expect(searchAssets('ron').some((a) => a.symbol === 'RON')).toBe(true)
    expect(searchAssets('')).toHaveLength(ASSET_CATALOG.length)
  })
})

describe('indicative quote', () => {
  it('quotes BTC into EURC with spread and network fee', () => {
    const q = indicativeQuote(byId("btc"), 58, "EURC")
    expect(q.indicative).toBe(true)
    expect(q.payoutAmount).toBe(58)
    expect(q.sendAmount).toBeCloseTo((58 / 74000) * 1.01 + 0.00002, 8)
  })
  it('quotes USDT on Tron and XMR for an EU merchant paid in EURC', () => {
    expect(indicativeQuote(byId('usdt-tron'), 9.2, 'EURC').sendAmount).toBeGreaterThan(10)
    expect(indicativeQuote(byId('xmr'), 15, 'EURC').sendAmount).toBeGreaterThan(0.03)
  })
  it('never pays an EU merchant in USDT or XMR, but allows it outside the EU', () => {
    expect(allowedPayouts(true)).not.toContain('USDT')
    expect(allowedPayouts(true)).not.toContain('XMR')
    expect(() => indicativeQuote(byId('btc'), 10, 'USDT', true)).toThrow()
    expect(indicativeQuote(byId('btc'), 10, 'USDT', false).payout).toBe('USDT')
  })
  it('refuses fiat with the coming-soon label', () => {
    expect(() => indicativeQuote(ASSET_CATALOG.find((a) => a.symbol === 'JPY')!, 10, 'EURC')).toThrow(FIAT_COMING_LABEL)
  })
})
