import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertKeyFileOutsideRepo, assertNoSecrets, assertSepoliaChainId, assertSepoliaRpc, SEPOLIA_CHAIN_ID, SEPOLIA_RPC } from './sepoliaE2eGuard'

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
})
