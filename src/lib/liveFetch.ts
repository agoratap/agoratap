// THE ONLY FILE in the app that touches the network. It sends JSON-RPC POSTs to a fixed public Base RPC endpoint and nothing else.
// A test (readmeClaims.test.ts) checks that no other source file does, and that the RPC methods sent are read-only.
import type { FetchLike } from './chainReader'

export const READ_ONLY_METHODS = ['eth_blockNumber', 'eth_getLogs', 'eth_getBlockByNumber', 'eth_getTransactionReceipt'] as const

export const browserFetch: FetchLike = (url, init) => {
  const method = (JSON.parse(init.body) as { method?: string }).method
  if (!method || !(READ_ONLY_METHODS as readonly string[]).includes(method)) throw new Error(`Blocked: ${String(method)} is not a read-only method`)
  return fetch(url, { ...init, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' })
}
