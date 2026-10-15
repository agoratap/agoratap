import { useMemo, useState } from 'react'
import { ASSET_CATALOG, FIAT_COMING_LABEL, INDICATIVE_LABEL, assetLabel, indicativeQuote, searchAssets, type CatalogAsset, type PayoutAsset } from './lib/anyAsset'

interface Props {
  eurAmount: number
  payout: PayoutAsset
  practiceBalances: Record<string, number>
  selectedId: string
  onSelect: (asset: CatalogAsset) => void
}

export function AnyAssetPicker({ eurAmount, payout, practiceBalances, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchAssets(query), [query])
  const selected = ASSET_CATALOG.find((a) => a.id === selectedId)
  const quote = selected && selected.kind === 'crypto' ? indicativeQuote(selected, eurAmount, payout) : null
  return <div className="any-asset">
    <input className="asset-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search BTC, USDT Tron, XMR, SOL, RON…" aria-label="Search assets" />
    <div className="asset-list any-asset-list" role="listbox" aria-label="Pay with">
      {results.map((a) => {
        const fiat = a.kind === 'fiat'
        return <button key={a.id} role="option" aria-selected={a.id === selectedId} disabled={fiat} className={a.id === selectedId ? 'selected' : ''} onClick={() => onSelect(a)}>
          <span className="asset-icon">{a.symbol.slice(0, 1)}</span>
          <div><strong>{assetLabel(a)}</strong><small>{fiat ? FIAT_COMING_LABEL : a.name}</small></div>
          {a.practice && <span className="asset-balance">{(practiceBalances[a.symbol] ?? 0).toFixed(2)}<small>practice</small></span>}
          <span className="radio-dot" />
        </button>
      })}
      {results.length === 0 && <p className="fine-print">No match. Any asset a swap route supports can be added.</p>}
    </div>
    {quote && <div className="quote-card indicative-quote" aria-live="polite">
      <div><span>You send</span><strong>{quote.sendAmount} {quote.from.symbol}</strong></div>
      <div><span>Merchant receives</span><strong>{quote.payoutAmount} {quote.payout}</strong></div>
      <div><span>Swap spread</span><strong>{quote.spreadFee} {quote.from.symbol}</strong></div>
      <div><span>Network fee</span><strong>{quote.networkFee} {quote.from.symbol}</strong></div>
      <small>{INDICATIVE_LABEL}. Review & pay runs a practice payment; a real swap order is offered on the next screen.</small>
    </div>}
  </div>
}
