import { describe, expect, it } from 'vitest'

const workflow = (import.meta.glob('../../.github/workflows/pages.yml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../../.github/workflows/pages.yml']

describe('GitHub Pages', () => {
  it('pages workflow still deploys a main branch push', () => {
    expect(workflow).toContain('branches: [main]')
    expect(workflow).toContain('npm run build')
    expect(workflow).toContain('npm test')
    expect(workflow).toContain('actions/upload-pages-artifact@v3')
    expect(workflow).toContain('actions/deploy-pages@v4')
    expect(workflow).toContain('path: dist')
    expect(workflow).not.toMatch(/branches:\s*\[[^\]]*cursor\//)
  })
})
