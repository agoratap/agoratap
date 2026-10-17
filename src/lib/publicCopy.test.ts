import { describe, expect, it } from 'vitest'

const files = import.meta.glob(
  ['../../README.md', '../../index.html', '../../SECURITY.md', '../../vite.config.ts', '../../docs/**/*.md', '../**/*.ts', '../**/*.tsx'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const isTest = (path: string) => /\.(test|spec)\.ts$/.test(path)
const publicFiles = Object.entries(files).filter(([path]) => !isTest(path))

/** A Network fee line that prints a euro amount, including split markup such as Network fee</span><strong>€0.00. */
const NETWORK_FEE_EURO = /Network fee(?:(?!Network fee)[^€]){0,80}€\s*\d/

describe('public copy', () => {
  it('public copy avoids the banned non-EU wording and does not hard-code a Network fee euro amount', () => {
    expect(publicFiles.length).toBeGreaterThan(10)
    const offenders: string[] = []
    for (const [path, text] of publicFiles) {
      if (/\bunrestricted\b/i.test(text)) offenders.push(`${path}: unrestricted`)
      if (NETWORK_FEE_EURO.test(text)) offenders.push(`${path}: Network fee euro amount`)
    }
    expect(offenders).toEqual([])
    const readme = files['../../README.md']
    const app = files['../App.tsx']
    expect(readme).toContain('Non-EU merchants: subject to local law and sanctions')
    expect(readme).toContain('not available for EU yet')
    expect(readme).toContain('does not create an Exolix order')
    expect(app).toContain('Non-EU merchants: subject to local law and sanctions')
    expect(app).toMatch(/Network fee:<\/span><strong>simulated<\/strong>/)
    expect(files['../../index.html']).toContain('Non-EU merchants: subject to local law and sanctions')
  })
})
