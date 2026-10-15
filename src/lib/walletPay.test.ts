import { describe, expect, it, vi } from 'vitest'
import { decodeFunctionData } from 'viem'
import { buildBtcMemoTx, buildEvmDeposit, sendBtcUnisat, sendEvm, transferUri } from './walletPay'

const ROUTER_ABI = [{ type: 'function', name: 'depositWithExpiry', stateMutability: 'payable', inputs: [{ name: 'vault', type: 'address' }, { name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'memo', type: 'string' }, { name: 'expiration', type: 'uint256' }], outputs: [] }] as const
const ERC20 = [{ type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const
const VAULT = '0x0d15b57a5ba0a31a4774c03ddfacf79b289db9ce'
const ROUTER = '0xD37BbE5744D730a1d98d8DC97c42F0Ca46aD7146'

describe('payment URIs (no memo)', () => {
  it('BIP21 for BTC', () => expect(transferUri({ coin: 'BTC', network: 'BTC' }, 'bc1qm', 0.000115)).toBe('bitcoin:bc1qm?amount=0.000115'))
  it('EIP-681 ERC-20 transfer for USDC on Base', () => expect(transferUri({ coin: 'USDC', network: 'BASE' }, '0xMer', 9.1308)).toBe('ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0xMer&uint256=9130800'))
  it('EIP-681 native ETH', () => expect(transferUri({ coin: 'ETH', network: 'ETH' }, '0xMer', 0.001)).toBe('ethereum:0xMer@1?value=1000000000000000'))
  it('Solana Pay for USDC on Solana', () => expect(transferUri({ coin: 'USDC', network: 'SOL' }, 'So1', 9.1308)).toBe('solana:So1?amount=9.1308&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'))
  it('null where no standard exists', () => expect(transferUri({ coin: 'XMR', network: 'XMR' }, 'x', 1)).toBeNull())
})

describe('EVM one-tap deposit with memo', () => {
  const q = { route: 'thor' as const, router: ROUTER, depositAddress: VAULT, memo: '=:BASE.USDC:0xabc', expiry: 1792078010, sendAmount: 0.0039 }
  it('native ETH: single payable depositWithExpiry carrying the memo', () => {
    const [tx] = buildEvmDeposit({ coin: 'ETH', network: 'ETH' }, q)
    expect(tx).toMatchObject({ chainId: 1, to: ROUTER, value: '0x' + (3900000000000000n).toString(16) })
    const d = decodeFunctionData({ abi: ROUTER_ABI, data: tx.data as `0x${string}` })
    expect(d.args).toEqual([expect.stringMatching(/^0x0d15b57a/i), '0x0000000000000000000000000000000000000000', 3900000000000000n, '=:BASE.USDC:0xabc', 1792078010n])
  })
  it('USDC: approve the router then deposit the token', () => {
    const txs = buildEvmDeposit({ coin: 'USDC', network: 'ETH' }, { ...q, sendAmount: 9.5 })
    expect(txs).toHaveLength(2)
    expect(decodeFunctionData({ abi: ERC20, data: txs[0].data as `0x${string}` }).args).toEqual([ROUTER, 9500000n])
    const d = decodeFunctionData({ abi: ROUTER_ABI, data: txs[1].data as `0x${string}` })
    expect(d.args[1]).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
    expect(d.args[2]).toBe(9500000n)
    expect(d.args[3]).toBe('=:BASE.USDC:0xabc')
  })
  it('refuses quotes without router or memo', () => {
    expect(() => buildEvmDeposit({ coin: 'ETH', network: 'ETH' }, { ...q, memo: undefined })).toThrow()
  })
  it('sends through an EIP-1193 provider without signing anything itself', async () => {
    const calls: string[] = []
    const eth = { request: vi.fn(async ({ method }: { method: string }) => { calls.push(method); return method === 'eth_requestAccounts' ? ['0xme'] : method === 'eth_sendTransaction' ? '0xhash' : null }) }
    expect(await sendEvm(buildEvmDeposit({ coin: 'ETH', network: 'ETH' }, q), eth)).toEqual(['0xhash'])
    expect(calls).toEqual(['eth_requestAccounts', 'wallet_switchEthereumChain', 'eth_sendTransaction'])
    await expect(sendEvm([], undefined)).rejects.toThrow('No browser wallet')
  })
})

describe('BTC one-tap with OP_RETURN memo', () => {
  it('builds sats + memo and calls UniSat sendBitcoin with { memo }', async () => {
    const tx = buildBtcMemoTx({ depositAddress: 'bc1qvault', memo: '=:ARB.USDC:0xabc', sendAmount: 0.000115 })
    expect(tx).toEqual({ to: 'bc1qvault', sats: 11500, memo: '=:ARB.USDC:0xabc' })
    const unisat = { requestAccounts: vi.fn(async () => ['bc1qme']), sendBitcoin: vi.fn(async () => 'txid') }
    expect(await sendBtcUnisat(tx, unisat)).toBe('txid')
    expect(unisat.sendBitcoin).toHaveBeenCalledWith('bc1qvault', 11500, { memo: '=:ARB.USDC:0xabc' })
  })
  it('rejects memos over 80 bytes', () => {
    expect(() => buildBtcMemoTx({ depositAddress: 'a', memo: 'x'.repeat(81), sendAmount: 1 })).toThrow('80-byte')
  })
})
