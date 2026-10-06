import { describe, expect, it } from 'vitest'
import type { LiveRequest } from './liveSession'
import { paymentRequestLink } from './reference'
import {
  DEVICE_BACKUP_NOTE,
  MAX_SAVED_SALES,
  MERCHANT_SESSION_RECORD,
  buildMerchantSession,
  createDeviceSessionGateway,
  indexedDbMerchantSessionStore,
  liveFromStored,
  memoryBucket,
  merchantSessionStore,
  merchantSessionToJson,
  parseMerchantSession,
} from './merchantSession'

const MERCHANT = '0x1111111111111111111111111111111111111111'
const REFERENCE = '0x' + 'ab'.repeat(32)
const WHEN = '2026-10-06T12:00:00.000Z'

function sale(over: Partial<LiveRequest['request']> = {}): LiveRequest {
  const request = {
    orderId: 'live-1',
    chain: 'baseSepolia' as const,
    token: 'EURC' as const,
    merchant: MERCHANT,
    atomic: 1_000_042n,
    baseAtomic: 1_000_000n,
    tag: 42,
    reference: REFERENCE,
    ...over,
  }
  return { request, window: { fromBlock: 47_773_336, toBlock: 47_775_136 }, uri: paymentRequestLink(request), confirmations: 12 }
}

describe('merchant sale backup', () => {
  it('round-trips a Sepolia sale to JSON without keys and restores the reference and window', () => {
    const live = sale()
    const file = buildMerchantSession([live], WHEN)
    const json = merchantSessionToJson(file)
    expect(json).not.toMatch(/privateKey|mnemonic|seedPhrase|keystore/i)
    expect(json).toContain('"custody":"none"')
    expect(json).toContain('"keys":"device-only"')
    expect(DEVICE_BACKUP_NOTE).toMatch(/Keys stay in your wallet, on your device/)
    expect(DEVICE_BACKUP_NOTE).toMatch(/Non-custodial/)
    expect(DEVICE_BACKUP_NOTE).toMatch(/does not hold wallet keys/)
    const back = parseMerchantSession(json)
    const again = liveFromStored(back.sales[0])
    expect(again.request.reference).toBe(REFERENCE)
    expect(again.request.atomic).toBe(live.request.atomic)
    expect(again.request.baseAtomic).toBe(live.request.baseAtomic)
    expect(again.window).toEqual(live.window)
    expect(again.uri).toBe(live.uri)
    expect(again.confirmations).toBe(12)
    expect(again.claimedTxHash).toBeUndefined()
  })

  it('refuses a mainnet sale and a backup that contains key material', () => {
    const live = sale()
    expect(() => buildMerchantSession([{ ...live, request: { ...live.request, chain: 'base' } }], WHEN)).toThrow(/Mainnet is disabled/)
    const tampered = JSON.parse(merchantSessionToJson(buildMerchantSession([live], WHEN))) as { sales: Array<Record<string, unknown>> }
    tampered.sales[0].mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    expect(() => parseMerchantSession(JSON.stringify(tampered))).toThrow(/key material/)
    const nested = JSON.parse(merchantSessionToJson(buildMerchantSession([live], WHEN))) as { sales: Array<Record<string, unknown>> }
    nested.sales[0].window = { fromBlock: 1, privateKey: '0x' + '11'.repeat(32) }
    expect(() => parseMerchantSession(JSON.stringify(nested))).toThrow(/key material/)
  })

  it('refuses a backup whose share link does not match the sale', () => {
    const live = sale()
    const tampered = JSON.parse(merchantSessionToJson(buildMerchantSession([live], WHEN))) as { sales: Array<{ uri: string }> }
    tampered.sales[0].uri = tampered.sales[0].uri.replace(/uint256=\d+/, 'uint256=1')
    expect(() => parseMerchantSession(JSON.stringify(tampered))).toThrow(/share link does not match/)
  })

  it('saves, reloads and clears the same backup JSON', async () => {
    const bucket = memoryBucket()
    const store = merchantSessionStore(bucket)
    expect(await store.load()).toBeNull()
    const file = buildMerchantSession([sale()], WHEN)
    await store.save(file)
    const raw = await bucket.get(MERCHANT_SESSION_RECORD)
    expect(raw).toBe(merchantSessionToJson(file))
    const loaded = await store.load()
    expect(loaded?.sales[0].reference).toBe(REFERENCE)
    expect(loaded?.sales[0].window).toEqual({ fromBlock: 47_773_336, toBlock: 47_775_136 })
    await store.clear()
    expect(await store.load()).toBeNull()
  })

  it('IndexedDB store saves, reloads and clears the same backup JSON', async () => {
    const store = indexedDbMerchantSessionStore(fakeIndexedDB())
    const bound = { ...sale(), claimedTxHash: '0x' + 'cd'.repeat(32) }
    const file = buildMerchantSession([bound], WHEN)
    await store.save(file)
    const loaded = await store.load()
    expect(loaded?.sales).toHaveLength(1)
    expect(loaded?.sales[0].claimedTxHash).toBe(bound.claimedTxHash)
    expect(liveFromStored(loaded!.sales[0]).request.atomic).toBe(bound.request.atomic)
    await store.clear()
    expect(await store.load()).toBeNull()
  })

  it('a device clear wins over a load that has not finished', async () => {
    const store = merchantSessionStore(memoryBucket())
    const gateway = createDeviceSessionGateway(store)
    await gateway.save(buildMerchantSession([sale()], WHEN))
    const loading = gateway.load()
    gateway.clear()
    expect(await loading).toBeNull()
    expect(await gateway.load()).toBeNull()
    const saving = gateway.save(buildMerchantSession([sale()], WHEN))
    gateway.clear()
    await saving
    expect(await gateway.load()).toBeNull()
  })

  it('keeps only the newest saved sales', () => {
    const sales = Array.from({ length: MAX_SAVED_SALES + 5 }, (_, i) => {
      const reference = '0x' + i.toString(16).padStart(64, '0')
      return sale({ orderId: `live-${i}`, reference, tag: (i % 9999) + 1, atomic: 1_000_000n + BigInt((i % 9999) + 1) })
    })
    const file = buildMerchantSession(sales, WHEN)
    expect(file.sales).toHaveLength(MAX_SAVED_SALES)
    expect(file.sales[0].orderId).toBe('live-5')
    expect(file.sales.at(-1)?.orderId).toBe(`live-${MAX_SAVED_SALES + 4}`)
  })
})

/** Just enough of IndexedDB for one object store: open, get, put, delete. */
function fakeIndexedDB(): IDBFactory {
  const databases = new Map<string, Map<string, Map<string, unknown>>>()
  const factory = {
    open(name: string, version: number) {
      const request = eventRequest()
      queueMicrotask(() => {
        let db = databases.get(name)
        const upgrade = !db || version > 1 && !db
        if (!db) {
          db = new Map()
          databases.set(name, db)
        }
        const database = databaseHandle(db)
        request.result = database
        if (!db.has('merchant-session') || upgrade) request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request as IDBOpenDBRequest
    },
  }
  return factory as IDBFactory
}

function databaseHandle(db: Map<string, Map<string, unknown>>): IDBDatabase {
  const names = { contains: (name: string) => db.has(name) }
  return {
    objectStoreNames: names,
    createObjectStore(name: string) {
      db.set(name, new Map())
      return {} as IDBObjectStore
    },
    transaction(name: string) {
      const rows = db.get(name)
      if (!rows) throw new Error('missing store')
      const tx = eventTransaction()
      const store = {
        get: (key: string) => done(rows.get(String(key))),
        put: (value: unknown, key: string) => { rows.set(String(key), value); return done(key) },
        delete: (key: string) => { rows.delete(String(key)); return done(undefined) },
      }
      const transaction = tx as { oncomplete: (() => void) | null; objectStore: () => typeof store }
      transaction.objectStore = () => store
      queueMicrotask(() => transaction.oncomplete?.())
      return transaction as unknown as IDBTransaction
    },
    close() {},
  } as unknown as IDBDatabase
}

function eventRequest(): { result: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null; onupgradeneeded: (() => void) | null } {
  return { result: undefined, onsuccess: null, onerror: null, onupgradeneeded: null }
}

function eventTransaction() {
  return { oncomplete: null as (() => void) | null, onerror: null as (() => void) | null, onabort: null as (() => void) | null }
}

function done(result: unknown) {
  return { result, onsuccess: null, onerror: null }
}
