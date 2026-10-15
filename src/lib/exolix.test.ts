import { describe, expect, it, vi } from 'vitest'
import { EXOLIX_API, PAY_IN_LEGS, createOrder, liveRate, orderStatus, orderStatusLabel, SEED_PAYOUT_LEGS, fetchPayoutCurrencies, fixedQuote, mergeLegs, payoutAmountFor, searchLegs, usdPrice, createFixedOrder, sendAmountFor } from './exolix'
import { ASSET_CATALOG } from './anyAsset'

const json = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

describe('exolix swap adapter', () => {
  it('maps every crypto catalog asset to a pay-in leg', () => {
    for (const a of ASSET_CATALOG.filter((x) => x.kind === 'crypto')) expect(PAY_IN_LEGS[a.id], a.id).toBeDefined()
  })
  it('seeds payout legs across chains and searches them', () => {
    expect(SEED_PAYOUT_LEGS.map((l) => l.id)).toEqual(expect.arrayContaining(['usdc-sol', 'usdc-base', 'usdc-eth', 'btc-btc', 'eth-eth', 'sol-sol', 'ltc-ltc']))
    expect(searchLegs(SEED_PAYOUT_LEGS, 'solana').map((l) => l.id)).toEqual(expect.arrayContaining(['usdc-sol', 'sol-sol']))
    expect(mergeLegs(SEED_PAYOUT_LEGS, SEED_PAYOUT_LEGS)).toHaveLength(SEED_PAYOUT_LEGS.length)
  })
  it('loads the full Exolix currency list across pages', async () => {
    const page = (n: number) => ({ count: 3, data: n === 1 ? [{ code: 'BTC', name: 'Bitcoin', networks: [{ network: 'BTC', name: 'Bitcoin' }] }, { code: 'USDC', name: 'USD Coin', networks: [{ network: 'SOL', name: 'Solana' }, { network: 'BASE', name: 'Base' }] }] : [{ code: 'NOK', name: 'x', networks: [] }] })
    const f = vi.fn((u: string) => json(page(Number(new URL(u).searchParams.get('page')))))
    const legs = await fetchPayoutCurrencies(f as unknown as typeof fetch, 2)
    expect(legs.map((l) => l.id)).toEqual(['btc-btc', 'usdc-sol', 'usdc-base'])
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('prices stablecoins at 1 USD and other assets from a live route', async () => {
    expect(await usdPrice({ coin: 'USDC', network: 'SOL' })).toBe(1)
    expect(await usdPrice({ coin: 'BTC', network: 'BTC' }, (() => json({ rate: 80000 })) as unknown as typeof fetch)).toBe(80000)
    expect(payoutAmountFor(60, 80000)).toBeCloseTo(60 * 1.087 / 80000, 8)
    expect(payoutAmountFor(60, 1)).toBeCloseTo(65.22, 8)
  })
  it('gets a fixed-rate reverse quote and flags route minimums', async () => {
    const ok = await fixedQuote(PAY_IN_LEGS.xmr, { coin: 'BTC', network: 'BTC' }, 0.001, (() => json({ fromAmount: 0.15, toAmount: 0.001, minAmount: 0.09, withdrawMin: 0.0006 })) as unknown as typeof fetch)
    expect(ok).toMatchObject({ fromAmount: 0.15, belowMin: false })
    const low = await fixedQuote(PAY_IN_LEGS.btc, { coin: 'USDC', network: 'SOL' }, 9, (() => json({ fromAmount: 0.0001, toAmount: 0, minAmount: 0.0006, withdrawMin: 48 })) as unknown as typeof fetch)
    expect(low.belowMin).toBe(true)
  })
  it('creates a fixed order so the merchant receives an exact amount', async () => {
    const f = vi.fn(() => json({ id: 'fx', depositAddress: 'bc1dep', amount: 0.0008, coinFrom: { coinCode: 'BTC', network: 'BTC' }, amountTo: 60, coinTo: { coinCode: 'USDC' }, withdrawalAddress: 'So1', status: 'wait' }))
    await createFixedOrder(PAY_IN_LEGS.btc, { coin: 'USDC', network: 'SOL' }, 60, 'So1', f as unknown as typeof fetch)
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toMatchObject({ withdrawalAmount: 60, rateType: 'fixed', coinTo: 'USDC', networkTo: 'SOL' })
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
