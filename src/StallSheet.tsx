import { useMemo, useState, type ReactElement } from 'react'
import { QR_QUIET, qrMatrix, type QrMatrix } from './lib/qrMatrix'
import {
  STALL_ASSET_LINE,
  STALL_BASE_LINE,
  STALL_INSTRUCTION_EN,
  STALL_INSTRUCTION_RO,
  STALL_PILOT_LINE,
  STALL_ROUTE_LINE,
  normalizeMerchantName,
  stallPayLink,
} from './lib/stallSheet'

function QrSvg({ matrix }: { matrix: QrMatrix }) {
  const n = matrix.size + QR_QUIET * 2
  const cells: ReactElement[] = []
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.dark(x, y)) continue
      cells.push(<rect key={`${x}:${y}`} x={x + QR_QUIET} y={y + QR_QUIET} width={1} height={1} />)
    }
  }
  return (
    <svg className="stall-qr" role="img" aria-label="QR code of the merchant pay-link" viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges">
      <rect className="stall-qr-ground" width={n} height={n} fill="#ffffff" />
      <g fill="#000000">{cells}</g>
    </svg>
  )
}

function SheetCopy({ name, qr }: { name: string; qr?: ReactElement }) {
  return <>
    <p className="stall-kicker">AGORA PAY</p>
    <h1>{name}</h1>
    {qr}
    <p className="stall-instruction" lang="ro">{STALL_INSTRUCTION_RO}</p>
    <p className="stall-instruction" lang="en">{STALL_INSTRUCTION_EN}</p>
    <p className="stall-route">{STALL_ROUTE_LINE}</p>
    <p className="stall-assets">{STALL_ASSET_LINE}</p>
    <p className="stall-base">{STALL_BASE_LINE}</p>
    <p className="stall-pilot">{STALL_PILOT_LINE}</p>
  </>
}

function readStall(name: string, pageHref: string): { merchantName: string; payLink: string; matrix: QrMatrix | null; error: string } {
  if (!name.trim()) return { merchantName: '', payLink: '', matrix: null, error: '' }
  try {
    const merchantName = normalizeMerchantName(name)
    const payLink = stallPayLink(merchantName, pageHref)
    return { merchantName, payLink, matrix: qrMatrix(payLink), error: '' }
  } catch (reason) {
    return { merchantName: '', payLink: '', matrix: null, error: reason instanceof Error ? reason.message : 'Enter a merchant name' }
  }
}

export function StallSheet({ pageHref, initialName = '', onBack }: { pageHref: string; initialName?: string; onBack: () => void }) {
  const [name, setName] = useState(initialName)
  const parsed = useMemo(() => readStall(name, pageHref), [name, pageHref])
  const ready = parsed.matrix !== null
  return <div className="stall-page">
    <div className="stall-controls">
      <button type="button" className="text-link" onClick={onBack}>Back to the merchant screen</button>
      <p className="section-kicker">MARKET STALL</p>
      <h2>Print one sheet. Nothing to install.</h2>
      <p>A street or market merchant prints this page and keeps it at the stall. The buyer scans the QR and pays with crypto they hold. The merchant receives on the payout rail they prefer. any-in → any-out. Base is an optional rail only.</p>
      <form onSubmit={(event) => { event.preventDefault(); if (ready) window.print() }}>
        <label htmlFor="stall-merchant-name">Merchant name</label>
        <input id="stall-merchant-name" aria-label="Merchant name" value={name} maxLength={80} autoComplete="off" onChange={(event) => setName(event.target.value)} />
        {parsed.error && <p className="stall-error" role="alert">{parsed.error}</p>}
        <button type="submit" className="primary" disabled={!ready}>Print this sheet</button>
      </form>
    </div>
    <article className="stall-sheet" aria-label="Printable market stall sheet">
      <SheetCopy name={parsed.merchantName} qr={parsed.matrix ? <QrSvg matrix={parsed.matrix} /> : <p className="stall-placeholder">Enter the merchant name. The QR is that merchant’s pay-link.</p>} />
      {parsed.payLink && <p className="stall-link">{parsed.payLink}</p>}
    </article>
  </div>
}

export function StallPay({ merchantName, onBack }: { merchantName: string; onBack: () => void }) {
  let name = ''
  let problem = ''
  try {
    name = normalizeMerchantName(merchantName)
  } catch (reason) {
    problem = reason instanceof Error ? reason.message : 'Pay-link has no merchant name'
  }
  return <div className="stall-page">
    <div className="stall-controls">
      <button type="button" className="text-link" onClick={onBack}>Back</button>
    </div>
    <article className="stall-sheet" aria-label="Merchant pay-link">
      {problem ? <p className="stall-error" role="alert">{problem}</p> : <SheetCopy name={name} />}
    </article>
  </div>
}
