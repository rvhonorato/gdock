// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { render } from './entry-server'

describe('prerender', () => {
  const html = render()

  it('has one h1', () => {
    expect(html.match(/<h1[ >]/g)).toHaveLength(1)
  })

  it('has the name in the h1', () => {
    expect(html).toMatch(/<h1[^>]*>.*gdock/s)
  })

  it('has all the sections', () => {
    for (const id of ['gdock', 'algorithm', 'performance', 'installation', 'cli']) {
      expect(html).toContain(`id="${id}"`)
    }
  })

  it('has the text of the inactive tabs', () => {
    expect(html).toContain('gdock restraints')
  })
})
