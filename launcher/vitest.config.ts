import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  },
  // vitest 4 removed `environmentMatchGlobs` from the typed InlineConfig
  // (migration target is `test.projects`), but the runtime still honours it.
  // Phase 2 intentionally stays on the glob shape — `test.projects` is a later
  // refactor. Cast keeps the exact key shape the plan pins.
  test: {
    environmentMatchGlobs: [
      ['src/renderer/**', 'jsdom'],
      ['src/main/**', 'node'],
      ['src/preload/**', 'node']
    ],
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
})
