import { describe, expect, it, vi } from 'vitest'
import { directQuote, nativeQuote, quoteAllRoutes, rankRoutes, THOR_ASSETS, MAYA_ASSETS, type RouteQuote } from './routes'

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response)
const USDC_SOL = { coin: 'USDC', network: 'SOL' }
const USDC_BASE = { coin: 'USDC', network: 'BASE' }
const BTC = { coin: 'BTC', network: 'BTC' }
const ETH = { coin: 'ETH', network: 'ETH' }

describe('routes', () => {
  it('uses a direct transfer with no minimum when pay-in equals payout', async () => {
    const d = directQuote(USDC_SOL, USDC_SOL, 9.13, 'So1merchant')!
    expect(d).toMatchObject({ route: 'direct', sendAmount: 9.13, receiveAmount: 9.13, minUsd: 0, ok: true, depositAddress: 'So1merchant' })
    const f = vi.fn()
    expect((await quoteAllRoutes({ from: USDC_SOL, to: USDC_SOL, receive: 9.13, fromUsd: 1, toUsd: 1 }, f as unknown as typeof fetch)).map((r) => r.route)).toEqual(['direct'])
    expect(f).not.toHaveBeenCalled()
    expect(directQuote(USDC_SOL, USDC_BASE, 1)).toBeNull()
  })
  it('maps core assets for THORChain and MAYAChain', () => {
    expect(THOR_ASSETS['BTC/BTC']).toBe('BTC.BTC')
    expect(THOR_ASSETS['USDT/TRX']).toMatch(/^TRON\.USDT/)
    expect(THOR_ASSETS['USDC/BASE']).toMatch(/^BASE\.USDC/)
    expect(MAYA_ASSETS['USDC/ARBITRUM']).toMatch(/^ARB\.USDC/)
  })
  it('reads a native quote with memo and recommended minimum (1e8 units)', async () => {
    const f = vi.fn(() => json({ expected_amount_out: '901000000', recommended_min_amount_in: '5100', inbound_address: 'bc1qvault', memo: '=:BASE.USDC:0xabc', expiry: 1 }))
    const q = (await nativeQuote('maya', BTC, { coin: 'USDC', network: 'ARBITRUM' }, 0.00011, 80000, '0xabc', f as unknown as typeof fetch))!
    expect(q).toMatchObject({ ok: true, receiveAmount: 9.01, minIn: 0.000051, depositAddress: 'bc1qvault', memo: '=:BASE.USDC:0xabc' })
    expect(q.minUsd).toBeCloseTo(4.08, 2)
    expect(String(f.mock.calls[0][0])).toContain('amount=11000')
  })
  it('marks native quotes below the recommended minimum as not usable', async () => {
    const q = (await nativeQuote('thor', BTC, USDC_BASE, 0.0001, 80000, '', (() => json({ expected_amount_out: '700000000', recommended_min_amount_in: '29622' })) as unknown as typeof fetch))!
    expect(q.ok).toBe(false)
  })
  it('returns null when a chain has no pool for the pair', async () => {
    expect(await nativeQuote('maya', { coin: 'XMR', network: 'XMR' }, USDC_BASE, 1, 500)).toBeNull()
  })
  it('surfaces halted trading as unusable', async () => {
    const q = (await nativeQuote('thor', { coin: 'SOL', network: 'SOL' }, USDC_BASE, 0.1, 100, '', (() => json({ error: 'trading is halted' })) as unknown as typeof fetch))!
    expect(q.ok).toBe(false)
    expect(q.note).toContain('halted')
  })
  it('ranks usable routes first, then lowest minimum', () => {
    const r = (route: RouteQuote['route'], ok: boolean, minUsd: number) => ({ route, ok, minUsd } as RouteQuote)
    expect(rankRoutes([r('exolix', false, 48), r('thor', true, 0.8), null, r('maya', true, 4)]).map((x) => x.route)).toEqual(['thor', 'maya', 'exolix'])
  })
  it('quotes all providers in parallel for a €8.40 ETH payment', async () => {
    const f = vi.fn((u: string) => u.includes('thorchain') ? json({ expected_amount_out: '900000000', recommended_min_amount_in: '34000' })
      : u.includes('exolix') ? json({ fromAmount: 0.0039, minAmount: 0.0202, withdrawMin: 0 }) : json({ error: 'no pool' }))
    const list = await quoteAllRoutes({ from: ETH, to: USDC_BASE, receive: 9.13, fromUsd: 2370, toUsd: 1 }, f as unknown as typeof fetch)
    expect(list[0]).toMatchObject({ route: 'thor', ok: true })
    expect(list.find((x) => x.route === 'exolix')?.ok).toBe(false)
  })
})
