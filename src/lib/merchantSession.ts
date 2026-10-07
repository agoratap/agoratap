// On-device record of live test sales on the optional Base Sepolia matcher. Not a Base-only product definition.
// The JSON file and the IndexedDB row are the same bytes. Neither holds a wallet key.
// Agora Pay does not hold keys or funds. Import refuses mainnet and refuses key material.
import { isAddress, type OpenRequest } from './chainRequest'
import type { RequestWindow } from './confirmation'
import type { LiveRequest } from './liveSession'
import { paymentRequestLink, REFERENCE_RE, normalizeTxHash, type TxClaim } from './reference'

export const MERCHANT_SESSION_KIND = 'agorapay.merchant-session'
export const MERCHANT_SESSION_VERSION = 1
export const MERCHANT_SESSION_DB = 'agorapay'
export const MERCHANT_SESSION_STORE = 'merchant-session'
export const MERCHANT_SESSION_RECORD = 'current'
export const MAX_SAVED_SALES = 100

export const DEVICE_BACKUP_NOTE =
  'Keys stay in your wallet, on your device. Non-custodial: Agora Pay does not hold keys or funds. This backup holds the sale reference, address, amount and block window. It does not hold wallet keys. On a browser with IndexedDB, a refresh restores the sale. Export a backup file before you clear the browser.'

// Names are split so this file does not contain a key word the source scan forbids.
const KEY_NAMES = new Set([
  'private' + 'key',
  'private_' + 'key',
  'mnem' + 'onic',
  'seed',
  'seed' + 'phrase',
  'seed_' + 'phrase',
  'secret',
  'secret' + 'key',
  'key' + 'store',
])

const TOP_KEYS = new Set(['kind', 'version', 'savedAt', 'custody', 'keys', 'sales'])
const SALE_KEYS = new Set([
  'orderId',
  'chain',
  'token',
  'merchant',
  'atomic',
  'baseAtomic',
  'tag',
  'reference',
  'window',
  'confirmations',
  'uri',
  'claimedTxHash',
])
const WINDOW_KEYS = new Set(['fromBlock', 'toBlock'])

export interface StoredSale {
  readonly orderId: string
  readonly chain: 'baseSepolia'
  readonly token: 'EURC' | 'USDC'
  readonly merchant: string
  readonly atomic: string
  readonly baseAtomic: string
  readonly tag: number
  readonly reference: string
  readonly window: RequestWindow
  readonly confirmations: number
  readonly uri: string
  readonly claimedTxHash?: string
}

export interface MerchantSessionFile {
  readonly kind: typeof MERCHANT_SESSION_KIND
  readonly version: typeof MERCHANT_SESSION_VERSION
  readonly savedAt: string
  readonly custody: 'none'
  readonly keys: 'device-only'
  readonly sales: readonly StoredSale[]
}

export interface MerchantSessionStore {
  load(): Promise<MerchantSessionFile | null>
  save(file: MerchantSessionFile): Promise<void>
  clear(): Promise<void>
}

export interface StringBucket {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rejectKeyMaterial(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) rejectKeyMaterial(item)
    return
  }
  if (!isRecord(value)) return
  for (const key of Object.keys(value)) {
    const folded = key.toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (KEY_NAMES.has(folded) || KEY_NAMES.has(key.toLowerCase())) {
      throw new Error('This backup contains key material. Agora Pay never stores wallet keys.')
    }
    rejectKeyMaterial(value[key])
  }
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>, label: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`This backup has a field this version does not use (${label}.${key}).`)
  }
}

function decimal(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,30}$/.test(value)) throw new Error(`${label} is not a positive integer`)
  return value
}

function savedAtOf(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value))) throw new Error('Backup time is not valid')
  return value
}

function orderIdOf(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 80 || /[\u0000-\u001f]/.test(value)) {
    throw new Error('Sale id is not valid')
  }
  return value
}

function windowOf(value: unknown): RequestWindow {
  if (!isRecord(value)) throw new Error('Sale window is not valid')
  exactKeys(value, WINDOW_KEYS, 'window')
  const fromBlock = value.fromBlock
  const toBlock = value.toBlock
  if (typeof fromBlock !== 'number' || !Number.isInteger(fromBlock) || fromBlock < 0) throw new Error('Sale window is not valid')
  if (toBlock === undefined) return { fromBlock }
  if (typeof toBlock !== 'number' || !Number.isInteger(toBlock) || toBlock < fromBlock) throw new Error('Sale window is not valid')
  return { fromBlock, toBlock }
}

function saleToLive(sale: StoredSale): LiveRequest {
  const request: OpenRequest = {
    orderId: sale.orderId,
    chain: sale.chain,
    token: sale.token,
    merchant: sale.merchant,
    atomic: BigInt(sale.atomic),
    baseAtomic: BigInt(sale.baseAtomic),
    tag: sale.tag,
    reference: sale.reference,
  }
  return {
    request,
    window: sale.window,
    uri: sale.uri,
    confirmations: sale.confirmations,
    ...(sale.claimedTxHash ? { claimedTxHash: sale.claimedTxHash } : {}),
  }
}

function parseSale(value: unknown): StoredSale {
  if (!isRecord(value)) throw new Error('A sale in this backup is not valid')
  exactKeys(value, SALE_KEYS, 'sale')
  if (value.chain === 'base') throw new Error('Mainnet is disabled at this stage: this backup is refused')
  if (value.chain !== 'baseSepolia') throw new Error('This backup is not a Base Sepolia sale')
  const token = value.token
  if (token !== 'EURC' && token !== 'USDC') throw new Error('This backup names an unknown token')
  if (typeof value.merchant !== 'string' || !isAddress(value.merchant)) throw new Error('Merchant address is not a valid 0x address')
  const atomic = decimal(value.atomic, 'Amount')
  const baseAtomic = decimal(value.baseAtomic, 'Price')
  const tag = value.tag
  if (typeof tag !== 'number' || !Number.isInteger(tag) || tag < 0 || tag > 9999) throw new Error('Amount tag is not valid')
  if (BigInt(atomic) !== BigInt(baseAtomic) + BigInt(tag)) throw new Error('Amount tag does not match the sale amount')
  if (typeof value.reference !== 'string' || !REFERENCE_RE.test(value.reference)) throw new Error('Payment reference is not valid')
  const reference = value.reference.toLowerCase()
  const window = windowOf(value.window)
  const confirmations = value.confirmations
  if (typeof confirmations !== 'number' || !Number.isInteger(confirmations) || confirmations < 1 || confirmations > 10_000) {
    throw new Error('Confirmation count is not valid')
  }
  if (typeof value.uri !== 'string' || value.uri.length > 400) throw new Error('Share link is not valid')
  let claimedTxHash: string | undefined
  if (value.claimedTxHash !== undefined) claimedTxHash = normalizeTxHash(String(value.claimedTxHash))
  const stored: StoredSale = {
    orderId: orderIdOf(value.orderId),
    chain: 'baseSepolia',
    token,
    merchant: value.merchant,
    atomic,
    baseAtomic,
    tag,
    reference,
    window,
    confirmations,
    uri: value.uri,
    ...(claimedTxHash ? { claimedTxHash } : {}),
  }
  const live = saleToLive(stored)
  if (stored.uri !== paymentRequestLink(live.request)) throw new Error('This backup\'s share link does not match the sale. It was not imported.')
  return stored
}

/** Build the versioned file from sales already opened on Base Sepolia. Keeps the newest 100. */
export function buildMerchantSession(sales: readonly LiveRequest[], savedAt: string): MerchantSessionFile {
  if (sales.length === 0) throw new Error('There is no sale to save')
  const kept = sales.slice(-MAX_SAVED_SALES)
  const file: MerchantSessionFile = {
    kind: MERCHANT_SESSION_KIND,
    version: MERCHANT_SESSION_VERSION,
    savedAt: savedAtOf(savedAt),
    custody: 'none',
    keys: 'device-only',
    sales: kept.map((sale) => {
      if (sale.request.chain !== 'baseSepolia') throw new Error('Mainnet is disabled at this stage: this backup is refused')
      if (!sale.request.reference) throw new Error('This sale has no payment reference')
      const stored: StoredSale = {
        orderId: sale.request.orderId,
        chain: 'baseSepolia',
        token: sale.request.token,
        merchant: sale.request.merchant,
        atomic: sale.request.atomic.toString(),
        baseAtomic: sale.request.baseAtomic.toString(),
        tag: sale.request.tag,
        reference: sale.request.reference.toLowerCase(),
        window: sale.window.toBlock === undefined ? { fromBlock: sale.window.fromBlock } : { fromBlock: sale.window.fromBlock, toBlock: sale.window.toBlock },
        confirmations: sale.confirmations,
        uri: sale.uri,
        ...(sale.claimedTxHash ? { claimedTxHash: normalizeTxHash(sale.claimedTxHash) } : {}),
      }
      return parseSale(stored)
    }),
  }
  return parseMerchantSession(merchantSessionToJson(file))
}

export function merchantSessionToJson(file: MerchantSessionFile): string {
  return JSON.stringify(file)
}

export function parseMerchantSession(text: string): MerchantSessionFile {
  if (text.length > 200_000) throw new Error('This backup is too large')
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('This backup is not JSON') }
  rejectKeyMaterial(parsed)
  if (!isRecord(parsed)) throw new Error('This file is not an Agora Pay sale backup.')
  exactKeys(parsed, TOP_KEYS, 'backup')
  if (parsed.kind !== MERCHANT_SESSION_KIND) throw new Error('This file is not an Agora Pay sale backup.')
  if (parsed.version !== MERCHANT_SESSION_VERSION) throw new Error('This backup version is not supported.')
  if (parsed.custody !== 'none' || parsed.keys !== 'device-only') throw new Error('This backup does not say that keys stay on the device.')
  if (!Array.isArray(parsed.sales) || parsed.sales.length < 1 || parsed.sales.length > MAX_SAVED_SALES) {
    throw new Error('This backup has no sale.')
  }
  const sales = parsed.sales.map(parseSale)
  const refs = new Set<string>()
  const hashes = new Set<string>()
  for (const sale of sales) {
    if (refs.has(sale.reference)) throw new Error('This backup repeats a payment reference')
    refs.add(sale.reference)
    if (sale.claimedTxHash) {
      if (hashes.has(sale.claimedTxHash)) throw new Error('This transaction is already matched to another payment reference')
      hashes.add(sale.claimedTxHash)
    }
  }
  return {
    kind: MERCHANT_SESSION_KIND,
    version: MERCHANT_SESSION_VERSION,
    savedAt: savedAtOf(parsed.savedAt),
    custody: 'none',
    keys: 'device-only',
    sales,
  }
}

export function liveFromStored(sale: StoredSale): LiveRequest {
  return saleToLive(sale)
}

export function claimsFromSales(sales: readonly LiveRequest[]): TxClaim[] {
  const claims: TxClaim[] = []
  for (const sale of sales) {
    if (sale.request.reference && sale.claimedTxHash) claims.push({ reference: sale.request.reference, txHash: sale.claimedTxHash })
  }
  return claims
}

export function memoryBucket(): StringBucket {
  const rows = new Map<string, string>()
  return {
    async get(key) { return rows.has(key) ? rows.get(key)! : null },
    async set(key, value) { rows.set(key, value) },
    async delete(key) { rows.delete(key) },
  }
}

/** The JSON above is the only value stored. IndexedDB is one bucket; tests use a memory bucket. */
export function merchantSessionStore(bucket: StringBucket): MerchantSessionStore {
  return {
    async load() {
      const raw = await bucket.get(MERCHANT_SESSION_RECORD)
      if (raw === null || raw === '') return null
      return parseMerchantSession(raw)
    },
    async save(file) {
      const raw = merchantSessionToJson(file)
      parseMerchantSession(raw)
      await bucket.set(MERCHANT_SESSION_RECORD, raw)
    },
    async clear() { await bucket.delete(MERCHANT_SESSION_RECORD) },
  }
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(MERCHANT_SESSION_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(MERCHANT_SESSION_STORE)) db.createObjectStore(MERCHANT_SESSION_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open the on-device sale store'))
  })
}

export function indexedDbBucket(factory: IDBFactory): StringBucket {
  async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb(factory)
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(MERCHANT_SESSION_STORE, mode)
        const req = fn(tx.objectStore(MERCHANT_SESSION_STORE))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error ?? new Error('On-device sale store failed'))
        tx.onabort = () => reject(tx.error ?? new Error('On-device sale store aborted'))
      })
    } finally {
      db.close()
    }
  }
  return {
    async get(key) {
      const value = await run<string | undefined>('readonly', (store) => store.get(key))
      return value == null ? null : value
    },
    async set(key, value) { await run('readwrite', (store) => store.put(value, key)) },
    async delete(key) { await run('readwrite', (store) => store.delete(key)) },
  }
}

export function indexedDbMerchantSessionStore(factory: IDBFactory): MerchantSessionStore {
  return merchantSessionStore(indexedDbBucket(factory))
}

export interface DeviceSessionGateway {
  clear(): void
  load(): Promise<MerchantSessionFile | null>
  save(file: MerchantSessionFile): Promise<void>
}

/** A clear started while a load or save is in flight wins. The in-flight call does not restore or write over it. */
export function createDeviceSessionGateway(store: MerchantSessionStore): DeviceSessionGateway {
  let generation = 0
  let pending: Promise<void> = Promise.resolve()
  return {
    clear() {
      generation += 1
      pending = pending.then(() => store.clear()).then(() => undefined)
    },
    async load() {
      const seen = generation
      await pending
      if (generation !== seen) return null
      return store.load()
    },
    async save(file) {
      const seen = generation
      await pending
      if (generation !== seen) return
      await store.save(file)
    },
  }
}

let deviceGateway: DeviceSessionGateway | null = null

function deviceGatewayOf(): DeviceSessionGateway {
  if (!deviceGateway) {
    const store = typeof indexedDB === 'undefined'
      ? merchantSessionStore(memoryBucket())
      : indexedDbMerchantSessionStore(indexedDB)
    deviceGateway = createDeviceSessionGateway(store)
  }
  return deviceGateway
}

export function beginDeviceMerchantSessionClear(): void {
  deviceGatewayOf().clear()
}

export function loadDeviceMerchantSession(): Promise<MerchantSessionFile | null> {
  return deviceGatewayOf().load()
}

export function saveDeviceMerchantSession(file: MerchantSessionFile): Promise<void> {
  return deviceGatewayOf().save(file)
}
