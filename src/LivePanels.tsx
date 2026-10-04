import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Radio } from 'lucide-react'
import { createChainReader, PUBLIC_RPC, type ChainReader } from './lib/chainReader'
import { browserFetch } from './lib/liveFetch'
import { describeState, HISTORY_LOOKBACK_BLOCKS, openLiveRequest, refreshLive, type LiveRequest } from './lib/liveSession'
import { type PaymentState } from './lib/confirmation'
import { parseRequestLink } from './lib/requestLink'
import { eip681Uri, formatUsdc, isAddress, type OpenRequest } from './lib/chainRequest'
import { secureRandom, type Random } from './lib/tagging'
import { screenAddress } from './lib/screening'
import { windowFrom } from './lib/confirmation'

const CHAIN = 'baseSepolia' as const
export const POLL_MS = 6000
const defaultReader = (): ChainReader => createChainReader({ fetchFn: browserFetch, rpcUrl: PUBLIC_RPC[CHAIN], maxRange: 1000, maxCalls: 60 })

const TESTNET_NOTE = 'Base Sepolia test network only. Test tokens have no value. Read-only: this page never signs, sends or holds anything. Reads go to the public endpoint sepolia.base.org, which sees your IP address.'

function usePolling(run: () => Promise<void>, active: boolean) {
  const busy = useRef(false)
  useEffect(() => {
    if (!active) return
    const tick = async () => { if (busy.current) return; busy.current = true; try { await run() } finally { busy.current = false } }
    void tick()
    const id = window.setInterval(tick, POLL_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}

function StateLine({ state, error }: { state: PaymentState | null; error: string }) {
  const bad = state?.status === 'ambiguous' || state?.status === 'reorged' || state?.status === 'unknown' || !!error
  return <div className={bad ? 'address-check-result address-check-warn' : 'address-check-result'} role={bad ? 'alert' : 'status'}>
    {bad ? <AlertTriangle size={18} /> : <Radio size={18} />}
    <p>{error || (state ? describeState(state) : 'Not checked yet.')}</p>
  </div>
}

/** Merchant side: create a unique-amount EURC request on Base Sepolia and watch the chain for it. */
export function MerchantLive({ reader, random = secureRandom }: { reader?: ChainReader; random?: Random }) {
  const rd = useMemo(() => reader ?? defaultReader(), [reader])
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('1.00')
  const [live, setLive] = useState<LiveRequest | null>(null)
  const [state, setState] = useState<PaymentState | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<OpenRequest[]>([])
  const screen = screenAddress(merchant)
  const prev = useRef<PaymentState | undefined>(undefined)

  const create = async () => {
    setError(''); setState(null); prev.current = undefined
    try {
      if (!isAddress(merchant)) throw new Error('Enter your receiving address (0x…)')
      const made = await openLiveRequest(rd, { orderId: 'live-' + Date.now(), chain: CHAIN, merchant, eurAmount: Number(amount), ttlSeconds: 3600 }, open, random)
      setLive(made); setOpen([...open, made.request])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the request') }
  }
  usePolling(async () => {
    if (!live) return
    try { const next = await refreshLive(rd, live, prev.current); prev.current = next; setState(next); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Chain read failed') }
  }, live !== null && state?.status !== 'confirmed')

  return <section className="address-check" aria-label="Live testnet request">
    <label className="amount-entry"><span>LIVE TEST (BASE SEPOLIA, READ-ONLY) · YOUR RECEIVING ADDRESS</span>
      <input value={merchant} onChange={(e) => setMerchant(e.target.value.trim())} placeholder="0x…" spellCheck={false} autoComplete="off" aria-label="Receiving address" /></label>
    {(screen.status === 'listed' || screen.status === 'list-not-loaded') && <div className="address-check-result address-check-warn" role="alert"><AlertTriangle size={18} /><p>{screen.message}</p></div>}
    <label className="amount-entry"><span>PRICE IN EURC (1 EURC = 1 EUR)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Live price in EURC" /></label>
    <button className="secondary full" onClick={create}>Create live test request</button>
    {live && <div className="request-details" aria-label="Live request">
      <div><span>Buyer must send exactly</span><strong>{formatUsdc(live.request.atomic)} EURC</strong></div>
      <div><span>To</span><strong style={{ wordBreak: 'break-all' }}>{live.request.merchant}</strong></div>
      <div><span>Payment link</span><strong style={{ wordBreak: 'break-all', fontSize: 11 }}>{eip681Uri(live.request)}</strong></div>
      <div><span>Counts from block</span><strong>{live.window.fromBlock}{live.window.toBlock ? ` to ${live.window.toBlock}` : ''}</strong></div>
    </div>}
    {(live || error) && <StateLine state={state} error={error} />}
    <small className="address-check-note">{TESTNET_NOTE} The exact amount includes a random 0.000001–0.009999 tag so two requests do not collide. Anyone can send that amount: a match shows an amount arrived, not who sent it.</small>
  </section>
}

export function buyerWatchWindow(head: number) {
  return windowFrom(Math.max(0, head - HISTORY_LOOKBACK_BLOCKS))
}

/** Buyer side: paste a payment link, see exactly what it asks, open it in your own wallet, and watch confirmations. */
export function BuyerLive({ reader, initialText = '' }: { reader?: ChainReader; initialText?: string }) {
  const rd = useMemo(() => reader ?? defaultReader(), [reader])
  const [text, setText] = useState(initialText)
  const [live, setLive] = useState<LiveRequest | null>(null)
  const [state, setState] = useState<PaymentState | null>(null)
  const [error, setError] = useState('')
  const [watching, setWatching] = useState(false)
  const prev = useRef<PaymentState | undefined>(undefined)

  let parsed: ReturnType<typeof parseRequestLink> | null = null
  let parseError = ''
  if (text) { try { parsed = parseRequestLink(text) } catch (e) { parseError = (e as Error).message } }
  const screen = parsed ? screenAddress(parsed.merchant) : null
  const testnetOnly = parsed !== null && parsed.chain !== CHAIN

  const watch = async () => {
    if (!parsed || testnetOnly) return
    setError(''); setState(null); prev.current = undefined
    try {
      const { head } = await rd.headBlock()
      const request: OpenRequest = { orderId: 'buyer-watch', chain: parsed.chain, token: parsed.token, merchant: parsed.merchant, atomic: parsed.atomic, baseAtomic: parsed.atomic, tag: 0 }
      setLive({ request, window: buyerWatchWindow(head), uri: eip681Uri(request), confirmations: 12 }); setWatching(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the chain') }
  }
  usePolling(async () => {
    if (!live) return
    try { const next = await refreshLive(rd, live, prev.current); prev.current = next; setState(next); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Chain read failed') }
  }, watching && state?.status !== 'confirmed')

  return <section className="address-check" aria-label="Live testnet payment link">
    <label className="amount-entry"><span>LIVE TEST (BASE SEPOLIA, READ-ONLY) · PASTE A PAYMENT LINK</span>
      <input value={text} onChange={(e) => { setText(e.target.value); setLive(null); setWatching(false); setState(null) }} placeholder="ethereum:0x…@84532/transfer?address=0x…&uint256=…" spellCheck={false} autoComplete="off" aria-label="Payment link" /></label>
    {text && !parsed && <div className="address-check-result address-check-warn" role="alert"><AlertTriangle size={18} /><p>{parseError || 'Not an AgoraTap payment link.'}</p></div>}
    {parsed && <div className="request-details" aria-label="What this link asks">
      <div><span>Send exactly</span><strong>{formatUsdc(parsed.atomic)} {parsed.token}</strong></div>
      <div><span>To</span><strong style={{ wordBreak: 'break-all' }}>{parsed.merchant}</strong></div>
      <div><span>Network</span><strong>{parsed.chain === 'baseSepolia' ? 'Base Sepolia (test)' : 'Base MAINNET (real funds)'}</strong></div>
    </div>}
    {testnetOnly && <div className="address-check-result address-check-warn" role="alert"><AlertTriangle size={18} /><p>This link is for Base mainnet (real funds). This stage of AgoraTap only works with the Base Sepolia test network. Do not pay it from here.</p></div>}
    {screen && (screen.status === 'listed' || screen.status === 'list-not-loaded') && <div className="address-check-result address-check-warn" role="alert"><AlertTriangle size={18} /><p>{screen.message}</p></div>}
    {parsed && !testnetOnly && <>
      <a className="secondary full" href={text.trim()}>Open in my wallet (I confirm there)</a>
      <button className="secondary full" onClick={watch}>Watch the chain for this payment</button>
    </>}
    {(watching || error) && <StateLine state={state} error={error} />}
    <small className="address-check-note">{TESTNET_NOTE} Your wallet, not AgoraTap, signs and sends. Watching includes the prior 24 hours so a payment made just before opening this screen is not missed.</small>
  </section>
}
