import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AddressCheck } from './AddressCheck'
import { OFAC_LIST, type OfacList } from './lib/screening'

const render = (value: string, list?: OfacList) =>
  renderToStaticMarkup(createElement(AddressCheck, { value, onChange: () => {}, list }))
const listed = Object.keys(OFAC_LIST.addresses).find((a) => /^0x[0-9a-f]{40}$/.test(a))!

describe('AddressCheck (merchant UI)', () => {
  it('renders a visible warning, not a block, for a listed address', () => {
    const html = render(listed.toUpperCase().replace('0X', '0x'))
    expect(html).toContain('role="alert"')
    expect(html).toMatch(/appears on the public OFAC sanctions list/)
    expect(html).toMatch(/You decide/)
    expect(html).not.toMatch(/disabled/) // never blocks anything
  })

  it('renders a neutral note for an address that is not on the snapshot', () => {
    const html = render('0x00000000000000000000000000000000000000aa')
    expect(html).not.toContain('role="alert"')
    expect(html).toMatch(/Not on the OFAC snapshot/)
  })

  it('renders list not loaded when the list is empty and never says not on the snapshot', () => {
    const html = render('0x00000000000000000000000000000000000000aa', { source: '', downloadedAt: '', count: 0, addresses: {} })
    expect(html).toMatch(/list not loaded/i)
    expect(html).not.toMatch(/Not on the OFAC snapshot/)
  })

  it('always shows the snapshot date and the may-be-outdated label', () => {
    const html = render('')
    expect(html).toContain(OFAC_LIST.downloadedAt)
    expect(html).toMatch(/may be incomplete or outdated/i)
  })
})

describe('AddressCheck EU list', () => {
  it('warns for an address on the EU consolidated list and states EU names are not checked', () => {
    const html = render('0x3051Ca7cB7f6C599fA2f27385AD75010cf0f2bbF')
    expect(html).toContain('role="alert"')
    expect(html).toMatch(/appears on the public EU sanctions list/)
    expect(html).toMatch(/EU consolidated list snapshot of \d{4}-\d{2}-\d{2}/)
    expect(html).toMatch(/names not checked/)
    expect(html).not.toMatch(/disabled/)
  })
})

describe('AddressCheck UK list', () => {
  it('warns for an address on the UK Sanctions List and shows the UK snapshot date', () => {
    const html = render('TCQqA58EmX6AnUZKPCogL2Q441B4ThbJGN')
    expect(html).toContain('role="alert"')
    expect(html).toMatch(/appears on the public UK sanctions list/)
    expect(html).toMatch(/UK Sanctions List snapshot of \d{4}-\d{2}-\d{2}/)
    expect(html).not.toMatch(/disabled/)
  })
})
