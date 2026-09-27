import { describe, expect, it } from 'vitest'
import { calculateQuote, completePayment, createPaymentRequest } from './payments'

describe('calculateQuote', () => {
  it('quotes USDC into EUR with transparent network and conversion fees', () => {
    const quote = calculateQuote('USDC', 12.5)
    expect(quote).toEqual({
      asset: 'USDC',
      eurAmount: 12.5,
      rate: 0.92,
      sourceAmount: 13.59,
      conversionFee: 0.07,
      networkFee: 0,
      totalSourceAmount: 13.66,
    })
  })

  it('does not charge conversion on EURC', () => {
    const quote = calculateQuote('EURC', 20)
    expect(quote.rate).toBe(1)
    expect(quote.conversionFee).toBe(0)
    expect(quote.totalSourceAmount).toBe(20)
  })

  it('rejects non-positive or non-finite amounts', () => {
    expect(() => calculateQuote('EURC', 0)).toThrow('Amount must be greater than zero')
    expect(() => calculateQuote('USDC', Number.NaN)).toThrow('Amount must be greater than zero')
  })
})

describe('payment lifecycle', () => {
  it('creates a pending request and completes it with a receipt', () => {
    const request = createPaymentRequest(8.4, 'SEPA_INSTANT', () => 'req-123')
    expect(request).toMatchObject({ id: 'req-123', amount: 8.4, settlement: 'SEPA_INSTANT', status: 'pending' })

    const receipt = completePayment(request, 'EURC', () => 'rcpt-123', new Date('2026-09-27T10:30:00Z'))
    expect(receipt).toMatchObject({
      id: 'rcpt-123',
      requestId: 'req-123',
      amount: 8.4,
      asset: 'EURC',
      settlement: 'SEPA_INSTANT',
      status: 'settled',
      createdAt: '2026-09-27T10:30:00.000Z',
    })
  })

  it('rejects completing an already completed request', () => {
    const request = { ...createPaymentRequest(5, 'EUR_STABLECOIN'), status: 'completed' as const }
    expect(() => completePayment(request, 'EURC')).toThrow('Payment request is not pending')
  })
})
