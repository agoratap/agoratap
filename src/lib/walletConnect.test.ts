import { describe, expect, it } from 'vitest'
import { WALLETCONNECT_PROJECT_ID, walletConnectConfig } from './walletConnect'

describe('walletConnect config', () => {
  it('uses the public Reown project ID and opens the QR modal', () => {
    const c = walletConnectConfig('https://agoratap.github.io')
    expect(WALLETCONNECT_PROJECT_ID).toMatch(/^[0-9a-f]{32}$/)
    expect(c.projectId).toBe('fd55a87597107cf4eb73620aa7282416')
    expect(c.showQrModal).toBe(true)
    expect(c.optionalChains).toContain(1)
    expect(c.metadata.url).toBe('https://agoratap.github.io')
  })
})
