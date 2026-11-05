// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { trackedDemoLink } from './lib/outreachRef'

const REF = 'c1-btcmap-608'

function copyButton(): HTMLButtonElement | null {
  return document.querySelector('button.ref-copy')
}

describe('personal link copy', () => {
  let root: Root | null = null
  let host: HTMLDivElement | null = null
  const writeText = vi.fn<(text: string) => Promise<void>>()

  afterEach(async () => {
    vi.useRealTimers()
    if (root) await act(async () => { root?.unmount() })
    host?.remove()
    root = null
    host = null
    localStorage.clear()
  })

  async function renderAt(search: string) {
    if (root) await act(async () => { root?.unmount() })
    host?.remove()
    window.history.replaceState(null, '', `/${search}`)
    localStorage.clear()
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => { root?.render(createElement(App)) })
  }

  it('shows Copy link only with a valid ref notice and copies the tracked demo URL', async () => {
    await renderAt('')
    expect(document.querySelector('.ref-notice')).toBeNull()
    expect(copyButton()).toBeNull()
    expect(document.body.textContent).not.toContain('Personal link')
    expect(document.body.textContent).not.toContain('Copy link')

    await renderAt('?ref=%3Cscript%3E')
    expect(document.querySelector('.ref-notice')).toBeNull()
    expect(copyButton()).toBeNull()
    expect(writeText).not.toHaveBeenCalled()

    await renderAt(`?ref=${REF}`)
    expect(document.body.textContent).toContain(`Personal link: ${REF}. Your readiness sprint request will carry this tag.`)
    expect(copyButton()?.textContent).toBe('Copy link')
    const sprint = document.querySelector('a.primary[href^="mailto:"]') as HTMLAnchorElement | null
    expect(sprint).not.toBeNull()
    expect(decodeURIComponent(sprint!.href)).toContain(`[ref:${REF}]`)

    vi.useFakeTimers()
    await act(async () => { copyButton()!.click() })
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(trackedDemoLink(REF))
    expect(trackedDemoLink(REF)).toBe('https://agoratap.github.io/agoratap/?ref=c1-btcmap-608')
    expect(copyButton()?.textContent).toBe('Copied')

    await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
    expect(copyButton()?.textContent).toBe('Copied')
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(copyButton()?.textContent).toBe('Copy link')

    writeText.mockRejectedValueOnce(new Error('denied'))
    await act(async () => { copyButton()!.click() })
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(copyButton()?.textContent).toBe('Copy link')
  })
})
