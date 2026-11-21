import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.tsx'

// Used by scripts/prerender.mjs to put the page text in dist/index.html.
export function render() {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
