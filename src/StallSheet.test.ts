import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import App from './App'
import { StallPay, StallSheet } from './StallSheet'
import { QR_QUIET, qrMatrix } from './lib/qrMatrix'
import {
  STALL_INSTRUCTION_EN,
  STALL_INSTRUCTION_RO,
  merchantNameFromPayLink,
  nextStallLocation,
  stallPayLink,
  stallRouteFromLocation,
} from './lib/stallSheet'

const PAGE = 'https://example.com/agoratap/#stall'
const NAME = 'Piața Obor'

const appSource = (import.meta.glob('./App.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./App.tsx']
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const stallSources = import.meta.glob(['./StallSheet.tsx', './lib/stallSheet.ts', './lib/qrMatrix.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

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

function withLocation(loc: { hash: string; search: string; href: string }, run: () => void) {
  const previousStorage = globalThis.localStorage
  const hadLocation = 'location' in globalThis
  const previousLocation = globalThis.location
  globalThis.localStorage = memoryStorage()
  Object.defineProperty(globalThis, 'location', { configurable: true, writable: true, value: loc })
  try {
    run()
  } finally {
    globalThis.localStorage = previousStorage
    if (hadLocation) Object.defineProperty(globalThis, 'location', { configurable: true, writable: true, value: previousLocation })
    else delete (globalThis as { location?: Location }).location
  }
}

function darkCount(text: string): number {
  const matrix = qrMatrix(text)
  let dark = 0
  for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) if (matrix.dark(x, y)) dark++
  return dark
}

describe('market stall sheet', () => {
  it('prints a market-stall sheet with a pay-link QR, bilingual instructions, and no USDT', () => {
    expect(STALL_INSTRUCTION_RO).toBe('Scanează și plătește cu ce crypto ai')
    expect(STALL_INSTRUCTION_EN).toBe('Scan and pay with any crypto you hold')

    const link = stallPayLink(`  ${NAME}  `, PAGE)
    expect(link.startsWith('https://example.com/agoratap/?pay=')).toBe(true)
    expect(link).not.toMatch(/#|ethereum:|baseSepolia|84532|8453/)
    expect(merchantNameFromPayLink(link)).toBe(NAME)
    expect(link).not.toMatch(/USDT/i)

    const html = renderToStaticMarkup(createElement(StallSheet, { pageHref: PAGE, initialName: NAME, onBack: () => {} }))
    expect(html).toContain(NAME)
    expect(html).toContain('Scanează și plătește cu ce crypto ai')
    expect(html).toContain('Scan and pay with any crypto you hold')
    expect(html).toContain('any-in → any-out')
    expect(html).toContain('Prefer USDC, EURC, BTC or ETH.')
    expect(html).toContain('USDC')
    expect(html).toContain('EURC')
    expect(html).toContain('BTC')
    expect(html).toContain('ETH')
    expect(html).toContain('Base is an optional rail only')
    expect(html).toContain('You do not need to fund Base')
    expect(html).toContain('Nothing to install')
    expect(html).toContain('QR code of the merchant pay-link')
    expect(html).toContain(link)
    expect(html).toContain('Print this sheet')
    expect(html).not.toMatch(/USDT|Tether|ethereum:/i)

    const matrix = qrMatrix(link)
    const rects = [...html.matchAll(/<rect x="(\d+)" y="(\d+)" width="1" height="1"/g)]
    expect(rects.length).toBe(darkCount(link))
    for (const match of rects) {
      expect(matrix.dark(Number(match[1]) - QR_QUIET, Number(match[2]) - QR_QUIET)).toBe(true)
    }
    expect(html).toContain(`viewBox="0 0 ${matrix.size + QR_QUIET * 2} ${matrix.size + QR_QUIET * 2}"`)

    for (const text of Object.values(stallSources)) expect(text).not.toMatch(/USDT|Tether/i)

    const printBlock = css.slice(css.lastIndexOf('@media print'))
    expect(printBlock.length).toBeGreaterThan(40)
    expect(printBlock).toContain('.stall-controls')
    expect(printBlock).toContain('.topbar')
    expect(printBlock).toContain('.legal-footer')
    expect(printBlock).toContain('.stall-sheet')
    expect(printBlock).toContain('.stall-qr')
    expect(printBlock).toContain('display: none')
    expect(printBlock).toContain('110mm')
    expect(appSource).toContain('Print market stall sheet')
    expect(appSource).toContain('href="#stall"')
  })

  it('keeps the pay-link an https merchant URL and the stall route separate from Base', () => {
    expect(() => stallPayLink('   ', 'https://example.com/agoratap/')).toThrow(/Merchant name is required/)
    expect(() => stallPayLink('a'.repeat(81), 'https://example.com/agoratap/')).toThrow(/too long/)
    expect(() => stallPayLink('Ada\u0000', 'https://example.com/agoratap/')).toThrow(/invalid characters/)
    expect(() => stallPayLink('Ada', 'javascript:alert(1)')).toThrow(/http/)
    expect(qrMatrix(stallPayLink('ț'.repeat(80), 'https://example.github.io/agoratap/')).size).toBeGreaterThan(20)

    expect(stallRouteFromLocation({ hash: '#stall', search: '?pay=Ada' })).toBe('stall')
    expect(stallRouteFromLocation({ hash: '', search: '?pay=Ada' })).toBe('pay')
    expect(stallRouteFromLocation({ hash: '', search: '' })).toBeNull()
    expect(stallRouteFromLocation({ hash: '#merchant', search: '?pay=Ada' })).toBeNull()
    expect(nextStallLocation('https://example.com/agoratap/', 'stall')).toBe('https://example.com/agoratap/#stall')
    expect(nextStallLocation('https://example.com/agoratap/?pay=Ada', 'other')).toBe('https://example.com/agoratap/')
    expect(nextStallLocation('https://example.com/agoratap/#stall', 'other')).toBe('https://example.com/agoratap/')
    expect(nextStallLocation('https://example.com/agoratap/?pay=Ada', 'pay')).toBe('https://example.com/agoratap/?pay=Ada')

    const empty = renderToStaticMarkup(createElement(StallSheet, { pageHref: 'https://example.com/agoratap/', onBack: () => {} }))
    expect(empty).toContain('Scanează și plătește cu ce crypto ai')
    expect(empty).not.toContain('<svg')
    expect(empty).toContain('disabled')

    const pay = renderToStaticMarkup(createElement(StallPay, { merchantName: NAME, onBack: () => {} }))
    expect(pay).toContain(NAME)
    expect(pay).toContain('Scan and pay with any crypto you hold')
    expect(pay).toContain('any-in → any-out')
    expect(pay).not.toContain('<svg')
    expect(pay).not.toMatch(/USDT/i)
  })

  it('opens #stall and ?pay= from the address bar', () => {
    withLocation({ hash: '#stall', search: '', href: 'https://example.com/agoratap/#stall' }, () => {
      const html = renderToStaticMarkup(createElement(App))
      expect(html).toContain('Print one sheet. Nothing to install.')
      expect(html).toContain('Scanează și plătește cu ce crypto ai')
      expect(html).toContain('Scan and pay with any crypto you hold')
      expect(html).toContain('Base is an optional rail only')
      expect(html).not.toMatch(/USDT/)
    })
    withLocation({ hash: '', search: '?pay=Piața+Obor', href: 'https://example.com/agoratap/?pay=Piața+Obor' }, () => {
      const html = renderToStaticMarkup(createElement(App))
      expect(html).toContain('Piața Obor')
      expect(html).toContain('Scan and pay with any crypto you hold')
      expect(html).toContain('Prefer USDC, EURC, BTC or ETH.')
      expect(html).not.toMatch(/USDT/)
      expect(html).not.toContain('stall-qr')
      expect(html).not.toContain('QR code of the merchant pay-link')
    })
  })

  it('draws QR modules in the same coordinates the encoder paints', () => {
    const text = stallPayLink('Ada', 'https://example.com/agoratap/')
    const matrix = qrMatrix(text)
    const code = QRCode.create(text, { errorCorrectionLevel: 'Q' })
    expect(matrix.size).toBe(code.modules.size)
    expect(matrix.dark(0, 0)).toBe(true)
    expect(matrix.dark(1, 1)).toBe(false)
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        expect(matrix.dark(col, row)).toBe(Boolean(code.modules.data[row * matrix.size + col]))
      }
    }
    const other = qrMatrix(stallPayLink('Ida', 'https://example.com/agoratap/'))
    let same = other.size === matrix.size
    if (same) {
      for (let row = 0; row < matrix.size; row++) {
        for (let col = 0; col < matrix.size; col++) if (matrix.dark(col, row) !== other.dark(col, row)) same = false
      }
    }
    expect(same).toBe(false)
  })
})
