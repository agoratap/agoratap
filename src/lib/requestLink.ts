// Parse the EIP-681 link that eip681Uri() builds, so the buyer screen can show exactly what a request asks for.
// Strict on purpose: anything that is not a plain ERC-20 `transfer` of a known token on a known chain is rejected.
import { CHAINS, isAddress, type ChainName, type TokenSymbol } from './chainRequest'

export interface ParsedRequestLink {
  readonly chain: ChainName
  readonly token: TokenSymbol
  readonly merchant: string
  readonly atomic: bigint
}

const LINK = /^ethereum:(0x[0-9a-fA-F]{40})@(\d+)\/transfer\?address=(0x[0-9a-fA-F]{40})&uint256=(\d{1,30})$/

export function parseRequestLink(text: string): ParsedRequestLink {
  const m = LINK.exec(String(text ?? '').trim())
  if (!m) throw new Error('Not an Agora Pay payment link')
  const [, tokenAddress, chainId, merchant, amount] = m
  if (!isAddress(merchant)) throw new Error('Merchant address is not valid')
  for (const chain of Object.keys(CHAINS) as ChainName[]) {
    if (String(CHAINS[chain].id) !== chainId) continue
    for (const token of Object.keys(CHAINS[chain].tokens) as TokenSymbol[]) {
      if (CHAINS[chain].tokens[token].toLowerCase() === tokenAddress.toLowerCase()) {
        const atomic = BigInt(amount)
        if (atomic <= 0n) throw new Error('Amount must be greater than zero')
        return { chain, token, merchant, atomic }
      }
    }
  }
  throw new Error('Unknown token or chain in link')
}
