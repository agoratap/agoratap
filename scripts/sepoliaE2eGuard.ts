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

export type HarnessPlan =
  | { action: 'skip'; exitCode: 0; reason: string; ethNeedWei?: bigint }
  | { action: 'blocked'; exitCode: 2; reason: string; ethNeedWei: bigint }
  | { action: 'run'; transfers: 1 | 2; ethNeedWei: bigint }

/**
 * No key and no explicit create flag: exit 0 before any RPC call and before creating a key.
 * `SEPOLIA_E2E_CREATE_KEY=1` is the only way a missing key file becomes a new throwaway payer.
 */
export function decideHarnessStart(input: { hasKey: boolean; createKey: boolean }): Extract<HarnessPlan, { action: 'skip' }> | { action: 'run' } {
  if (!input.hasKey && !input.createKey) {
    return {
      action: 'skip',
      exitCode: 0,
      reason: 'No payer key in SEPOLIA_PAYER_KEY or in a key file outside the repo. No key was created and no network call was made.',
    }
  }
  return { action: 'run' }
}

/** Gas buffer the harness requires before it will sign. Matches the 2026-10-06 run: 6_000_000 wei × 150_000 gas × 3 × transfers. */
export function ethForTransfers(gasPriceWei: bigint, transfers: number): bigint {
  if (!Number.isInteger(transfers) || transfers < 1) throw new Error('transfers must be at least 1')
  if (gasPriceWei < 0n) throw new Error('gas price must be non-negative')
  return gasPriceWei * 150_000n * 3n * BigInt(transfers)
}

/**
 * Short EURC or ETH: exit 0 and do not write evidence, unless the caller asked to record a blocked run (exit 2).
 * Never returns `run` when a transfer cannot be paid for.
 */
export function decideAfterBalances(input: {
  eurcAtomic: bigint
  saleAtomic: bigint
  ethWei: bigint
  gasPriceWei: bigint
  recordBlocked: boolean
}): HarnessPlan {
  const one = input.eurcAtomic >= input.saleAtomic
  const transfers: 1 | 2 = input.eurcAtomic >= input.saleAtomic * 2n ? 2 : 1
  const ethNeedWei = ethForTransfers(input.gasPriceWei, one ? transfers : 1)
  if (one && input.ethWei >= ethNeedWei) return { action: 'run', transfers, ethNeedWei }
  const reason = !one
    ? `Payer EURC balance is below the sale amount (${input.saleAtomic.toString()} atomic). No transaction was sent.`
    : `Payer Base Sepolia ETH (${input.ethWei.toString()} wei) is below the gas buffer (${ethNeedWei.toString()} wei). No transaction was sent.`
  if (input.recordBlocked) return { action: 'blocked', exitCode: 2, reason, ethNeedWei }
  return { action: 'skip', exitCode: 0, reason: `${reason} Skipping with exit 0 and without writing evidence.`, ethNeedWei }
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
