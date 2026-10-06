import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertKeyFileOutsideRepo, assertNoSecrets, assertSepoliaChainId, assertSepoliaRpc, decideAfterBalances, decideHarnessStart, ethForTransfers, SEPOLIA_CHAIN_ID, SEPOLIA_RPC } from './sepoliaE2eGuard'

describe('sepolia reference e2e guards', () => {
  it('allows only the public Base Sepolia endpoint', () => {
    expect(() => assertSepoliaRpc(SEPOLIA_RPC)).not.toThrow()
    expect(() => assertSepoliaRpc('https://mainnet.base.org')).toThrow(/Refusing/)
    expect(() => assertSepoliaRpc('https://sepolia.base.org.evil.example')).toThrow(/Refusing/)
    expect(() => assertSepoliaRpc('http://sepolia.base.org')).toThrow(/Refusing/)
  })

  it('refuses Base mainnet and any other chain id', () => {
    expect(() => assertSepoliaChainId(SEPOLIA_CHAIN_ID)).not.toThrow()
    expect(() => assertSepoliaChainId(8453)).toThrow(/mainnet/i)
    expect(() => assertSepoliaChainId(1)).toThrow(/Refusing chain id 1/)
  })

  it('refuses a key file inside the repository', () => {
    const repo = mkdtempSync(join(tmpdir(), 'agorapay-repo-'))
    const outside = join(tmpdir(), 'agorapay-sepolia-e2e.key')
    writeFileSync(join(repo, 'secret.key'), 'nope')
    expect(() => assertKeyFileOutsideRepo(join(repo, 'secret.key'), repo)).toThrow(/inside the repository/)
    expect(() => assertKeyFileOutsideRepo(outside, repo)).not.toThrow()
  })

  it('refuses evidence that contains a secret field', () => {
    expect(() => assertNoSecrets({ txHash: '0x' + 'ab'.repeat(32), payer: '0x' + '11'.repeat(20) })).not.toThrow()
    expect(() => assertNoSecrets({ privateKey: '0x' + 'ab'.repeat(32) })).toThrow(/secret field/)
  })

  it('skips cleanly when no payer key is available', () => {
    expect(decideHarnessStart({ hasKey: false, createKey: false })).toEqual({
      action: 'skip',
      exitCode: 0,
      reason: expect.stringMatching(/No payer key/),
    })
    expect(decideHarnessStart({ hasKey: false, createKey: true })).toEqual({ action: 'run' })
    expect(decideHarnessStart({ hasKey: true, createKey: false })).toEqual({ action: 'run' })
  })

  it('skips cleanly when ETH or EURC cannot pay, and records a block only when asked', () => {
    const gas = 6_000_000n
    expect(ethForTransfers(gas, 2)).toBe(5_400_000_000_000n)
    expect(ethForTransfers(gas, 1)).toBe(2_700_000_000_000n)
    const funded = decideAfterBalances({ eurcAtomic: 20_000_000n, saleAtomic: 103_724n, ethWei: 5_400_000_000_000n, gasPriceWei: gas, recordBlocked: false })
    expect(funded).toMatchObject({ action: 'run', transfers: 2, ethNeedWei: 5_400_000_000_000n })
    const one = decideAfterBalances({ eurcAtomic: 200_000n, saleAtomic: 103_724n, ethWei: 2_700_000_000_000n, gasPriceWei: gas, recordBlocked: false })
    expect(one).toMatchObject({ action: 'run', transfers: 1 })
    const noEth = decideAfterBalances({ eurcAtomic: 20_000_000n, saleAtomic: 103_724n, ethWei: 0n, gasPriceWei: gas, recordBlocked: false })
    expect(noEth).toMatchObject({ action: 'skip', exitCode: 0 })
    if (noEth.action === 'skip') expect(noEth.reason).toMatch(/No transaction was sent/)
    const noEurc = decideAfterBalances({ eurcAtomic: 1n, saleAtomic: 103_724n, ethWei: 10n ** 18n, gasPriceWei: gas, recordBlocked: false })
    expect(noEurc).toMatchObject({ action: 'skip', exitCode: 0 })
    const recorded = decideAfterBalances({ eurcAtomic: 20_000_000n, saleAtomic: 103_724n, ethWei: 0n, gasPriceWei: gas, recordBlocked: true })
    expect(recorded).toMatchObject({ action: 'blocked', exitCode: 2, ethNeedWei: 5_400_000_000_000n })
    const shortGasForTwo = decideAfterBalances({ eurcAtomic: 20_000_000n, saleAtomic: 103_724n, ethWei: 2_700_000_000_000n, gasPriceWei: gas, recordBlocked: false })
    expect(shortGasForTwo).toMatchObject({ action: 'skip', exitCode: 0, ethNeedWei: 5_400_000_000_000n })
  })
})
