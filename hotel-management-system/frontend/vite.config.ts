/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// Canonical mock dataset shared with the backend (see ../shared/README.md).
const seedDir = fileURLToPath(new URL('../shared/seed', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@seed': seedDir,
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Pre-bundle libraries used only by lazy routes, so the dev server never re-optimises
    // mid-session (which would load a second copy of React and break hooks).
    include: ['recharts', 'react-router-dom', '@tanstack/react-query', 'react-hot-toast', 'lucide-react', 'axios'],
  },
  build: {
    rolldownOptions: {
      output: {
        // Long-term-cacheable vendor chunks, separate from app code and mock data.
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory-vendor)/, priority: 2 },
            { name: 'forms', test: /node_modules[\\/](react-hook-form|zod|@hookform)/, priority: 2 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), seedDir],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    // Full-page tests render the whole app; give them headroom when the suite runs in parallel.
    testTimeout: 30_000,
    // Lazy page modules (with the charting library) are pre-loaded in beforeAll hooks.
    hookTimeout: 30_000,
    // jsdom page tests are CPU-heavy: one worker per core starves them on laptops (especially on battery)
    // and makes timing-dependent tests flaky. Half the cores is about as fast and far more stable.
    maxWorkers: '50%',
  },
})
