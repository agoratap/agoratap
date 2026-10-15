import { useEffect, useMemo, useState } from 'react'
import { QR_QUIET, qrMatrix } from './lib/qrMatrix'
import { ORDER_DONE, ORDER_FAILED, SEED_PAYOUT_LEGS, createFixedOrder, fetchPayoutCurrencies, fixedQuote, mergeLegs, orderStatus, orderStatusLabel, payoutAmountFor, searchLegs, usdPrice, type FixedQuote, type Leg, type PayoutLeg, type SwapOrder } from './lib/exolix'
import { FIAT_PAYOUTS, FIAT_PAYOUT_LABEL, euPayoutBlockReason, payoutAllowed } from './lib/anyAsset'

function Qr({ text }: { text: string }) {
  const m = useMemo(() => qrMatrix(text), [text])
  const n = m.size + QR_QUIET * 2
  const cells = []
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.dark(x, y)) cells.push(<rect key={`${x}:${y}`} x={x + QR_QUIET} y={y + QR_QUIET} width={1} height={1} />)
  return <svg className="swap-qr" role="img" aria-label="QR code of the deposit address" viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" width={200} height={200}><rect width={n} height={n} fill="#fff" />{cells}</svg>
}

/** Real non-custodial swap order through Exolix. Agora Pay never holds funds. */
export function RealSwap({ from, fromLabel, eurAmount }: { from: Leg; fromLabel: string; eurAmount: number }) {
  const [merchantInEu, setMerchantInEu] = useState(true)
  const [allLegs, setAllLegs] = useState<PayoutLeg[]>(SEED_PAYOUT_LEGS)
  const [query, setQuery] = useState('')
  const [payout, setPayout] = useState<PayoutLeg>(SEED_PAYOUT_LEGS[0])
  const [eur, setEur] = useState(String(eurAmount))
  const [address, setAddress] = useState('')
  const [quote, setQuote] = useState<{ receive: number; q: FixedQuote } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState<SwapOrder | null>(null)
  const eurNum = Number(eur)

  useEffect(() => { fetchPayoutCurrencies().then((l) => setAllLegs(mergeLegs(SEED_PAYOUT_LEGS, l))).catch(() => {}) }, [])
  const blocked = merchantInEu && !payoutAllowed(payout.coin, true)
  const shown = useMemo(() => searchLegs(allLegs, query).slice(0, 60), [allLegs, query])
  const fiat = useMemo(() => FIAT_PAYOUTS.filter((p) => !query.trim() || p.symbol.toLowerCase().includes(query.trim().toLowerCase())), [query])

  useEffect(() => {
    let live = true
    setQuote(null); setError('')
    if (blocked || !(eurNum > 0)) return
    usdPrice(payout)
      .then((price) => { const receive = payoutAmountFor(eurNum, price); return fixedQuote(from, payout, receive).then((q) => ({ receive, q })) })
      .then((r) => { if (live) setQuote(r) })
      .catch((e) => { if (live) setError(`No live route for ${fromLabel} → ${payout.label}: ${e.message}`) })
    return () => { live = false }
  }, [from.coin, from.network, payout.id, eurNum, blocked])

  useEffect(() => {
    if (!order || ORDER_DONE.includes(order.status) || ORDER_FAILED.includes(order.status)) return
    const t = window.setInterval(() => { orderStatus(order.id).then(setOrder).catch(() => {}) }, 15000)
    return () => window.clearInterval(t)
  }, [order?.id, order?.status])

  const create = async () => {
    if (!quote) return
    setBusy(true); setError('')
    try { setOrder(await createFixedOrder(from, payout, quote.receive, address)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (order) return <div className="real-swap" data-testid="real-order">
    <span className="section-kicker">REAL SWAP ORDER · EXOLIX · NON-CUSTODIAL</span>
    <p>Send exactly <strong>{order.amount} {order.coinFrom}</strong>{order.networkFrom ? ` on ${order.networkFrom}` : ''} to:</p>
    <Qr text={order.depositAddress} />
    <code className="swap-address">{order.depositAddress}</code>
    {order.depositExtraId && <p>Memo / tag: <code>{order.depositExtraId}</code></p>}
    <p>Merchant receives <strong>{order.amountTo} {order.coinTo}</strong> at <code>{order.withdrawalAddress}</code></p>
    <p>Status: <strong>{orderStatusLabel(order.status)}</strong> · order {order.id} · checks every 15 s</p>
    <p className="fine-print">Real money if you send it. Agora Pay never holds funds or keys; Exolix runs the swap and pays the merchant address.</p>
  </div>

  return <div className="real-swap">
    <span className="section-kicker">PAY FOR REAL · LIVE SWAP</span>
    <label><input type="checkbox" checked={merchantInEu} onChange={(e) => setMerchantInEu(e.target.checked)} /> Merchant is in the EU (excludes only USDT and privacy coins)</label>
    <label>Amount (EUR)<input inputMode="decimal" aria-label="Real amount in EUR" value={eur} onChange={(e) => setEur(e.target.value.replace(/[^0-9.]/g, ''))} /></label>
    <label>Merchant receives — search any asset or chain<input type="search" aria-label="Search payout asset" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="BTC, USDC Solana, LTC, EUR…" /></label>
    <div className="asset-list payout-list" role="listbox" aria-label="Merchant payout">
      {shown.map((l) => {
        const no = merchantInEu && !payoutAllowed(l.coin, true)
        return <button key={l.id} role="option" aria-selected={l.id === payout.id} disabled={no} title={no ? euPayoutBlockReason(l.coin) : ''} className={l.id === payout.id ? 'selected' : ''} onClick={() => setPayout(l)}>
          <div><strong>{l.label}</strong><small>{no ? `EU: ${euPayoutBlockReason(l.coin)}` : l.name}</small></div><span className="radio-dot" />
        </button>
      })}
      {fiat.map((p) => <button key={p.id} disabled role="option" aria-selected={false}><div><strong>{p.symbol}</strong><small>{FIAT_PAYOUT_LABEL}</small></div></button>)}
    </div>
    <p>Payout: <strong data-testid="payout-picked">{payout.label}</strong>{blocked && ` — ${euPayoutBlockReason(payout.coin)}`}</p>
    {quote && <p data-testid="real-quote">Live fixed quote: send <strong>{quote.q.fromAmount} {from.coin}</strong> → merchant receives exactly <strong>{quote.receive} {payout.coin}</strong></p>}
    {quote?.q.belowMin && <p className="fine-print" role="alert">Below this route's minimum ({quote.q.minAmount} {from.coin} in, {quote.q.withdrawMin} {payout.coin} out). Raise the amount.</p>}
    {error && <p className="fine-print" role="alert">{error}</p>}
    <label>Merchant payout address<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`${payout.label} address`} /></label>
    <button className="secondary full" disabled={busy || !quote || quote.q.belowMin || blocked || !address.trim()} onClick={create}>{busy ? 'Creating order…' : 'Create real swap order'}</button>
  </div>
}
