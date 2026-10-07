import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

const appSource = (import.meta.glob('./App.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./App.tsx']
const panelSource = (import.meta.glob('./LivePanels.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./LivePanels.tsx']

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear() { data.clear() },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem(key) { data.delete(key) },
    setItem(key, value) { data.set(key, value) },
  }
}

describe('pages copy', () => {
  it('pages copy stays an early pilot and does not use demo-only or unfinished framing', () => {
    expect(appSource).toContain('EARLY PILOT · PRACTICE')
    expect(appSource).toContain('Early pilot — no live funds.')
    expect(appSource).toContain('practice flows with simulated balances')
    expect(appSource).toContain('Mainnet payments are not enabled')
    expect(appSource).toContain('any-in → any-out')
    expect(appSource).toContain('market stall')
    expect(appSource).toContain('installs nothing')
    expect(appSource).toContain('QR or pay-link')
    expect(appSource).toContain('optional rail')
    expect(appSource).toContain('You do not need to fund Base')
    expect(appSource).not.toContain('Straight to the merchant')
    expect(appSource).not.toContain('Chain checks run on Base Sepolia only')
    expect(appSource).not.toContain('only works with the Base Sepolia')
    expect(appSource).not.toContain('One checkout')
    expect(appSource).not.toContain('Do not pretend it is live')
    expect(appSource).not.toContain('This prototype')
    expect(appSource).not.toContain('DEMO · SIMULATED')
    expect(appSource).not.toContain('What this demo proves')
    expect(appSource).not.toMatch(/demo only/i)
    expect(appSource).not.toMatch(/\bunfinished\b/i)
    expect(panelSource).toContain('sepolia.base.org')
    expect(panelSource).toContain('Mainnet is not contacted')
    expect(panelSource).toContain('optional Base rail')
    expect(panelSource).toContain('not the product')
    expect(panelSource).not.toContain('only works with the Base Sepolia')
    expect(panelSource).not.toContain('mainnet.base.org')

    const previous = globalThis.localStorage
    globalThis.localStorage = memoryStorage()
    try {
      const html = renderToStaticMarkup(createElement(App))
      expect(html).toContain('EARLY PILOT')
      expect(html).toContain('Mainnet payments are not enabled')
      expect(html).toContain('simulated balances')
      expect(html).toContain('Pay with what you hold.')
      expect(html).toContain('They receive what they want.')
      expect(html).toContain('any-in → any-out')
      expect(html).toContain('market stall')
      expect(html).toContain('QR or pay-link')
      expect(html).toContain('You do not need to fund Base')
      expect(html).not.toContain('Straight to the merchant')
      expect(html).not.toContain('Base Sepolia only')
      expect(html).not.toMatch(/demo only/i)
      expect(html).not.toMatch(/\bunfinished\b/i)
    } finally {
      globalThis.localStorage = previous
    }
  })
})
