// Miroir de `src/domain/fin/` — T-13, EXG-28 (zone dédiée du boss final, écran de fin) et EXG-44
// (partie terminée : plus aucun prestige ni Ascension).
//
// Aucune valeur d'équilibrage n'est écrite ici : le seuil d'Ascensions, le numéro de la zone dédiée,
// les PV du boss final et son chrono sont tous dérivés de `CONSTANTES.fin` (sortie du simulateur,
// rapport `2026-09-21-revision-adr17-bossfinal.md`). Un test qui recopierait un nombre mesuré cesserait
// de vérifier la formule pour ne plus vérifier que lui-même.

import { describe, expect, it } from 'vitest'

import { MS_PAR_SECONDE, PAS_TICK_MS, VAGUE_DEPART, ZONE_DEPART } from '../../src/domain/constantes-moteur.ts'
import { ascensionner } from '../../src/domain/ascension/index.ts'
import {
  apercuFin,
  avancerBossFinal,
  entrerZoneFinale,
  statistiquesDeFin,
  zoneFinaleAccessible,
} from '../../src/domain/fin/index.ts'
import { avancerCombatJeu, etatInitial, tick } from '../../src/domain/moteur.ts'
import { prestiger } from '../../src/domain/prestige/index.ts'
import { exporterTexte, importerTexte } from '../../src/domain/sauvegarde/index.ts'
import { normaliserEtat } from '../../src/domain/sauvegarde/normalisation.ts'
import type { Constantes, EtatJeu } from '../../src/domain/types.ts'
import { creerBossFinal, pvBoss, pvBossFinal, timerBossFinalMs } from '../../src/domain/zones/index.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { FIN } from '../../src/donnees/fin.ts'

const C: Constantes = CONSTANTES
const HORODATAGE = 1_700_000_000_000

/** État de départ auquel on impose un nombre d'Ascensions : le seuil d'accès d'EXG-28 est son entrée. */
function etatAscensionne(ascensions: number, patch: Partial<EtatJeu> = {}): EtatJeu {
  const base = etatInitial(HORODATAGE)
  return {
    ...base,
    ascension: { ...base.ascension, ascensionsEffectuees: ascensions, sixiemeEcoleDebloquee: ascensions > 0 },
    ...patch,
  }
}

/** État prêt à combattre le boss final : seuil atteint, zone dédiée ouverte. */
function etatEngage(ascensions = FIN.nAscensionsRequises): EtatJeu {
  const entree = entrerZoneFinale(etatAscensionne(ascensions), C)
  expect(entree.accepte).toBe(true)
  return entree.etat
}

/** Un pas de combat final avec de quoi tuer le boss d'un coup. */
function coupFatal(etat: EtatJeu) {
  return avancerBossFinal(etat, pvBossFinal(C), PAS_TICK_MS, C)
}

/* ══════════════════════════════════════════════ EXG-28 — les constantes viennent du simulateur */

describe('EXG-28 — les cinq constantes de fin sont lues, jamais recalculées', () => {
  it('la vue `src/donnees/fin.ts` est bien celle que le moteur reçoit', () => {
    expect(FIN).toBe(C.fin)
  })

  it('les PV du boss final se dérivent de la profondeur équivalente, pas du numéro de la zone dédiée', () => {
    expect(pvBossFinal(C)).toBe(pvBoss(FIN.pvProfondeurEquivalente, C) * FIN.pvMultiplicateur)
    // Le point de la révision ADR-17 : `zoneBossFinal` est un **nom**, pas une profondeur. Si les PV
    // s'en déduisaient, ils seraient d'un autre ordre de grandeur (et probablement non finis).
    expect(pvBossFinal(C)).not.toBe(pvBoss(FIN.zoneBossFinal, C))
    expect(Number.isFinite(pvBossFinal(C))).toBe(true)
    expect(pvBossFinal(C)).toBeGreaterThan(0)
  })

  it('le chrono du boss final est le sien, pas celui des boss de zone', () => {
    expect(timerBossFinalMs(C)).toBe(FIN.timerBossFinalS * MS_PAR_SECONDE)
  })

  it('le boss final porte le numéro de la zone dédiée et son marqueur de fin', () => {
    const boss = creerBossFinal(C)
    expect(boss.zone).toBe(FIN.zoneBossFinal)
    expect(boss.estBoss).toBe(true)
    expect(boss.estFinal).toBe(true)
    expect(boss.pvMax).toBe(pvBossFinal(C))
    expect(boss.pvCourants).toBe(boss.pvMax)
    // La partie s'arrête sur sa mort : aucun or à dépenser après, et la zone dédiée n'a pas de
    // multiplicateur d'or (elle n'est pas sur l'échelle des zones — il serait non fini).
    expect(boss.orAuMeurtre).toBe(0)
  })
})

/* ═══════════════════════════════════════════════════ EXG-28 — seuil d'accès à la zone dédiée */

describe('EXG-28 — la zone dédiée n’est accessible qu’au seuil d’Ascensions', () => {
  it('reste fermée tant que `ascensions < nAscensionsRequises` (tous les cas en dessous)', () => {
    for (let n = 0; n < FIN.nAscensionsRequises; n += 1) {
      expect(zoneFinaleAccessible(etatAscensionne(n), C), `${n} Ascension(s)`).toBe(false)
    }
  })

  it('s’ouvre exactement au seuil, et le reste au-delà', () => {
    expect(zoneFinaleAccessible(etatAscensionne(FIN.nAscensionsRequises), C)).toBe(true)
    expect(zoneFinaleAccessible(etatAscensionne(FIN.nAscensionsRequises + 3), C)).toBe(true)
  })

  it('un accès refusé rend l’état d’entrée **par référence**, avec le motif `verrouille`', () => {
    const avant = etatAscensionne(FIN.nAscensionsRequises - 1)
    const refus = entrerZoneFinale(avant, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.etat).toBe(avant)
    expect(refus.etat.bossFinal).toBeUndefined()
  })

  it('l’aperçu dit au joueur où il en est sans rien modifier (EXG-21, même discipline)', () => {
    const trop_tot = apercuFin(etatAscensionne(FIN.nAscensionsRequises - 1), C)
    expect(trop_tot.accessible).toBe(false)
    expect(trop_tot.motifIndisponible).toBe('verrouille')
    expect(trop_tot.ascensionsRequises).toBe(FIN.nAscensionsRequises)
    expect(trop_tot.ascensionsEffectuees).toBe(FIN.nAscensionsRequises - 1)

    const pret = apercuFin(etatAscensionne(FIN.nAscensionsRequises), C)
    expect(pret.accessible).toBe(true)
    expect(pret.motifIndisponible).toBeNull()
    expect(pret.pvBossFinal).toBe(pvBossFinal(C))
    expect(pret.timerMs).toBe(timerBossFinalMs(C))
    expect(pret.engage).toBe(false)
    expect(apercuFin(etatEngage(), C).engage).toBe(true)
  })

  it('au seuil, l’entrée arme le boss à PV pleins et chrono plein', () => {
    const engage = etatEngage()
    expect(engage.bossFinal?.pvCourants).toBe(pvBossFinal(C))
    expect(engage.bossFinal?.timerRestantMs).toBe(timerBossFinalMs(C))
    expect(engage.partieTerminee).toBe(false)
  })

  it('une partie déjà terminée ne rouvre pas la zone dédiée', () => {
    const gagne = coupFatal(etatEngage()).etat
    expect(gagne.partieTerminee).toBe(true)
    expect(zoneFinaleAccessible(gagne, C)).toBe(false)
    const refus = entrerZoneFinale(gagne, C)
    expect(refus.accepte).toBe(false)
    expect(refus.etat).toBe(gagne)
  })
})

/* ══════════════════════ EXG-28 — la progression normale ne mène jamais à la zone dédiée */

describe('EXG-28 — la zone dédiée est hors de l’échelle de progression', () => {
  it('aucun pas de combat normal n’engage le boss final, si loin qu’on pousse la zone', () => {
    // On part volontairement de la zone qui **précède** le numéro de la zone dédiée : même là, le
    // combat ordinaire ne fait qu'avancer d'une zone, il n'ouvre jamais le combat final.
    const base = etatAscensionne(FIN.nAscensionsRequises)
    const voisine: EtatJeu = {
      ...base,
      combat: { ...base.combat, zone: FIN.zoneBossFinal - 1, vague: C.zones.nbVagues, phase: 'boss', cible: null, timerBossRestantMs: null },
    }
    const apres = avancerCombatJeu(voisine, PAS_TICK_MS, C, Number.MAX_VALUE).etat
    expect(apres.bossFinal).toBeUndefined()
    expect(apres.partieTerminee).toBe(false)
  })

  it('une partie ordinaire ne voit jamais la zone dédiée passer dans son combat', () => {
    let etat = etatInitial(HORODATAGE)
    for (let i = 0; i < 200; i += 1) {
      etat = tick(etat, C)
      expect(etat.combat.zone).not.toBe(FIN.zoneBossFinal)
      expect(etat.bossFinal).toBeUndefined()
    }
  })

  it('le combat final ne touche ni au combat ordinaire ni à la zone maximale du run (EXG-18)', () => {
    const base = etatAscensionne(FIN.nAscensionsRequises)
    const enCours: EtatJeu = {
      ...base,
      combat: { ...base.combat, zone: 7, vague: 3 },
      prestige: { ...base.prestige, zoneMaxDuRun: 7 },
    }
    const engage = entrerZoneFinale(enCours, C).etat
    const apres = coupFatal(engage).etat

    expect(apres.combat).toEqual(enCours.combat)
    // La zone dédiée ne gonfle jamais `zoneMaxDuRun`, sinon le gain d'Éclats d'EXG-18 exploserait.
    expect(apres.prestige.zoneMaxDuRun).toBe(7)
    expect(apres.statistiquesFin?.zoneMaxAtteinte).toBe(7)
    expect(apres.statistiquesFin?.zoneMaxAtteinte).not.toBe(FIN.zoneBossFinal)
  })
})

/* ═══════════════════════════════════════════ EXG-16 / EXG-28 — combat chronométré du boss final */

describe('EXG-16 / EXG-28 — le combat final suit le chrono de boss, avec sa propre durée', () => {
  it('un pas sans dégâts décompte le chrono et rien d’autre', () => {
    const engage = etatEngage()
    const pas = avancerBossFinal(engage, 0, PAS_TICK_MS, C)
    expect(pas.bossVaincu).toBe(false)
    expect(pas.bossEchoue).toBe(false)
    expect(pas.etat.bossFinal?.timerRestantMs).toBe(timerBossFinalMs(C) - PAS_TICK_MS)
    expect(pas.etat.bossFinal?.pvCourants).toBe(pvBossFinal(C))
  })

  it('les dégâts entament les PV sans jamais descendre sous zéro', () => {
    const engage = etatEngage()
    const moitie = pvBossFinal(C) / 2
    const pas = avancerBossFinal(engage, moitie, PAS_TICK_MS, C)
    expect(pas.etat.bossFinal?.pvCourants).toBeCloseTo(moitie, 0)
    expect(pas.pvRestants).toBeGreaterThan(0)
  })

  it('le chrono expiré sans victoire met fin au combat sans terminer la partie (EXG-17)', () => {
    const engage = etatEngage()
    const echec = avancerBossFinal(engage, 0, timerBossFinalMs(C), C)
    expect(echec.bossEchoue).toBe(true)
    expect(echec.bossVaincu).toBe(false)
    expect(echec.etat.partieTerminee).toBe(false)
    expect(echec.etat.statistiquesFin).toBeUndefined()
    // Le combat est refermé, jamais figé sur un boss à 0 s : la zone dédiée se rouvre gratuitement.
    expect(echec.etat.bossFinal).toBeUndefined()
    expect(zoneFinaleAccessible(echec.etat, C)).toBe(true)
  })

  it('un échec ne coûte rien : or, niveaux, Éclats, Ascensions et compteurs intacts (EXG-17)', () => {
    const base = etatAscensionne(FIN.nAscensionsRequises)
    const riche: EtatJeu = {
      ...base,
      bourse: { ...base.bourse, or: 1234.5, eclatsPossedes: 42, eclatsDepensables: 42, pointsAscension: 9 },
      ecoles: { ...base.ecoles, feu: { niveau: 31, debloquee: true, revelee: true } },
      magicien: { ...base.magicien, monstresTues: 777, clicsCumules: 88, degatsCumules: 1e9 },
      prestige: { ...base.prestige, prestigesTotal: 24, prestigesDuCycle: 4, zoneMaxDuRun: 61 },
    }
    const echec = avancerBossFinal(entrerZoneFinale(riche, C).etat, 0, timerBossFinalMs(C), C)
    expect(echec.etat).toEqual(riche)
  })

  it('la mort du boss l’emporte sur l’expiration du chrono dans le même pas (EXG-16)', () => {
    const simultane = avancerBossFinal(etatEngage(), pvBossFinal(C), timerBossFinalMs(C), C)
    expect(simultane.bossVaincu).toBe(true)
    expect(simultane.bossEchoue).toBe(false)
    expect(simultane.etat.partieTerminee).toBe(true)
  })

  it('avancer sans combat engagé ne fait rien et rend l’état par référence', () => {
    const avant = etatAscensionne(FIN.nAscensionsRequises)
    const rien = avancerBossFinal(avant, 1e30, PAS_TICK_MS, C)
    expect(rien.engage).toBe(false)
    expect(rien.etat).toBe(avant)
    expect(rien.bossVaincu).toBe(false)
  })
})

/* ══════════════════════════════════ EXG-28 / EXG-44 — victoire, écran de fin, partie terminée */

describe('EXG-44 — la victoire termine la partie et fige l’écran de fin', () => {
  it('marque `partieTerminee` et referme le combat final', () => {
    const victoire = coupFatal(etatEngage())
    expect(victoire.bossVaincu).toBe(true)
    expect(victoire.etat.partieTerminee).toBe(true)
    expect(victoire.etat.bossFinal).toBeUndefined()
  })

  it('les trois statistiques exigées par EXG-28 sont présentes et exactes', () => {
    const base = etatAscensionne(FIN.nAscensionsRequises + 1)
    const joue: EtatJeu = {
      ...base,
      tempsJeuMs: 9_876_543,
      prestige: { ...base.prestige, zoneMaxDuRun: 118, prestigesTotal: 26 },
    }
    const gagne = coupFatal(entrerZoneFinale(joue, C).etat).etat
    const stats = gagne.statistiquesFin
    expect(stats).toBeDefined()
    expect(stats?.dureeTotaleMs).toBe(joue.tempsJeuMs)
    expect(stats?.zoneMaxAtteinte).toBe(118)
    expect(stats?.ascensions).toBe(FIN.nAscensionsRequises + 1)
    expect(stats?.prestigesTotal).toBe(26)
    // `statistiquesDeFin` est la lecture que l'écran de fin (T-27) appellera : même valeur, figée.
    expect(statistiquesDeFin(gagne)).toEqual(stats)
  })

  it('les statistiques sont **figées** : le temps qui passe après la victoire ne les bouge plus', () => {
    let gagne = coupFatal(etatEngage()).etat
    const fige = gagne.statistiquesFin
    for (let i = 0; i < 50; i += 1) gagne = tick(gagne, C)
    expect(gagne.tempsJeuMs).toBeGreaterThan(fige?.dureeTotaleMs ?? 0)
    expect(gagne.statistiquesFin).toEqual(fige)
    expect(gagne.partieTerminee).toBe(true)
  })

  it('une partie non terminée n’a pas d’écran de fin', () => {
    expect(statistiquesDeFin(etatAscensionne(FIN.nAscensionsRequises))).toBeNull()
    expect(statistiquesDeFin(etatEngage())).toBeNull()
  })
})

/* ═════════════════════════════════════ EXG-44 — prestige et Ascension refusés après la fin */

describe('EXG-44 — après la victoire, plus aucun prestige ni Ascension', () => {
  /** Partie gagnée dans les conditions réelles : seuil d'Ascensions atteint, prestiges au compteur. */
  function partieGagnee(): EtatJeu {
    const base = etatAscensionne(FIN.nAscensionsRequises)
    const pret: EtatJeu = {
      ...base,
      bourse: { ...base.bourse, eclatsPossedes: 500, eclatsDepensables: 500 },
      prestige: {
        ...base.prestige,
        // De quoi rendre prestige ET Ascension disponibles… juste avant la victoire.
        prestigesDuCycle: C.ascension.prestigesParAscension,
        prestigesTotal: 24,
        zoneMaxDuRun: 90,
        eclatsCumulesAVie: 5000,
      },
    }
    // Les deux guichets sont bien ouverts **avant** la fin : sinon le test ne prouverait rien.
    expect(prestiger(pret, C).accepte).toBe(true)
    expect(ascensionner(pret, C).accepte).toBe(true)
    return coupFatal(entrerZoneFinale(pret, C).etat).etat
  }

  it('le prestige est refusé, sans rien créditer ni réinitialiser (EXG-44)', () => {
    const fini = partieGagnee()
    const refus = prestiger(fini, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.gain).toBe(0)
    expect(refus.etat).toBe(fini)
  })

  it('l’Ascension est refusée, sans rien créditer ni effacer (EXG-44)', () => {
    const fini = partieGagnee()
    const refus = ascensionner(fini, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.gain).toBe(0)
    expect(refus.etat).toBe(fini)
  })
})

/* ═══════════════════════════════════════════════════════════ pureté : non-mutation de l'entrée */

describe('non-mutation — l’état d’entrée ressort intact de toutes les fonctions de fin', () => {
  it('ni l’entrée en zone dédiée ni le combat final ne mutent leur entrée', () => {
    const avant = etatAscensionne(FIN.nAscensionsRequises)
    const copie = structuredClone(avant)
    Object.freeze(avant)
    Object.freeze(avant.ascension)
    Object.freeze(avant.prestige)

    const engage = entrerZoneFinale(avant, C).etat
    expect(avant).toEqual(copie)

    const copieEngagee = structuredClone(engage)
    Object.freeze(engage)
    avancerBossFinal(engage, pvBossFinal(C) / 3, PAS_TICK_MS, C)
    coupFatal(engage)
    avancerBossFinal(engage, 0, timerBossFinalMs(C), C)
    apercuFin(engage, C)
    statistiquesDeFin(engage)
    expect(engage).toEqual(copieEngagee)
  })

  it('un budget de dégâts absurde se résout en un pas, sans boucle (EXG-30, LRN-002)', () => {
    // Le timeout **est** l'assertion : un boss final résolu monstre par monstre ou PV par PV ne
    // rendrait jamais la main avec 1e300 de dégâts. Le compteur d'itérations documente l'intention.
    const victoire = avancerBossFinal(etatEngage(), 1e300, PAS_TICK_MS, C)
    expect(victoire.bossVaincu).toBe(true)
    expect(victoire.iterations).toBe(1)
  }, 1_000)

  it('des dégâts non finis ou négatifs ne cassent rien', () => {
    for (const degats of [Number.NaN, Number.POSITIVE_INFINITY, -1e9]) {
      const pas = avancerBossFinal(etatEngage(), degats, PAS_TICK_MS, C)
      expect(Number.isFinite(pas.pvRestants), String(degats)).toBe(true)
      expect(pas.pvRestants).toBeGreaterThanOrEqual(0)
    }
  })
})

/* ═════════════════════════════════════ T-10 — la fin de partie traverse la sauvegarde */

describe('EXG-45 / T-10 — une partie terminée se sauvegarde, se relit et se répare', () => {
  it('survit à un aller-retour export → import, statistiques comprises', () => {
    const base = etatAscensionne(FIN.nAscensionsRequises)
    const gagne = coupFatal(entrerZoneFinale({ ...base, tempsJeuMs: 4_321_000 }, C).etat).etat
    const retour = importerTexte(exporterTexte(gagne, HORODATAGE), etatInitial(0), C)
    expect(retour.ok).toBe(true)
    if (!retour.ok) return
    expect(retour.etat.partieTerminee).toBe(true)
    expect(retour.etat.statistiquesFin).toEqual(gagne.statistiquesFin)
    expect(retour.etat.bossFinal).toBeUndefined()
  })

  it('un combat final en cours se relit à PV et chrono conservés', () => {
    const entame = avancerBossFinal(etatEngage(), pvBossFinal(C) / 4, PAS_TICK_MS, C).etat
    const retour = importerTexte(exporterTexte(entame, HORODATAGE), etatInitial(0), C)
    expect(retour.ok).toBe(true)
    if (!retour.ok) return
    expect(retour.etat.bossFinal?.pvCourants).toBe(entame.bossFinal?.pvCourants)
    expect(retour.etat.bossFinal?.timerRestantMs).toBe(entame.bossFinal?.timerRestantMs)
  })

  it('invariant croisé : une fin de partie sans les Ascensions requises se **répare**, pas se rejette', () => {
    const base = etatAscensionne(0)
    const menteur: EtatJeu = {
      ...base,
      partieTerminee: true,
      statistiquesFin: { dureeTotaleMs: 1, zoneMaxAtteinte: ZONE_DEPART, ascensions: 0, prestigesTotal: 0 },
      bourse: { ...base.bourse, or: 500 },
    }
    const repare = normaliserEtat(menteur, C)
    expect(repare.partieTerminee).toBe(false)
    expect(repare.statistiquesFin).toBeUndefined()
    // Réparer, pas punir : la progression réelle est conservée (EXG-45, esprit de la normalisation).
    expect(repare.bourse.or).toBe(500)
    // …et le joueur retrouve ses guichets de méta.
    expect(prestiger(repare, C).accepte).toBe(true)
  })

  it('un combat final engagé sans le seuil d’Ascensions est refermé par la normalisation', () => {
    const base = etatAscensionne(0)
    const triche: EtatJeu = { ...base, bossFinal: { pvCourants: 1, timerRestantMs: timerBossFinalMs(C) } }
    expect(normaliserEtat(triche, C).bossFinal).toBeUndefined()
  })

  it('la normalisation reste idempotente et laisse une vraie fin de partie intacte', () => {
    const gagne = coupFatal(etatEngage()).etat
    const une = normaliserEtat(gagne, C)
    expect(une.partieTerminee).toBe(true)
    expect(une.statistiquesFin).toEqual(gagne.statistiquesFin)
    expect(normaliserEtat(une, C)).toEqual(une)
  })

  it('les PV d’un combat final rechargé sont ramenés dans leurs bornes', () => {
    const base = etatAscensionne(FIN.nAscensionsRequises)
    const enfle: EtatJeu = {
      ...base,
      bossFinal: { pvCourants: pvBossFinal(C) * 10, timerRestantMs: timerBossFinalMs(C) * 10 },
    }
    const sain = normaliserEtat(enfle, C)
    expect(sain.bossFinal?.pvCourants).toBe(pvBossFinal(C))
    expect(sain.bossFinal?.timerRestantMs).toBe(timerBossFinalMs(C))
  })

  it('un état neuf reste un point fixe de la normalisation (aucun champ de fin inventé)', () => {
    const neuf = etatInitial(HORODATAGE)
    expect(normaliserEtat(neuf, C)).toEqual(neuf)
    expect(normaliserEtat(neuf, C).bossFinal).toBeUndefined()
    expect(normaliserEtat(neuf, C).statistiquesFin).toBeUndefined()
    expect(neuf.combat.vague).toBe(VAGUE_DEPART)
  })
})
