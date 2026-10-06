/**
 * Browser store for the local practice screens.
 * `agoratap-demo-v1` is the previous key. A one-time read copies that record
 * into `agorapay-pilot-v1` so an existing browser keeps its data.
 */
export const STORAGE_KEY = 'agorapay-pilot-v1'
export const LEGACY_STORAGE_KEY = 'agoratap-demo-v1'

export function resolveStoredRecord(current: string | null, legacy: string | null): {
  raw: string | null
  /** True only when `raw` came from the legacy key and should be copied once. */
  copyLegacy: boolean
} {
  if (current !== null) return { raw: current, copyLegacy: false }
  if (legacy !== null) return { raw: legacy, copyLegacy: true }
  return { raw: null, copyLegacy: false }
}
