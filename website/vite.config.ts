import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

// The structured data in index.html shows the version of the workspace.
function workspaceVersion(): string {
  const cargoToml = readFileSync(new URL('../Cargo.toml', import.meta.url), 'utf8')
  const section = /^\[workspace\.package\]\n((?:(?!\[).*\n?)*)/m.exec(cargoToml)?.[1]
  const version = section && /^version\s*=\s*"([^"]+)"/m.exec(section)?.[1]
  if (!version) throw new Error('no version in [workspace.package] of ../Cargo.toml')
  return version
}

// Set SITE_URL for staging or preview builds, so they do not claim the production URL.
const siteUrl = (process.env.SITE_URL ?? 'https://gdock.org').replace(/\/+$/, '')

function gdockVersionInHtml(): Plugin {
  return {
    name: 'gdock-version-in-html',
    apply: 'build',
    transformIndexHtml: html =>
      html
        .replaceAll('%GDOCK_VERSION%', workspaceVersion())
        .replaceAll('%SITE_URL%', siteUrl),
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
  </url>
</urlset>
`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), gdockVersionInHtml()],
  base: '/',
  optimizeDeps: {
    exclude: ['gdock-wasm'],
  },
  // gdock-wasm is a link to ../wasm/pkg, which is outside the Vite root.
  // Keep the node_modules path so Vite can serve the .wasm file.
  resolve: { preserveSymlinks: true },
  test: {
    projects: [
      {
        // Node environment: pure utility tests (no WASM, no DOM needed)
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/**/*.browser.test.tsx'],
          environment: 'jsdom',
        },
      },
      {
        // Browser environment: tests that need real WASM + DOM
        plugins: [react()],
        optimizeDeps: {
          // Keep gdock-wasm unoptimized so import.meta.url points to the real
          // node_modules path and Vite can serve the .wasm file next to it.
          exclude: ['gdock-wasm'],
          // Pre-bundle these to avoid mid-test page reloads.
          include: [
            'react-dom/client',
            'fflate',
            'katex',
            // Molstar loads on demand, so Vite does not find it at startup.
            'molstar/lib/mol-plugin-ui',
            'molstar/lib/mol-plugin-ui/react18',
            'molstar/lib/mol-plugin-ui/spec',
            'molstar/lib/mol-script/language/builder',
            'molstar/lib/mol-util/color',
            'molstar/lib/mol-model/structure',
            'molstar/lib/mol-data/int',
          ],
        },
        resolve: { preserveSymlinks: true },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
