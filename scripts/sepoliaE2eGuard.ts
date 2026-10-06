// Guards for the Base Sepolia reference-matching harness. No network, no keys.
import { isAbsolute, relative, resolve, sep } from 'node:path'

export const SEPOLIA_RPC = 'https://sepolia.base.org'
export const SEPOLIA_CHAIN_ID = 84_532
export const MAINNET_CHAIN_ID = 8_453

const SECRET_KEY = /private|secret|mnemonic|seedphrase|seed_phrase/i

export function assertSepoliaRpc(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Refusing RPC ${url}. This harness only talks to ${SEPOLIA_RPC}.`)
  }
  const pathOk = parsed.pathname === '/' || parsed.pathname === ''
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'sepolia.base.org' || !pathOk || parsed.search !== '' || parsed.hash !== '') {
    throw new Error(`Refusing RPC ${url}. This harness only talks to ${SEPOLIA_RPC}.`)
  }
}

export function assertSepoliaChainId(chainId: number): void {
  if (chainId === MAINNET_CHAIN_ID) throw new Error('Refusing Base mainnet (chain id 8453). Mainnet is not enabled.')
  if (chainId !== SEPOLIA_CHAIN_ID) throw new Error(`Refusing chain id ${chainId}. This harness only runs on Base Sepolia (${SEPOLIA_CHAIN_ID}).`)
}

/** A key file inside the repository must never be read or written. */
export function assertKeyFileOutsideRepo(keyFile: string, repoRoot: string): void {
  const abs = resolve(keyFile)
  const root = resolve(repoRoot)
  const rel = relative(root, abs)
  const inside = rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
  if (inside) throw new Error(`Refusing key file inside the repository: ${keyFile}`)
}

/** Evidence JSON must not carry a private key, under any field name. */
export function assertNoSecrets(value: unknown, path = 'root'): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoSecrets(item, `${path}[${i}]`))
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) throw new Error(`Refusing to write secret field ${path}.${key}`)
      assertNoSecrets(child, `${path}.${key}`)
    }
  }
}
