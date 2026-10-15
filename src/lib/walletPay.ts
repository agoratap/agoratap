/**
 * Wallet hand-off so the payer never types a memo.
 *  - Direct transfers: standard payment-URI QR codes (BIP21, EIP-681 transfer, Solana Pay).
 *  - THOR/Maya EVM routes: one-tap EIP-1193 (injected wallet) calling the router's depositWithExpiry
 *    with the memo built in (ERC-20: approve first).
 *  - THOR/Maya BTC routes: one-tap UniSat `sendBitcoin(to, sats, { memo })`, which writes the OP_RETURN.
 * Nothing here signs or broadcasts on its own; the payer's wallet asks for approval.
 */
import { encodeFunctionData, parseUnits } from 'viem'
import { THOR_ASSETS, MAYA_ASSETS, type RouteQuote } from './routes'
import type { Leg } from './exolix'

export const EVM_CHAIN_IDS: Record<string, number> = { ETH: 1, BASE: 8453, BSC: 56, AVAXC: 43114, ARBITRUM: 42161, MATIC: 137 }
export const ZERO = '0x0000000000000000000000000000000000000000'

/** Known tokens: contract + decimals per Exolix network code. */
export const TOKENS: Record<string, { address: string; decimals: number }> = {
  'USDC/ETH': { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  'USDC/BASE': { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  'USDC/ARBITRUM': { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  'USDC/BSC': { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  'USDC/AVAXC': { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
  'USDC/MATIC': { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  'USDT/ETH': { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  'USDT/BSC': { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  'USDT/ARBITRUM': { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
}
export const SOLANA_MINTS: Record<string, string> = { USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' }
const NATIVE_EVM: Record<string, string> = { ETH: 'ETH', BASE: 'ETH', ARBITRUM: 'ETH', BSC: 'BNB', AVAXC: 'AVAX', MATIC: 'POL' }

const k = (l: Leg) => `${l.coin}/${l.network}`.toUpperCase()
export const isEvm = (l: Leg) => l.network.toUpperCase() in EVM_CHAIN_IDS
export const isNativeEvm = (l: Leg) => isEvm(l) && NATIVE_EVM[l.network.toUpperCase()] === l.coin.toUpperCase()

function trimDecimal(n: number, dp: number) { return n.toFixed(dp).replace(/\.?0+$/, '') }

/**
 * Standard payment URI for a plain transfer (no memo). Returns null when no standard exists.
 * BIP21 (bitcoin:, litecoin:, dogecoin:), EIP-681 (ethereum: native or ERC-20 transfer), Solana Pay (solana:).
 */
export function transferUri(leg: Leg, to: string, amount: number): string | null {
  const net = leg.network.toUpperCase(), coin = leg.coin.toUpperCase()
  if (net === 'BTC' && coin === 'BTC') return `bitcoin:${to}?amount=${trimDecimal(amount, 8)}`
  if (net === 'LTC' && coin === 'LTC') return `litecoin:${to}?amount=${trimDecimal(amount, 8)}`
  if (net === 'DOGE' && coin === 'DOGE') return `dogecoin:${to}?amount=${trimDecimal(amount, 8)}`
  if (isEvm(leg)) {
    const chain = EVM_CHAIN_IDS[net]
    if (isNativeEvm(leg)) return `ethereum:${to}@${chain}?value=${parseUnits(trimDecimal(amount, 18), 18).toString()}`
    const t = TOKENS[k(leg)]
    if (!t) return null
    return `ethereum:${t.address}@${chain}/transfer?address=${to}&uint256=${parseUnits(trimDecimal(amount, t.decimals), t.decimals).toString()}`
  }
  if (net === 'SOL') {
    if (coin === 'SOL') return `solana:${to}?amount=${trimDecimal(amount, 9)}`
    const mint = SOLANA_MINTS[coin]
    return mint ? `solana:${to}?amount=${trimDecimal(amount, 6)}&spl-token=${mint}` : null
  }
  return null
}

const ROUTER_ABI = [{ type: 'function', name: 'depositWithExpiry', stateMutability: 'payable', inputs: [
  { name: 'vault', type: 'address' }, { name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'memo', type: 'string' }, { name: 'expiration', type: 'uint256' }], outputs: [] }] as const
const ERC20_ABI = [{ type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const

export interface EvmTx { chainId: number; to: string; data: string; value: string; label: string }

/** THOR/Maya EVM deposit: [approve?, depositWithExpiry] with the memo inside the call. */
export function buildEvmDeposit(from: Leg, q: Pick<RouteQuote, 'route' | 'router' | 'depositAddress' | 'memo' | 'expiry' | 'sendAmount'>): EvmTx[] {
  if (!isEvm(from)) throw new Error('Not an EVM pay-in')
  if (!q.router || !q.depositAddress || !q.memo) throw new Error('Quote has no router, vault or memo')
  const table = q.route === 'maya' ? MAYA_ASSETS : THOR_ASSETS
  if (!table[k(from)]) throw new Error('Asset not supported on this route')
  const chainId = EVM_CHAIN_IDS[from.network.toUpperCase()]
  const expiry = BigInt(q.expiry ?? Math.floor(Date.now() / 1000) + 900)
  if (isNativeEvm(from)) {
    const value = parseUnits(trimDecimal(q.sendAmount, 18), 18)
    return [{ chainId, to: q.router, value: `0x${value.toString(16)}`, label: `Deposit ${q.sendAmount} ${from.coin} with memo`,
      data: encodeFunctionData({ abi: ROUTER_ABI, functionName: 'depositWithExpiry', args: [q.depositAddress as `0x${string}`, ZERO, value, q.memo, expiry] }) }]
  }
  const t = TOKENS[k(from)]
  if (!t) throw new Error('Unknown token contract')
  const units = parseUnits(trimDecimal(q.sendAmount, t.decimals), t.decimals)
  return [
    { chainId, to: t.address, value: '0x0', label: `Approve ${q.sendAmount} ${from.coin} for the router`, data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [q.router as `0x${string}`, units] }) },
    { chainId, to: q.router, value: '0x0', label: `Deposit ${q.sendAmount} ${from.coin} with memo`, data: encodeFunctionData({ abi: ROUTER_ABI, functionName: 'depositWithExpiry', args: [q.depositAddress as `0x${string}`, t.address as `0x${string}`, units, q.memo, expiry] }) },
  ]
}

interface Eip1193 { request(args: { method: string; params?: unknown[] }): Promise<any> }

/** Send the built txs through an injected EIP-1193 wallet (MetaMask, Rabby, Coinbase Wallet, Trust/OKX extensions...). */
export async function sendEvm(txs: EvmTx[], eth: Eip1193 | undefined = (globalThis as any).ethereum): Promise<string[]> {
  if (!eth) throw new Error('No browser wallet found. Open this page in a wallet browser (MetaMask, Rabby, Coinbase Wallet, Trust).')
  const [from] = await eth.request({ method: 'eth_requestAccounts' })
  const hashes: string[] = []
  for (const tx of txs) {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${tx.chainId.toString(16)}` }] })
    hashes.push(await eth.request({ method: 'eth_sendTransaction', params: [{ from, to: tx.to, data: tx.data, value: tx.value }] }))
  }
  return hashes
}

export interface BtcMemoTx { to: string; sats: number; memo: string }
export function buildBtcMemoTx(q: Pick<RouteQuote, 'depositAddress' | 'memo' | 'sendAmount'>): BtcMemoTx {
  if (!q.depositAddress || !q.memo) throw new Error('Quote has no vault or memo')
  if (new TextEncoder().encode(q.memo).length > 80) throw new Error('Memo exceeds the 80-byte OP_RETURN limit')
  return { to: q.depositAddress, sats: Math.round(q.sendAmount * 1e8), memo: q.memo }
}

/** UniSat: sendBitcoin(to, sats, { memo }) writes the memo as OP_RETURN (docs.unisat.io). */
export async function sendBtcUnisat(tx: BtcMemoTx, unisat: any = (globalThis as any).unisat): Promise<string> {
  if (!unisat) throw new Error('UniSat wallet not found. Install UniSat or open this page in the UniSat app browser.')
  await unisat.requestAccounts()
  return unisat.sendBitcoin(tx.to, tx.sats, { memo: tx.memo })
}
