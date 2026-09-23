// Actions de store de la vague 3 — `acheterNoeudAscension` (EXG-40) et `entrerZoneFinale` (EXG-28).
// Ce fichier prouve le **branchement** (l'action appelle bien le guichet du domaine, avec la bonne
// monnaie, et seulement quand l'onglet joue) ; les règles elles-mêmes (coût, prérequis, seuil) sont
// testées dans `tests/domain/ascension.test.ts` et `tests/domain/fin.test.ts`.
//
// Toutes les attentes chiffrées se lisent dans le domaine (`coutRangNoeud`, `apercuFin`) : aucun nombre
// d'équilibrage n'est recopié ici.

import { describe, expect, it } from 'vitest'

import { etatInitial } from '../../src/domain/moteur.ts'
import { apercuFin } from '../../src/domain/fin/index.ts'
import { coutRangNoeud, noeudParId } from '../../src/domain/prestige/arbre.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { DELAI_CONFIRMATION_VERROU_MS } from '../../src/state/constantes.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from './doubles.ts'
import { creerMonde } from './monde.ts'

const T0 = 1_700_000_000_000
const SEUIL = CONSTANTES.fin.nAscensionsRequises

function etatAvec(points: number, ascensions: number, extra: Partial<EtatJeu> = {}) {
  return (horodatageMs: number): EtatJeu => {
    const base = etatInitial(horodatageMs)
    return {
      ...base,
      bourse: { ...base.bourse, pointsAscension: points },
      ascension: { ...base.ascension, ascensionsEffectuees: ascensions, sixiemeEcoleDebloquee: ascensions > 0 },
      ...extra,
    }
  }
}

function ouvrir(etatInitialFn: (horodatageMs: number) => EtatJeu) {
  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage: creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: 'onglet-actions-v3',
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial: etatInitialFn,
  })
  confirmerDemarrage(planificateur)
  expect(store.getState().droitEcriture).toBe(true)
  return store
}

describe('EXG-40 — acheterNoeudAscension (store)', () => {
  it('débite le coût du domaine en Points d’Ascension et monte le rang ; les Éclats ne bougent pas', () => {
    const store = ouvrir(etatAvec(100, 1))
    const noeud = noeudParId('ascension-or-depart', CONSTANTES)!
    const cout = coutRangNoeud(0, noeud, CONSTANTES)
    const eclatsAvant = store.getState().etat.bourse.eclatsDepensables
    try {
      store.getState().actions.acheterNoeudAscension(noeud.id)
      const etat = store.getState().etat
      expect(etat.bourse.pointsAscension).toBe(100 - cout)
      expect(etat.ascension.rangsArbreAscension[noeud.id]).toBe(1)
      expect(etat.bourse.eclatsDepensables).toBe(eclatsAvant)
    } finally {
      store.arreter()
    }
  })

  it('sans assez de points, ou prérequis manquant : état rendu tel quel (même référence)', () => {
    const pauvre = ouvrir(etatAvec(0, 1))
    try {
      const avant = pauvre.getState().etat
      pauvre.getState().actions.acheterNoeudAscension('ascension-or-depart')
      expect(pauvre.getState().etat).toBe(avant)
    } finally {
      pauvre.arreter()
    }

    // `ascension-autocast-glace` exige `ascension-autocast-feu` ; 100 points suffiraient largement.
    const riche = ouvrir(etatAvec(100, 1))
    try {
      const avant = riche.getState().etat
      riche.getState().actions.acheterNoeudAscension('ascension-autocast-glace')
      expect(riche.getState().etat).toBe(avant)
    } finally {
      riche.arreter()
    }
  })

  it('un nœud d’Éclats présenté au guichet d’Ascension est refusé (mauvaise monnaie)', () => {
    const store = ouvrir(etatAvec(100, 1))
    try {
      const avant = store.getState().etat
      store.getState().actions.acheterNoeudAscension('eclats-degats-1')
      expect(store.getState().etat).toBe(avant)
    } finally {
      store.arreter()
    }
  })
})

describe('EXG-28 — entrerZoneFinale (store)', () => {
  it('au seuil d’Ascensions : le boss final est armé à PV et chrono pleins (lus dans apercuFin)', () => {
    const store = ouvrir(etatAvec(0, SEUIL))
    try {
      expect(store.getState().etat.bossFinal).toBeUndefined()
      store.getState().actions.entrerZoneFinale()
      const apercu = apercuFin(store.getState().etat, CONSTANTES)
      expect(store.getState().etat.bossFinal).toEqual({ pvCourants: apercu.pvBossFinal, timerRestantMs: apercu.timerMs })
    } finally {
      store.arreter()
    }
  })

  it('sous le seuil, ou partie terminée : aucun effet', () => {
    for (const fabrique of [etatAvec(0, SEUIL - 1), etatAvec(0, SEUIL, { partieTerminee: true })]) {
      const store = ouvrir(fabrique)
      try {
        const avant = store.getState().etat
        store.getState().actions.entrerZoneFinale()
        expect(store.getState().etat).toBe(avant)
      } finally {
        store.arreter()
      }
    }
  })
})

describe('EXG-48 — onglet secondaire : les deux actions sont sans effet', () => {
  it('le second onglet voit la partie du premier mais ne peut ni acheter ni entrer', () => {
    const monde = creerMonde()
    const fabrique = etatAvec(100, SEUIL)
    const a = monde.ouvrir('A', fabrique)
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS)
    expect(a.store.getState().droitEcriture).toBe(true)
    const b = monde.ouvrir('B', fabrique)
    try {
      expect(b.store.getState().lectureSeule).toBe(true)
      const etatB = b.store.getState().etat
      // Précondition : ces deux gestes réussiraient chez le propriétaire (sinon le test ne prouverait rien).
      expect(etatB.bourse.pointsAscension).toBe(100)
      expect(etatB.ascension.ascensionsEffectuees).toBe(SEUIL)

      b.store.getState().actions.acheterNoeudAscension('ascension-or-depart')
      b.store.getState().actions.entrerZoneFinale()
      expect(b.store.getState().etat.bourse.pointsAscension, 'achat de nœud en lecture seule').toBe(100)
      expect(b.store.getState().etat.bossFinal, 'entrée en zone finale en lecture seule').toBeUndefined()
      expect(b.store.getState().etat).toBe(etatB)
    } finally {
      a.store.arreter()
      b.store.arreter()
    }
  })
})
