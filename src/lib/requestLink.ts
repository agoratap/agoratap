// Parse the EIP-681 link that eip681Uri() builds, plus an optional `#ref=` fragment.
// Strict on purpose: anything that is not a plain ERC-20 `transfer` of a known token on a known chain is rejected.
// The reference is a fragment, never a query parameter, so it cannot be encoded as an extra transfer argument.
import { CHAINS, eip681Uri, isAddress, type ChainName, type TokenSymbol } from './chainRequest'

export interface ParsedRequestLink {
  readonly chain: ChainName
  readonly token: TokenSymbol
  readonly merchant: string
  readonly atomic: bigint
  readonly reference?: string
}

const LINK = /^ethereum:(0x[0-9a-fA-F]{40})@(\d+)\/transfer\?address=(0x[0-9a-fA-F]{40})&uint256=(\d{1,30})$/
const FRAGMENT = /^#ref=(0x[0-9a-fA-F]{64})$/i

export function parseRequestLink(text: string): ParsedRequestLink {
  const trimmed = String(text ?? '').trim()
  const hashAt = trimmed.indexOf('#')
  let body = trimmed
  let reference: string | undefined
  if (hashAt !== -1) {
    body = trimmed.slice(0, hashAt)
    const frag = FRAGMENT.exec(trimmed.slice(hashAt))
    if (!frag) throw new Error('Payment reference is not valid')
    reference = frag[1].toLowerCase()
  }
  const m = LINK.exec(body)
  if (!m) throw new Error('Not an Agora Pay payment link')
  const [, tokenAddress, chainId, merchant, amount] = m
  if (!isAddress(merchant)) throw new Error('Merchant address is not valid')
  for (const chain of Object.keys(CHAINS) as ChainName[]) {
    if (String(CHAINS[chain].id) !== chainId) continue
    for (const token of Object.keys(CHAINS[chain].tokens) as TokenSymbol[]) {
      if (CHAINS[chain].tokens[token].toLowerCase() === tokenAddress.toLowerCase()) {
        const atomic = BigInt(amount)
        if (atomic <= 0n) throw new Error('Amount must be greater than zero')
        return reference ? { chain, token, merchant, atomic, reference } : { chain, token, merchant, atomic }
      }
    }
  }
  throw new Error('Unknown token or chain in link')
}

/** The href a wallet should open: the same transfer, with the reference fragment removed. */
export function walletTransferUri(text: string): string {
  const parsed = parseRequestLink(text)
  return eip681Uri({
    orderId: 'pay',
    chain: parsed.chain,
    token: parsed.token,
    merchant: parsed.merchant,
    atomic: parsed.atomic,
    baseAtomic: parsed.atomic,
    tag: 0,
  })
}
