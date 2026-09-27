import type { Receipt } from './payments'

export function receiptsToCsv(receipts: Receipt[]): string {
  const header = 'receipt_id,request_id,timestamp,amount_eur,paid_asset,settlement,status,environment'
  const rows = receipts.map((receipt) => [
    receipt.id,
    receipt.requestId,
    receipt.createdAt,
    receipt.amount.toFixed(2),
    receipt.asset,
    receipt.settlement,
    receipt.status,
    'DEMO',
  ].join(','))
  return [header, ...rows].join('\n')
}
