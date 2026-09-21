import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Le squelette a un seul invariant qui casse silencieusement la mise en ligne : la `base` de Vite.
// Si elle ne vaut plus le nom du dépôt, GitHub Pages sert une page blanche sans erreur de build.
describe('squelette du projet', () => {
  it('garde base = /magic-battle/ pour GitHub Pages', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
    expect(config).toContain("base: '/magic-battle/'")
  })
})
