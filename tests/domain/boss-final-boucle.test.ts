// Branchement du combat du boss final dans la boucle du moteur (`src/domain/moteur.ts` → `fin/`),
// EXG-16 / EXG-17 / EXG-28 / EXG-44 / EXG-3.
//
// `tests/domain/fin.test.ts` prouve la règle d'un pas (`avancerBossFinal`) ; ce fichier prouve que le jeu
// réel l'appelle : `tick`, `appliquerDelta` (itératif ET forme fermée), `appliquerClic` et `lancerSort`
// envoient dégâts et temps écoulé au boss final dès que `entrerZoneFinale` l'a engagé. Sans ce
// branchement, la partie ne pouvait pas se terminer.
//
// Aucune valeur d'équilibrage n'est recopiée : les PV du boss sont posés **relativement** au DPS de la
// chaîne (`degatsParSeconde`) et au chrono lu dans `CONSTANTES.fin`, jamais en dur.

import { describe, expect, it } from 'vitest'

import { MS_PAR_HEURE, MS_PAR_SECONDE, PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import { ascensionner } from '../../src/domain/ascension/index.ts'
import { entrerZoneFinale, zoneFinaleAccessible } from '../../src/domain/fin/index.ts'
import {
  appliquerClic,
  appliquerDelta,
  degatsParSeconde,
  etatInitial,
  lancerSort,
  tick,
} from '../../src/domain/moteur.ts'
import { prestiger } from '../../src/domain/prestige/index.ts'
import { multiplicateursAchats } from '../../src/domain/ameliorations/index.ts'
import { degatsClic, degatsSort } from '../../src/domain/sorts/index.ts'
import type { Constantes, EtatJeu } from '../../src/domain/types.ts'
import { pvBossFinal, timerBossFinalMs } from '../../src/domain/zones/index.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { FIN } from '../../src/donnees/fin.ts'

const C: Constantes = CONSTANTES
const HORODATAGE = 1_700_000_000_000

/** Premier sort du catalogue (École du Feu, disponible dès le départ) : sert au sort manuel et à l'auto-cast. */
const SORT = C.sorts[0]!
/** Nombre de ticks d'un chrono plein : lu des constantes, jamais recopié. */
const TICKS_CHRONO = Math.round(timerBossFinalMs(C) / PAS_TICK_MS)

/**
 * Joueur au seuil d'Ascensions, avec une production passive non nulle, un combat ordinaire **en cours**
 * (zone et vague au-delà du départ, cible vivante) et de l'or en poche : tout ce que le combat final ne
 * doit pas toucher est posé à une valeur reconnaissable.
 */
function joueurPret(): EtatJeu {
  const base = etatInitial(HORODATAGE)
  const enJeu: EtatJeu = {
    ...base,
    ascension: { ...base.ascension, ascensionsEffectuees: FIN.nAscensionsRequises, sixiemeEcoleDebloquee: true },
    ecoles: { ...base.ecoles, feu: { niveau: 25, debloquee: true, revelee: true } },
    bourse: { ...base.bourse, or: 4321 },
    prestige: { ...base.prestige, zoneMaxDuRun: 3, prestigesTotal: 12 },
    magicien: { ...base.magicien, monstresTues: 55 },
  }
  // Quelques ticks ordinaires pour que le combat ait une vraie cible vivante (pas `cible: null`).
  let etat = enJeu
  for (let i = 0; i < 5; i += 1) etat = tick(etat, C)
  expect(degatsParSeconde(etat, C)).toBeGreaterThan(0)
  return etat
}

/**
 * Engage le boss final puis fixe ses PV **restants** à `pv` (≤ PV max : `avancerBossFinal` ramène tout
 * combat lu dans ses bornes). Poser les PV relativement au DPS rend le test indépendant des PV livrés.
 */
function engageAvecPv(etat: EtatJeu, pv: number): EtatJeu {
  const entree = entrerZoneFinale(etat, C)
  expect(entree.accepte).toBe(true)
  expect(pv).toBeLessThanOrEqual(pvBossFinal(C))
  return { ...entree.etat, bossFinal: { pvCourants: pv, timerRestantMs: timerBossFinalMs(C) } }
}

/**
 * PV « loin de la mort » : mille secondes de DPS passif. Pas les PV livrés — ils sont d'un autre ordre de
 * grandeur que le DPS d'un état de test, et `pvLivres − dégâts_d'un_tick` y vaudrait `pvLivres` à la
 * précision flottante près : le test ne verrait aucune baisse.
 */
function pvLoin(etat: EtatJeu): number {
  return Math.min(degatsParSeconde(etat, C) * 1000, pvBossFinal(C))
}

/** Un pas de production passive de la chaîne complète (§8), en dégâts. */
function degatsPassifsParTick(etat: EtatJeu): number {
  return degatsParSeconde(etat, C) * (PAS_TICK_MS / MS_PAR_SECONDE)
}

/** Avance de `n` ticks par petits `appliquerDelta` de 100 ms (chemin itératif du jeu en ligne). */
function petitsPas(etat: EtatJeu, n: number): EtatJeu {
  let courant = etat
  for (let i = 0; i < n; i += 1) courant = appliquerDelta(courant, PAS_TICK_MS, C)
  return courant
}

/* ════════════════════════════════════ EXG-16 / EXG-28 — le tick fait tourner le combat final */

describe('EXG-28 — une fois la zone dédiée ouverte, le tick frappe le boss final', () => {
  it('un tick baisse les PV du boss au DPS de la chaîne complète et décompte son chrono', () => {
    const pret = joueurPret()
    const engage = engageAvecPv(pret, pvLoin(pret))
    const apres = tick(engage, C)
    expect(apres.bossFinal).toBeDefined()
    const baisse = engage.bossFinal!.pvCourants - apres.bossFinal!.pvCourants
    expect(baisse).toBeGreaterThan(0)
    expect(baisse / degatsPassifsParTick(engage)).toBeCloseTo(1, 9)
    expect(apres.bossFinal?.timerRestantMs).toBe(timerBossFinalMs(C) - PAS_TICK_MS)
  })

  it('appliquerDelta (chemin itératif) fait de même, pas par pas', () => {
    const engage = engageAvecPv(joueurPret(), pvLoin(joueurPret()))
    const apres = appliquerDelta(engage, 10 * PAS_TICK_MS, C)
    expect(apres.bossFinal?.timerRestantMs).toBe(timerBossFinalMs(C) - 10 * PAS_TICK_MS)
    const baisse = engage.bossFinal!.pvCourants - apres.bossFinal!.pvCourants
    expect(baisse / (10 * degatsPassifsParTick(engage))).toBeCloseTo(1, 9)
  })

  it('l’auto-cast d’un sort frappe aussi le boss final (même chaîne que le combat ordinaire)', () => {
    const pret = joueurPret()
    const avecAutoCast: EtatJeu = {
      ...pret,
      sorts: { ...pret.sorts, [SORT.id]: { debloque: true, cooldownRestantMs: 0, autoCast: true } },
    }
    const engage = engageAvecPv(avecAutoCast, pvLoin(avecAutoCast))
    const apres = tick(engage, C)
    const attendu = degatsPassifsParTick(engage) + degatsSort(SORT, multiplicateursAchats(engage, C))
    const baisse = engage.bossFinal!.pvCourants - apres.bossFinal!.pvCourants
    expect(baisse / attendu).toBeCloseTo(1, 9)
  })

  it('pendant le combat final, le combat ordinaire est gelé et ne rapporte rien', () => {
    const pret = joueurPret()
    const engage = engageAvecPv(pret, pvLoin(pret))
    // Moitié du chrono : le combat est toujours en cours, rien ne l'a refermé.
    const apres = petitsPas(engage, Math.floor(TICKS_CHRONO / 2))
    expect(apres.bossFinal).toBeDefined()
    expect(apres.combat).toEqual(engage.combat)
    expect(apres.magicien.monstresTues).toBe(engage.magicien.monstresTues)
    expect(apres.prestige.zoneMaxDuRun).toBe(engage.prestige.zoneMaxDuRun)
    // Le boss final n'a pas d'or (`orAuMeurtre = 0`, zone hors de l'échelle d'or) : ses dégâts non plus.
    expect(apres.bourse.or).toBe(engage.bourse.or)
    // Le temps de jeu, lui, avance : l'écran de fin doit compter le combat final dans la durée.
    expect(apres.tempsJeuMs).toBe(engage.tempsJeuMs + Math.floor(TICKS_CHRONO / 2) * PAS_TICK_MS)
  })
})

/* ═════════════════════════════════════════ EXG-11 / EXG-12 — clic et sort frappent le boss */

describe('EXG-11 / EXG-12 — le clic et le sort manuel frappent le boss final engagé', () => {
  it('un clic entame les PV du boss, sans chrono, sans or, sans toucher au combat ordinaire', () => {
    const engage = engageAvecPv(joueurPret(), pvLoin(joueurPret()))
    const apres = appliquerClic(engage, C)
    expect(engage.bossFinal!.pvCourants - apres.bossFinal!.pvCourants).toBeCloseTo(degatsClic(engage, C), 6)
    expect(apres.bossFinal?.timerRestantMs).toBe(timerBossFinalMs(C))
    expect(apres.combat).toEqual(engage.combat)
    expect(apres.bourse.or).toBe(engage.bourse.or)
    expect(apres.magicien.clicsCumules).toBe(engage.magicien.clicsCumules + 1)
  })

  it('un sort lancé entame les PV du boss de ses dégâts', () => {
    const engage = engageAvecPv(joueurPret(), pvLoin(joueurPret()))
    const tir = lancerSort(engage, SORT.id, C)
    expect(tir.declenche).toBe(true)
    expect(tir.degats).toBeGreaterThan(0)
    expect(engage.bossFinal!.pvCourants - tir.etat.bossFinal!.pvCourants).toBeCloseTo(tir.degats, 6)
    expect(tir.etat.combat).toEqual(engage.combat)
    expect(tir.etat.bourse.or).toBe(engage.bourse.or)
  })

  it('le clic qui achève le boss termine la partie', () => {
    const engage = engageAvecPv(joueurPret(), degatsClic(joueurPret(), C) / 2)
    const fini = appliquerClic(engage, C)
    expect(fini.partieTerminee).toBe(true)
    expect(fini.bossFinal).toBeUndefined()
    expect(fini.statistiquesFin).toBeDefined()
  })
})

/* ═══════════════════════════════════ EXG-28 / EXG-44 — victoire par la boucle : la partie finit */

describe('EXG-28 / EXG-44 — une victoire gagnée par la boucle termine la partie', () => {
  /** Boss à 10 s de DPS passif : gagnable bien avant la fin du chrono (qui dure plus de 10 s). */
  function gagneeParLaBoucle(): { engage: EtatJeu; fini: EtatJeu } {
    const pret = joueurPret()
    const engage = engageAvecPv(pret, degatsParSeconde(pret, C) * 10)
    expect(timerBossFinalMs(C)).toBeGreaterThan(10 * MS_PAR_SECONDE)
    return { engage, fini: petitsPas(engage, TICKS_CHRONO) }
  }

  it('partieTerminee = true, combat refermé, statistiques figées (EXG-28)', () => {
    const { engage, fini } = gagneeParLaBoucle()
    expect(fini.partieTerminee).toBe(true)
    expect(fini.bossFinal).toBeUndefined()
    const stats = fini.statistiquesFin
    expect(stats).toBeDefined()
    expect(stats?.ascensions).toBe(FIN.nAscensionsRequises)
    expect(stats?.prestigesTotal).toBe(engage.prestige.prestigesTotal)
    expect(stats?.zoneMaxAtteinte).toBe(Math.max(engage.prestige.zoneMaxDuRun, engage.combat.zone))
    // Victoire vers la 100e seconde de combat (10 s de DPS), jamais au bout du chrono.
    expect(stats?.dureeTotaleMs).toBeGreaterThan(engage.tempsJeuMs)
    expect(stats?.dureeTotaleMs).toBeLessThan(engage.tempsJeuMs + timerBossFinalMs(C))
    // Figées : le temps qui continue de passer ne les bouge plus.
    const plusTard = petitsPas(fini, 50)
    expect(plusTard.statistiquesFin).toEqual(stats)
  })

  it('prestige et Ascension sont refusés ensuite (EXG-44)', () => {
    const { fini } = gagneeParLaBoucle()
    const riche: EtatJeu = {
      ...fini,
      bourse: { ...fini.bourse, eclatsPossedes: 500, eclatsDepensables: 500 },
      prestige: {
        ...fini.prestige,
        prestigesDuCycle: C.ascension.prestigesParAscension,
        zoneMaxDuRun: 90,
        eclatsCumulesAVie: 5000,
      },
    }
    expect(prestiger(riche, C).accepte).toBe(false)
    expect(ascensionner(riche, C).accepte).toBe(false)
    // Témoin : les mêmes guichets, sans la fin de partie, sont ouverts — le refus vient bien d'EXG-44.
    const temoin: EtatJeu = { ...riche, partieTerminee: false }
    expect(prestiger(temoin, C).accepte).toBe(true)
    expect(ascensionner(temoin, C).accepte).toBe(true)
  })
})

/* ════════════════════════════════════════════ EXG-16 / EXG-17 — chrono écoulé par la boucle */

describe('EXG-16 / EXG-17 — le chrono écoulé dans la boucle referme le combat sans rien coûter', () => {
  it('au bout du chrono, combat refermé, partie non terminée, or / niveaux / combat ordinaire intacts', () => {
    const pret = joueurPret()
    // Dix chronos de DPS passif : impossible à gagner dans le temps imparti.
    const engage = engageAvecPv(pret, Math.min(degatsParSeconde(pret, C) * FIN.timerBossFinalS * 10, pvBossFinal(C)))
    const juste = petitsPas(engage, TICKS_CHRONO - 1)
    expect(juste.bossFinal).toBeDefined()

    const echec = petitsPas(engage, TICKS_CHRONO)
    expect(echec.bossFinal).toBeUndefined()
    expect(echec.partieTerminee).toBe(false)
    expect(echec.statistiquesFin).toBeUndefined()
    expect(echec.bourse).toEqual(engage.bourse)
    expect(echec.ecoles).toEqual(engage.ecoles)
    expect(echec.combat).toEqual(engage.combat)
    expect(echec.ascension).toEqual(engage.ascension)
    // La zone dédiée se rouvre gratuitement (même conséquence qu'`avancerBossFinal`).
    expect(zoneFinaleAccessible(echec, C)).toBe(true)
    // Et le combat ordinaire reprend là où il était, au tick suivant.
    const reprise = tick(echec, C)
    expect(reprise.bourse.or).toBeGreaterThan(echec.bourse.or)
  })
})

/* ═══════════════════ EXG-3 — la forme fermée ne saute ni la victoire ni l'échec du combat final */

describe('EXG-3 — un grand appliquerDelta rend la même issue que la même durée en petits pas', () => {
  /** Au-delà de `nTicksMax` ticks : c'est la forme fermée qui répond, pas la boucle. */
  const GRAND_DELTA_MS = 2 * MS_PAR_HEURE

  it('le grand delta dépasse bien le seuil de bascule (sinon ce bloc ne teste rien)', () => {
    expect(GRAND_DELTA_MS / PAS_TICK_MS).toBeGreaterThan(C.tick.nTicksMax)
  })

  it('le combat final tient dans le budget de rattrapage d’EXG-3 (chrono ≤ nTicksMax ticks)', () => {
    // Le combat final est le seul segment itéré dans un grand delta : son coût est borné par le chrono,
    // qui doit rester sous le seuil que la spec autorise par appel. Si le simulateur allongeait le chrono
    // au-delà, ce test le signalerait avant qu'EXG-3 ne soit silencieusement violée.
    expect(TICKS_CHRONO).toBeLessThanOrEqual(C.tick.nTicksMax)
  })

  it('victoire : même fin de partie, mêmes statistiques figées, à la milliseconde près', () => {
    const pret = joueurPret()
    const engage = engageAvecPv(pret, degatsParSeconde(pret, C) * 10)
    const enPetitsPas = petitsPas(engage, TICKS_CHRONO)
    const enUnBloc = appliquerDelta(engage, GRAND_DELTA_MS, C)
    expect(enPetitsPas.partieTerminee).toBe(true)
    expect(enUnBloc.partieTerminee).toBe(true)
    expect(enUnBloc.bossFinal).toBeUndefined()
    expect(enUnBloc.statistiquesFin).toEqual(enPetitsPas.statistiquesFin)
  })

  it('échec : même combat refermé, sans fin de partie', () => {
    const pret = joueurPret()
    const engage = engageAvecPv(pret, Math.min(degatsParSeconde(pret, C) * FIN.timerBossFinalS * 10, pvBossFinal(C)))
    const enPetitsPas = petitsPas(engage, TICKS_CHRONO)
    const enUnBloc = appliquerDelta(engage, GRAND_DELTA_MS, C)
    expect(enPetitsPas.bossFinal).toBeUndefined()
    expect(enUnBloc.bossFinal).toBeUndefined()
    expect(enUnBloc.partieTerminee).toBe(false)
    expect(enUnBloc.statistiquesFin).toBeUndefined()
  })

  it('le cas qui départage : gagnable avec l’auto-cast, perdu au seul DPS passif — la forme fermée gagne aussi', () => {
    const pret = joueurPret()
    const avecAutoCast: EtatJeu = {
      ...pret,
      sorts: { ...pret.sorts, [SORT.id]: { debloque: true, cooldownRestantMs: 0, autoCast: true } },
    }
    const coupDeSort = degatsSort(SORT, multiplicateursAchats(avecAutoCast, C))
    // Plus que tout le passif d'un chrono plein, moins que passif + deux sorts : seul l'auto-cast gagne.
    // (le sort repart au moins deux fois par chrono : son cooldown est plus court que la moitié du chrono)
    expect(SORT.cooldownMs * 2).toBeLessThan(timerBossFinalMs(C))
    const pv = degatsPassifsParTick(avecAutoCast) * TICKS_CHRONO + coupDeSort * 1.5
    const engage = engageAvecPv(avecAutoCast, pv)

    const enPetitsPas = petitsPas(engage, TICKS_CHRONO)
    expect(enPetitsPas.partieTerminee).toBe(true)
    const enUnBloc = appliquerDelta(engage, GRAND_DELTA_MS, C)
    expect(enUnBloc.partieTerminee).toBe(true)
    expect(enUnBloc.statistiquesFin).toEqual(enPetitsPas.statistiquesFin)
  })

  it('coût constant : le combat final itère au plus un chrono, quelle que soit l’absence (EXG-30)', () => {
    const pret = joueurPret()
    const engage = engageAvecPv(pret, Math.min(degatsParSeconde(pret, C) * FIN.timerBossFinalS * 10, pvBossFinal(C)))
    const itere = (dtMs: number): number => appliquerDelta(engage, dtMs, C).ticksRattrapes - engage.ticksRattrapes
    expect(itere(GRAND_DELTA_MS)).toBe(TICKS_CHRONO)
    expect(itere(4 * GRAND_DELTA_MS)).toBe(TICKS_CHRONO)
    // Le reste de l'absence est crédité en forme fermée : autant de temps de jeu que sans combat final.
    expect(appliquerDelta(engage, GRAND_DELTA_MS, C).tempsJeuMs).toBe(engage.tempsJeuMs + GRAND_DELTA_MS)
  })

  it('sans combat final engagé, la forme fermée n’itère toujours rien (EXG-3 inchangée)', () => {
    const pret = joueurPret()
    expect(appliquerDelta(pret, GRAND_DELTA_MS, C).ticksRattrapes).toBe(pret.ticksRattrapes)
  })
})
