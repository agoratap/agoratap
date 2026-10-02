import { AlertTriangle, Info } from 'lucide-react'
import { OFAC_LIST, screenAddress, type OfacList } from './lib/screening'

/** Merchant-side address check. Warn only: it never disables a button or blocks a sale. Value lives in component memory only. */
export function AddressCheck({ value, onChange, list = OFAC_LIST }: { value: string; onChange: (next: string) => void; list?: OfacList }) {
  const result = screenAddress(value, list)
  const warn = result.status === 'listed' || result.status === 'list-not-loaded'
  return (
    <div className="address-check">
      <label className="amount-entry">
        <span>CHECK A PAYER OR DESTINATION ADDRESS (OPTIONAL)</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" aria-label="Payer or destination address" />
      </label>
      {result.status !== 'empty' && (
        <div className={warn ? 'address-check-result address-check-warn' : 'address-check-result'} role={warn ? 'alert' : 'status'}>
          {warn ? <AlertTriangle size={18} /> : <Info size={18} />}
          <p>{result.message}</p>
        </div>
      )}
      <small className="address-check-note">
        OFAC list snapshot of {list.downloadedAt || 'unknown date'}; may be incomplete or outdated. Warning only, nothing is blocked. The address is checked in your browser and is not sent or stored.
      </small>
    </div>
  )
}
