import { useEffect, useMemo, useState } from 'react'
import { QR_QUIET, qrMatrix } from './lib/qrMatrix'
import { ORDER_DONE, ORDER_FAILED, SEED_PAYOUT_LEGS, createFixedOrder, fetchPayoutCurrencies, mergeLegs, orderStatus, orderStatusLabel, payoutAmountFor, searchLegs, usdPrice, type Leg, type PayoutLeg, type SwapOrder } from './lib/exolix'
import { buildBtcMemoTx, buildEvmDeposit, isEvm, sendBtcUnisat, sendEvm, transferUri } from './lib/walletPay'
import { nativeQuote, quoteAllRoutes, type RouteQuote } from './lib/routes'
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
  const [routes, setRoutes] = useState<{ receive: number; fromUsd: number; list: RouteQuote[] } | null>(null)
  const [routeId, setRouteId] = useState<string>('')
  const [native, setNative] = useState<RouteQuote | null>(null)
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
    setRoutes(null); setError(''); setNative(null)
    if (blocked || !(eurNum > 0)) return
    Promise.all([usdPrice(from), usdPrice(payout)])
      .then(async ([fromUsd, toUsd]) => { const receive = payoutAmountFor(eurNum, toUsd); return { receive, fromUsd, list: await quoteAllRoutes({ from, to: payout, receive, fromUsd, toUsd }) } })
      .then((r) => { if (live) { setRoutes(r); setRouteId(r.list.find((q) => q.ok)?.route ?? '') } })
      .catch((e) => { if (live) setError(`No live route for ${fromLabel} → ${payout.label}: ${e.message}`) })
    return () => { live = false }
  }, [from.coin, from.network, payout.id, eurNum, blocked])

  useEffect(() => {
    if (!order || ORDER_DONE.includes(order.status) || ORDER_FAILED.includes(order.status)) return
    const t = window.setInterval(() => { orderStatus(order.id).then(setOrder).catch(() => {}) }, 15000)
    return () => window.clearInterval(t)
  }, [order?.id, order?.status])

  const chosen = routes?.list.find((q) => q.route === routeId && q.ok) ?? null
  const create = async () => {
    if (!routes || !chosen) return
    setBusy(true); setError('')
    try {
      if (chosen.route === 'exolix') setOrder(await createFixedOrder(from, payout, routes.receive, address))
      else if (chosen.route === 'direct') setNative({ ...chosen, depositAddress: address.trim() })
      else {
        const q = await nativeQuote(chosen.route, from, payout, chosen.sendAmount, routes.fromUsd, address.trim())
        if (!q || !q.ok || !q.depositAddress || !q.memo) throw new Error(q?.note ?? 'No route')
        setNative(q)
      }
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (native) return <NativePay native={native} from={from} payout={payout} address={address} />

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
    {routes && <div className="route-list" data-testid="real-quote" role="radiogroup" aria-label="Swap route">{routes.list.map((q) =>
      <label key={q.route} className={q.ok ? '' : 'route-off'}><input type="radio" name="route" disabled={!q.ok} checked={routeId === q.route} onChange={() => setRouteId(q.route)} />
        <span><strong>{q.label}</strong>{q.ok ? <> · send {q.sendAmount} {from.coin} → merchant {q.route === 'thor' || q.route === 'maya' ? '≈' : 'exactly'} {q.route === 'thor' || q.route === 'maya' ? q.receiveAmount.toFixed(6) : q.receiveAmount} {payout.coin}</> : <> · {q.note}</>}<small> · min {Number.isFinite(q.minUsd) ? `≈ $${q.minUsd.toFixed(2)}` : 'n/a'}</small></span></label>)}
      {routes.list.length === 0 && <p className="fine-print">No route for this pair.</p>}
    </div>}
    {routes && !routes.list.some((q) => q.ok) && <p className="fine-print" role="alert">No route accepts this amount. Raise the amount or pick another payout (e.g. USDC on Base or Arbitrum).</p>}
    {error && <p className="fine-print" role="alert">{error}</p>}
    <label>Merchant payout address<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`${payout.label} address`} /></label>
    <button className="secondary full" disabled={busy || !chosen || blocked || !address.trim()} onClick={create}>{busy ? 'Creating order…' : chosen?.route === 'direct' ? 'Show payment details' : 'Create real swap order'}</button>
  </div>
}

function NativePay({ native, from, payout, address }: { native: RouteQuote; from: Leg; payout: PayoutLeg; address: string }) {
  const [status, setStatus] = useState('')
  const direct = native.route === 'direct'
  const uri = direct ? transferUri(from, native.depositAddress!, native.sendAmount) : null
  let evm: ReturnType<typeof buildEvmDeposit> | null = null, btc: ReturnType<typeof buildBtcMemoTx> | null = null, buildError = ''
  if (!direct) {
    try {
      if (isEvm(from)) evm = buildEvmDeposit(from, native)
      else if (from.coin === 'BTC' && from.network === 'BTC') btc = buildBtcMemoTx(native)
    } catch (e) { buildError = (e as Error).message }
  }
  const run = async (fn: () => Promise<unknown>) => { setStatus('Waiting for your wallet…'); try { setStatus(`Sent: ${JSON.stringify(await fn())}`) } catch (e) { setStatus((e as Error).message) } }
  return <div className="real-swap" data-testid="real-order">
    <span className="section-kicker">{direct ? 'DIRECT TRANSFER · NO SWAP' : `${native.label.toUpperCase()} NATIVE SWAP · NON-CUSTODIAL`}</span>
    <p>Pay <strong>{native.sendAmount} {from.coin}</strong> on {from.network}. Merchant receives {direct ? 'exactly' : '≈'} <strong>{direct ? native.receiveAmount : native.receiveAmount.toFixed(6)} {payout.coin}</strong> at <code>{address}</code></p>
    {direct && uri && <><Qr text={uri} /><code className="swap-address" data-testid="pay-uri">{uri}</code><p className="fine-print">Scan with any wallet: amount and recipient are filled in for you.</p></>}
    {direct && !uri && <><Qr text={native.depositAddress!} /><code className="swap-address">{native.depositAddress}</code></>}
    {evm && <div data-testid="evm-tx">
      <button className="primary full" onClick={() => run(() => sendEvm(evm!))}>Pay with browser wallet (memo included)</button>
      <p className="fine-print">One tap in MetaMask, Rabby, Coinbase Wallet or another injected wallet. {evm.length === 2 ? 'Two approvals: allow the token, then deposit.' : 'One approval.'} The memo is inside the transaction; you type nothing.</p>
      <details><summary>Transaction preview</summary>{evm.map((t, i) => <pre key={i} className="swap-address">{`${t.label}\nchain ${t.chainId} · to ${t.to} · value ${t.value}\ndata ${t.data}`}</pre>)}</details>
    </div>}
    {btc && <div data-testid="btc-tx">
      <button className="primary full" onClick={() => run(() => sendBtcUnisat(btc!))}>Pay with UniSat (memo included)</button>
      <p className="fine-print">UniSat writes the memo as OP_RETURN for you. Plain QR codes (BIP21) cannot carry it, so no QR is shown for this route.</p>
      <details><summary>Transaction preview</summary><pre className="swap-address">{`to ${btc.to}\nsats ${btc.sats}\nOP_RETURN ${btc.memo}`}</pre></details>
    </div>}
    {!direct && !evm && !btc && <p className="fine-print" role="alert">{buildError || `No one-tap wallet for ${from.coin} on ${from.network} yet. Use a wallet that supports memos, or pick another route.`} Memo: <code className="swap-address">{native.memo}</code> to <code className="swap-address">{native.depositAddress}</code></p>}
    {native.expiry && <p className="fine-print">Quote expires {new Date(native.expiry * 1000).toLocaleTimeString()}. Do not send after expiry.</p>}
    {status && <p className="fine-print" role="status">{status}</p>}
    <p className="fine-print">{native.note} Agora Pay never holds funds or keys.</p>
  </div>
}
