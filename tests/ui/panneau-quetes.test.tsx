// Panneau de quêtes (T-26, EXG-54 / EXG-10). Attentes lues dans `CONSTANTES.quetes` et `TEXTES_QUETES`,
// jamais recopiées : si le simulateur change un seuil, l'objectif affiché et ce test suivent ensemble.
//
// Ce que ce fichier prouve :
//  1. toutes les quêtes du contrat sont listées, avec nom, description, objectif chiffré (seuil passé
//     par `formater`), Renommée gagnée ;
//  2. l'état accompli / pas encore vient du moteur (`quetesAccomplies`), en toutes lettres ;
//  3. le libellé de travail `libelle` de `constantes.ts` n'est jamais affiché ;
//  4. place : colonne droite à 1440 px, onglet « Améliorations » à 375 px.

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { act, render } from '@testing-library/react'

import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
import { formater } from '../../src/domain/notation.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { TEXTES_QUETES } from '../../src/donnees/quetes.ts'
import { TEXTES_UI } from '../../src/donnees/textes-ui.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { creerStoreDeTest } from './aide-audit.ts'

const PREMIERE = CONSTANTES.quetes[0]!

function etatAvecPremiereQuete(horodatageMs: number): EtatJeu {
  return { ...etatInitial(horodatageMs), quetesAccomplies: [PREMIERE.id] }
}

function objectifAttendu(q: (typeof CONSTANTES.quetes)[number]): string {
  if (q.typeJalon === 'zoneAtteinte') return TEXTES_UI.quetes.objectifZone(formater(q.seuil))
  if (q.typeJalon === 'monstresTues') return TEXTES_UI.quetes.objectifMonstres(formater(q.seuil))
  return TEXTES_UI.quetes.objectifPremierPrestige
}

describe('panneau de quêtes (T-26)', () => {
  it('1440 px : toutes les quêtes, objectif chiffré, Renommée, état — dans la colonne droite', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest({ etatInitialFn: etatAvecPremiereQuete })
    const { getByRole, unmount } = render(<Disposition store={store} />)
    try {
      const panneau = getByRole('region', { name: TEXTES_UI.quetes.titre })
      const cartes = panneau.querySelectorAll('li')
      expect(cartes).toHaveLength(CONSTANTES.quetes.length)

      for (const q of CONSTANTES.quetes) {
        const carte = panneau.querySelector(`[data-testid="quete-${q.id}"]`)!
        const texte = carte.textContent!
        expect(texte, q.id).toContain(TEXTES_QUETES[q.id]!.nom)
        expect(texte, q.id).toContain(TEXTES_QUETES[q.id]!.description)
        expect(texte, q.id).toContain(objectifAttendu(q))
        expect(texte, q.id).toContain(TEXTES_UI.quetes.recompense(formater(q.renommeeGagnee)))
        expect(texte, q.id).not.toContain(q.libelle)
        const accomplie = q.id === PREMIERE.id
        expect(texte, q.id).toContain(accomplie ? TEXTES_UI.quetes.accomplie : TEXTES_UI.quetes.pasEncore)
      }

      // Colonne droite : à droite du combat, alignée avec la colonne des achats.
      const combat = getByRole('region', { name: TEXTES_UI.combat.titre })
      const ameliorations = getByRole('region', { name: TEXTES_UI.ameliorations.titre })
      expect(panneau.getBoundingClientRect().left).toBeGreaterThanOrEqual(combat.getBoundingClientRect().right)
      expect(panneau.getBoundingClientRect().left).toBe(ameliorations.getBoundingClientRect().left)
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('l’état suit `quetesAccomplies` en direct : « Pas encore » → « Accomplie » sans remontage', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { getByRole, unmount } = render(<Disposition store={store} />)
    try {
      const carte = () =>
        getByRole('region', { name: TEXTES_UI.quetes.titre }).querySelector(`[data-testid="quete-${PREMIERE.id}"]`)!
      expect(carte().textContent).toContain(TEXTES_UI.quetes.pasEncore)
      act(() => store.setState({ etat: etatAvecPremiereQuete(0) }))
      expect(carte().textContent).toContain(TEXTES_UI.quetes.accomplie)
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('375 px : dans l’onglet « Améliorations », absent de l’onglet « Écoles »', async () => {
    await page.viewport(375, 800)
    const store = creerStoreDeTest()
    const { getByRole, queryByRole, unmount } = render(<Disposition store={store} />)
    try {
      expect(queryByRole('region', { name: TEXTES_UI.quetes.titre })).toBeNull()
      await userEvent.click(getByRole('tab', { name: TEXTES_UI.onglets.ameliorations }))
      expect(getByRole('region', { name: TEXTES_UI.quetes.titre }).getBoundingClientRect().width).toBeGreaterThan(0)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
    } finally {
      unmount()
      store.arreter()
    }
  })
})
