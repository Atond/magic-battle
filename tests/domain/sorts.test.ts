// Miroir de `src/domain/sorts/` — T-4, EXG-11 (sort de clic sans cooldown) et EXG-12 (cooldown), plus le
// drapeau d'auto-cast (EXG-40, acheté en T-7) et le verrou de la 6e école (EXG-13 / EXG-41).
// Aucun clavier ici : la logique est pure, T-20 branchera les touches 1 à 6.

import { describe, expect, it } from 'vitest'

import { PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import { appliquerClic, etatInitial, lancerSort, tick } from '../../src/domain/moteur.ts'
import {
  avancerSorts,
  bonusAmeliorations,
  declencherSort,
  degatsClic,
  etatSortLu,
  sortDisponible,
} from '../../src/domain/sorts/index.ts'
import type { EtatJeu, IdEcole, ParametresSort } from '../../src/domain/types.ts'
import { GRAINES } from '../../tools/idle-balance/graines.ts'

const C = GRAINES
const HORODATAGE = 1_700_000_000_000

/** Premier sort du contrat : celui de l'école de départ, disponible dès la 1re seconde de jeu. */
const SORT_DEPART: ParametresSort = C.sorts[0]
/** Sort d'une école encore verrouillée (EXG-14). */
const SORT_VERROUILLE: ParametresSort = C.sorts[1]
/** 6e sort : réservé à la 1re Ascension (EXG-13, EXG-41). */
const SORT_LUMIERE: ParametresSort =
  C.sorts.find((sort) => C.ecoles[sort.idEcole].requiertAscension) ?? C.sorts[C.sorts.length - 1]

function etatProductif(niveaux: Partial<Record<IdEcole, number>> = { feu: 5 }): EtatJeu {
  const base = etatInitial(HORODATAGE)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(niveaux) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return { ...base, ecoles }
}

describe('EXG-11 — sort de clic, sans cooldown', () => {
  it('`D_clic = base_clic × (1 + Σ bonus_améliorations)`', () => {
    const nu = etatProductif()
    expect(bonusAmeliorations(nu, C)).toBe(0)
    expect(degatsClic(nu, C)).toBe(C.or.baseClic)

    const premiere = C.ameliorations[0]
    const ameliore: EtatJeu = { ...nu, paliersAmeliorations: { [premiere.id]: 2 } }
    const bonusAttendu = 2 * (premiere.effetMult - 1)
    expect(bonusAmeliorations(ameliore, C)).toBeCloseTo(bonusAttendu, 12)
    expect(degatsClic(ameliore, C)).toBeCloseTo(C.or.baseClic * (1 + bonusAttendu), 12)
  })

  it('10 clics en 1 s produisent 10 applications de dégâts', () => {
    let etat = etatProductif()
    const degatsUnitaires = degatsClic(etat, C)
    const degatsAvant = etat.magicien.degatsCumules

    for (let clic = 0; clic < 10; clic += 1) etat = appliquerClic(etat, C)

    expect(etat.magicien.clicsCumules).toBe(10)
    expect(etat.magicien.degatsCumules - degatsAvant).toBeCloseTo(10 * degatsUnitaires, 9)
  })

  it('le clic n\'a pas de cooldown : dix clics dans le même instant passent tous', () => {
    let etat = etatProductif()
    for (let clic = 0; clic < 10; clic += 1) etat = appliquerClic(etat, C)
    expect(etat.tempsJeuMs).toBe(0) // aucun temps simulé consommé
    expect(etat.magicien.clicsCumules).toBe(10)
  })
})

describe('EXG-12 — sorts à cooldown', () => {
  it('un premier déclenchement passe et arme le cooldown du contrat', () => {
    const etat = etatSortPret()
    const resultat = declencherSort(etat, SORT_DEPART.id, C)

    expect(resultat.declenche).toBe(true)
    expect(resultat.motifRefus).toBeNull()
    expect(resultat.degats).toBeGreaterThan(0)
    expect(etatSortLu(resultat.etat, SORT_DEPART.id, C).cooldownRestantMs).toBe(SORT_DEPART.cooldownMs)
  })

  it('un déclenchement pendant le cooldown est ignoré, ne consomme aucune ressource, et le temps restant reste lisible', () => {
    const etat = etatSortPret()
    const premier = declencherSort(etat, SORT_DEPART.id, C).etat
    const ecoule = 3 * PAS_TICK_MS
    const apresAttente = avancerSorts(premier, ecoule, C).etat

    const refus = declencherSort(apresAttente, SORT_DEPART.id, C)
    expect(refus.declenche).toBe(false)
    expect(refus.motifRefus).toBe('enCooldown')
    expect(refus.degats).toBe(0)
    expect(refus.etat).toBe(apresAttente)
    expect(refus.etat.bourse).toEqual(etat.bourse)
    // T-20 affichera exactement ce reste.
    expect(etatSortLu(refus.etat, SORT_DEPART.id, C).cooldownRestantMs).toBe(SORT_DEPART.cooldownMs - ecoule)
  })

  it('le cooldown décroît à chaque tick et se termine pile à zéro, jamais en négatif', () => {
    const lance = declencherSort(etatSortPret(), SORT_DEPART.id, C).etat
    const pas = Math.ceil(SORT_DEPART.cooldownMs / PAS_TICK_MS)

    let etat = lance
    for (let i = 0; i < pas; i += 1) etat = tick(etat, C)
    expect(etatSortLu(etat, SORT_DEPART.id, C).cooldownRestantMs).toBe(0)

    etat = tick(etat, C)
    expect(etatSortLu(etat, SORT_DEPART.id, C).cooldownRestantMs).toBe(0)
    expect(declencherSort(etat, SORT_DEPART.id, C).declenche).toBe(true)
  })

  it('les dégâts du sort touchent la cible en combat sans attendre le tick', () => {
    // Zone profonde : le sort ne peut pas tuer la cible d'un coup, on observe donc les PV baisser.
    const profond = etatSortPret()
    const enZone: EtatJeu = { ...profond, combat: { ...profond.combat, zone: 4 } }
    const engage = tick(enZone, C) // engendre la cible de la vague 1
    const pvAvant = engage.combat.cible?.pvCourants ?? 0

    const resultat = lancerSort(engage, SORT_DEPART.id, C)
    expect(resultat.declenche).toBe(true)
    expect(resultat.etat.combat.cible?.pvCourants ?? 0).toBeLessThan(pvAvant)
    // Le chrono de boss ne bouge pas : un sort n'est pas un pas de temps.
    expect(resultat.etat.tempsJeuMs).toBe(engage.tempsJeuMs)
  })
})

describe('auto-cast (EXG-40) — mécanisme prêt, nœud d\'achat en T-7', () => {
  it('sans auto-cast, aucun sort ne part de lui-même au tick', () => {
    const etat = etatSortPret()
    const apres = avancerSorts(etat, PAS_TICK_MS, C)
    expect(apres.degats).toBe(0)
    expect(etatSortLu(apres.etat, SORT_DEPART.id, C).cooldownRestantMs).toBe(0)
  })

  it('avec auto-cast, le sort part seul dès que le cooldown est fini, sans clic', () => {
    const base = etatSortPret()
    const auto: EtatJeu = {
      ...base,
      sorts: {
        ...base.sorts,
        [SORT_DEPART.id]: { debloque: true, cooldownRestantMs: 0, autoCast: true },
      },
    }

    const premier = avancerSorts(auto, PAS_TICK_MS, C)
    expect(premier.degats).toBeGreaterThan(0)
    expect(etatSortLu(premier.etat, SORT_DEPART.id, C).cooldownRestantMs).toBe(SORT_DEPART.cooldownMs)

    // Pendant le cooldown, l'auto-cast ne tire pas.
    const second = avancerSorts(premier.etat, PAS_TICK_MS, C)
    expect(second.degats).toBe(0)

    // Le clic du joueur n'est pas requis : le tick suffit.
    const apresTick = tick(auto, C)
    expect(apresTick.magicien.clicsCumules).toBe(0)
    expect(etatSortLu(apresTick, SORT_DEPART.id, C).cooldownRestantMs).toBeGreaterThan(0)
  })
})

describe('EXG-13 / EXG-14 / EXG-41 — sorts verrouillés', () => {
  it('le sort d\'une école non débloquée n\'a aucun effet', () => {
    const etat = etatSortPret()
    expect(sortDisponible(etat, SORT_VERROUILLE.id, C)).toBe(false)

    const refus = declencherSort(etat, SORT_VERROUILLE.id, C)
    expect(refus.declenche).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.degats).toBe(0)
    expect(refus.etat).toBe(etat)
  })

  it('le 6e sort reste muet avant la 1re Ascension, même école débloquée', () => {
    const base = etatSortPret()
    const avecLumiere: EtatJeu = {
      ...base,
      ecoles: { ...base.ecoles, [SORT_LUMIERE.idEcole]: { niveau: 3, debloquee: true, revelee: true } },
    }
    expect(sortDisponible(avecLumiere, SORT_LUMIERE.id, C)).toBe(false)
    expect(declencherSort(avecLumiere, SORT_LUMIERE.id, C).motifRefus).toBe('verrouille')

    const apresAscension: EtatJeu = {
      ...avecLumiere,
      ascension: { ...avecLumiere.ascension, sixiemeEcoleDebloquee: true },
    }
    expect(sortDisponible(apresAscension, SORT_LUMIERE.id, C)).toBe(true)
    expect(declencherSort(apresAscension, SORT_LUMIERE.id, C).declenche).toBe(true)
  })

  it('un identifiant de sort inconnu est refusé sans toucher à l\'état', () => {
    const etat = etatSortPret()
    const refus = declencherSort(etat, 'sort-fantome', C)
    expect(refus.motifRefus).toBe('inconnu')
    expect(refus.etat).toBe(etat)
  })

  it('un auto-cast armé sur un sort verrouillé ne tire pas', () => {
    const base = etatSortPret()
    const auto: EtatJeu = {
      ...base,
      sorts: { [SORT_VERROUILLE.id]: { debloque: false, cooldownRestantMs: 0, autoCast: true } },
    }
    expect(avancerSorts(auto, PAS_TICK_MS, C).degats).toBe(0)
  })
})

/** État où l'école du sort de départ est achetée : son sort est donc disponible (§5). */
function etatSortPret(): EtatJeu {
  return etatProductif({ [SORT_DEPART.idEcole]: 5 })
}
