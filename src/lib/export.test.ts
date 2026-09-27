import { expect, it } from 'vitest'
import { receiptsToCsv } from './export'

it('exports audit-friendly receipt rows with an honest simulation marker', () => {
  const csv = receiptsToCsv([{
    id: 'r-1',
    requestId: 'q-1',
    amount: 4.2,
    asset: 'EURC',
    settlement: 'EUR_STABLECOIN',
    status: 'settled',
    createdAt: '2026-09-27T09:00:00.000Z',
  }])
  expect(csv).toContain('receipt_id,request_id,timestamp,amount_eur,paid_asset,settlement,status,environment')
  expect(csv).toContain('r-1,q-1,2026-09-27T09:00:00.000Z,4.20,EURC,EUR_STABLECOIN,settled,DEMO')
})
