// Stockage plein (reste de la vague 2) : écriture principale refusée (quota). Même patron que l'encart
// hors-ligne EXG-53 (`bandeau-lecture-seule-et-hors-ligne.test.tsx`) : élément de flux, jamais par-dessus
// une cible de jeu — mesuré sur **toutes** les cibles visibles, à 375 et 1440 px (piège 10 du skill).
//
// Texte attendu lu dans `TEXTES_UI`, jamais recopié.

import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { act, render } from '@testing-library/react'

import '../../src/index.css'

import { INTERVALLE_AUTOSAVE_MS } from '../../src/domain/constantes-moteur.ts'
import { etatInitial } from '../../src/domain/moteur.ts'
import { exporterTexte } from '../../src/domain/sauvegarde/index.ts'
import { TEXTES_UI } from '../../src/donnees/textes-ui.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { creerStoreJeu } from '../../src/state/store.ts'
import type { Stockage } from '../../src/state/ports.ts'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from '../state/doubles.ts'
import { CLE_PRINCIPALE, T0, auditerSansViolation } from './aide-audit.ts'

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

describe('stockage plein — message clair, non bloquant, retiré à la prochaine écriture réussie', () => {
  function creerStockageQuiRefuse() {
    const base = creerStockageFactice()
    base.ecrire(CLE_PRINCIPALE, exporterTexte(etatInitial(T0), T0))
    let refuse = false
    return {
      refuser: (v: boolean) => {
        refuse = v
      },
      stockage: {
        lire: base.lire,
        supprimer: base.supprimer,
        ecrire: (cle: string, valeur: string) => {
          if (refuse && cle === CLE_PRINCIPALE) throw new DOMException('quota dépassé', 'QuotaExceededError')
          base.ecrire(cle, valeur)
        },
      } satisfies Stockage,
    }
  }

  it.each([375, 1440])('à %dpx : apparaît au refus, sans chevaucher de cible, disparaît au succès suivant', async (largeur) => {
    await page.viewport(largeur, 900)
    const { stockage, refuser } = creerStockageQuiRefuse()
    const planificateur = creerPortPlanificateurFactice()
    const store = creerStoreJeu({
      horloge: creerHorlogeFactice(T0),
      stockage,
      canal: creerCanalFactice(),
      matchMedia: creerMatchMediaFactice(),
      idOnglet: 'onglet-quota-ui',
      portPage: creerPortPageFactice(),
      portPlanificateur: planificateur,
      etatInitial,
    })
    confirmerDemarrage(planificateur)
    const { getByTestId, queryByTestId, unmount } = render(<Disposition store={store} />)
    try {
      expect(queryByTestId('encart-stockage-plein')).toBeNull()

      refuser(true)
      act(() => planificateur.declencherIntervallesDe(INTERVALLE_AUTOSAVE_MS))
      const encart = getByTestId('encart-stockage-plein')
      expect(encart.textContent).toBe(TEXTES_UI.stockagePlein.message)
      expect(encart.getAttribute('role')).toBe('alert')
      aucunChevauchement(encart)
      await auditerSansViolation()

      refuser(false)
      act(() => planificateur.declencherIntervallesDe(INTERVALLE_AUTOSAVE_MS))
      expect(queryByTestId('encart-stockage-plein')).toBeNull()
    } finally {
      unmount()
      store.arreter()
    }
  })
})
