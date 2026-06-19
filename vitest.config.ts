import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // escapeHtml uses document.createElement, so we need a DOM.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
