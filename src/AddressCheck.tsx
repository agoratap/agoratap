import { useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { EU_LIST, OFAC_LIST, UK_LIST, combineScreenResults, screenAddressAll, screenNameAll, type OfacList } from './lib/screening'

/** Merchant-side address and name check. Warn only: it never disables a button or blocks a sale. Values live in component memory only. */
export function AddressCheck({
  value,
  onChange,
  name,
  onNameChange,
  list = OFAC_LIST,
  euList = EU_LIST,
  ukList = UK_LIST,
}: {
  value: string
  onChange: (next: string) => void
  name?: string
  onNameChange?: (next: string) => void
  list?: OfacList
  euList?: OfacList
  ukList?: OfacList
}) {
  const [localName, setLocalName] = useState('')
  const nameValue = name !== undefined ? name : localName
  const setName = onNameChange ?? setLocalName
  const lists: OfacList[] = [{ authority: 'OFAC', ...list }, { authority: 'EU', ...euList }, { authority: 'UK', ...ukList }]
  const result = combineScreenResults(screenAddressAll(value, lists), screenNameAll(nameValue, lists))
  const warn = result.status === 'listed' || result.status === 'list-not-loaded'
  return (
    <div className="address-check">
      <label className="amount-entry">
        <span>CHECK A PAYER OR DESTINATION ADDRESS (OPTIONAL)</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" aria-label="Payer or destination address" />
      </label>
      <label className="amount-entry">
        <span>CHECK A PAYER OR DESTINATION NAME (OPTIONAL)</span>
        <input className="address-check-name" value={nameValue} onChange={(e) => setName(e.target.value)} placeholder="Name as written on the list" autoComplete="off" aria-label="Payer or destination name" />
      </label>
      {result.status !== 'empty' && (
        <div className={warn ? 'address-check-result address-check-warn' : 'address-check-result'} role={warn ? 'alert' : 'status'}>
          {warn ? <AlertTriangle size={18} /> : <Info size={18} />}
          <p>{result.message}</p>
        </div>
      )}
      <small className="address-check-note">
        OFAC list snapshot of {list.downloadedAt || 'unknown date'} (addresses only) and EU consolidated list snapshot of {euList.downloadedAt || 'unknown date'} and UK Sanctions List snapshot of {ukList.downloadedAt || 'unknown date'} (EU and UK: crypto addresses, and names of list entries that publish wallet addresses); may be incomplete or outdated. Warning only, nothing is blocked. The address and name are checked in your browser and are not sent or stored.
      </small>
    </div>
  )
}
