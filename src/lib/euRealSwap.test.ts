import { describe, expect, it, vi } from 'vitest'
import { EU_SWAP_NOT_AVAILABLE, EuRealSwapBlocked, euSwapComingMessage } from './anyAsset'
import { PAY_IN_LEGS, createFixedOrder, createOrder } from './exolix'
import { nativeQuote, quoteAllRoutes } from './routes'

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response)
const orderBody = { id: 'ex1', depositAddress: 'bc1dep', amount: 0.01, coinFrom: { coinCode: 'BTC', network: 'BTC' }, amountTo: 60, coinTo: { coinCode: 'USDC' }, withdrawalAddress: 'So1', status: 'wait' }
const thorBody = { expected_amount_out: '900000000', recommended_min_amount_in: '1000', inbound_address: 'bc1qvault', memo: '=:BASE.USDC:0xabc', expiry: 1 }
const BTC = PAY_IN_LEGS.btc
const USDC = { coin: 'USDC', network: 'BASE' }
const panel = (import.meta.glob('../RealSwap.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../RealSwap.tsx']

describe('EU real-swap perimeter', () => {
  it('refuses an Exolix order and a THOR or MAYA route for an EU merchant before any provider call', async () => {
    const f = vi.fn(() => json(orderBody))
    await expect(createOrder(BTC, USDC, 0.01, 'So1', f as unknown as typeof fetch, true)).rejects.toBeInstanceOf(EuRealSwapBlocked)
    await expect(createFixedOrder(BTC, USDC, 60, 'So1', f as unknown as typeof fetch, true)).rejects.toThrow(euSwapComingMessage('USDC'))
    await expect(nativeQuote('thor', BTC, USDC, 0.01, 80000, '0xabc', f as unknown as typeof fetch, true)).rejects.toBeInstanceOf(EuRealSwapBlocked)
    await expect(nativeQuote('maya', BTC, USDC, 0.01, 80000, '0xabc', f as unknown as typeof fetch, true)).rejects.toBeInstanceOf(EuRealSwapBlocked)
    const listed = await quoteAllRoutes({ from: BTC, to: USDC, receive: 9, fromUsd: 80000, toUsd: 1, merchantInEu: true }, f as unknown as typeof fetch)
    expect(listed.map((r) => r.route)).toEqual(['maya', 'thor', 'exolix'])
    expect(listed.every((r) => r.ok === false && r.note === EU_SWAP_NOT_AVAILABLE)).toBe(true)
    const direct = await quoteAllRoutes({ from: USDC, to: USDC, receive: 9, fromUsd: 1, toUsd: 1, merchantInEu: true, destination: '0xmerchant' }, f as unknown as typeof fetch)
    expect(direct[0]).toMatchObject({ route: 'direct', ok: true, depositAddress: '0xmerchant' })
    expect(direct.slice(1).every((r) => r.ok === false && r.note === EU_SWAP_NOT_AVAILABLE)).toBe(true)
    expect(f).not.toHaveBeenCalled()
  })

  it('still creates an Exolix order and a THOR or MAYA route for a non-EU merchant', async () => {
    const orders = vi.fn(() => json(orderBody))
    const created = await createOrder(BTC, USDC, 0.01, 'So1', orders as unknown as typeof fetch, false)
    const fixed = await createFixedOrder(BTC, USDC, 60, 'So1', orders as unknown as typeof fetch, false)
    expect(created.depositAddress).toBe('bc1dep')
    expect(fixed.id).toBe('ex1')
    expect(orders).toHaveBeenCalledTimes(2)
    const routes = vi.fn((u: string) => json(u.includes('exolix') ? { fromAmount: 0.01, minAmount: 0.001, withdrawMin: 0 } : thorBody))
    const thor = await nativeQuote('thor', BTC, USDC, 0.01, 80000, '0xabc', routes as unknown as typeof fetch, false)
    const maya = await nativeQuote('maya', BTC, { coin: 'USDC', network: 'ARBITRUM' }, 0.01, 80000, '0xabc', routes as unknown as typeof fetch, false)
    expect(thor).toMatchObject({ route: 'thor', ok: true, memo: '=:BASE.USDC:0xabc' })
    expect(maya).toMatchObject({ route: 'maya', ok: true })
    const list = await quoteAllRoutes({ from: BTC, to: USDC, receive: 9, fromUsd: 80000, toUsd: 1, merchantInEu: false }, routes as unknown as typeof fetch)
    expect(list.some((r) => r.route === 'thor' && r.ok)).toBe(true)
    expect(list.some((r) => r.route === 'exolix')).toBe(true)
    expect(routes.mock.calls.length).toBeGreaterThan(2)
  })

  it('the pay screen passes the merchant jurisdiction into the order and route guards', () => {
    expect(panel).toContain('createFixedOrder(from, payout, routes.receive, address, fetch, merchantInEu)')
    expect(panel).toContain('nativeQuote(chosen.route, from, payout, chosen.sendAmount, routes.fromUsd, address.trim(), fetch, merchantInEu)')
    expect(panel).toContain('merchantInEu: true')
    expect(panel).toContain('merchantInEu: false')
    expect(panel).toContain(EU_SWAP_NOT_AVAILABLE)
    expect(panel).toContain('euSwapComingMessage(payout.label)')
  })
})
