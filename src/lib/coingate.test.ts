import { describe, it, expect, vi } from 'vitest'
import { buildCreateOrderRequest, createEurPayoutOrder, validateEurPayout, CoinGateValidationError, COINGATE_API, isSettled, isTerminalFailure } from './coingate'

const base = { orderId: 'AGP-1', priceEur: 12.5, title: 'Stall order #1', description: '2 x coffee', merchantInEu: true }

describe('CoinGate EUR payout adapter (dry-run)', () => {
  it('builds a sandbox Create Order request settling in EUR', () => {
    const r = buildCreateOrderRequest(base)
    expect(r.url).toBe(`${COINGATE_API.sandbox}/orders`)
    expect(r.body).toMatchObject({ price_amount: '12.50', price_currency: 'EUR', receive_currency: 'EUR', order_id: 'AGP-1' })
    expect(r.headers.Authorization).toBe('Token DRY_RUN')
  })
  it('includes optional urls only when given', () => {
    expect(buildCreateOrderRequest(base).body.callback_url).toBeUndefined()
    expect(buildCreateOrderRequest({ ...base, callbackUrl: 'https://x/cb' }).body.callback_url).toBe('https://x/cb')
  })
  it('dry-run never calls the network', async () => {
    const f = vi.fn()
    const o = await createEurPayoutOrder(base, { fetchImpl: f as unknown as typeof fetch })
    expect(f).not.toHaveBeenCalled()
    expect(o).toMatchObject({ dryRun: true, status: 'new', receive_currency: 'EUR' })
  })
  it('stays dry-run when dryRun:false but no token', async () => {
    const f = vi.fn()
    const o = await createEurPayoutOrder(base, { dryRun: false, fetchImpl: f as unknown as typeof fetch })
    expect(f).not.toHaveBeenCalled(); expect(o.dryRun).toBe(true)
  })
  it('live sandbox call posts form-encoded body (mocked fetch)', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 9, status: 'new', order_id: 'AGP-1', price_amount: '12.5', price_currency: 'EUR', receive_currency: 'EUR', payment_url: 'https://sandbox/invoice/9' }), { status: 200 }))
    const o = await createEurPayoutOrder(base, { dryRun: false, token: 'sbx', fetchImpl: f as unknown as typeof fetch })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${COINGATE_API.sandbox}/orders`)
    expect(String(init.body)).toContain('receive_currency=EUR')
    expect((init.headers as Record<string, string>).Authorization).toBe('Token sbx')
    expect(o).toMatchObject({ id: 9, dryRun: false })
  })
  it('surfaces CoinGate 422 errors', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ message: 'Order is not valid', errors: ["Price can't be blank"] }), { status: 422 }))
    await expect(createEurPayoutOrder(base, { dryRun: false, token: 't', fetchImpl: f as unknown as typeof fetch })).rejects.toThrow(/422.*Price/)
  })
  it('rejects invalid input', () => {
    expect(validateEurPayout({ ...base, priceEur: 0, title: 'x', orderId: '' })).toHaveLength(3)
    expect(() => buildCreateOrderRequest({ ...base, priceEur: -1 })).toThrow(CoinGateValidationError)
  })
  it('refuses USDT / privacy-coin settlement for EU merchants, allows for non-EU', () => {
    expect(() => buildCreateOrderRequest({ ...base, receiveCurrency: 'USDT' })).toThrow(/USDT/)
    expect(() => buildCreateOrderRequest({ ...base, receiveCurrency: 'XMR' })).toThrow()
    expect(buildCreateOrderRequest({ ...base, merchantInEu: false, receiveCurrency: 'USDT' }).body.receive_currency).toBe('USDT')
  })
  it('status helpers', () => {
    expect(isSettled('paid')).toBe(true); expect(isSettled('pending')).toBe(false)
    expect(isTerminalFailure('expired')).toBe(true); expect(isTerminalFailure('paid')).toBe(false)
  })
})
