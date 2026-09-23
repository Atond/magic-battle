import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import axe from 'axe-core'

// Garde-fou d'infrastructure (T-18a, ADR-20) : prouve que les tests de tests/ui/ tournent dans un vrai
// Chromium (Vitest browser mode + Playwright), pas dans jsdom. jsdom ne fait aucune mise en page réelle —
// getBoundingClientRect() y renvoie toujours des zéros, donc une cible tactile de 44 px (EXG-35/EXG-51)
// n'y serait jamais mesurable. Ce test ne couvre PAS les vrais composants HUD/canvas à venir (T-19+) : il
// ne prouve que l'infrastructure, pas l'absence de régression d'accessibilité ailleurs.
describe('environnement navigateur (Vitest browser mode + Playwright)', () => {
  it('mesure une vraie mise en page (44px) et ne remonte aucune violation axe-core', async () => {
    const { getByRole } = render(
      <button
        type="button"
        aria-label="Cible tactile de démonstration"
        style={{ display: 'block', width: '44px', height: '44px', padding: 0, border: 0 }}
      >
        44
      </button>,
    )

    const bouton = getByRole('button', { name: 'Cible tactile de démonstration' })
    const rect = bouton.getBoundingClientRect()
    // jsdom rendrait ces deux valeurs à 0 : c'est la preuve que Chromium est bien là.
    expect(rect.width).toBe(44)
    expect(rect.height).toBe(44)

    const resultats = await axe.run(bouton)
    expect(resultats.violations.length).toBe(0)
  })
})
