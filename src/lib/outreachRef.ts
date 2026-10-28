// Outreach attribution without analytics: a `?ref=` tag on the demo link is
// carried into the merchant's "Request a readiness sprint" email subject,
// so Marketing Machine can tell which outreach message a reply came from.
// Nothing is stored or sent anywhere; the ref only lives in the URL.

const REF_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/

export const DEMO_URL = 'https://agoratap.github.io/agoratap/'
export const SPRINT_EMAIL = 'enccmail@proton.me'
export const SPRINT_SUBJECT = 'Agora Pay merchant readiness sprint'

export function outreachRefFromUrl(href: string): string | null {
  let url: URL
  try { url = new URL(href) } catch { return null }
  const raw = url.searchParams.get('ref') ?? url.searchParams.get('utm_campaign')
  if (!raw) return null
  const ref = raw.trim().toLowerCase()
  return REF_PATTERN.test(ref) ? ref : null
}

export function sprintMailto(ref: string | null): string {
  const subject = ref ? `${SPRINT_SUBJECT} [ref:${ref}]` : SPRINT_SUBJECT
  return `mailto:${SPRINT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export function trackedDemoLink(ref: string): string {
  const clean = ref.trim().toLowerCase()
  if (!REF_PATTERN.test(clean)) throw new Error(`invalid ref: ${ref}`)
  return `${DEMO_URL}?ref=${clean}`
}
