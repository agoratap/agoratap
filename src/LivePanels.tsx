import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { AlertTriangle, Radio } from 'lucide-react'
import { createChainReader, PUBLIC_RPC, type ChainReader } from './lib/chainReader'
import { browserFetch } from './lib/liveFetch'
import { bindLiveClaim, describeState, HISTORY_LOOKBACK_BLOCKS, openLiveRequest, refreshLive, type LiveRequest } from './lib/liveSession'
import { type PaymentState } from './lib/confirmation'
import { parseRequestLink, walletTransferUri, type ParsedRequestLink } from './lib/requestLink'
import { formatUsdc, isAddress, type OpenRequest } from './lib/chainRequest'
import { secureRandom, type Random } from './lib/tagging'
import { screenAddress } from './lib/screening'
import { windowFrom } from './lib/confirmation'
import { type TxClaim } from './lib/reference'
import {
  DEVICE_BACKUP_NOTE,
  MAX_SAVED_SALES,
  beginDeviceMerchantSessionClear,
  buildMerchantSession,
  liveFromStored,
  loadDeviceMerchantSession,
  merchantSessionToJson,
  parseMerchantSession,
  saveDeviceMerchantSession,
  type MerchantSessionFile,
  type MerchantSessionStore,
} from './lib/merchantSession'
import { MISSED_PAYMENT_GUIDE, checkMissedPayment, type MissedPaymentReport } from './lib/missedPayment'

const CHAIN = 'baseSepolia' as const
export const POLL_MS = 6000
// Sepolia's public endpoint (2026-10-06) rejects eth_getLogs when toBlock - fromBlock is over 500.
// maxRange 501 asks for a 500-block span. A 24 h history is about 87 calls; 120 leaves room for a few retries.
const defaultReader = (): ChainReader => createChainReader({ fetchFn: browserFetch, rpcUrl: PUBLIC_RPC[CHAIN], maxRange: 501, maxCalls: 120 })

const TESTNET_NOTE = 'Base Sepolia test network only. Test tokens have no value. Read-only: this page never signs, sends or holds anything. Reads go to the public endpoint sepolia.base.org, which sees your IP address.'

function usePolling(run: () => Promise<void>, active: boolean) {
  const busy = useRef(false)
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    if (!active) return
    const tick = async () => { if (busy.current) return; busy.current = true; try { await runRef.current() } finally { busy.current = false } }
    void tick()
    const id = window.setInterval(tick, POLL_MS)
    return () => window.clearInterval(id)
  }, [active])
}

function StateLine({ state, error }: { state: PaymentState | null; error: string }) {
  const bad = state?.status === 'ambiguous' || state?.status === 'reorged' || state?.status === 'unknown' || !!error
  return <div className={bad ? 'address-check-result address-check-warn' : 'address-check-result'} role={bad ? 'alert' : 'status'}>
    {bad ? <AlertTriangle size={18} /> : <Radio size={18} />}
    <p>{error || (state ? describeState(state) : 'Not checked yet.')}</p>
  </div>
}

function requestFromParsed(parsed: ParsedRequestLink): OpenRequest {
  return {
    orderId: parsed.reference ?? 'buyer-watch',
    chain: parsed.chain,
    token: parsed.token,
    merchant: parsed.merchant,
    atomic: parsed.atomic,
    baseAtomic: parsed.atomic,
    tag: 0,
    reference: parsed.reference,
  }
}

function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function claimsOf(sales: readonly LiveRequest[]): TxClaim[] {
  const claims: TxClaim[] = []
  for (const sale of sales) {
    if (sale.request.reference && sale.claimedTxHash) claims.push({ reference: sale.request.reference, txHash: sale.claimedTxHash })
  }
  return claims
}

/** Merchant side: create a referenced EURC request on Base Sepolia and watch the chain for its transaction. */
export function MerchantLive({ reader, random = secureRandom, store }: { reader?: ChainReader; random?: Random; store?: MerchantSessionStore }) {
  const rd = useMemo(() => reader ?? defaultReader(), [reader])
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('1.00')
  const [txHash, setTxHash] = useState('')
  const [saleLink, setSaleLink] = useState('')
  const [missedHash, setMissedHash] = useState('')
  const [live, setLive] = useState<LiveRequest | null>(null)
  const [sales, setSales] = useState<LiveRequest[]>([])
  const [state, setState] = useState<PaymentState | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [desk, setDesk] = useState<MissedPaymentReport | null>(null)
  const screen = screenAddress(merchant)
  const prev = useRef<PaymentState | undefined>(undefined)
  const dirty = useRef(false)

  const showSales = (restored: LiveRequest[], nextNotice?: string) => {
    setSales(restored)
    const last = restored[restored.length - 1] ?? null
    setLive(last)
    setState(null)
    prev.current = undefined
    if (last) {
      setMerchant(last.request.merchant)
      setAmount(formatUsdc(last.request.baseAtomic))
      setSaleLink(last.uri)
    }
    if (nextNotice) setNotice(nextNotice)
  }

  const persist = async (next: LiveRequest[]) => {
    const file = buildMerchantSession(next, new Date().toISOString())
    if (store) await store.save(file)
    else await saveDeviceMerchantSession(file)
  }

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const file = store ? await store.load() : await loadDeviceMerchantSession()
        if (cancel || !file || dirty.current) return
        showSales(file.sales.map(liveFromStored), 'Restored the sale saved on this device. Keys were never in that record.')
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : 'Could not read the sale saved on this device')
      }
    })()
    return () => { cancel = true }
  }, [store])

  const create = async () => {
    dirty.current = true
    setError(''); setNotice(''); setState(null); prev.current = undefined; setTxHash(''); setBusy(''); setDesk(null)
    try {
      if (!isAddress(merchant)) throw new Error('Enter your receiving address (0x…)')
      setBusy('Reading recent transfers on Base Sepolia…')
      const made = await openLiveRequest(rd, { orderId: 'live-' + Date.now(), chain: CHAIN, merchant, eurAmount: Number(amount), ttlSeconds: 3600 }, sales.map((sale) => sale.request), random)
      const next = [...sales, made].slice(-MAX_SAVED_SALES)
      setSales(next)
      setLive(made)
      setSaleLink(made.uri)
      setBusy('')
      try { await persist(next) } catch (e) { setNotice(e instanceof Error ? `${e.message} Export a backup file before you leave this page.` : 'Could not save the sale on this device. Export a backup file before you leave this page.') }
    } catch (e) { setBusy(''); setError(e instanceof Error ? e.message : 'Could not create the request') }
  }
  const matchTx = async () => {
    if (!live) return
    dirty.current = true
    setError(''); setNotice(''); setDesk(null)
    try {
      const nextLive = bindLiveClaim(live, txHash, claimsOf(sales))
      const reference = nextLive.request.reference
      if (!reference || !nextLive.claimedTxHash) throw new Error('This request has no payment reference')
      const next = sales.map((sale) => sale.request.reference?.toLowerCase() === reference.toLowerCase() ? nextLive : sale)
      prev.current = undefined
      setSales(next)
      setLive(nextLive)
      const seen = await refreshLive(rd, nextLive)
      prev.current = seen
      setState(seen)
      try { await persist(next) } catch (e) { setNotice(e instanceof Error ? `${e.message} Export a backup file before you leave this page.` : 'Could not save the sale on this device. Export a backup file before you leave this page.') }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not match that transaction') }
  }
  const exportBackup = () => {
    try {
      if (sales.length === 0) throw new Error('Create a live test request before exporting a backup.')
      const file = buildMerchantSession(sales, new Date().toISOString())
      downloadJson(merchantSessionToJson(file), 'agora-pay-merchant-session.json')
      setError('')
      setNotice('Backup file downloaded. It has no wallet key. Keys stay in your wallet.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not export the backup') }
  }
  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    dirty.current = true
    setError(''); setDesk(null)
    try {
      const parsed: MerchantSessionFile = parseMerchantSession(await file.text())
      if (store) await store.save(parsed)
      else await saveDeviceMerchantSession(parsed)
      showSales(parsed.sales.map(liveFromStored), 'Imported the sale backup. Keys were not in that file.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not import that backup') }
  }
  const forget = async () => {
    dirty.current = true
    setError(''); setDesk(null)
    try {
      if (store) await store.clear()
      else beginDeviceMerchantSessionClear()
      setSales([])
      setLive(null)
      setState(null)
      prev.current = undefined
      setNotice('Saved sales were removed from this device. A file you already downloaded is still on disk. Keys were never in this app.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove the saved sales') }
  }
  const runDesk = async () => {
    setError(''); setDesk(null)
    try {
      const report = await checkMissedPayment(rd, { saleLink, txHash: missedHash, sales })
      setDesk(report)
      if (report.outcome === 'checked') {
        dirty.current = true
        setSales(report.sales)
        if (live?.request.reference?.toLowerCase() === report.reference) {
          const updated = report.sales.find((sale) => sale.request.reference?.toLowerCase() === report.reference) ?? null
          setLive(updated)
          prev.current = report.state
          setState(report.state)
        }
        try { await persist(report.sales) } catch (e) { setNotice(e instanceof Error ? `${e.message} Export a backup file before you leave this page.` : 'Could not save the sale on this device. Export a backup file before you leave this page.') }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not check that transaction') }
  }
  usePolling(async () => {
    if (!live) return
    try { const next = await refreshLive(rd, live, prev.current); prev.current = next; setState(next); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Chain read failed') }
  }, live !== null && state?.status !== 'confirmed')

  const deskBad = desk !== null && (desk.outcome !== 'checked' || desk.state.status === 'ambiguous' || desk.state.status === 'reorged' || desk.state.status === 'unknown' || (desk.state.status === 'unpaid' && desk.state.claimMissed))

  return <section className="address-check" aria-label="Live testnet request">
    <label className="amount-entry"><span>LIVE TEST (BASE SEPOLIA, READ-ONLY) · YOUR RECEIVING ADDRESS</span>
      <input value={merchant} onChange={(e) => setMerchant(e.target.value.trim())} placeholder="0x…" spellCheck={false} autoComplete="off" aria-label="Receiving address" /></label>
    {(screen.status === 'listed' || screen.status === 'list-not-loaded') && <div className="address-check-result address-check-warn" role="alert"><AlertTriangle size={18} /><p>{screen.message}</p></div>}
    <label className="amount-entry"><span>PRICE IN EURC (1 EURC = 1 EUR)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Live price in EURC" /></label>
    <button className="secondary full" onClick={create}>Create live test request</button>
    {live && <div className="request-details" aria-label="Live request">
      <div><span>Buyer must send exactly</span><strong>{formatUsdc(live.request.atomic)} EURC</strong></div>
      <div><span>To</span><strong style={{ wordBreak: 'break-all' }}>{live.request.merchant}</strong></div>
      <div><span>Payment reference</span><strong style={{ wordBreak: 'break-all', fontSize: 11 }}>{live.request.reference}</strong></div>
      <div><span>Share link (paste into the buyer screen)</span><strong style={{ wordBreak: 'break-all', fontSize: 11 }}>{live.uri}</strong></div>
      <div><span>Counts from block</span><strong>{live.window.fromBlock}{live.window.toBlock ? ` to ${live.window.toBlock}` : ''}</strong></div>
    </div>}
    {live && <label className="amount-entry"><span>TRANSACTION HASH (PRIMARY MATCH)</span>
      <input value={txHash} onChange={(e) => setTxHash(e.target.value.trim())} placeholder="0x… 64 hex characters" spellCheck={false} autoComplete="off" aria-label="Transaction hash" /></label>}
    {live && <button className="secondary full" onClick={matchTx}>Match this transaction</button>}
    {busy && <p role="status">{busy}</p>}
    {(live || error) && <StateLine state={state} error={error} />}
    <div className="session-tools">
      <p className="address-check-note">{DEVICE_BACKUP_NOTE}</p>
      <button type="button" className="secondary full" onClick={exportBackup}>Export sale backup</button>
      <label className="secondary full" htmlFor="merchant-session-import">Import sale backup</label>
      <input id="merchant-session-import" type="file" accept="application/json,.json" onChange={onImport} />
      <button type="button" className="secondary full" onClick={forget}>Remove saved sales on this device</button>
    </div>
    <details className="missed-payment">
      <summary>Missed payment?</summary>
      <ol>{MISSED_PAYMENT_GUIDE.map((line) => <li key={line}>{line}</li>)}</ol>
      <label className="compact-entry"><span>SALE LINK</span>
        <input value={saleLink} onChange={(e) => setSaleLink(e.target.value.trim())} placeholder="ethereum:0x…@84532/transfer?…#ref=0x…" spellCheck={false} autoComplete="off" aria-label="Sale link for missed payment" /></label>
      <label className="compact-entry"><span>TRANSACTION HASH</span>
        <input value={missedHash} onChange={(e) => setMissedHash(e.target.value.trim())} placeholder="0x… 64 hex characters" spellCheck={false} autoComplete="off" aria-label="Missed payment transaction hash" /></label>
      <button type="button" className="secondary full" onClick={runDesk}>Check this transaction</button>
      {desk && <div className={deskBad ? 'address-check-result address-check-warn' : 'address-check-result'} role={deskBad ? 'alert' : 'status'}><p>{desk.message}</p></div>}
    </details>
    {notice && <p role="status">{notice}</p>}
    <small className="address-check-note">{TESTNET_NOTE} Primary match is the transaction hash bound to the payment reference on the share link. The amount tag (0.000001–0.009999) is only a backup when no hash is given. Anyone can send that amount: a match shows an amount arrived, not who sent it.</small>
  </section>
}

export function buyerWatchWindow(head: number) {
  return windowFrom(Math.max(0, head - HISTORY_LOOKBACK_BLOCKS))
}

/** Buyer side: paste a payment link, see exactly what it asks, open it in your own wallet, and match the transaction hash. */
export function BuyerLive({ reader, initialText = '' }: { reader?: ChainReader; initialText?: string }) {
  const rd = useMemo(() => reader ?? defaultReader(), [reader])
  const [text, setText] = useState(initialText)
  const [txHash, setTxHash] = useState('')
  const [live, setLive] = useState<LiveRequest | null>(null)
  const [state, setState] = useState<PaymentState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [watching, setWatching] = useState(false)
  const prev = useRef<PaymentState | undefined>(undefined)

  let parsed: ReturnType<typeof parseRequestLink> | null = null
  let parseError = ''
  if (text) { try { parsed = parseRequestLink(text) } catch (e) { parseError = (e as Error).message } }
  const screen = parsed ? screenAddress(parsed.merchant) : null
  const testnetOnly = parsed !== null && parsed.chain !== CHAIN

  const start = async (hashText: string) => {
    if (!parsed || testnetOnly) return
    setError(''); setBusy(hashText.trim() ? '' : 'Reading recent transfers on Base Sepolia…')
    try {
      const request = requestFromParsed(parsed)
      const requestWindow = live !== null && live.request.reference === request.reference
        ? live.window
        : buyerWatchWindow((await rd.headBlock()).head)
      let next: LiveRequest = { request, window: requestWindow, uri: text.trim(), confirmations: 12 }
      if (hashText.trim()) {
        if (!request.reference) throw new Error('This link has no payment reference. Create the request again from the merchant screen.')
        next = bindLiveClaim(next, hashText)
      }
      prev.current = undefined
      setLive(next)
      setWatching(true)
      const nextState = await refreshLive(rd, next)
      prev.current = nextState
      setState(nextState)
      setBusy('')
    } catch (e) { setBusy(''); setError(e instanceof Error ? e.message : 'Could not read the chain') }
  }
  usePolling(async () => {
    if (!live) return
    try { const next = await refreshLive(rd, live, prev.current); prev.current = next; setState(next); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Chain read failed') }
  }, watching && state?.status !== 'confirmed')

  return <section className="address-check" aria-label="Live testnet payment link">
    <label className="amount-entry"><span>LIVE TEST (BASE SEPOLIA, READ-ONLY) · PASTE A PAYMENT LINK</span>
      <input value={text} onChange={(e) => { setText(e.target.value); setLive(null); setWatching(false); setState(null); setBusy('') }} placeholder="ethereum:0x…@84532/transfer?address=0x…&uint256=…#ref=0x…" spellCheck={false} autoComplete="off" aria-label="Payment link" /></label>
    {text && !parsed && <div className="address-check-result address-check-warn" role="alert"><AlertTriangle size={18} /><p>{parseError || 'Not an Agora Pay payment link.'}</p></div>}
    {parsed && <div className="request-details" aria-label="What this link asks">
      <div><span>Send exactly</span><strong>{formatUsdc(parsed.atomic)} {parsed.token}</strong></div>
      <div><span>To</span><strong style={{ wordBreak: 'break-all' }}>{parsed.merchant}</strong></div>
      <div><span>Network</span><strong>{parsed.chain === 'baseSepolia' ? 'Base Sepolia (test)' : 'Base MAINNET (real funds)'}</strong></div>
      {parsed.reference && <div><span>Payment reference</span><strong style={{ wordBreak: 'break-all', fontSize: 11 }}>{parsed.reference}</strong></div>}
    </div>}
    {testnetOnly && <div className="address-check-result address-check-warn" role="alert"><AlertTriangle size={18} /><p>This link is for Base mainnet (real funds). This stage of Agora Pay only works with the Base Sepolia test network. Do not pay it from here.</p></div>}
    {screen && (screen.status === 'listed' || screen.status === 'list-not-loaded') && <div className="address-check-result address-check-warn" role="alert"><AlertTriangle size={18} /><p>{screen.message}</p></div>}
    {parsed && !testnetOnly && <>
      <a className="secondary full" href={walletTransferUri(text)}>Open in my wallet (I confirm there)</a>
      <label className="amount-entry"><span>TRANSACTION HASH (PRIMARY MATCH)</span>
        <input value={txHash} onChange={(e) => setTxHash(e.target.value.trim())} placeholder="0x… 64 hex characters" spellCheck={false} autoComplete="off" aria-label="Transaction hash" /></label>
      <button className="secondary full" onClick={() => { if (!txHash.trim()) { setError('Paste the transaction hash from the buyer wallet.'); return } void start(txHash) }}>Match this transaction</button>
      <button className="secondary full" onClick={() => start('')}>Watch the chain for this payment</button>
    </>}
    {busy && <p role="status">{busy}</p>}
    {(watching || error) && <StateLine state={state} error={error} />}
    <small className="address-check-note">{TESTNET_NOTE} Your wallet, not Agora Pay, signs and sends. The wallet link is the plain transfer; the reference stays in Agora Pay. Watching includes the prior 24 hours so a payment made just before opening this screen is not missed.</small>
  </section>
}
