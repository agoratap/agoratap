import { describe, expect, it } from 'vitest'
import { outreachRefFromUrl, sprintMailto, trackedDemoLink } from './outreachRef'

describe('outreach ref', () => {
  it('reads a clean ref from the demo link', () => {
    expect(outreachRefFromUrl('https://agoratap.github.io/agoratap/?ref=c1-btcmap-608')).toBe('c1-btcmap-608')
    expect(outreachRefFromUrl('https://agoratap.github.io/agoratap/?utm_campaign=C1-BTCMAP#stall')).toBe('c1-btcmap')
  })
  it('rejects missing or unsafe refs', () => {
    expect(outreachRefFromUrl('https://agoratap.github.io/agoratap/')).toBeNull()
    expect(outreachRefFromUrl('https://x.test/?ref=<script>')).toBeNull()
    expect(outreachRefFromUrl('https://x.test/?ref=' + 'a'.repeat(41))).toBeNull()
    expect(outreachRefFromUrl('not a url')).toBeNull()
  })
  it('puts the ref into the sprint email subject only when present', () => {
    expect(sprintMailto(null)).toBe('mailto:enccmail@proton.me?subject=Agora%20Pay%20merchant%20readiness%20sprint')
    expect(decodeURIComponent(sprintMailto('c1-btcmap-608'))).toContain('[ref:c1-btcmap-608]')
  })
  it('builds tracked demo links and refuses bad refs', () => {
    expect(trackedDemoLink('C1-BTCMAP-608')).toBe('https://agoratap.github.io/agoratap/?ref=c1-btcmap-608')
    expect(() => trackedDemoLink('a b')).toThrow()
  })
})
