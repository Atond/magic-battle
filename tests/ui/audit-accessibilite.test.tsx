// Audit axe-core sur la liste complète des états d'écran (T-22, spec §16 T-22, §12, EXG-31/32).
// `violations = 0` **et** `incomplete` de `color-contrast` = 0 sur chacun, à 1440 px et 375 px où les
// deux mises en page diffèrent (`aide-audit.ts` documente pourquoi les deux compteurs sont distincts).
//
// États couverts, rendus par le code réel de T-19/T-21/T-23a/T-23b (aucun état factice) :
//  - vide (nouvelle partie, `etatInitial`) ;
//  - chargement (`store.pret === false`, avant tout démarrage) ;
//  - erreur EXG-27 (`sauvegardeIllisible`, construite en écrivant un texte non-JSON sous la clé
//    principale et en laissant le vrai pipeline d'import du domaine le rejeter — jamais un état forgé) ;
//  - jeu en cours (`Disposition`) ;
//  - résumé hors-ligne (`EncartHorsLigne`, construit en écrivant une vraie sauvegarde exportée avec un
//    `derniereSauvegardeMs` ancien, créditée par le vrai `calculHorsLigne` au démarrage) ;
//  - confirmation prestige, étapes 1 et 2 ;
//  - confirmation Ascension, étapes 1 et 2 ;
//  - bandeau lecture seule ;
//  - chaque onglet mobile (Écoles / Améliorations / Prestige), 375 px seulement (n'existe pas à 1440 px).
//
// Une régression trouvée en écrivant ce fichier (corrigée ici, pas contournée) : `opacity-70` sur les
// cartes verrouillées (écoles scellées, sorts verrouillés) diluait le texte atténué vers le fond de page
// réel (composite alpha, pas le fond de carte affiché) sous 4,5:1 — retiré de `PanneauEcoles.tsx` et
// `BarreSorts.tsx`. Une deuxième : la règle axe `region` rejetait la barre d'onglets mobile, restée hors
// de tout point de repère — `Disposition.tsx` l'enveloppe désormais dans un `<main>`. Une troisième :
// `role="alert"` sur un `<main>` n'est pas un rôle autorisé (`aria-allowed-role`) — `EcranSauvegardeIllisible.tsx`
// porte l'alerte sur un `<div>` imbriqué, le `<main>` garde son rôle implicite.

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
import { exporterTexte } from '../../src/domain/sauvegarde/index.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { EcranSauvegardeIllisible } from '../../src/components/hud/EcranSauvegardeIllisible.tsx'
import { TEXTES_UI } from '../../src/donnees/textes-ui.ts'
import { useStoreJeu } from '../../src/state/hooks.ts'
import type { StoreJeuApi } from '../../src/state/store.ts'
import { CLE_PRINCIPALE, T0, auditerSansViolation, creerStoreDeTest, visible } from './aide-audit.ts'
import { creerStockageFactice } from '../state/doubles.ts'

function EcranChargement() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--couleur-charbon-950)] text-[var(--couleur-charbon-texte)]">
      <p>{TEXTES_UI.chargement}</p>
    </main>
  )
}

/** Reproduit exactement la branche `illisible` d'`App.tsx`, sans son store câblé sur les ports réels. */
function EcranErreurPossible({ store }: { readonly store: StoreJeuApi }) {
  const illisible = useStoreJeu(store, (s) => s.sauvegardeIllisible)
  if (illisible === null) throw new Error('précondition du test : la sauvegarde doit être illisible')
  return <EcranSauvegardeIllisible store={store} illisible={illisible} />
}

describe('T-22 — audit axe-core, état vide et chargement', () => {
  it('nouvelle partie (vide), jeu en cours — 1440 px', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { unmount } = render(<Disposition store={store} />)
    await auditerSansViolation()
    unmount()
    store.arreter()
  })

  it('nouvelle partie (vide), jeu en cours — 375 px, onglet Écoles par défaut', async () => {
    await page.viewport(375, 800)
    const store = creerStoreDeTest()
    const { unmount } = render(<Disposition store={store} />)
    await auditerSansViolation()
    unmount()
    store.arreter()
  })

  it('chargement (store.pret === false) — 1440 et 375 px', async () => {
    for (const [largeur, hauteur] of [[1440, 900] as const, [375, 800] as const]) {
      await page.viewport(largeur, hauteur)
      const { unmount } = render(<EcranChargement />)
      await auditerSansViolation()
      unmount()
    }
  })
})

describe('T-22 — audit axe-core, erreur EXG-27 (sauvegarde illisible)', () => {
  function ecrireSauvegardeIllisible() {
    const stockage = creerStockageFactice()
    stockage.ecrire(CLE_PRINCIPALE, 'ceci n’est pas du JSON valide')
    return stockage
  }

  it('écran EXG-27 — 1440 px', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest({ stockage: ecrireSauvegardeIllisible() })
    expect(store.getState().sauvegardeIllisible).not.toBeNull()
    const { unmount } = render(<EcranErreurPossible store={store} />)
    await auditerSansViolation()
    unmount()
    store.arreter()
  })

  it('écran EXG-27 — 375 px', async () => {
    await page.viewport(375, 800)
    const store = creerStoreDeTest({ stockage: ecrireSauvegardeIllisible() })
    const { unmount } = render(<EcranErreurPossible store={store} />)
    await auditerSansViolation()
    unmount()
    store.arreter()
  })
})

describe('T-22 — audit axe-core, résumé hors-ligne (EXG-4/53)', () => {
  it('encart hors-ligne visible après un vrai calculHorsLigne — 1440 et 375 px', async () => {
    const GAP_MS = 5 * 3_600_000 // 5 h : largement au-dessus du seuil d'affichage.
    for (const [largeur, hauteur] of [[1440, 900] as const, [375, 800] as const]) {
      await page.viewport(largeur, hauteur)
      const stockage = creerStockageFactice()
      const ancien = { ...etatInitial(T0 - GAP_MS), derniereSauvegardeMs: T0 - GAP_MS }
      stockage.ecrire(CLE_PRINCIPALE, exporterTexte(ancien, T0 - GAP_MS))
      const store = creerStoreDeTest({ stockage })
      expect(store.getState().resumeHorsLigne).not.toBeNull()
      const { unmount } = render(<Disposition store={store} />)
      await auditerSansViolation()
      unmount()
      store.arreter()
    }
  })
})

describe('T-22 — audit axe-core, bandeau lecture seule (EXG-48)', () => {
  it('bandeau visible — 1440 et 375 px', async () => {
    for (const [largeur, hauteur] of [[1440, 900] as const, [375, 800] as const]) {
      await page.viewport(largeur, hauteur)
      const store = creerStoreDeTest()
      const { unmount } = render(<Disposition store={store} />)
      // `lectureSeule` est un état lu par les composants (garde côté moteur déjà couverte ailleurs,
      // T-23a) ; le poser directement ici audite l'affichage réel du bandeau, pas la mécanique du verrou.
      store.setState({ lectureSeule: true, motifLectureSeule: 'ongletSecondaire' })
      await auditerSansViolation()
      unmount()
      store.arreter()
    }
  })
})

describe('T-22 — audit axe-core, confirmation prestige (EXG-19/21)', () => {
  it('étape 1 puis étape 2 — 1440 et 375 px', async () => {
    for (const [largeur, hauteur] of [[1440, 900] as const, [375, 800] as const]) {
      await page.viewport(largeur, hauteur)
      const store = creerStoreDeTest()
      const { getAllByTestId, getByRole, unmount } = render(<Disposition store={store} />)

      // À 375 px, `PanneauPrestige` mobile n'est monté qu'à la sélection de l'onglet « Prestige »
      // (state React de `Disposition.tsx`, pas un `hidden` CSS) : sans ce clic, seul le bouton
      // desktop existe dans le DOM (masqué en CSS, largeur 0), et `visible()` ne trouverait rien.
      if (largeur < 1024) await userEvent.click(getByRole('tab', { name: 'Prestige' }))

      await userEvent.click(visible(getAllByTestId('bouton-declencher-prestige')))
      const etape1 = getByRole('dialog', { name: 'Recommencer le run ?' })
      await auditerSansViolation()

      const continuer = [...etape1.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')!
      await userEvent.click(continuer)
      getByRole('dialog', { name: 'Confirme le prestige' })
      await auditerSansViolation()

      unmount()
      store.arreter()
    }
  })
})

describe('T-22 — audit axe-core, confirmation Ascension (EXG-20/21)', () => {
  function etatAscensionDisponible(horodatageMs: number) {
    const base = etatInitial(horodatageMs)
    return { ...base, prestige: { ...base.prestige, prestigesDuCycle: 6, eclatsCumulesAVie: 100 } }
  }

  it('étape 1 puis étape 2 — 1440 et 375 px', async () => {
    for (const [largeur, hauteur] of [[1440, 900] as const, [375, 800] as const]) {
      await page.viewport(largeur, hauteur)
      const store = creerStoreDeTest({ etatInitialFn: etatAscensionDisponible })
      const { getAllByTestId, getByRole, unmount } = render(<Disposition store={store} />)

      if (largeur < 1024) await userEvent.click(getByRole('tab', { name: 'Prestige' }))

      await userEvent.click(visible(getAllByTestId('bouton-declencher-ascension')))
      const etape1 = getByRole('dialog', { name: 'Ascensionner ?' })
      await auditerSansViolation()

      const continuer = [...etape1.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')!
      await userEvent.click(continuer)
      getByRole('dialog', { name: 'Confirme l’Ascension' })
      await auditerSansViolation()

      unmount()
      store.arreter()
    }
  })
})

describe('T-22 — audit axe-core, onglets mobiles (375 px seulement — absents à 1440 px)', () => {
  it.for(['Écoles', 'Améliorations', 'Prestige'] as const)('onglet %s', async (nomOnglet) => {
    await page.viewport(375, 800)
    const store = creerStoreDeTest()
    const { getByRole, unmount } = render(<Disposition store={store} />)
    await userEvent.click(getByRole('tab', { name: nomOnglet }))
    await auditerSansViolation()
    unmount()
    store.arreter()
  })
})
