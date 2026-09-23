// Écran de fin (EXG-28, spec §12 « test d'intégration UI (vague 3) »). Intégration de bout en bout sur
// le code réel : l'état de victoire est produit par le **moteur** (`ascensionner` jusqu'au seuil lu dans
// `CONSTANTES.fin`, `entrerZoneFinale`, `avancerBossFinal`), exporté par le vrai pipeline de sauvegarde,
// relu par le vrai démarrage du store, puis rendu par `Disposition`. Aucun état forgé à la main pour
// `partieTerminee`/`statistiquesFin`.
//
// Limite assumée (voir le rapport de vague 3) : le combat final n'est pas encore branché dans la boucle
// du moteur (`tick`/`appliquerClic`/`lancerSort` n'appellent jamais `avancerBossFinal`) et l'UI n'offre
// donc pas d'entrée dans la zone finale. Ce test couvre tout ce qui suit la victoire.

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { ascensionner } from '../../src/domain/ascension/index.ts'
import { avancerBossFinal, entrerZoneFinale, statistiquesDeFin } from '../../src/domain/fin/index.ts'
import { etatInitial } from '../../src/domain/moteur.ts'
import { formater } from '../../src/domain/notation.ts'
import { exporterTexte } from '../../src/domain/sauvegarde/index.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { pvBossFinal } from '../../src/domain/zones/index.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { TEXTES_FIN } from '../../src/donnees/fin.ts'
import { TEXTES_UI } from '../../src/donnees/textes-ui.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { formaterDuree } from '../../src/state/presentation.ts'
import { creerStockageFactice } from '../state/doubles.ts'
import { CLE_PRINCIPALE, T0, auditerSansViolation, creerStoreDeTest } from './aide-audit.ts'

/** Durée de jeu simulée posée avant la victoire : l'écran doit la montrer telle que le moteur la fige. */
const DUREE_MS = 47 * 3_600_000 + 12 * 60_000
const ZONE_MAX = 118

/** Partie gagnée, construite pas à pas par le moteur. */
function partieGagnee(): EtatJeu {
  let etat: EtatJeu = etatInitial(T0)
  for (let i = 0; i < CONSTANTES.fin.nAscensionsRequises; i += 1) {
    const pret: EtatJeu = {
      ...etat,
      prestige: {
        ...etat.prestige,
        prestigesDuCycle: CONSTANTES.ascension.prestigesParAscension,
        eclatsCumulesAVie: Math.max(etat.prestige.eclatsCumulesAVie, 100),
      },
    }
    const resultat = ascensionner(pret, CONSTANTES)
    expect(resultat.accepte, `Ascension ${i + 1}`).toBe(true)
    etat = resultat.etat
  }
  etat = {
    ...etat,
    tempsJeuMs: DUREE_MS,
    prestige: { ...etat.prestige, zoneMaxDuRun: ZONE_MAX, prestigesTotal: 25 },
  }
  const entree = entrerZoneFinale(etat, CONSTANTES)
  expect(entree.accepte).toBe(true)
  const victoire = avancerBossFinal(entree.etat, pvBossFinal(CONSTANTES), 100, CONSTANTES)
  expect(victoire.bossVaincu).toBe(true)
  return victoire.etat
}

function stockageGagne() {
  const stockage = creerStockageFactice()
  stockage.ecrire(CLE_PRINCIPALE, exporterTexte(partieGagnee(), T0))
  return stockage
}

describe('EXG-28 — écran de fin après la victoire sur le boss final', () => {
  it.each([375, 1440])('à %dpx : titre, texte, durée totale, zone max, Ascensions — puis retour au HUD', async (largeur) => {
    await page.viewport(largeur, 900)
    const store = creerStoreDeTest({ stockage: stockageGagne() })
    const { getByRole, getByTestId, queryByTestId, unmount } = render(<Disposition store={store} />)
    try {
      const stats = statistiquesDeFin(store.getState().etat)
      expect(stats).not.toBeNull()

      const ecran = getByTestId('ecran-fin')
      expect(getByRole('heading', { level: 1, name: TEXTES_FIN.ecranFin.titre })).toBe(document.activeElement)
      for (const ligne of TEXTES_FIN.ecranFin.lignes) expect(ecran.textContent).toContain(ligne)

      expect(getByTestId('fin-duree').textContent).toBe(formaterDuree(DUREE_MS))
      expect(getByTestId('fin-zone-max').textContent).toBe(formater(ZONE_MAX))
      expect(getByTestId('fin-ascensions').textContent).toBe(formater(CONSTANTES.fin.nAscensionsRequises))
      expect(getByTestId('fin-prestiges').textContent).toBe(formater(stats!.prestigesTotal))

      // Le HUD n'est pas monté par-dessus : un seul `<main>`, celui de l'écran de fin.
      expect(document.querySelectorAll('main')).toHaveLength(1)
      expect(queryByTestId('bouton-clic')).toBeNull()
      await auditerSansViolation()

      await userEvent.click(getByRole('button', { name: TEXTES_UI.fin.continuer }))
      expect(queryByTestId('ecran-fin')).toBeNull()
      expect(store.getState().etat.partieTerminee).toBe(true)
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('partie non terminée : aucun écran de fin', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { queryByTestId, unmount } = render(<Disposition store={store} />)
    try {
      expect(queryByTestId('ecran-fin')).toBeNull()
    } finally {
      unmount()
      store.arreter()
    }
  })
})
