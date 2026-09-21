// Miroir de `src/domain/moteur.ts` — boucle de simulation (EXG-1, EXG-2, EXG-3, EXG-30).
// Aucune valeur d'équilibrage n'est écrite ici : tout vient de `tools/idle-balance/graines.ts`.

import { describe, expect, it } from 'vitest'

import { PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import { appliquerDelta, degatsParSeconde, etatInitial, tick } from '../../src/domain/moteur.ts'
import type { Constantes, EtatJeu, IdEcole } from '../../src/domain/types.ts'
import { GRAINES } from '../../tools/idle-balance/graines.ts'

const C = GRAINES
const HORODATAGE = 1_700_000_000_000

/** État de départ productif : quelques niveaux d'école, sinon le DPS vaut 0 et les tests ne prouvent rien. */
function etatProductif(niveaux: Partial<Record<IdEcole, number>> = { feu: 12, glace: 4 }): EtatJeu {
  const base = etatInitial(HORODATAGE)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(niveaux) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return { ...base, ecoles }
}

/** Gèle récursivement : en mode strict (module ES), toute mutation de l'entrée lève alors une TypeError. */
function gelerProfond<T>(valeur: T): T {
  if (valeur !== null && typeof valeur === 'object') {
    for (const enfant of Object.values(valeur)) gelerProfond(enfant)
    Object.freeze(valeur)
  }
  return valeur
}

function ticksSuccessifs(etat: EtatJeu, nombre: number, constantes: Constantes = C): EtatJeu {
  let courant = etat
  for (let i = 0; i < nombre; i += 1) courant = tick(courant, constantes)
  return courant
}

describe('degatsParSeconde — chaîne de DPS §8', () => {
  it('somme les écoles débloquées lues dans l\'état, facteurs non implémentés neutres', () => {
    const etat = etatProductif({ feu: 3 })
    const attendu = 3 * C.ecoles.feu.productionBase
    expect(degatsParSeconde(etat, C)).toBeCloseTo(attendu, 12)
  })

  it('ignore une école non débloquée (EXG-7) et un état vierge produit 0', () => {
    const vierge = etatInitial(HORODATAGE)
    expect(degatsParSeconde(vierge, C)).toBe(0)

    const verrouillee: EtatJeu = {
      ...vierge,
      ecoles: { ...vierge.ecoles, glace: { niveau: 50, debloquee: false, revelee: true } },
    }
    expect(degatsParSeconde(verrouillee, C)).toBe(0)
  })

  it('applique le multiplicateur de palier à chaque seuil franchi (§8)', () => {
    const seuils = C.ecoles.feu.paliersSeuils
    const niveau = seuils[1] // deux seuils franchis (le 1er et le 2e)
    const attendu =
      niveau * C.ecoles.feu.productionBase * C.ecoles.feu.multiplicateurParPalier ** 2
    expect(degatsParSeconde(etatProductif({ feu: niveau }), C)).toBeCloseTo(attendu, 9)
  })
})

describe('tick — pas fixe de 100 ms (EXG-1)', () => {
  it('10 ticks de 100 ms et un appel de 1000 ms : écart relatif < 1e-9', () => {
    const base = etatProductif()
    const parTicks = ticksSuccessifs(base, 10)
    const parDelta = appliquerDelta(base, 10 * PAS_TICK_MS, C)

    const ecartRelatif = Math.abs(parTicks.bourse.or - parDelta.bourse.or) / parTicks.bourse.or
    expect(parTicks.bourse.or).toBeGreaterThan(0)
    expect(ecartRelatif).toBeLessThan(1e-9)
    expect(parDelta.tempsJeuMs).toBe(parTicks.tempsJeuMs)
  })

  it('avance le temps de jeu d\'exactement un pas et ne mute pas son entrée', () => {
    const base = gelerProfond(etatProductif())
    const copie = structuredClone(base)
    const suivant = tick(base, C)

    expect(suivant.tempsJeuMs).toBe(base.tempsJeuMs + PAS_TICK_MS)
    expect(suivant.ticksEcoules).toBe(base.ticksEcoules + 1)
    expect(suivant).not.toBe(base)
    expect(base).toEqual(copie)
  })
})

describe('appliquerDelta — rattrapage des ticks manquants (EXG-2)', () => {
  it('un delta de 5000 ms produit exactement l\'état de 50 ticks successifs', () => {
    const base = etatProductif()
    const parTicks = ticksSuccessifs(base, 50)
    const parDelta = appliquerDelta(base, 50 * PAS_TICK_MS, C)

    expect(parDelta).toEqual(parTicks)
    expect(parDelta.ticksEcoules).toBe(50)
    expect(parDelta.ticksRattrapes).toBe(50)
  })

  it('accumule le reste sous 100 ms sans jamais le perdre', () => {
    const base = etatProductif()
    const apres1 = appliquerDelta(base, 150, C)
    expect(apres1.ticksEcoules).toBe(1)
    expect(apres1.resteDeltaMs).toBe(50)

    const apres2 = appliquerDelta(apres1, 60, C)
    expect(apres2.ticksEcoules).toBe(2)
    expect(apres2.resteDeltaMs).toBe(10)

    // Conservation du temps injecté : 150 + 60 = temps simulé + reste en attente.
    expect(apres2.tempsJeuMs + apres2.resteDeltaMs).toBe(210)
  })

  it('ignore un delta négatif, nul ou non fini sans produire de NaN (robustesse EXG-49)', () => {
    const base = etatProductif()
    for (const dt of [0, -1000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const resultat = appliquerDelta(base, dt, C)
      expect(resultat.ticksEcoules).toBe(0)
      expect(Number.isFinite(resultat.bourse.or)).toBe(true)
      expect(resultat.bourse.or).toBe(base.bourse.or)
    }
  })

  it('ne mute pas l\'état d\'entrée, même sur un gros rattrapage', () => {
    const base = gelerProfond(etatProductif())
    const copie = structuredClone(base)
    appliquerDelta(base, 2 * 3_600_000, C)
    expect(base).toEqual(copie)
  })
})

describe('appliquerDelta — bascule en forme fermée au-delà du seuil N (EXG-3)', () => {
  it('un delta de 2 h n\'itère pas plus de nTicksMax fois', () => {
    const base = etatProductif()
    const deuxHeuresMs = 2 * 3_600_000
    const resultat = appliquerDelta(base, deuxHeuresMs, C)

    expect(resultat.ticksEcoules).toBe(deuxHeuresMs / PAS_TICK_MS)
    expect(resultat.ticksRattrapes).toBeLessThanOrEqual(C.tick.nTicksMax)
    expect(resultat.bourse.or).toBeGreaterThan(0)
    expect(Number.isFinite(resultat.bourse.or)).toBe(true)
  })

  it('la forme fermée reste à moins de 1 % du résultat itératif sur un cas comparable', () => {
    // Seuil abaissé pour rendre les deux chemins comparables sur 50 ticks seulement.
    const seuilBas: Constantes = { ...C, tick: { ...C.tick, nTicksMax: 10 } }
    const base = etatProductif()

    const itere = ticksSuccessifs(base, 50, seuilBas)
    const fermee = appliquerDelta(base, 50 * PAS_TICK_MS, seuilBas)

    expect(fermee.ticksRattrapes).toBe(0) // aucune itération : forme fermée
    expect(fermee.ticksEcoules).toBe(itere.ticksEcoules)
    const ecartRelatif = Math.abs(fermee.bourse.or - itere.bourse.or) / itere.bourse.or
    expect(ecartRelatif).toBeLessThan(0.01)
  })
})

describe('coût constant de la boucle (EXG-30)', () => {
  it('le nombre d\'itérations par frame ne dépend pas de l\'ancienneté de la session', () => {
    let etat = etatProductif()
    const iterationsParFrame: number[] = []

    // 2 h de session découpées en frames de 1 s, échantillonnées toutes les 10 minutes.
    for (let minute = 0; minute < 120; minute += 1) {
      for (let seconde = 0; seconde < 60; seconde += 1) {
        const avant = etat.ticksRattrapes
        etat = appliquerDelta(etat, 1_000, C)
        if (minute % 10 === 0 && seconde === 0) iterationsParFrame.push(etat.ticksRattrapes - avant)
      }
    }

    expect(iterationsParFrame).toHaveLength(12)
    expect(new Set(iterationsParFrame).size).toBe(1)
    expect(iterationsParFrame[0]).toBe(1_000 / PAS_TICK_MS)
  })

  it('un delta arbitrairement grand n\'augmente jamais le nombre d\'itérations', () => {
    const base = etatProductif()
    const iterations = [1, 10, 100, 1_000].map((heures) => {
      const resultat = appliquerDelta(base, heures * 3_600_000, C)
      return resultat.ticksRattrapes - base.ticksRattrapes
    })

    expect(iterations.every((n) => n <= C.tick.nTicksMax)).toBe(true)
    expect(new Set(iterations).size).toBe(1)
  })
})
