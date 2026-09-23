// Encarts non bloquants de la vague 3 : narration (T-27 — intro au premier lancement, ligne de la n-ième
// Ascension juste après elle). Même patron que l'encart
// hors-ligne EXG-53 (`bandeau-lecture-seule-et-hors-ligne.test.tsx`) : élément de flux, jamais par-dessus
// une cible de jeu — mesuré sur **toutes** les cibles visibles, à 375 et 1440 px (piège 10 du skill).
//
// Textes attendus lus dans `TEXTES_FIN`/`TEXTES_UI`, jamais recopiés.

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
import { exporterTexte } from '../../src/domain/sauvegarde/index.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { TEXTES_FIN } from '../../src/donnees/fin.ts'
import { TEXTES_UI } from '../../src/donnees/textes-ui.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import type { Stockage } from '../../src/state/ports.ts'
import { creerStockageFactice } from '../state/doubles.ts'
import { CLE_PRINCIPALE, T0, auditerSansViolation, creerStoreDeTest, visible } from './aide-audit.ts'

function seChevauchent(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** Toutes les cibles de jeu visibles hors de l'encart ne le chevauchent jamais. */
function aucunChevauchement(encart: HTMLElement): void {
  const rect = encart.getBoundingClientRect()
  expect(rect.width).toBeGreaterThan(0)
  const cibles = [...document.querySelectorAll<HTMLElement>('button, [role="tab"], [role="switch"]')].filter(
    (el) => !encart.contains(el) && el.getBoundingClientRect().width > 0,
  )
  expect(cibles.length).toBeGreaterThan(0)
  for (const cible of cibles) {
    expect(seChevauchent(rect, cible.getBoundingClientRect()), cible.textContent ?? '').toBe(false)
  }
}

/** Une sauvegarde existe déjà (partie en cours) : c'est elle que le démarrage relit, pas `etatInitial`. */
function stockageAvecSauvegarde(etat: EtatJeu = etatInitial(T0)): Stockage {
  const stockage = creerStockageFactice()
  stockage.ecrire(CLE_PRINCIPALE, exporterTexte(etat, T0))
  return stockage
}

/** Ascension disponible tout de suite (mêmes réglages que `audit-accessibilite.test.tsx`). */
function etatAscensionDisponible(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return { ...base, prestige: { ...base.prestige, prestigesDuCycle: 6, eclatsCumulesAVie: 100 } }
}

describe('narration — intro au premier lancement (T-27)', () => {
  it.each([375, 1440])('à %dpx : nouvelle partie → intro, sans chevaucher de cible, fermable', async (largeur) => {
    await page.viewport(largeur, 900)
    const store = creerStoreDeTest() // stockage vide : c'est une nouvelle partie
    const { getByTestId, queryByTestId, unmount } = render(<Disposition store={store} />)
    try {
      const encart = getByTestId('encart-narration')
      expect(encart.getAttribute('role')).toBe('status')
      expect(encart.textContent).toContain(TEXTES_FIN.intro)
      aucunChevauchement(encart)
      await auditerSansViolation()
      await userEvent.click(encart.querySelector('button')!)
      expect(queryByTestId('encart-narration')).toBeNull()
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('partie existante : pas d’intro', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest({ stockage: stockageAvecSauvegarde() })
    const { queryByTestId, unmount } = render(<Disposition store={store} />)
    try {
      expect(store.getState().partieNeuve).toBe(false)
      expect(queryByTestId('encart-narration')).toBeNull()
    } finally {
      unmount()
      store.arreter()
    }
  })
})

describe('narration — une ligne juste après la n-ième Ascension (T-27)', () => {
  it('Ascension confirmée par de vrais clics → la ligne de la 1ʳᵉ Ascension', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest({ stockage: stockageAvecSauvegarde(etatAscensionDisponible(T0)) })
    const { getAllByTestId, getByRole, getByTestId, queryByTestId, unmount } = render(<Disposition store={store} />)
    try {
      expect(queryByTestId('encart-narration')).toBeNull()
      await userEvent.click(visible(getAllByTestId('bouton-declencher-ascension')))
      const etape1 = getByRole('dialog', { name: TEXTES_UI.ascension.etape1Titre })
      await userEvent.click([...etape1.querySelectorAll('button')].find((b) => b.textContent === TEXTES_UI.ascension.etape1Continuer)!)
      const etape2 = getByRole('dialog', { name: TEXTES_UI.ascension.etape2Titre })
      await userEvent.click([...etape2.querySelectorAll('button')].find((b) => b.textContent === TEXTES_UI.ascension.confirmer)!)

      expect(store.getState().etat.ascension.ascensionsEffectuees).toBe(1)
      const encart = getByTestId('encart-narration')
      expect(encart.textContent).toContain(TEXTES_FIN.ascensions[0])
      aucunChevauchement(encart)
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('recharger après une Ascension ne rejoue pas la ligne (référence prise au montage)', async () => {
    await page.viewport(1440, 900)
    const deja = (h: number): EtatJeu => {
      const base = etatInitial(h)
      return { ...base, ascension: { ...base.ascension, ascensionsEffectuees: 2 } }
    }
    const store = creerStoreDeTest({ stockage: stockageAvecSauvegarde(deja(T0)) })
    const { queryByTestId, unmount } = render(<Disposition store={store} />)
    try {
      expect(store.getState().etat.ascension.ascensionsEffectuees).toBe(2)
      expect(queryByTestId('encart-narration')).toBeNull()
    } finally {
      unmount()
      store.arreter()
    }
  })
})
