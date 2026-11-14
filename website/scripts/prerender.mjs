// Put the server-rendered page into the built index.html.
// Usage: node scripts/prerender.mjs [dist dir] [ssr bundle dir]
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const distDir = resolve(process.argv[2] ?? 'dist')
const ssrDir = resolve(process.argv[3] ?? 'node_modules/.tmp/ssr')

const { render } = await import(pathToFileURL(resolve(ssrDir, 'entry-server.js')).href)

const indexPath = resolve(distDir, 'index.html')
const template = readFileSync(indexPath, 'utf8')
const marker = '<div id="root"></div>'
if (!template.includes(marker)) {
  throw new Error(`${indexPath} has no empty root element`)
}

// A function, so "$" in the page text is not read as a replace pattern.
writeFileSync(indexPath, template.replace(marker, () => `<div id="root">${render()}</div>`))
console.log(`prerendered ${indexPath}`)
