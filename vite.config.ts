/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// base = nom du dépôt GitHub Pages (https://atond.github.io/magic-battle/). Remettre '/' si domaine custom.
export default defineConfig({
  base: '/magic-battle/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
