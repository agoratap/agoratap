import { useMemo, useState } from 'react'
import { qrMatrix } from './lib/qrMatrix'
import { readOutreachTag } from './lib/outreachLinkPage'
import { QrSvg } from './StallSheet'

export function OutreachLink({ initialTag = '', onBack }: { initialTag?: string; onBack: () => void }) {
  const [tag, setTag] = useState(initialTag)
  const parsed = useMemo(() => readOutreachTag(tag), [tag])
  const matrix = useMemo(() => (parsed.link ? qrMatrix(parsed.link) : null), [parsed.link])
  return <div className="stall-page">
    <div className="stall-controls">
      <button type="button" className="text-link" onClick={onBack}>Back</button>
      <p className="section-kicker">OUTREACH LINK</p>
      <h2>One tagged demo link per message.</h2>
      <p>Type the outreach tag. Use c1-btcmap-&lt;id&gt; for a BTC Map merchant or c2-&lt;community&gt; for a community post. If the merchant requests a readiness sprint from this link, the email subject carries [ref:&lt;tag&gt;]. The QR is made in this browser. Nothing is stored or sent anywhere.</p>
      <label htmlFor="outreach-tag">Outreach tag</label>
      <input id="outreach-tag" aria-label="Outreach tag" value={tag} maxLength={40} autoComplete="off" onChange={(event) => setTag(event.target.value)} />
      {parsed.error && <p className="stall-error" role="alert">{parsed.error}</p>}
      {parsed.link && <button type="button" className="primary" onClick={() => window.print()}>Print link and QR</button>}
    </div>
    <article className="stall-sheet" aria-label="Tagged demo link">
      <p className="stall-kicker">AGORA PAY</p>
      {matrix ? <QrSvg matrix={matrix} /> : <p className="stall-placeholder">Enter a tag. The QR is the tagged demo link.</p>}
      {parsed.link && <p className="stall-link">{parsed.link}</p>}
      <p className="stall-pilot">Early pilot — no live funds. Network fee: simulated. Subject to local law and sanctions.</p>
    </article>
  </div>
}
