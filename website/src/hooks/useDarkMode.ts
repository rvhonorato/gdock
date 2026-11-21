import { useSyncExternalStore } from 'react'

// The inline script in index.html sets the class before the first paint.
// The class on <html> is the source of truth.
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark')
}

// The prerendered page is always light. React corrects it after hydration.
function getServerSnapshot() {
  return false
}

function toggle() {
  const isDark = document.documentElement.classList.toggle('dark')
  try {
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  } catch {
    // Storage can be blocked. The theme still changes for this visit.
  }
  listeners.forEach(listener => listener())
}

export function useDarkMode() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { isDark, toggle }
}
