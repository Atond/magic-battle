/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { playwright } from '@vitest/browser-playwright'

// base = nom du dépôt GitHub Pages (https://atond.github.io/magic-battle/). Remettre '/' si domaine custom.
export default defineConfig({
  base: '/magic-battle/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    // Deux projets, `npm test` (vitest run) lance les deux. jsdom n'a jamais sa place ici (ADR-20) : la
    // couche moteur/domaine tourne en Node pur, la couche UI a besoin d'une vraie mise en page.
    projects: [
      {
        test: {
          name: 'domaine',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'ui',
          // Les relevés informatifs (`*.mesure.tsx`, EVAL-002) ne bloquent jamais : hors `npm test` et hors
          // hook Stop, lancés à la demande par `npm run mesure:frame`.
          include: process.env.MESURE ? ['tests/ui/**/*.mesure.tsx'] : ['tests/ui/**/*.test.tsx'],
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
