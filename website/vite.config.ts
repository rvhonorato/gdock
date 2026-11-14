import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

// The structured data in index.html shows the version of the workspace.
const cargoToml = readFileSync(new URL('../Cargo.toml', import.meta.url), 'utf8')
const gdockVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargoToml)?.[1]

function gdockVersionInHtml(): Plugin {
  if (!gdockVersion) throw new Error('no version in ../Cargo.toml')
  return {
    name: 'gdock-version-in-html',
    transformIndexHtml: html => html.replaceAll('%GDOCK_VERSION%', gdockVersion),
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
          include: ['react-dom/client', 'fflate', 'katex'],
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
