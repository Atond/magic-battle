// Stockage plein (reste de la vague 2) : une écriture de la sauvegarde principale qui lève (quota
// dépassé, `QuotaExceededError`, stockage refusé) ne fait jamais tomber le store, et `stockagePlein`
// prévient l'UI ; la première écriture réussie l'éteint. Doubles de `doubles.ts`, jamais `localStorage`.
//
// Faute attrapée : l'exception avalée sans rien dire (état d'avant ce correctif), ou un drapeau qui ne
// retombe jamais. Faute qu'il ne verrait pas seul : un vrai `localStorage` qui avale l'erreur au lieu de
// la lever — c'est `tests/ui/persistance-navigateur.test.tsx` (quota réel dans Chromium) qui la voit.

import { describe, expect, it } from 'vitest'

import { INTERVALLE_AUTOSAVE_MS } from '../../src/domain/constantes-moteur.ts'
import { etatInitial } from '../../src/domain/moteur.ts'
import { NOM_PRINCIPAL } from '../../src/domain/sauvegarde/index.ts'
import { NOM_VERROU, PREFIXE_STOCKAGE } from '../../src/state/constantes.ts'
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
} from './doubles.ts'

const T0 = 1_700_000_000_000
const CLE_PRINCIPALE = `${PREFIXE_STOCKAGE}${NOM_PRINCIPAL}`
const CLE_VERROU = `${PREFIXE_STOCKAGE}${NOM_VERROU}`

/** Double de `doubles.ts` enveloppé : les clés listées dans `refusees` lèvent comme un quota plein. */
function creerStockageQuiRefuse(): Stockage & { refusees: Set<string> } {
  const base = creerStockageFactice()
  const refusees = new Set<string>()
  return {
    refusees,
    lire: base.lire,
    supprimer: base.supprimer,
    ecrire: (cle, valeur) => {
      if (refusees.has(cle)) throw new DOMException('quota dépassé', 'QuotaExceededError')
      base.ecrire(cle, valeur)
    },
  }
}

function demarrer(stockage: Stockage) {
  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage,
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: 'onglet-quota',
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial,
  })
  confirmerDemarrage(planificateur)
  return { store, planificateur }
}

describe('stockage plein — la progression n’est plus sauvegardée, le joueur le sait', () => {
  it('quota plein dès le démarrage : le store démarre quand même, `stockagePlein` est levé', () => {
    const stockage = creerStockageQuiRefuse()
    stockage.refusees.add(CLE_PRINCIPALE)
    const { store } = demarrer(stockage)
    try {
      expect(store.getState().pret).toBe(true)
      expect(store.getState().droitEcriture).toBe(true)
      expect(store.getState().stockagePlein).toBe(true)
    } finally {
      store.arreter()
    }
  })

  it('auto-sauvegarde refusée → drapeau levé ; la suivante réussit → drapeau retombé', () => {
    const stockage = creerStockageQuiRefuse()
    const { store, planificateur } = demarrer(stockage)
    try {
      expect(store.getState().stockagePlein).toBe(false)

      stockage.refusees.add(CLE_PRINCIPALE)
      expect(() => planificateur.declencherIntervallesDe(INTERVALLE_AUTOSAVE_MS)).not.toThrow()
      expect(store.getState().stockagePlein).toBe(true)

      stockage.refusees.delete(CLE_PRINCIPALE)
      planificateur.declencherIntervallesDe(INTERVALLE_AUTOSAVE_MS)
      expect(store.getState().stockagePlein).toBe(false)
    } finally {
      store.arreter()
    }
  })

  it('une écriture de verrou réussie n’éteint pas le drapeau : seule la sauvegarde principale compte', () => {
    const stockage = creerStockageQuiRefuse()
    stockage.refusees.add(CLE_PRINCIPALE)
    const { store } = demarrer(stockage)
    try {
      expect(store.getState().stockagePlein).toBe(true)
      store.stockage.ecrire(CLE_VERROU, JSON.stringify({ idProprietaire: 'onglet-quota', dernierHeartbeatMs: T0 }))
      expect(store.getState().stockagePlein).toBe(true)
    } finally {
      store.arreter()
    }
  })

  it('une clé hors de l’espace magic-battle: reste une faute bruyante, jamais avalée comme un quota', () => {
    const { store } = demarrer(creerStockageFactice())
    try {
      expect(() => store.stockage.ecrire('sauvegarde', 'x')).toThrow(/magic-battle:/)
    } finally {
      store.arreter()
    }
  })
})
