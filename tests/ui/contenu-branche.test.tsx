// Vague 3 — branchement du contenu écrit dans le HUD (T-24/T-25/T-27). Chaque attente lit la constante
// de contenu (`TEXTES_*`), jamais un littéral : si le narrateur réécrit un nom, ce test suit.
//
// Ce que ce fichier prouve :
//  1. écoles, sorts (nom + description accessible), améliorations, équipement et nœuds d'Éclats
//     affichent leurs textes définitifs, jamais un identifiant du moteur ;
//  2. la région et son ambiance s'affichent à côté de la zone ;
//  3. le miroir DOM du canvas nomme la cible d'après la région et la vague, jamais d'après le `nom` de
//     l'état (vide côté moteur, non fiable côté sauvegarde) ;
//  4. l'annonce `aria-live` nomme le monstre **vaincu**, pas celui qui le remplace.

import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { act, render } from '@testing-library/react'

import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu, IdEcole, Monstre } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { TEXTES_AMELIORATIONS } from '../../src/donnees/ameliorations.ts'
import { TEXTES_NOEUDS } from '../../src/donnees/arbres.ts'
import { TEXTES_ECOLES } from '../../src/donnees/ecoles.ts'
import { TEXTES_EQUIPEMENT } from '../../src/donnees/equipement.ts'
import { TEXTES_SORTS } from '../../src/donnees/sorts.ts'
import { TEXTES_UI } from '../../src/donnees/textes-ui.ts'
import { TEXTES_REGIONS } from '../../src/donnees/zones.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { creerStoreDeTest, visible } from './aide-audit.ts'

/** Zone 12 (2ᵉ région), vague 1, une cible à 1 PV : un clic l'achève. */
function etatZone12(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  const cible: Monstre = { nom: 'NOM_DE_L_ETAT_JAMAIS_AFFICHE', pvMax: 1, pvCourants: 1, orAuMeurtre: 1 }
  return {
    ...base,
    combat: { ...base.combat, zone: 12, vague: 1, phase: 'vague', cible },
    prestige: { ...base.prestige, zoneMaxDuRun: 12 },
  }
}

describe('vague 3 — textes définitifs dans les panneaux', () => {
  // Revue de fin de vague 3 : la carte scellée de la Lumière invitait à « taper un boss » alors qu'elle
  // n'est révélée que par une Ascension (`requiertAscension`). Le texte doit suivre la règle du moteur.
  it('école scellée : le texte dit comment la révéler (boss de zone ou Ascension)', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { getByRole, unmount } = render(<Disposition store={store} />)
    try {
      const ecoles = getByRole('region', { name: TEXTES_UI.ecoles.titre }).textContent ?? ''
      const scellees = (Object.keys(CONSTANTES.ecoles) as IdEcole[]).filter((id) => id !== 'feu')
      const parAscension = scellees.filter((id) => CONSTANTES.ecoles[id].requiertAscension)
      expect(parAscension.length).toBeGreaterThan(0)
      expect(ecoles.split(TEXTES_UI.ecoles.verrouilleeDetailAscension).length - 1).toBe(parAscension.length)
      expect(ecoles.split(TEXTES_UI.ecoles.verrouilleeDetail).length - 1).toBe(scellees.length - parAscension.length)
    } finally {
      unmount()
    }
  })

  it('1440 px : écoles, sorts, améliorations, équipement, nœuds d’Éclats', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)
    try {
      const ecoles = getByRole('region', { name: TEXTES_UI.ecoles.titre })
      expect(ecoles.textContent).toContain(TEXTES_ECOLES.feu.nom)
      expect(ecoles.textContent).toContain(TEXTES_ECOLES.feu.description)

      // Sort 1 : nom visible, description reliée par `aria-describedby` (lue par les lecteurs d'écran).
      const sort1 = visible(getAllByTestId('sort-1'))
      expect(sort1.getAttribute('aria-label')).toContain(TEXTES_SORTS['sort-feu'].nom)
      const idDescription = sort1.getAttribute('aria-describedby')
      expect(idDescription).not.toBeNull()
      expect(document.getElementById(idDescription!)?.textContent).toBe(TEXTES_SORTS['sort-feu'].description)
      // L'id vient de `useId` : les deux barres (desktop + mobile) n'en partagent jamais un.
      const ids = getAllByTestId('sort-1').map((el) => el.getAttribute('aria-describedby'))
      expect(new Set(ids).size).toBe(ids.length)

      const ameliorations = getByRole('region', { name: TEXTES_UI.ameliorations.titre })
      for (const t of Object.values(TEXTES_AMELIORATIONS)) {
        expect(ameliorations.textContent).toContain(t.nom)
        expect(ameliorations.textContent).toContain(t.description)
      }
      const equipement = getByRole('region', { name: TEXTES_UI.equipement.titre })
      for (const t of Object.values(TEXTES_EQUIPEMENT)) {
        expect(equipement.textContent).toContain(t.nom)
        expect(equipement.textContent).toContain(t.description)
      }
      const arbre = getByRole('region', { name: TEXTES_UI.arbreEclats.titre })
      for (const [id, t] of Object.entries(TEXTES_NOEUDS).filter(([id]) => id.startsWith('eclats-'))) {
        expect(arbre.textContent, id).toContain(t.nom)
        expect(arbre.textContent, id).toContain(t.description)
      }
      // Aucun identifiant du moteur ne fuit à l'écran.
      expect(document.body.textContent).not.toMatch(/eclats-|amelioration-|equipement-|sort-feu|ecole3/)
    } finally {
      unmount()
      store.arreter()
    }
  })
})

describe('vague 3 — région, cible nommée, annonce', () => {
  it('zone 12 : 2ᵉ région affichée (bandeau + ambiance), cible baptisée par la région et la vague', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest({ etatInitialFn: etatZone12 })
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)
    const region = TEXTES_REGIONS[1]!
    try {
      expect(getByRole('banner').textContent).toContain(region.nom)
      expect(document.body.textContent).toContain(region.ambiance)

      const nomCible = visible(getAllByTestId('nom-cible'))
      expect(nomCible.textContent).toBe(region.monstres[0])
      expect(document.body.textContent).not.toContain('NOM_DE_L_ETAT_JAMAIS_AFFICHE')

      // Le clic achève la cible (1 PV) : le moteur passe à la vague 2.
      act(() => store.getState().actions.clic())
      expect(store.getState().etat.combat.vague).toBe(2)
      expect(visible(getAllByTestId('nom-cible')).textContent).toBe(region.monstres[1])

      // L'annonce nomme le monstre vaincu (vague 1), pas son remplaçant (vague 2).
      const annonce = visible(getAllByTestId('annonce-combat').map((el) => el.parentElement!))
      expect(annonce.querySelector('[data-testid="annonce-combat"]')!.textContent).toBe(
        TEXTES_UI.combat.monstreVaincu(region.monstres[0]),
      )
    } finally {
      unmount()
      store.arreter()
    }
  })
})
