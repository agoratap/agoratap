import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import { OutreachLink } from './OutreachLink'
import { batchCsv, batchCsvHref, isOutreachRoute, readOutreachBatch, readOutreachTag } from './lib/outreachLinkPage'
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

  it('batch: dedupes, keeps order, reports invalid tags', () => {
    const b = readOutreachBatch('c1-btcmap-608\nC1-BTCMAP-608, c2-bitcoin-bucuresti\nbad!tag\n\n')
    expect(b.rows.map((r) => r.tag)).toEqual(['c1-btcmap-608', 'c2-bitcoin-bucuresti'])
    expect(b.invalid).toEqual(['bad!tag'])
    expect(readOutreachBatch(Array.from({ length: 250 }, (_, i) => `c1-btcmap-${i}`).join('\n')).rows).toHaveLength(200)
  })

  it('batch CSV round-trips: each link carries its ref into the sprint subject', () => {
    const { rows } = readOutreachBatch('c1-btcmap-608 c2-bitcoin-bucuresti')
    const lines = batchCsv(rows).trim().split('\r\n')
    expect(lines[0]).toBe('tag,link,sprint_subject')
    expect(lines).toHaveLength(3)
    for (const [i, r] of rows.entries()) {
      const [, link, subject] = lines[i + 1].split(',').map((c) => c.slice(1, -1))
      expect(link).toBe(r.link)
      expect(outreachRefFromUrl(link)).toBe(r.tag)
      expect(decodeURIComponent(sprintMailto(outreachRefFromUrl(link)).split('subject=')[1])).toBe(subject)
    }
    expect(batchCsvHref(rows).startsWith('data:text/csv')).toBe(true)
  })

  it('batch render: one QR sheet per tag with locked copy, plus CSV download', () => {
    const html = renderToStaticMarkup(createElement(OutreachLink, { initialBatch: 'c1-btcmap-608\nc2-bitcoin-bucuresti', onBack: () => {} }))
    expect((html.match(/<svg/g) ?? []).length).toBe(2)
    expect((html.match(/Network fee: simulated/g) ?? []).length).toBe(2)
    expect((html.match(/Subject to local law and sanctions/g) ?? []).length).toBe(2)
    expect(html).not.toContain('Enter a tag. The QR is the tagged demo link.')
    expect(html).not.toContain('aria-label="Tagged demo link"')
    expect(html).toContain('aria-label="Tagged demo link c1-btcmap-608"')
    expect(html).toContain('download="agora-outreach-links.csv"')
    expect(html).toContain('?ref=c2-bitcoin-bucuresti')
  })
  it('batch: hides the empty single-tag placeholder on screen when batch QRs exist; single and empty modes still show', () => {
    const batchHtml = renderToStaticMarkup(createElement(OutreachLink, { initialBatch: 'c2-a\nc2-b', onBack: () => {} }))
    expect(batchHtml).not.toContain('Enter a tag. The QR is the tagged demo link.')
    expect(batchHtml).not.toContain('aria-label="Tagged demo link"')
    expect(batchHtml).toContain('aria-label="Tagged demo link c2-a"')
    expect(batchHtml).toContain('aria-label="Tagged demo link c2-b"')
    expect((batchHtml.match(/<svg/g) ?? []).length).toBe(2)
    const singleHtml = renderToStaticMarkup(createElement(OutreachLink, { initialTag: 'c2-a', initialBatch: 'c2-b', onBack: () => {} }))
    expect(singleHtml).toContain('aria-label="Tagged demo link"')
    expect(singleHtml).not.toContain('no-print')
    expect(singleHtml).toContain('?ref=c2-a')
    const emptyHtml = renderToStaticMarkup(createElement(OutreachLink, { onBack: () => {} }))
    expect(emptyHtml).toContain('Enter a tag. The QR is the tagged demo link.')
    expect(emptyHtml).toContain('Network fee: simulated')
    expect(emptyHtml).toContain('Subject to local law and sanctions')
    expect(emptyHtml).not.toContain('<svg')
  })
})
