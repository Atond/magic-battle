// Rendu de texte hostile (T-19/T-23b, EXG-47). Vrai navigateur (Vitest browser mode + Playwright,
// ADR-20) : preuve d'exécution, pas seulement de syntaxe — le grep de `scripts/verify.sh` attrape
// l'écriture d'un appel dangereux dans `src/`, mais pas un contournement sémantique. Ce fichier prouve
// que le résultat affiché est littéral, contre les VRAIS composants et le VRAI pipeline d'import, pas un
// composant-jouet qui ne prouve rien sur le code réellement livré (défaut relevé en revue lecture seule).
//
// Deux points d'entrée distincts, chacun avec sa propre raison d'être testé séparément :
//  1. `EcranSauvegardeIllisible` — `illisible.message` vient de `ErreurImport.message` (domaine) ; il
//     traverse ce composant comme une chaîne interpolée en JSX (`src/components/hud/
//     EcranSauvegardeIllisible.tsx` le documente explicitement).
//  2. `CanvasCombat` — `cible.nom` (`Monstre`/`Boss`) est un champ `texte(LONGUEUR_TEXTE_MAX)` du schéma
//     de sauvegarde (`src/domain/sauvegarde/schema.ts`) : la validation borne sa LONGUEUR, mais ne filtre
//     aucun caractère. Le test passe donc par le VRAI pipeline (`store.actions.importer`, la seule entrée
//     non fiable documentée par `src/domain/sauvegarde/index.ts`) pour prouver que rien, ni le schéma ni
//     le moteur, ne nettoie cette charge avant qu'elle n'atteigne le miroir DOM — c'est bien à la couche
//     d'affichage, et seulement à elle, de ne jamais l'interpréter comme balisage.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { etatInitial } from '../../src/domain/moteur.ts'
import { exporterTexte } from '../../src/domain/sauvegarde/index.ts'
import type { EtatJeu, Monstre } from '../../src/domain/types.ts'
import { CanvasCombat } from '../../src/canvas/CanvasCombat.tsx'
import { EcranSauvegardeIllisible } from '../../src/components/hud/EcranSauvegardeIllisible.tsx'
import { creerStoreJeu } from '../../src/state/store.ts'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from '../state/doubles.ts'

const T0 = 1_700_000_000_000
const CHARGE_HOSTILE = '<img src=x onerror="window.__exg47 = true">'

async function attendreFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
}

describe('rendu de texte hostile — jamais interprété comme balisage (EXG-47)', () => {
  it('un message de sauvegarde illisible hostile s’affiche comme texte littéral, sans exécuter de script', () => {
    // @ts-expect-error — sonde posée par le test, jamais par le code applicatif.
    delete window.__exg47

    const planificateur = creerPortPlanificateurFactice()
    const store = creerStoreJeu({
      horloge: creerHorlogeFactice(T0),
      stockage: creerStockageFactice(),
      canal: creerCanalFactice(),
      matchMedia: creerMatchMediaFactice(),
      idOnglet: 'onglet-hostile-illisible',
      portPage: creerPortPageFactice(),
      portPlanificateur: planificateur,
      etatInitial,
    })
    confirmerDemarrage(planificateur)

    const { unmount } = render(
      <EcranSauvegardeIllisible
        store={store}
        illisible={{ motif: 'jsonIllisible', message: CHARGE_HOSTILE, secoursRestaurable: false }}
      />,
    )

    try {
      // Le message hostile apparaît deux fois dans le composant (résumé + détail technique) : les deux
      // occurrences doivent rester du texte littéral.
      const occurrences = document.body.querySelectorAll('p')
      const textesAvecCharge = [...occurrences].filter((p) => p.textContent === CHARGE_HOSTILE)
      expect(textesAvecCharge.length).toBeGreaterThan(0)
      expect(document.querySelector('img')).toBeNull()
      // @ts-expect-error — sonde posée par le test.
      expect(window.__exg47).toBeUndefined()
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('un nom de monstre hostile, réellement importé par le pipeline de sauvegarde, s’affiche comme texte littéral dans le miroir DOM du canvas', async () => {
    // @ts-expect-error — sonde posée par le test, jamais par le code applicatif.
    delete window.__exg47

    const cibleHostile: Monstre = { nom: CHARGE_HOSTILE, pvMax: 100, pvCourants: 42, orAuMeurtre: 5 }
    const etatHostile: EtatJeu = { ...etatInitial(T0), combat: { ...etatInitial(T0).combat, cible: cibleHostile } }
    const texteHostile = exporterTexte(etatHostile, T0)

    const planificateur = creerPortPlanificateurFactice()
    const store = creerStoreJeu({
      horloge: creerHorlogeFactice(T0),
      stockage: creerStockageFactice(),
      canal: creerCanalFactice(),
      matchMedia: creerMatchMediaFactice(),
      idOnglet: 'onglet-hostile-canvas',
      portPage: creerPortPageFactice(),
      portPlanificateur: planificateur,
      etatInitial,
    })
    confirmerDemarrage(planificateur)

    // Passe par le VRAI pipeline d'import (la seule entrée non fiable, EXG-46/47) : preuve que le schéma
    // n'a filtré aucun caractère de `nom`, seulement borné sa longueur.
    const resultat = store.getState().actions.importer(texteHostile)
    expect(resultat.ok).toBe(true)
    expect(store.getState().etat.combat.cible?.nom).toBe(CHARGE_HOSTILE)

    const { getByTestId: getByTestIdCanvas, unmount } = render(<CanvasCombat store={store} />)

    try {
      await attendreFrames(2)
      const pv = getByTestIdCanvas('pv-cible')
      // Le miroir DOM interpole `cible.pvMax`/`pvCourants`, pas `cible.nom` — mais `MiroirCombat` lit
      // `cible?.nom` dans son annonce `aria-live` dès qu'un monstre est vaincu. On vérifie ici surtout
      // que rien, nulle part dans l'arbre rendu par `CanvasCombat`, n'a interprété la charge comme
      // balisage : ni `<img>`, ni exécution du gestionnaire `onerror`.
      expect(pv.textContent).not.toBe('')
      expect(document.querySelector('img')).toBeNull()
      // @ts-expect-error — sonde posée par le test.
      expect(window.__exg47).toBeUndefined()
    } finally {
      unmount()
      store.arreter()
    }
  })
})
