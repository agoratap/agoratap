import { describe, expect, it } from 'vitest'

// Raw text of every source file, test file and the README, loaded at test time by Vite (no Node APIs needed).
const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const readme = (import.meta.glob('../../README.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../../README.md']

const isTest = (path: string) => /\.(test|spec)\.ts$/.test(path)
const appSources = Object.entries(sources).filter(([path]) => !isTest(path) && !path.endsWith('vite-env.d.ts'))
const testText = Object.entries(sources).filter(([path]) => isTest(path)).map(([, text]) => text).join('\n')

// This file cannot read itself through import.meta.glob, so its own test names are listed here and used in it() below.
const OWN = ['app source makes no network calls', 'chainRequest has no keys, no fee and no network access'] as const

const NETWORK = /\bfetch\s*\(|\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios|ethers|viem|web3)\b/

function codeOnly(text: string): string {
  return text.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
}

describe('README claims', () => {
  it(OWN[0], () => {
    expect(appSources.length).toBeGreaterThan(5)
    const hits = appSources.filter(([, text]) => NETWORK.test(codeOnly(text))).map(([path]) => path)
    expect(hits).toEqual([])
  })

  it(OWN[1], () => {
    const entry = appSources.find(([path]) => path.endsWith('/chainRequest.ts'))
    expect(entry).toBeDefined()
    const code = codeOnly(entry![1])
    expect(code).not.toMatch(/privateKey|private_key|mnemonic|seed|secret/i)
    expect(code).not.toMatch(/\bfee\b|commission|affiliate/i)
    expect(code).not.toMatch(NETWORK)
    expect(code).not.toMatch(/^\s*import\b/m)
  })

  it('every test named in the README table exists', () => {
    const table = readme.split('## What the code does today')[1].split('## What we do not do yet')[0]
    const cited = [...table.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    expect(cited.length).toBeGreaterThan(8)
    const missing = cited.filter((name) => !(testText.includes(name) || (OWN as readonly string[]).includes(name)))
    expect(missing).toEqual([])
  })
})
