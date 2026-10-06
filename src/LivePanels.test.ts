import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BuyerLive, MerchantLive, buyerWatchWindow } from './LivePanels'
import { eip681Uri, type OpenRequest } from './lib/chainRequest'
import { paymentRequestLink } from './lib/reference'
import { OFAC_LIST } from './lib/screening'

const M = '0x1111111111111111111111111111111111111111'
const r = (chain: 'base' | 'baseSepolia', merchant = M): OpenRequest => ({ orderId: 'A', chain, token: 'EURC', merchant, atomic: 1_000_042n, baseAtomic: 1_000_000n, tag: 42 })
const buyer = (text: string) => renderToStaticMarkup(createElement(BuyerLive, { initialText: text }))

describe('live test panels', () => {
  it('buyer watch includes the prior 24 hours so a payment made just before opening the watcher is not missed', () => {
    expect(buyerWatchWindow(50_000)).toEqual({ fromBlock: 6_800 })
    expect(buyerWatchWindow(1_000)).toEqual({ fromBlock: 0 })
  })

  it('merchant panel offers a device backup and a missed-payment check', () => {
    const html = renderToStaticMarkup(createElement(MerchantLive))
    expect(html).toMatch(/Export sale backup/)
    expect(html).toMatch(/Import sale backup/)
    expect(html).toMatch(/Remove saved sales on this device/)
    expect(html).toMatch(/Keys stay in your wallet, on your device/)
    expect(html).toMatch(/Non-custodial/)
    expect(html).toMatch(/does not hold wallet keys/)
    expect(html).toMatch(/Missed payment\?/)
    expect(html).toMatch(/Base mainnet is refused/)
    expect(html).toMatch(/does not decide the payment/)
    expect(html).toMatch(/does not prove who paid/)
    expect(html).toMatch(/Nothing is signed or sent/)
  })

  it('merchant panel is labelled testnet read-only and says a match does not prove who paid', () => {
    const html = renderToStaticMarkup(createElement(MerchantLive))
    expect(html).toMatch(/BASE SEPOLIA, READ-ONLY/)
    expect(html).toMatch(/Test tokens have no value/)
    expect(html).toMatch(/never signs, sends or holds anything/)
    expect(html).toMatch(/not who sent it/)
    expect(html).toMatch(/transaction hash/i)
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
    expect(html).not.toContain('Match this transaction')
  })
  it('buyer wallet link is a plain transfer and the reference stays on the share link', () => {
    const reference = '0x' + 'ab'.repeat(32)
    const html = buyer(paymentRequestLink({ ...r('baseSepolia'), reference }))
    expect(html).toContain(reference)
    expect(html).toContain('Transaction hash')
    expect(html).toContain('Match this transaction')
    const href = html.match(/href="([^"]+)"/)?.[1] ?? ''
    expect(href.replace(/&amp;/g, '&')).toBe(eip681Uri(r('baseSepolia')))
    expect(href).not.toMatch(/#ref=|%23ref=/)
  })
  it('buyer panel warns on junk links and on an OFAC-listed merchant (warn only)', () => {
    expect(buyer('https://evil.example')).toMatch(/Not an Agora Pay payment link/)
    const listed = Object.keys(OFAC_LIST.addresses).find((a) => /^0x[0-9a-f]{40}$/.test(a))!
    const html = buyer(eip681Uri(r('baseSepolia', listed)))
    expect(html).toMatch(/appears on the public OFAC sanctions list/)
    expect(html).toContain('Open in my wallet') // warn only: nothing is removed
  })
})
