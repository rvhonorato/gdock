// @vitest-environment node
import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'
import manifest from '../public/manifest.webmanifest?raw'

describe('seo', () => {
  it('has valid JSON-LD with the DOI and the code repository', () => {
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1]
    const data = JSON.parse(json ?? '')
    expect(data.identifier).toContain('10.5281/zenodo.')
    expect(data.codeRepository).toMatch(/^https:\/\//)
  })

  it('has the twitter card tags', () => {
    for (const name of ['title', 'description', 'image']) {
      expect(html).toContain(`name="twitter:${name}"`)
    }
  })

  it('links a manifest that exists', () => {
    expect(html).toContain('href="/manifest.webmanifest"')
    expect(JSON.parse(manifest).name).toBe('gdock')
  })
})
