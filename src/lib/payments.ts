export type Asset = 'EURC' | 'USDC'
export type Settlement = 'EUR_STABLECOIN' | 'SEPA_INSTANT'

export interface Quote {
  asset: Asset
  eurAmount: number
  rate: number
  sourceAmount: number
  conversionFee: number
  networkFee: number
  totalSourceAmount: number
}

export interface PaymentRequest {
  id: string
  amount: number
  settlement: Settlement
  status: 'pending' | 'completed'
  createdAt: string
}

export interface Receipt {
  id: string
  requestId: string
  amount: number
  asset: Asset
  settlement: Settlement
  status: 'settled'
  createdAt: string
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const id = () => crypto.randomUUID()

export function calculateQuote(asset: Asset, eurAmount: number): Quote {
  if (!Number.isFinite(eurAmount) || eurAmount <= 0) throw new Error('Amount must be greater than zero')
  const rate = asset === 'EURC' ? 1 : 0.92
  const sourceAmount = round(eurAmount / rate)
  const conversionFee = asset === 'EURC' ? 0 : round(sourceAmount * 0.005)
  return { asset, eurAmount: round(eurAmount), rate, sourceAmount, conversionFee, networkFee: 0, totalSourceAmount: round(sourceAmount + conversionFee) }
}

export function createPaymentRequest(amount: number, settlement: Settlement, makeId: () => string = id): PaymentRequest {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero')
  return { id: makeId(), amount: round(amount), settlement, status: 'pending', createdAt: new Date().toISOString() }
}

export function completePayment(request: PaymentRequest, asset: Asset, makeId: () => string = id, now = new Date()): Receipt {
  if (request.status !== 'pending') throw new Error('Payment request is not pending')
  return { id: makeId(), requestId: request.id, amount: request.amount, asset, settlement: request.settlement, status: 'settled', createdAt: now.toISOString() }
}
