// Outreach link page (#outreach): Marketing Machine types a ref tag and gets
// the tracked demo link plus a QR of it, generated in the browser.
// No network request, no storage, no analytics. The tag only lives in the link.
import { trackedDemoLink } from './outreachRef'

export const OUTREACH_HASH = 'outreach'

/** Convention from docs/DISTRIBUTION.md: c1-btcmap-<id> for BTC Map merchants, c2-<community> for communities. */
export function readOutreachTag(input: string): { tag: string; link: string; error: string } {
  const tag = input.trim().toLowerCase()
  if (!tag) return { tag: '', link: '', error: '' }
  try {
    return { tag, link: trackedDemoLink(tag), error: '' }
  } catch {
    return { tag: '', link: '', error: 'Use 1–40 lowercase letters, digits or dashes, e.g. c1-btcmap-608 or c2-bitcoin-bucuresti' }
  }
}

export function isOutreachRoute(loc: { hash: string }): boolean {
  return loc.hash.replace(/^#/, '') === OUTREACH_HASH
}
