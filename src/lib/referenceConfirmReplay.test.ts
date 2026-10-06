import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createChainReader, TRANSFER_TOPIC, type FetchLike } from './chainReader'
import { CHAINS, toAtomicEurc } from './chainRequest'
import { describeState, bindLiveClaim, openLiveRequest, refreshLive, type LiveRequest } from './liveSession'
import type { PaymentState } from './confirmation'
import { createReference } from './reference'

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/reference-confirm-replay.json'), 'utf8')) as {
  merchant: string
  other: string
  payer: string
  eurAmount: number
  openHead: number
  ttlSeconds: number
  referenceFill: number
  frames: Array<{
    name: string
    head: number
    finalized: number | null
    bindTx?: number
    bindCase?: 'upper' | 'lower'
    previous?: string
    logs: Array<{ block: number; tx: number; value: 'exact' | 'other'; logIndex: number; to?: 'merchant' | 'other' }>
    expect: { status: string; via?: string; final?: boolean; confirmations?: number; claimMissed?: boolean; expired?: boolean; txCount?: number; line: string }
  }>
}

const TOKEN = CHAINS.baseSepolia.tokens.EURC
const pad = (a: string) => '0x' + '0'.repeat(24) + a.slice(2).toLowerCase()
const h = (n: number) => '0x' + n.toString(16).padStart(64, '0')

describe('reference confirm replay fixture', () => {
  it('walks bind to confirmed, and the edges around it, with no network and no ETH', async () => {
    const calls: string[] = []
    const state = { head: fixture.openHead, finalized: 900 as number | null, logs: [] as Record<string, unknown>[] }
    const fetchFn: FetchLike = async (_u, init) => {
      const body = JSON.parse(init.body) as { method: string; params: [{ fromBlock?: string; toBlock?: string } | string] }
      calls.push(body.method)
      let result: unknown
      if (body.method === 'eth_blockNumber') result = '0x' + state.head.toString(16)
      else if (body.method === 'eth_getBlockByNumber') result = state.finalized === null ? null : { number: '0x' + state.finalized.toString(16) }
      else if (body.method === 'eth_getLogs') {
        const q = body.params[0] as { fromBlock: string; toBlock: string }
        const from = parseInt(q.fromBlock, 16)
        const to = parseInt(q.toBlock, 16)
        result = state.logs.filter((l) => {
          const b = parseInt(String(l.blockNumber), 16)
          return b >= from && b <= to
        })
      } else if (body.method === 'eth_getTransactionReceipt') {
        const hash = String(body.params[0]).toLowerCase()
        const logs = state.logs.filter((l) => String(l.transactionHash).toLowerCase() === hash)
        result = logs.length === 0 ? null : { status: '0x1', logs }
      } else return { ok: true, status: 200, json: async () => ({ error: { code: -32601, message: 'method not allowed' } }) }
      return { ok: true, status: 200, json: async () => ({ result }) }
    }
    const reader = createChainReader({ fetchFn, rpcUrl: 'http://injected.invalid', maxRange: 5000, maxCalls: 80 })
    const live = await openLiveRequest(
      reader,
      {
        orderId: 'replay-sale',
        chain: 'baseSepolia',
        merchant: fixture.merchant,
        eurAmount: fixture.eurAmount,
        ttlSeconds: fixture.ttlSeconds,
        fillReference: (b) => b.fill(fixture.referenceFill),
      },
      [],
      () => 0,
    )
    expect(live.request.atomic).toBe(toAtomicEurc(fixture.eurAmount) + 1n)
    expect(live.request.reference).toBe(createReference((b) => b.fill(fixture.referenceFill)))
    expect(live.window).toEqual({ fromBlock: fixture.openHead, toBlock: fixture.openHead + 10 })

    const seen = new Map<string, PaymentState>()
    const boundFor = (frameBind: number | undefined, bindCase: 'upper' | 'lower' | undefined): LiveRequest => {
      if (frameBind === undefined) return live
      const hash = bindCase === 'upper' ? h(frameBind).toUpperCase() : h(frameBind)
      return bindLiveClaim(live, hash)
    }

    for (const frame of fixture.frames) {
      state.head = frame.head
      state.finalized = frame.finalized
      state.logs = frame.logs.map((log) => ({
        address: TOKEN,
        topics: [TRANSFER_TOPIC, pad(fixture.payer), pad(log.to === 'other' ? fixture.other : fixture.merchant)],
        data: '0x' + (log.value === 'exact' ? live.request.atomic : live.request.atomic - 1n).toString(16).padStart(64, '0'),
        blockNumber: '0x' + log.block.toString(16),
        logIndex: '0x' + log.logIndex.toString(16),
        transactionHash: h(log.tx),
        blockHash: h(9000 + log.tx + log.logIndex),
        removed: false,
      }))
      const previous = frame.previous ? seen.get(frame.previous) : undefined
      if (frame.previous && !previous) throw new Error(`missing previous frame ${frame.previous}`)
      const stateNow = await refreshLive(reader, boundFor(frame.bindTx, frame.bindCase), previous)
      seen.set(frame.name, stateNow)
      const line = describeState(stateNow)
      expect(stateNow.status, frame.name).toBe(frame.expect.status)
      expect(line, frame.name).toMatch(new RegExp(frame.expect.line))
      if (frame.expect.via) expect(stateNow).toMatchObject({ via: frame.expect.via })
      if (frame.expect.final !== undefined) expect(stateNow).toMatchObject({ final: frame.expect.final })
      if (frame.expect.confirmations !== undefined) expect(stateNow).toMatchObject({ confirmations: frame.expect.confirmations })
      if (frame.expect.claimMissed !== undefined) expect(stateNow).toMatchObject({ claimMissed: frame.expect.claimMissed })
      if (frame.expect.expired !== undefined) expect(stateNow).toMatchObject({ expired: frame.expect.expired })
      if (frame.expect.txCount !== undefined && stateNow.status === 'ambiguous') expect(stateNow.txHashes).toHaveLength(frame.expect.txCount)
      if (stateNow.status === 'pending' || stateNow.status === 'confirmed') {
        expect(stateNow.seen.txHash).toBe(h(frame.bindTx ?? 11))
        expect(stateNow.via).toBe('reference')
      }
    }

    const paymentHash = h(11)
    expect(() => bindLiveClaim(live, paymentHash)).not.toThrow()
    const other = await openLiveRequest(
      reader,
      { orderId: 'other-sale', chain: 'baseSepolia', merchant: fixture.merchant, eurAmount: fixture.eurAmount, fillReference: (b) => b.fill(0x22) },
      [live.request],
      () => 0,
    )
    expect(() => bindLiveClaim(other, paymentHash, [{ reference: live.request.reference!, txHash: paymentHash }])).toThrow(/another payment reference/)
    expect(calls.every((m) => m === 'eth_blockNumber' || m === 'eth_getLogs' || m === 'eth_getBlockByNumber' || m === 'eth_getTransactionReceipt')).toBe(true)
    expect(calls).not.toContain('eth_sendRawTransaction')
  })
})
