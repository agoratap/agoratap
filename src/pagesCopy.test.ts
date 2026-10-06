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
    expect(appSource).not.toContain('Do not pretend it is live')
    expect(appSource).not.toContain('This prototype')
    expect(appSource).not.toContain('DEMO · SIMULATED')
    expect(appSource).not.toContain('What this demo proves')
    expect(appSource).not.toMatch(/demo only/i)
    expect(appSource).not.toMatch(/\bunfinished\b/i)
    expect(panelSource).toContain('sepolia.base.org')
    expect(panelSource).toContain('Mainnet is not contacted')
    expect(panelSource).not.toContain('mainnet.base.org')

    const previous = globalThis.localStorage
    globalThis.localStorage = memoryStorage()
    try {
      const html = renderToStaticMarkup(createElement(App))
      expect(html).toContain('EARLY PILOT')
      expect(html).toContain('Mainnet payments are not enabled')
      expect(html).toContain('simulated balances')
      expect(html).not.toMatch(/demo only/i)
      expect(html).not.toMatch(/\bunfinished\b/i)
    } finally {
      globalThis.localStorage = previous
    }
  })
})
