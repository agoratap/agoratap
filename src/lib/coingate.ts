/**
 * CoinGate adapter — EU merchant fiat (EUR) settlement through a licensed partner.
 * DRY-RUN BY DEFAULT: builds the exact Create Order request
 * (POST /api/v2/orders, https://developer.coingate.com/reference/create-order)
 * with receive_currency=EUR so the merchant is settled in euros by CoinGate,
 * and returns a simulated response. No network call, no account, no funds.
 * A live call only happens when dryRun === false AND a token is supplied, and
 * then only against the sandbox unless env === 'production' is set explicitly.
 */
import { payoutAllowed } from './anyAsset'

export const COINGATE_API = {
  sandbox: 'https://api-sandbox.coingate.com/api/v2',
  production: 'https://api.coingate.com/api/v2',
} as const

export type CoinGateEnv = keyof typeof COINGATE_API

export interface EurPayoutInput {
  orderId: string
  priceEur: number
  title: string
  description: string
  merchantInEu: boolean
  /** settlement currency, defaults to EUR (fiat bank payout by CoinGate) */
  receiveCurrency?: string
  callbackUrl?: string
  successUrl?: string
  cancelUrl?: string
}

export interface CoinGateRequest {
  url: string
  method: 'POST'
  headers: Record<string, string>
  body: Record<string, string>
}

export interface CoinGateOrder {
  id: number
  status: string
  order_id: string
  price_amount: string
  price_currency: string
  receive_currency: string
  payment_url: string
  dryRun: boolean
}

export class CoinGateValidationError extends Error {}

export function validateEurPayout(input: EurPayoutInput): string[] {
  const errors: string[] = []
  if (!input.orderId?.trim()) errors.push('orderId required')
  if (!(Number.isFinite(input.priceEur) && input.priceEur > 0)) errors.push('priceEur must be > 0')
  if (!input.title || input.title.length < 3 || input.title.length > 150) errors.push('title must be 3-150 chars')
  if (!input.description || input.description.length < 3 || input.description.length > 500) errors.push('description must be 3-500 chars')
  const rc = (input.receiveCurrency ?? 'EUR').toUpperCase()
  if (!payoutAllowed(rc, input.merchantInEu)) errors.push(`${rc} is not an allowed EU merchant settlement`)
  return errors
}

export function buildCreateOrderRequest(input: EurPayoutInput, opts: { env?: CoinGateEnv; token?: string } = {}): CoinGateRequest {
  const errors = validateEurPayout(input)
  if (errors.length) throw new CoinGateValidationError(errors.join('; '))
  const body: Record<string, string> = {
    order_id: input.orderId,
    price_amount: input.priceEur.toFixed(2),
    price_currency: 'EUR',
    receive_currency: (input.receiveCurrency ?? 'EUR').toUpperCase(),
    title: input.title,
    description: input.description,
  }
  if (input.callbackUrl) body.callback_url = input.callbackUrl
  if (input.successUrl) body.success_url = input.successUrl
  if (input.cancelUrl) body.cancel_url = input.cancelUrl
  return {
    url: `${COINGATE_API[opts.env ?? 'sandbox']}/orders`,
    method: 'POST',
    headers: { Authorization: `Token ${opts.token ?? 'DRY_RUN'}`, 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body,
  }
}

export interface CreateOpts {
  dryRun?: boolean
  env?: CoinGateEnv
  token?: string
  fetchImpl?: typeof fetch
}

export async function createEurPayoutOrder(input: EurPayoutInput, opts: CreateOpts = {}): Promise<CoinGateOrder> {
  const dryRun = opts.dryRun !== false || !opts.token
  const req = buildCreateOrderRequest(input, { env: opts.env, token: opts.token })
  if (dryRun) {
    return {
      id: 0, status: 'new', order_id: req.body.order_id, price_amount: req.body.price_amount,
      price_currency: 'EUR', receive_currency: req.body.receive_currency,
      payment_url: `${COINGATE_API.sandbox.replace('/api/v2', '')}/invoice/dry-run-${encodeURIComponent(req.body.order_id)}`,
      dryRun: true,
    }
  }
  const res = await (opts.fetchImpl ?? fetch)(req.url, { method: 'POST', headers: req.headers, body: new URLSearchParams(req.body).toString() })
  const json = await res.json()
  if (!res.ok) throw new Error(`CoinGate ${res.status}: ${json?.message ?? 'error'}${json?.errors ? ' — ' + json.errors.join(', ') : ''}`)
  return { ...json, dryRun: false } as CoinGateOrder
}

/** CoinGate order statuses that mean the merchant's EUR settlement is final. */
export const isSettled = (status: string) => status === 'paid'
export const isTerminalFailure = (status: string) => ['invalid', 'expired', 'canceled', 'refunded'].includes(status)
