import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import { OutreachLink } from './OutreachLink'
import { isOutreachRoute, readOutreachTag } from './lib/outreachLinkPage'
import { outreachRefFromUrl, sprintMailto } from './lib/outreachRef'
import { QR_QUIET, qrMatrix } from './lib/qrMatrix'

const sources = import.meta.glob(['./OutreachLink.tsx', './lib/outreachLinkPage.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('outreach link page', () => {
  it('turns a BTC Map tag into the tracked demo link whose sprint subject carries the ref', () => {
    const r = readOutreachTag('  C1-BTCMAP-608 ')
    expect(r).toEqual({ tag: 'c1-btcmap-608', link: 'https://agoratap.github.io/agoratap/?ref=c1-btcmap-608', error: '' })
    const subject = decodeURIComponent(sprintMailto(outreachRefFromUrl(r.link)).split('subject=')[1])
    expect(subject).toContain('[ref:c1-btcmap-608]')
  })

  it('rejects bad tags and is empty for blank input', () => {
    expect(readOutreachTag('').link).toBe('')
    expect(readOutreachTag('bad tag!').error).not.toBe('')
    expect(readOutreachTag('x'.repeat(41)).link).toBe('')
  })

  it('renders the link and a QR that encodes exactly that link', () => {
    const html = renderToStaticMarkup(createElement(OutreachLink, { initialTag: 'c2-bitcoin-bucuresti', onBack: () => {} }))
    const link = 'https://agoratap.github.io/agoratap/?ref=c2-bitcoin-bucuresti'
    expect(html).toContain(link)
    expect(html).toContain('<svg')
    const m = qrMatrix(link)
    const ref = QRCode.create(link, { errorCorrectionLevel: 'Q' })
    const darkRects = (html.match(/<rect x=/g) ?? []).length
    let dark = 0
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.dark(x, y)) dark++
    expect(darkRects).toBe(dark)
    expect(m.size).toBe(ref.modules.size)
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) expect(m.dark(x, y)).toBe(ref.modules.get(y, x) === 1)
    expect(QR_QUIET).toBeGreaterThan(0)
  })

  it('keeps the locked copy and makes no network calls', () => {
    const html = renderToStaticMarkup(createElement(OutreachLink, { onBack: () => {} }))
    expect(html).toContain('Network fee: simulated')
    expect(html).toContain('Subject to local law and sanctions')
    for (const src of Object.values(sources)) expect(src).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|localStorage|WebSocket/)
  })

  it('routes only on #outreach', () => {
    expect(isOutreachRoute({ hash: '#outreach' })).toBe(true)
    expect(isOutreachRoute({ hash: '#stall' })).toBe(false)
  })
})
