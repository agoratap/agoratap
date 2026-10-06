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
