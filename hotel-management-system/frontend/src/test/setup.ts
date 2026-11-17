import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { signInAs } from './auth'

// jsdom has no layout engine; Recharts' ResponsiveContainer needs ResizeObserver to exist.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// jsdom has no matchMedia; react-hot-toast uses it for prefers-reduced-motion.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// findBy*/waitFor wait up to 10 s. They return as soon as the UI is ready, so passing tests are not slowed;
// the headroom is for debounced inputs on a busy machine, where a full parallel run can take several seconds per render.
configure({ asyncUtilTimeout: 10_000 })

// Tests run signed in as the administrator unless they sign in as another role (src/test/auth.ts).
beforeEach(() => {
  signInAs('ADMIN')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
