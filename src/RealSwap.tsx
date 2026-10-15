import { useEffect, useMemo, useState } from 'react'
import { QR_QUIET, qrMatrix } from './lib/qrMatrix'
import { ORDER_DONE, ORDER_FAILED, createOrder, liveRate, orderStatus, orderStatusLabel, payoutLegsFor, sendAmountFor, type Leg, type SwapOrder } from './lib/exolix'

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
  const legs = payoutLegsFor(merchantInEu)
  const [payoutId, setPayoutId] = useState('usdc-base')
  const payout = legs.find((l) => l.id === payoutId) ?? legs[0]
  const [address, setAddress] = useState('')
  const [rate, setRate] = useState<number | null>(null)
  const [min, setMin] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState<SwapOrder | null>(null)
  // USDC/USDT payout amount from EUR uses a reference 1 EUR ≈ 1.087 USD; BTC/ETH/XMR payouts priced via the live route.
  const payoutAmount = payout.coin === 'USDC' || payout.coin === 'USDT' ? Math.round(eurAmount * 1.087 * 100) / 100 : null

  useEffect(() => {
    let live = true
    setRate(null); setError('')
    liveRate(from, payout).then((r) => { if (live) { setRate(r.rate); setMin(r.minAmount) } }).catch((e) => { if (live) setError(`No live route for ${fromLabel} → ${payout.label}: ${e.message}`) })
    return () => { live = false }
  }, [from.coin, from.network, payout.coin, payout.network])

  useEffect(() => {
    if (!order || ORDER_DONE.includes(order.status) || ORDER_FAILED.includes(order.status)) return
    const t = window.setInterval(() => { orderStatus(order.id).then(setOrder).catch(() => {}) }, 15000)
    return () => window.clearInterval(t)
  }, [order?.id, order?.status])

  const send = rate && payoutAmount ? sendAmountFor(payoutAmount, rate) : null

  const belowMin = send != null && send < min

  const create = async () => {
    if (!send) return
    setBusy(true); setError('')
    try { setOrder(await createOrder(from, payout, send, address)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (order) return <div className="real-swap" data-testid="real-order">
    <span className="section-kicker">REAL SWAP ORDER · EXOLIX · NON-CUSTODIAL</span>
    <p>Send exactly <strong>{order.amount} {order.coinFrom}</strong>{order.networkFrom ? ` on ${order.networkFrom}` : ''} to:</p>
    <Qr text={order.depositAddress} />
    <code className="swap-address">{order.depositAddress}</code>
    {order.depositExtraId && <p>Memo / tag: <code>{order.depositExtraId}</code></p>}
    <p>Merchant receives ≈ <strong>{order.amountTo} {order.coinTo}</strong> at <code>{order.withdrawalAddress}</code></p>
    <p>Status: <strong>{orderStatusLabel(order.status)}</strong> · order {order.id} · checks every 15 s</p>
    <p className="fine-print">Real money if you send it. Agora Pay never holds funds or keys; Exolix runs the swap and pays the merchant address.</p>
  </div>

  return <div className="real-swap">
    <span className="section-kicker">PAY FOR REAL · LIVE SWAP</span>
    <label><input type="checkbox" checked={merchantInEu} onChange={(e) => setMerchantInEu(e.target.checked)} /> Merchant is in the EU (payout never USDT or XMR)</label>
    <label>Merchant payout<select value={payout.id} onChange={(e) => setPayoutId(e.target.value)}>{legs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
    <label>Merchant payout address<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`${payout.label} address`} /></label>
    {rate != null && <p>Live rate: 1 {from.coin} ≈ {rate} {payout.coin}{send ? <> · you send ≈ <strong>{send} {from.coin}</strong> for {payoutAmount} {payout.coin}</> : ' · BTC/ETH payout: the order uses the live float amount'}</p>}
    {!payoutAmount && <p className="fine-print">For a BTC or ETH payout, pick USDC to fix the merchant amount; crypto payouts float.</p>}
    {belowMin && <p className="fine-print" role="alert">Below this route's minimum of {min} {from.coin}. The swap partner will not accept an order this small; pick another asset or a larger amount.</p>}
    {error && <p className="fine-print" role="alert">{error}</p>}
    <button className="secondary full" disabled={busy || !send || belowMin || !address.trim()} onClick={create}>{busy ? 'Creating order…' : 'Create real swap order'}</button>
  </div>
}
