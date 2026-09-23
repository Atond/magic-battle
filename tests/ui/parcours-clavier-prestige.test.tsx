// Parcours clavier jusqu'au premier prestige, sans souris (T-22, spec §16 T-22, EXG-34). Aucun
// `userEvent.click` : uniquement `Tab`/`Shift+Tab` pour déplacer le focus et `Enter`/`Espace` pour
// activer — le même geste qu'un vrai clavier physique, jamais `store.actions.prestige(...)` appelé à la
// main ni un état construit directement (le déclenchement passe par le vrai moteur, `apercuPrestige`
// rend le prestige disponible dès la zone 1, donc aucun combat n'est nécessaire pour l'atteindre).
//
// Vrai navigateur (Vitest browser mode + Playwright, ADR-20) : la navigation `Tab` dépend de l'ordre de
// focus réel du DOM (position, `tabindex`), que jsdom ne calcule pas fidèlement.

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { creerStoreDeTest, visible } from './aide-audit.ts'

/** Presse `Tab` jusqu'à ce que l'élément focalisé corresponde au prédicat, ou lève après `max` essais. */
async function tabJusqua(predicat: () => boolean, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (predicat()) return
    await userEvent.tab()
  }
  throw new Error(`Tab répété ${max} fois sans atteindre la cible (focus actuel : ${document.activeElement?.outerHTML})`)
}

describe('T-22 — parcours clavier jusqu’au premier prestige, sans souris (EXG-34)', () => {
  it('Tab + Entrée seuls déclenchent et confirment le premier prestige', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)

    expect(store.getState().etat.prestige.prestigesTotal).toBe(0)

    // Atteindre le bouton « déclencher le prestige » à coups de Tab (jamais de clic direct).
    const boutonPrestige = visible(getAllByTestId('bouton-declencher-prestige'))
    await tabJusqua(() => document.activeElement === boutonPrestige)
    await userEvent.keyboard('{Enter}')

    const etape1 = getByRole('dialog', { name: 'Recommencer le run ?' })
    // Focus initial déjà sur « Annuler » (T-23b) : Tab une fois pour atteindre « Continuer ».
    const continuer = [...etape1.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')!
    await tabJusqua(() => document.activeElement === continuer)
    await userEvent.keyboard('{Enter}')

    const etape2 = getByRole('dialog', { name: 'Confirme le prestige' })
    const confirmer = [...etape2.querySelectorAll('button')].find((b) => b.textContent?.includes('Confirmer'))!
    await tabJusqua(() => document.activeElement === confirmer)
    await userEvent.keyboard('{Enter}')

    expect(store.getState().etat.prestige.prestigesTotal).toBe(1)
    expect(store.getState().etat.combat.zone).toBe(1)

    unmount()
    store.arreter()
  })
})
