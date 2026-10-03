import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BuyerLive, MerchantLive } from './LivePanels'
import { eip681Uri, type OpenRequest } from './lib/chainRequest'
import { OFAC_LIST } from './lib/screening'

const M = '0x1111111111111111111111111111111111111111'
const r = (chain: 'base' | 'baseSepolia', merchant = M): OpenRequest => ({ orderId: 'A', chain, token: 'EURC', merchant, atomic: 1_000_042n, baseAtomic: 1_000_000n, tag: 42 })
const buyer = (text: string) => renderToStaticMarkup(createElement(BuyerLive, { initialText: text }))

describe('live test panels', () => {
  it('merchant panel is labelled testnet read-only and says a match does not prove who paid', () => {
    const html = renderToStaticMarkup(createElement(MerchantLive))
    expect(html).toMatch(/BASE SEPOLIA, READ-ONLY/)
    expect(html).toMatch(/Test tokens have no value/)
    expect(html).toMatch(/never signs, sends or holds anything/)
    expect(html).toMatch(/not who sent it/)
    expect(html).toMatch(/sees your IP address/)
  })
  it('buyer panel shows exactly what a testnet link asks, and offers wallet + watch', () => {
    const html = buyer(eip681Uri(r('baseSepolia')))
    expect(html).toContain('1.000042 EURC')
    expect(html).toContain('Base Sepolia (test)')
    expect(html).toContain('Watch the chain')
    expect(html).toContain('Open in my wallet')
  })
  it('buyer panel refuses a mainnet link: warning shown, no wallet link, no watch button', () => {
    const html = buyer(eip681Uri(r('base')))
    expect(html).toMatch(/Base MAINNET \(real funds\)/)
    expect(html).toMatch(/Do not pay it from here/)
    expect(html).not.toContain('Open in my wallet')
    expect(html).not.toContain('Watch the chain')
  })
  it('buyer panel warns on junk links and on an OFAC-listed merchant (warn only)', () => {
    expect(buyer('https://evil.example')).toMatch(/Not an AgoraTap payment link/)
    const listed = Object.keys(OFAC_LIST.addresses).find((a) => /^0x[0-9a-f]{40}$/.test(a))!
    const html = buyer(eip681Uri(r('baseSepolia', listed)))
    expect(html).toMatch(/appears on the public OFAC sanctions list/)
    expect(html).toContain('Open in my wallet') // warn only: nothing is removed
  })
})
