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

export type BatchRow = { tag: string; link: string; error: string }

/** Batch mode: one tag per line (or comma/space separated). Dedupes, keeps order, reports bad tags. Max 200. */
export function readOutreachBatch(input: string): { rows: BatchRow[]; invalid: string[] } {
  const seen = new Set<string>()
  const rows: BatchRow[] = []
  const invalid: string[] = []
  for (const raw of input.split(/[\s,;]+/)) {
    if (!raw) continue
    const r = readOutreachTag(raw)
    if (r.error) { invalid.push(raw); continue }
    if (seen.has(r.tag)) continue
    seen.add(r.tag)
    if (rows.length < 200) rows.push(r)
  }
  return { rows, invalid }
}

/** CSV for Marketing Machine: tag,link,mailto_subject. Values are a-z0-9- and URL chars only, quoted anyway. */
export function batchCsv(rows: BatchRow[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = ['tag,link,sprint_subject']
  for (const r of rows) lines.push([r.tag, r.link, `Agora Pay merchant readiness sprint [ref:${r.tag}]`].map(q).join(','))
  return lines.join('\r\n') + '\r\n'
}

export function batchCsvHref(rows: BatchRow[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(batchCsv(rows))}`
}
