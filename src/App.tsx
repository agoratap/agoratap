import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Building2, Check, ChevronRight, CircleDollarSign,
  Download, Fingerprint, FlaskConical, History, Info, Landmark, Leaf, LockKeyhole, Radio,
  RefreshCcw, Send, ShieldCheck, Smartphone, Store, WalletCards, Wifi,
} from 'lucide-react'
import { receiptsToCsv } from './lib/export'
import {
  calculateQuote, completePayment, createPaymentRequest,
  type Asset, type PaymentRequest, type Receipt, type Settlement,
} from './lib/payments'
import { createPilotSession, type PilotSession } from './lib/pilot'
import { buildPilotSessionReport, PILOT_REPORT_DEMO_LABEL, pilotReportToCsv, pilotReportToJson } from './lib/pilotReport'

type Screen = 'home' | 'buyer' | 'merchant' | 'pilot' | 'architecture'
type BuyerStep = 'wallet' | 'quote' | 'tap' | 'receipt' | 'privacy'
type MerchantStep = 'amount' | 'request' | 'complete' | 'receipts'

interface DemoState {
  balances: Record<Asset, number>
  receipts: Receipt[]
  request: PaymentRequest | null
}

const STORAGE_KEY = 'agoratap-demo-v1'
const seedState: DemoState = {
  balances: { EURC: 84.2, USDC: 126.75 },
  request: null,
  receipts: [
    { id: 'demo-r-1003', requestId: 'demo-q-1003', amount: 7.8, asset: 'EURC', settlement: 'SEPA_INSTANT', status: 'settled', createdAt: '2026-09-27T08:42:00.000Z' },
    { id: 'demo-r-1002', requestId: 'demo-q-1002', amount: 12.4, asset: 'USDC', settlement: 'EUR_STABLECOIN', status: 'settled', createdAt: '2026-09-27T07:18:00.000Z' },
    { id: 'demo-r-1001', requestId: 'demo-q-1001', amount: 4.6, asset: 'EURC', settlement: 'EUR_STABLECOIN', status: 'settled', createdAt: '2026-09-26T16:05:00.000Z' },
  ],
}

function loadState(): DemoState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as DemoState : seedState
  } catch { return seedState }
}

const money = (amount: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount)
const downloadFile = (content: string, type: string, filename: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob); const link = document.createElement('a')
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
}
const when = (date: string) => new Intl.DateTimeFormat('en-IE', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(date))

function DemoLabel() { return <span className="demo-label"><span />DEMO · SIMULATED</span> }

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [data, setDataRaw] = useState<DemoState>(loadState)
  const setData = (next: DemoState) => { setDataRaw(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
  const reset = () => { localStorage.removeItem(STORAGE_KEY); setDataRaw(seedState); setScreen('home') }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <button className="brand" onClick={() => setScreen('home')} aria-label="AgoraTap home">
          <span className="brand-mark"><Leaf size={18} strokeWidth={2.5} /></span>
          <span>agora<span>tap</span></span>
        </button>
        <div className="top-actions"><DemoLabel /><button className="icon-button" onClick={reset} title="Reset demo"><RefreshCcw size={17} /></button></div>
      </header>

      <main>
        {screen === 'home' && <Home onNavigate={setScreen} />}
        {screen === 'buyer' && <Buyer data={data} setData={setData} onBack={() => setScreen('home')} />}
        {screen === 'merchant' && <Merchant data={data} setData={setData} onBack={() => setScreen('home')} />}
        {screen === 'pilot' && <MerchantPilot onBack={() => setScreen('home')} />}
        {screen === 'architecture' && <Architecture onBack={() => setScreen('home')} />}
      </main>
      <footer className="legal-footer">Prototype only · No real funds · No blockchain transactions · Not a regulated payment service</footer>
    </div>
  )
}

function Home({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return <div className="home-page">
    <section className="hero">
      <div className="eyebrow"><ShieldCheck size={15} /> PRIVATE BY DESIGN · OPEN PAYMENT RAILS</div>
      <h1>Tap. Pay.<br /><em>Keep it yours.</em></h1>
      <p className="hero-copy">A working concept for payments without card-network authorization: unlinkable shopper credentials, no routine buyer identity collection within lawful low-risk thresholds, and an identified, auditable merchant.</p>
      <div className="privacy-promise"><Fingerprint size={17} /><span><strong>No routine buyer KYC is the design target.</strong> Not a current legal guarantee; production thresholds and controls require counsel and licensed partners.</span></div>
      <div className="hero-actions">
        <button className="primary" onClick={() => onNavigate('pilot')}>Run local merchant pilot <FlaskConical size={18} /></button>
        <button className="secondary" onClick={() => onNavigate('merchant')}>Open local merchant demo</button>
      </div>
      <div className="honesty"><Info size={16} /><span><strong>Honest demo.</strong> Every balance, conversion and settlement is simulated locally on this device.</span></div>
    </section>

    <section className="role-panel">
      <button className="role-card buyer-card" onClick={() => onNavigate('buyer')}>
        <span className="role-number">01</span><WalletCards size={26} />
        <div><span className="role-label">FOR PEOPLE</span><h2>Pay without handing over your identity.</h2><p>Unlinkable tokens. No routine buyer KYC inside lawful low-risk thresholds.</p></div>
        <span className="circle-arrow"><ArrowRight /></span>
      </button>
      <button className="role-card merchant-card" onClick={() => onNavigate('merchant')}>
        <span className="role-number">02</span><Store size={26} />
        <div><span className="role-label">FOR MERCHANTS</span><h2>You stay identified. Shoppers do not.</h2><p>KYB, audit trail, EUR stablecoin or simulated SEPA Instant.</p></div>
        <span className="circle-arrow"><ArrowRight /></span>
      </button>
    </section>

    <section className="pilot-offer">
      <div><span className="section-kicker">FIRST BUSINESS WEDGE</span><h2>One merchant. One local test session. Fictional value only.</h2></div>
      <div><p>Run a structured checkout usability session entirely in this browser. No order is sent to GNU Taler or any other service; no money, customer data, credentials, custody or production payment is involved.</p><p><strong>Commercial pricing starts only after measured merchant evidence.</strong></p><a className="primary" href="mailto:enccmail@proton.me?subject=AgoraTap%20merchant%20readiness%20sprint">Request a readiness sprint <ArrowRight size={18} /></a></div>
    </section>

    <section className="how-section">
      <div><span className="section-kicker">THE PROPOSITION</span><h2>Cash-like privacy.<br />Digital convenience.</h2></div>
      <div className="steps">
        <article><span>1</span><div><h3>Load</h3><p>Buyer funds unlinkable payment tokens. Inside lawful low-risk thresholds, no routine identity collection is the design target.</p></div></article>
        <article><span>2</span><div><h3>Tap</h3><p>A one-time credential pays. Merchant sees amount and proof, not a reusable shopper identity or card profile.</p></div></article>
        <article><span>3</span><div><h3>Settle</h3><p>Merchant remains KYB-identified and auditable. They choose EUR stablecoin or SEPA Instant via licensed partners.</p></div></article>
      </div>
      <button className="text-link" onClick={() => onNavigate('architecture')}>See how the system fits together <ArrowRight size={16} /></button>
    </section>
  </div>
}

function Buyer({ data, setData, onBack }: { data: DemoState; setData: (d: DemoState) => void; onBack: () => void }) {
  const [step, setStep] = useState<BuyerStep>('wallet')
  const [asset, setAsset] = useState<Asset>('EURC')
  const [paying, setPaying] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null)
  const request = data.request?.status === 'pending' ? data.request : createPaymentRequest(8.4, 'EUR_STABLECOIN', () => 'demo-live-request')
  const quote = useMemo(() => calculateQuote(asset, request.amount), [asset, request.amount])

  const pay = () => {
    if (data.balances[asset] < quote.totalSourceAmount) return
    setPaying(true)
    window.setTimeout(() => {
      const receipt = completePayment(request, asset)
      setData({
        balances: { ...data.balances, [asset]: Math.round((data.balances[asset] - quote.totalSourceAmount) * 100) / 100 },
        receipts: [receipt, ...data.receipts],
        request: data.request ? { ...data.request, status: 'completed' } : null,
      })
      setLastReceipt(receipt); setPaying(false); setStep('receipt')
    }, 900)
  }

  if (step === 'privacy') return <FlowLayout title="Your privacy" onBack={() => setStep('wallet')} progress={100}>
    <div className="privacy-hero"><Fingerprint size={44} /><h2>No routine buyer KYC is the point.</h2><p>Inspired by GNU Taler: unlinkable payment tokens, not a Visa-style crypto card that still profiles the shopper.</p></div>
    <div className="privacy-list">
      <article><Check /><div><h3>Merchant sees</h3><p>Who they are (KYB), the amount, payment proof, and a settlement reference. Merchants stay identified and auditable.</p></div></article>
      <article><LockKeyhole /><div><h3>Merchant does not see</h3><p>Your name, reusable wallet ID, funding history, or a card-network shopping profile. Payments are designed to be unlinkable.</p></div></article>
      <article><Landmark /><div><h3>Not evasion</h3><p>Sanctions and AML controls remain. Privacy is for everyday low-risk spend within lawful thresholds, not for hiding from legal process.</p></div></article>
    </div>
    <div className="visa-contrast">
      <h3>Why this is not a Visa crypto card</h3>
      <p>Crypto cards still authorize through a card network. The network and often the merchant acquirer can build a buyer transaction graph. AgoraTap’s design target is no card-network authorization, no merchant-side buyer profiling, and one-time credentials that do not link purchases together.</p>
    </div>
    <p className="fine-print">Design target, not a current legal guarantee. This prototype does not implement GNU Taler cryptography, screening, custody, or anonymity. Production requires counsel and licensed CASP/EMI partners.</p>
  </FlowLayout>

  if (step === 'receipt' && lastReceipt) return <FlowLayout title="Payment complete" onBack={() => setStep('wallet')} progress={100}>
    <div className="success-orbit"><div><Check size={36} /></div></div>
    <div className="receipt-head"><span>PAID</span><h2>{money(lastReceipt.amount)}</h2><p>Corner Market · {when(lastReceipt.createdAt)}</p></div>
    <div className="paper-receipt">
      <div><span>Paid with</span><strong>{lastReceipt.asset}</strong></div><div><span>Settlement</span><strong>{lastReceipt.settlement === 'SEPA_INSTANT' ? 'SEPA Instant (simulated)' : 'EUR stablecoin'}</strong></div><div><span>Network fee</span><strong>€0.00</strong></div><div><span>Receipt</span><strong>{lastReceipt.id.slice(0, 13)}…</strong></div>
    </div>
    <button className="primary full" onClick={() => setStep('wallet')}>Done</button>
    <button className="text-link center" onClick={() => setStep('privacy')}><ShieldCheck size={16} /> What did the merchant learn?</button>
  </FlowLayout>

  if (step === 'tap') return <FlowLayout title="Tap to pay" onBack={() => setStep('quote')} progress={75}>
    <div className={`tap-zone ${paying ? 'paying' : ''}`}>
      <div className="tap-rings"><span /><span /><button onClick={pay} disabled={paying} aria-label="Simulate NFC tap"><Wifi size={42} /></button></div>
      <h2>{paying ? 'Exchanging payment proof…' : 'Hold near the merchant device'}</h2>
      <p>{paying ? 'This stays on-device in the demo.' : 'Or tap the signal to simulate NFC.'}</p>
    </div>
    <div className="pay-summary"><div><span>Corner Market</span><strong>{money(request.amount)}</strong></div><div><span>Paying from</span><strong>{asset} · {quote.totalSourceAmount.toFixed(2)}</strong></div></div>
    <div className="demo-note"><Radio size={16} /> No NFC hardware is accessed. This interaction is simulated.</div>
  </FlowLayout>

  if (step === 'quote') return <FlowLayout title="Review payment" onBack={() => setStep('wallet')} progress={50}>
    <div className="merchant-chip"><span className="merchant-logo">CM</span><div><small>PAYING</small><strong>Corner Market</strong></div><ShieldCheck size={19} /></div>
    <div className="amount-focus"><span>MERCHANT RECEIVES</span><h2>{money(request.amount)}</h2></div>
    <div className="quote-card">
      <div><span>You pay</span><strong>{quote.totalSourceAmount.toFixed(2)} {asset}</strong></div>
      <div><span>Reference rate</span><strong>1 {asset} = {quote.rate.toFixed(2)} EUR</strong></div>
      <div><span>Conversion fee</span><strong>{quote.conversionFee.toFixed(2)} {asset}</strong></div>
      <div><span>Payment network fee</span><strong>0.00 {asset}</strong></div>
      <div className="quote-total"><span>Total</span><strong>{quote.totalSourceAmount.toFixed(2)} {asset}</strong></div>
    </div>
    <p className="rate-note"><Info size={14} /> Simulated indicative rate. Quote is fixed only for this demo screen.</p>
    <button className="primary full" onClick={() => setStep('tap')}>Continue to tap <ArrowRight size={18} /></button>
  </FlowLayout>

  return <FlowLayout title="My wallet" onBack={onBack} progress={25}>
    <div className="balance-card">
      <div className="balance-top"><span>AVAILABLE BALANCE</span><ShieldCheck size={18} /></div>
      <h2>{money(data.balances.EURC + data.balances.USDC * 0.92)}</h2><p>Estimated across demo assets</p>
      <button onClick={() => setData({ ...data, balances: { ...data.balances, EURC: data.balances.EURC + 25 } })}><CircleDollarSign size={16} /> Add €25 demo funds</button>
    </div>
    <div className="section-row"><h3>Choose how to pay</h3><button onClick={() => setStep('privacy')}><LockKeyhole size={14} /> Privacy</button></div>
    <div className="asset-list">
      <button className={asset === 'EURC' ? 'selected' : ''} onClick={() => setAsset('EURC')}><span className="asset-icon euro">€</span><div><strong>EURC</strong><small>Euro stablecoin</small></div><span className="asset-balance">{data.balances.EURC.toFixed(2)}<small>≈ {money(data.balances.EURC)}</small></span><span className="radio-dot" /></button>
      <button className={asset === 'USDC' ? 'selected' : ''} onClick={() => setAsset('USDC')}><span className="asset-icon dollar">$</span><div><strong>USDC</strong><small>Dollar stablecoin</small></div><span className="asset-balance">{data.balances.USDC.toFixed(2)}<small>≈ {money(data.balances.USDC * 0.92)}</small></span><span className="radio-dot" /></button>
    </div>
    <div className="incoming"><div className="incoming-pulse"><Radio size={18} /></div><div><small>PAYMENT REQUEST FOUND</small><strong>Corner Market · {money(request.amount)}</strong></div></div>
    <button className="primary full" onClick={() => setStep('quote')}>Review & pay <ChevronRight size={18} /></button>
  </FlowLayout>
}

function Merchant({ data, setData, onBack }: { data: DemoState; setData: (d: DemoState) => void; onBack: () => void }) {
  const [step, setStep] = useState<MerchantStep>('amount')
  const [amount, setAmount] = useState('12.50')
  const [settlement, setSettlement] = useState<Settlement>('EUR_STABLECOIN')
  const request = data.request
  const makeRequest = () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    setData({ ...data, request: createPaymentRequest(value, settlement) }); setStep('request')
  }
  const simulate = () => {
    if (!request || request.status !== 'pending') return
    const receipt = completePayment(request, 'EURC')
    setData({ ...data, request: { ...request, status: 'completed' }, receipts: [receipt, ...data.receipts] }); setStep('complete')
  }
  const download = () => downloadFile(receiptsToCsv(data.receipts), 'text/csv', 'agoratap-demo-receipts.csv')

  if (step === 'receipts') return <FlowLayout title="Daily receipts" onBack={() => setStep('amount')} progress={100}>
    <div className="audit-head"><div><span>TODAY · DEMO</span><h2>{money(data.receipts.reduce((sum, receipt) => sum + receipt.amount, 0))}</h2><p>{data.receipts.length} completed payments</p></div><button className="secondary compact" onClick={download}><Download size={16} /> Export CSV</button></div>
    <div className="receipt-list">{data.receipts.map((receipt) => <article key={receipt.id}><span className="receipt-status"><Check /></span><div><strong>{money(receipt.amount)}</strong><small>{when(receipt.createdAt)} · {receipt.asset}</small></div><div className="settle-label">{receipt.settlement === 'SEPA_INSTANT' ? 'SEPA SIM' : 'EUR STABLE'}</div></article>)}</div>
    <div className="audit-note"><ShieldCheck size={18} /><div><strong>Merchant remains auditable</strong><p>This trail is about the identified merchant and settlement, not the buyer’s identity. Exports are marked DEMO. Production would add signed references and retention controls.</p></div></div>
  </FlowLayout>

  if (step === 'complete' && request) return <FlowLayout title="Payment received" onBack={() => setStep('amount')} progress={100}>
    <div className="success-orbit merchant-success"><div><Check size={36} /></div></div>
    <div className="receipt-head"><span>RECEIVED · DEMO</span><h2>{money(request.amount)}</h2><p>Payment proof accepted</p></div>
    <div className="settlement-track"><span className="done"><Check /></span><i /><span className="done"><Check /></span><div><small>PAYMENT</small><strong>Confirmed</strong></div><div><small>SETTLEMENT</small><strong>{request.settlement === 'SEPA_INSTANT' ? 'SEPA simulated' : 'EUR stablecoin'}</strong></div></div>
    <button className="primary full" onClick={() => { setAmount(''); setStep('amount') }}>New sale</button>
    <button className="text-link center" onClick={() => setStep('receipts')}><History size={16} /> View daily receipts</button>
  </FlowLayout>

  if (step === 'request' && request) return <FlowLayout title="Payment request" onBack={() => setStep('amount')} progress={66}>
    <div className="request-card"><div className="request-signal"><Smartphone /><span><Wifi /></span></div><span>READY FOR TAP</span><h2>{money(request.amount)}</h2><p>Ask the buyer to hold their phone near this device.</p></div>
    <div className="request-details"><div><span>Settlement</span><strong>{request.settlement === 'SEPA_INSTANT' ? 'SEPA Instant · simulated' : 'EUR stablecoin'}</strong></div><div><span>Request ID</span><strong>{request.id.slice(0, 12)}…</strong></div></div>
    <button className="primary full" onClick={simulate}>Simulate buyer tap <Send size={17} /></button>
    <div className="demo-note"><Radio size={16} /> Waiting is simulated; no external payment is requested.</div>
  </FlowLayout>

  return <FlowLayout title="New sale" onBack={onBack} progress={33}>
    <button className="history-button" onClick={() => setStep('receipts')}><History size={17} /> Daily receipts <ChevronRight size={17} /></button>
    <label className="amount-entry"><span>AMOUNT DUE</span><div><b>€</b><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Amount due" /></div></label>
    <div className="quick-amounts">{['4.50', '8.00', '12.50', '20.00'].map((v) => <button key={v} onClick={() => setAmount(v)}>€{v}</button>)}</div>
    <div className="settlement-title"><span>SETTLE TO</span><small>You can change this for every sale</small></div>
    <div className="settlement-options">
      <button className={settlement === 'EUR_STABLECOIN' ? 'selected' : ''} onClick={() => setSettlement('EUR_STABLECOIN')}><span className="settlement-icon"><CircleDollarSign /></span><div><strong>EUR stablecoin</strong><small>Instant · demo wallet</small></div><span className="radio-dot" /></button>
      <button className={settlement === 'SEPA_INSTANT' ? 'selected' : ''} onClick={() => setSettlement('SEPA_INSTANT')}><span className="settlement-icon"><Landmark /></span><div><strong>SEPA Instant</strong><small>Simulated fiat settlement</small></div><span className="radio-dot" /></button>
    </div>
    <div className="fee-line"><span>Demo processing fee</span><strong>€0.00</strong></div>
    <button className="primary full" onClick={makeRequest} disabled={!Number(amount)}>Create payment request <ArrowRight size={18} /></button>
  </FlowLayout>
}

function MerchantPilot({ onBack }: { onBack: () => void }) {
  const [amount, setAmount] = useState('12.50')
  const [scenario, setScenario] = useState('Standard counter sale')
  const [session, setSession] = useState<PilotSession | null>(null)
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const completed = completedAt !== null
  const [error, setError] = useState('')

  const startSession = () => {
    try {
      setSession(createPilotSession({ amount, scenario }))
      setCompletedAt(null)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the local session')
    }
  }

  const exportReport = () => {
    if (!session) return
    try {
      const report = buildPilotSessionReport(session, { completedAt })
      const base = `agoratap-DEMO-pilot-session-${session.id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)}`
      downloadFile(pilotReportToJson(report), 'application/json', `${base}.json`)
      downloadFile(pilotReportToCsv(report), 'text/csv', `${base}.csv`)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not build the local session report')
    }
  }

  const startAnother = () => {
    setSession(null)
    setCompletedAt(null)
    setError('')
  }

  return <FlowLayout title="Merchant pilot" onBack={onBack} progress={100} wide>
    <div className="protocol-intro"><span className="section-kicker">LOCAL READINESS WORKFLOW</span><h2>Test the checkout.<br />Do not pretend it is live.</h2><p>This screen creates a fictional merchant session in this browser. It makes no network request and does not create, inspect or pay a GNU Taler order.</p></div>
    <div className="protocol-grid">
      <section className="protocol-form">
        {!session ? <>
          <label><span>FICTIONAL EUR AMOUNT</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label><span>SCENARIO LABEL — NO CUSTOMER DETAILS</span><input value={scenario} maxLength={80} onChange={(event) => setScenario(event.target.value)} /></label>
          <button className="primary full" onClick={startSession}>Start local test session <ArrowRight size={18} /></button>
        </> : <>
          <div className="sandbox-boundary"><Check size={18} /><div><strong>Session facts locked</strong><p>The amount, label, ID and start time below are an immutable snapshot. Start another session to change them.</p></div></div>
          <button className="secondary full" onClick={startAnother}>Start another session</button>
        </>}
        <div className="sandbox-boundary"><FlaskConical size={18} /><div><strong>Boundary</strong><p>All entered values stay in component memory and are discarded on refresh. Nothing is sent to GNU Taler, AgoraTap or a merchant backend.</p></div></div>
        <a className="text-link center" href="https://demo.taler.net/" target="_blank" rel="noreferrer noopener">Visit GNU Taler’s official public demo <ArrowRight size={16} /></a>
        <p className="fine-print">The external link is fixed and sends none of the values entered above. GNU Taler operates that separate site under its own terms.</p>
        {error && <div className="protocol-error"><Info size={16} />{error}</div>}
      </section>
      <section className="protocol-result" aria-live="polite">
        {!session && <div className="protocol-empty"><Radio size={28} /><h3>No local session yet</h3><p>Enter fictional test facts to create an immutable session card.</p></div>}
        {session && <>
          <div className={`live-status ${completed ? 'paid' : ''}`}><span />{completed ? 'SCENARIO RECORDED' : 'LOCAL SIMULATION · READY'}</div>
          <div className="live-amount"><small>FICTIONAL AMOUNT</small><strong>{money(session.amountMinor / 100)}</strong></div>
          <dl><div><dt>Scenario</dt><dd>{session.scenario}</dd></div><div><dt>Session ID</dt><dd>{session.id}</dd></div><div><dt>Started</dt><dd>{when(session.startedAt)}</dd></div><div><dt>Environment</dt><dd>LOCAL SIMULATION</dd></div></dl>
          {!completed && <button className="primary full" onClick={() => setCompletedAt(new Date().toISOString())}>Record scenario complete <Check size={18} /></button>}
          <button className="secondary full" onClick={exportReport}><Download size={17} /> Export session report</button>
          <p className="fine-print"><strong>{PILOT_REPORT_DEMO_LABEL}.</strong> Downloads a JSON and a CSV file built in this browser from the facts above. Nothing is uploaded; friction notes are not captured by this version.</p>
          <div className="sandbox-boundary"><Info size={18} /><div><strong>What this proves</strong><p>Only that the merchant-facing copy and task flow can be tested. It proves no protocol integration, payment, settlement, demand or regulatory status.</p></div></div>
        </>}
      </section>
    </div>
  </FlowLayout>
}

function Architecture({ onBack }: { onBack: () => void }) {
  return <FlowLayout title="System map" onBack={onBack} progress={100} wide>
    <div className="architecture-intro"><span className="section-kicker">PRODUCTION DIRECTION</span><h2>Unlinkable at the till.<br />Identified at the merchant.</h2><p>Core differentiator: no routine buyer KYC or identity collection within lawful low-risk thresholds. The merchant is KYB-identified and auditable. This is a design target requiring counsel and licensed partners, not a guarantee of this demo.</p></div>
    <div className="system-map">
      <article><span>01</span><WalletCards /><h3>Buyer wallet</h3><p>Holds unlinkable payment tokens. No reusable shopper ID at checkout.</p><small>BUYER DEVICE</small></article><i>→</i>
      <article className="core"><span>02</span><Radio /><h3>Licensed issuer / GNU Taler exchange</h3><p>Validates one-time value without building a buyer transaction graph. AgoraTap integrates; it does not operate this regulated layer.</p><small>OPEN PROTOCOL · PARTNER LAYER</small></article><i>→</i>
      <article><span>03</span><Store /><h3>Merchant till</h3><p>Identified merchant receives proof and settlement, not a shopper profile.</p><small>MERCHANT DEVICE</small></article>
    </div>
    <div className="rail-map"><div><Building2 /><span><small>REGULATED EDGE</small><strong>Licensed CASP / EMI</strong></span></div><div><Landmark /><span><small>FIAT SETTLEMENT</small><strong>SEPA Instant partner</strong></span></div></div>
    <div className="boundary-grid"><article><h3>What changes</h3><p>No card-network authorization. No merchant-side buyer profiling. Unlinkable credentials instead of a crypto card.</p></article><article><h3>What remains</h3><p>Merchant KYB, sanctions/AML at lawful boundaries, licensed rails. Privacy is not sanctions evasion.</p></article><article><h3>What this demo proves</h3><p>Interaction, quote clarity, settlement choice and merchant audit export—not production cryptography or legal anonymity.</p></article></div>
  </FlowLayout>
}

function FlowLayout({ title, onBack, progress, wide = false, children }: { title: string; onBack: () => void; progress: number; wide?: boolean; children: React.ReactNode }) {
  return <div className={`flow-page ${wide ? 'wide' : ''}`}>
    <div className="flow-header"><button className="icon-button" onClick={onBack}><ArrowLeft size={20} /></button><h1>{title}</h1><DemoLabel /></div>
    <div className="progress"><span style={{ width: `${progress}%` }} /></div>
    <div className="flow-content">{children}</div>
  </div>
}

export default App
