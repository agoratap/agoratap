import { describe, expect, it, vi } from 'vitest'
import { EXOLIX_API, PAY_IN_LEGS, createOrder, liveRate, orderStatus, orderStatusLabel, payoutLegsFor, sendAmountFor } from './exolix'
import { ASSET_CATALOG } from './anyAsset'

const json = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

describe('exolix swap adapter', () => {
  it('maps every crypto catalog asset to a pay-in leg', () => {
    for (const a of ASSET_CATALOG.filter((x) => x.kind === 'crypto')) expect(PAY_IN_LEGS[a.id], a.id).toBeDefined()
  })
  it('never offers USDT or XMR payout to an EU merchant', () => {
    expect(payoutLegsFor(true).map((l) => l.coin)).not.toContain('USDT')
    expect(payoutLegsFor(true).map((l) => l.coin)).not.toContain('XMR')
    expect(payoutLegsFor(false).map((l) => l.coin)).toEqual(expect.arrayContaining(['USDT', 'XMR']))
  })
  it('reads a live float rate keyless', async () => {
    const f = vi.fn(() => json({ rate: 80000, minAmount: 0.0006, maxAmount: 10 }))
    const r = await liveRate(PAY_IN_LEGS.btc, { coin: 'USDC', network: 'BASE' }, 1, f as unknown as typeof fetch)
    expect(r.rate).toBe(80000)
    expect(String(f.mock.calls[0][0])).toContain(`${EXOLIX_API}/rate?coinFrom=BTC&networkFrom=BTC&coinTo=USDC&networkTo=BASE`)
  })
  it('re-probes at the route minimum when the amount is too small', async () => {
    const f = vi.fn().mockReturnValueOnce(json({ toAmount: 0, minAmount: 220 })).mockReturnValueOnce(json({ rate: 0.6, minAmount: 220 }))
    expect((await liveRate(PAY_IN_LEGS.ada, { coin: 'USDC', network: 'BASE' }, 1, f as unknown as typeof fetch)).rate).toBe(0.6)
  })
  it('surfaces unavailable pairs', async () => {
    await expect(liveRate(PAY_IN_LEGS.xrp, { coin: 'USDC', network: 'BASE' }, 1, (() => json({ error: 'Such exchange pair is not available' })) as unknown as typeof fetch)).rejects.toThrow('not available')
  })
  it('sizes the send amount with a slippage buffer', () => {
    expect(sendAmountFor(100, 500)).toBeCloseTo(0.204, 6)
  })
  it('creates an order to the merchant address and parses deposit details', async () => {
    const f = vi.fn(() => json({ id: 'ex1', depositAddress: '84abc', amount: 0.2, coinFrom: { coinCode: 'XMR', network: 'XMR' }, amountTo: 100, coinTo: { coinCode: 'USDC' }, withdrawalAddress: '0xmerchant', status: 'wait' }))
    const o = await createOrder(PAY_IN_LEGS.xmr, { coin: 'USDC', network: 'BASE' }, 0.2, ' 0xmerchant ', f as unknown as typeof fetch)
    expect(o).toMatchObject({ id: 'ex1', depositAddress: '84abc', amount: 0.2, coinFrom: 'XMR', coinTo: 'USDC', status: 'wait' })
    const sent = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(sent).toMatchObject({ coinFrom: 'XMR', coinTo: 'USDC', networkTo: 'BASE', withdrawalAddress: '0xmerchant', rateType: 'float' })
  })
  it('rejects an empty payout address and API errors', async () => {
    await expect(createOrder(PAY_IN_LEGS.btc, PAY_IN_LEGS.eth, 1, ' ')).rejects.toThrow('address')
    await expect(createOrder(PAY_IN_LEGS.btc, PAY_IN_LEGS.eth, 1, 'x', (() => json({ error: 'Invalid withdrawal address' }, false, 422)) as unknown as typeof fetch)).rejects.toThrow('Invalid withdrawal address')
  })
  it('polls order status', async () => {
    const o = await orderStatus('ex1', (() => json({ id: 'ex1', depositAddress: 'd', amount: 1, coinFrom: 'BTC', amountTo: 2, coinTo: 'USDC', withdrawalAddress: 'w', status: 'success' })) as unknown as typeof fetch)
    expect(orderStatusLabel(o.status)).toBe('Merchant paid')
  })
})
