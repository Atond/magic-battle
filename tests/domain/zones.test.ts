// Miroir de `src/domain/zones/` — T-5, EXG-6 et EXG-15 à EXG-17 (vagues, boss chronométré, or), plus le
// budget de calcul d'EXG-30 (nettoyage de vagues en forme fermée).
// Aucune valeur d'équilibrage ici : tout vient de `src/donnees/constantes.ts`. ADR-13 : aucune liste
// de zones n'existe, ni dans le domaine ni dans ce test — tout passe par la formule paramétrique.

import { describe, expect, it } from 'vitest'

import { MS_PAR_SECONDE, VAGUE_DEPART, ZONE_DEPART } from '../../src/domain/constantes-moteur.ts'
import { avancerCombatJeu, etatInitial } from '../../src/domain/moteur.ts'
import * as zones from '../../src/domain/zones/index.ts'
import {
  avancerCombat,
  creerBoss,
  creerMonstre,
  multOrZone,
  orMonstre,
  pvBaseVague1,
  pvBoss,
  pvCumulVagues,
  pvVague,
  timerBossMs,
  vaguesNettoyees,
} from '../../src/domain/zones/index.ts'
import type { Boss, Constantes, EtatCombat, EtatJeu, IdEcole } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

const C = CONSTANTES
const Z = C.zones
const HORODATAGE = 1_700_000_000_000

function ecartRelatif(a: number, b: number): number {
  return Math.abs(a - b) / Math.abs(b)
}

/** Chaîne itérée zone par zone (§8), référence naïve de la forme fermée de `pvBaseVague1`. */
function pvBaseVague1Itere(zone: number, constantes: Constantes): number {
  const { pvBaseVague1Zone1, croissanceVague, nbVagues, multBoss, multZoneSuivante } = constantes.zones
  let pvBase = pvBaseVague1Zone1
  for (let z = 1; z < zone; z += 1) {
    const pvDerniereVague = pvBase * croissanceVague ** (nbVagues - 1)
    pvBase = pvDerniereVague * multBoss * multZoneSuivante
  }
  return pvBase
}

/** Combat au départ d'une zone, vague 1, cible non encore engendrée (comme après un chargement). */
function combatNeuf(zone: number, vague: number = VAGUE_DEPART): EtatCombat {
  return { zone, vague, phase: 'vague', cible: null, timerBossRestantMs: null }
}

/** État de jeu avec des écoles productives et un combat donné. */
function etatAvec(combat: EtatCombat, niveaux: Partial<Record<IdEcole, number>> = { feu: 12 }): EtatJeu {
  const base = etatInitial(HORODATAGE)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(niveaux) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return { ...base, ecoles, combat, prestige: { ...base.prestige, zoneMaxDuRun: combat.zone } }
}

describe('ADR-13 — zones sans borne, aucune liste', () => {
  it('le module n\'expose aucune liste de zones (formule paramétrique seulement)', () => {
    for (const valeur of Object.values(zones)) {
      expect(Array.isArray(valeur)).toBe(false)
    }
  })

  it('calcule une zone très profonde sans itérer et sans déborder', () => {
    const profonde = pvBaseVague1(50, C)
    expect(Number.isFinite(profonde)).toBe(true)
    expect(profonde).toBeGreaterThan(pvBaseVague1(49, C))
  })
})

describe('EXG-15 — PV par vague', () => {
  it('PV de la vague 5 = PV de la vague 1 × croissance⁴, dans n\'importe quelle zone', () => {
    for (const zone of [1, 2, 7, 23]) {
      expect(pvVague(zone, 5, C)).toBe(pvVague(zone, VAGUE_DEPART, C) * Z.croissanceVague ** 4)
    }
  })

  it('la vague 1 d\'une zone vaut `pvBaseVague1(zone)`', () => {
    expect(pvVague(3, VAGUE_DEPART, C)).toBe(pvBaseVague1(3, C))
  })

  it('la zone 1 démarre sur la valeur du contrat', () => {
    expect(pvBaseVague1(ZONE_DEPART, C)).toBe(Z.pvBaseVague1Zone1)
  })
})

describe('forme fermée de `pvBaseVague1` — §8 / EXG-30', () => {
  it('égale l\'enchaînement itéré zone par zone à moins de 1e-9 en écart relatif', () => {
    for (let zone = 1; zone <= 20; zone += 1) {
      expect(ecartRelatif(pvBaseVague1(zone, C), pvBaseVague1Itere(zone, C))).toBeLessThan(1e-9)
    }
  })

  it('PV du boss = PV de la dernière vague × mult_boss, et amorce la zone suivante', () => {
    for (const zone of [1, 4, 11]) {
      expect(pvBoss(zone, C)).toBe(pvVague(zone, Z.nbVagues, C) * Z.multBoss)
      expect(ecartRelatif(pvBaseVague1(zone + 1, C), pvBoss(zone, C) * Z.multZoneSuivante)).toBeLessThan(1e-9)
    }
  })
})

describe('EXG-6 — or par monstre tué', () => {
  it('3 cas de `Or = PV × or_par_dégât_moyen × mult_or_zone(z)` vérifiés à l\'unité près', () => {
    const cas = [
      { zone: 1, vague: 1 },
      { zone: 3, vague: 7 },
      { zone: 9, vague: 10 },
    ]
    for (const { zone, vague } of cas) {
      const pv = pvVague(zone, vague, C)
      const attendu = pv * C.or.orParDegatMoyen * C.or.croissanceOrParZone ** (zone - 1)
      expect(orMonstre(pv, zone, C)).toBeCloseTo(attendu, 9)
      expect(Math.round(orMonstre(pv, zone, C))).toBe(Math.round(attendu))
    }
  })

  it('le multiplicateur d\'or vaut 1 en zone 1 et croît avec la zone', () => {
    expect(multOrZone(ZONE_DEPART, C)).toBe(1)
    expect(multOrZone(2, C)).toBeGreaterThan(multOrZone(1, C))
    expect(multOrZone(5, C)).toBe(C.or.croissanceOrParZone ** 4)
  })

  it('le monstre engendré porte son or de meurtre (affiché par le canvas, T-21)', () => {
    const monstre = creerMonstre(2, 3, C)
    expect(monstre.pvMax).toBe(pvVague(2, 3, C))
    expect(monstre.pvCourants).toBe(monstre.pvMax)
    expect(monstre.orAuMeurtre).toBe(orMonstre(monstre.pvMax, 2, C))
  })
})

describe('nettoyage de vagues en forme fermée — EXG-30', () => {
  it('le nombre de vagues nettoyées égale le comptage itéré des PV cumulés', () => {
    const zone = 4
    const pvPremiere = pvVague(zone, VAGUE_DEPART, C)
    for (const degats of [0, pvPremiere / 2, pvPremiere, pvPremiere * 3, pvPremiere * 1e6, 1e30]) {
      // Référence naïve : on retire les PV vague après vague (jamais utilisée dans `src/`).
      let reste = degats
      let compte = 0
      let pv = pvPremiere
      while (reste >= pv && compte < 10_000) {
        reste -= pv
        pv *= Z.croissanceVague
        compte += 1
      }
      expect(vaguesNettoyees(pvPremiere, degats, C)).toBe(compte)
    }
  })

  it('les PV cumulés de m vagues suivent la somme géométrique', () => {
    const pvPremiere = pvVague(2, VAGUE_DEPART, C)
    const attendu = pvPremiere * (Z.croissanceVague ** 5 - 1) / (Z.croissanceVague - 1)
    expect(ecartRelatif(pvCumulVagues(pvPremiere, 5, C), attendu)).toBeLessThan(1e-9)
  })
})

describe('EXG-16 — boss chronométré', () => {
  it('le timer démarre à `timer_boss_s` quand la dernière vague normale tombe', () => {
    expect(timerBossMs(C)).toBe(Z.timerBossS * MS_PAR_SECONDE)

    // Un seul avancement, avec de quoi nettoyer toute la zone : la phase boss s'ouvre, chrono plein.
    const avancement = avancerCombat(combatNeuf(1), 1e12, 100, C)
    expect(avancement.combat.phase).toBe('boss')
    expect(avancement.combat.timerBossRestantMs).toBe(timerBossMs(C))
    expect(avancement.combat.vague).toBe(Z.nbVagues)
    expect(avancement.combat.zone).toBe(1)

    const boss = avancement.combat.cible as Boss
    expect(boss.estBoss).toBe(true)
    expect(boss.pvMax).toBe(pvBoss(1, C))
    expect(avancement.monstresTues).toBe(Z.nbVagues)
  })

  it('le chrono décroît du delta-temps tant que le boss vit', () => {
    const enBoss: EtatCombat = {
      zone: 1,
      vague: Z.nbVagues,
      phase: 'boss',
      cible: creerBoss(1, C),
      timerBossRestantMs: timerBossMs(C),
    }
    const apres = avancerCombat(enBoss, 0, 100, C)
    expect(apres.combat.timerBossRestantMs).toBe(timerBossMs(C) - 100)
    expect(apres.combat.phase).toBe('boss')
  })

  it('le boss vaincu ouvre la zone suivante à la vague 1', () => {
    const enBoss: EtatCombat = {
      zone: 3,
      vague: Z.nbVagues,
      phase: 'boss',
      cible: creerBoss(3, C),
      timerBossRestantMs: timerBossMs(C),
    }
    const apres = avancerCombat(enBoss, 1e30, 100, C)
    expect(apres.bossVaincu).toBe(true)
    expect(apres.zoneVaincue).toBe(3)
    expect(apres.combat.zone).toBe(4)
    expect(apres.combat.vague).toBe(VAGUE_DEPART)
    expect(apres.combat.phase).toBe('vague')
    expect(apres.combat.timerBossRestantMs).toBeNull()
  })
})

describe('EXG-17 — échec du boss', () => {
  /** Combat de boss dont le chrono est sur le point d'expirer. */
  function bossPresqueExpire(zone: number): EtatCombat {
    return {
      zone,
      vague: Z.nbVagues,
      phase: 'boss',
      cible: creerBoss(zone, C),
      timerBossRestantMs: 50,
    }
  }

  it('renvoie à la vague précédente — pas à la vague 1 de la zone, pas à la zone précédente', () => {
    const echec = avancerCombat(bossPresqueExpire(5), 0, 100, C)

    expect(echec.bossEchoue).toBe(true)
    expect(echec.combat.zone).toBe(5)
    expect(echec.combat.phase).toBe('vague')
    expect(echec.combat.vague).toBe(Z.nbVagues - 1)
    expect(echec.combat.vague).toBeGreaterThan(VAGUE_DEPART)
    expect(echec.combat.timerBossRestantMs).toBeNull()
    expect(echec.combat.cible?.pvCourants).toBe(pvVague(5, Z.nbVagues - 1, C))
  })

  it('ne coûte ni or ni niveaux d\'école (aucune perte de progression acquise)', () => {
    const avant = etatAvec(bossPresqueExpire(5))
    const avecOr: EtatJeu = { ...avant, bourse: { ...avant.bourse, or: 12_345 } }
    const apres = avancerCombatJeu(avecOr, 100, C)

    expect(apres.avancement.bossEchoue).toBe(true)
    expect(apres.etat.combat.phase).toBe('vague')
    expect(apres.etat.bourse.or).toBe(avecOr.bourse.or)
    expect(apres.etat.bourse.renommee).toBe(avecOr.bourse.renommee)
    expect(apres.etat.ecoles).toEqual(avecOr.ecoles)
    expect(apres.etat.prestige).toEqual(avecOr.prestige)
  })

  it('le boss peut être relancé gratuitement : rejouer la vague rouvre la phase boss, chrono plein', () => {
    const echec = avancerCombat(bossPresqueExpire(5), 0, 100, C)
    const relance = avancerCombat(echec.combat, 1e30, 100, C)

    expect(relance.combat.phase).toBe('boss')
    expect(relance.combat.timerBossRestantMs).toBe(timerBossMs(C))
    expect(relance.combat.zone).toBe(5)
  })

  it('le boss qui meurt dans le même pas que l\'expiration du chrono compte comme vaincu', () => {
    const limite: EtatCombat = { ...bossPresqueExpire(2), timerBossRestantMs: 0 }
    const apres = avancerCombat(limite, 1e30, 100, C)
    expect(apres.bossVaincu).toBe(true)
    expect(apres.bossEchoue).toBe(false)
  })
})

describe('progression des vagues', () => {
  it('des dégâts insuffisants entament la cible sans changer de vague', () => {
    const avancement = avancerCombat(combatNeuf(1), pvVague(1, 1, C) / 4, 100, C)
    expect(avancement.combat.vague).toBe(VAGUE_DEPART)
    expect(avancement.monstresTues).toBe(0)
    expect(avancement.combat.cible?.pvCourants).toBeCloseTo((pvVague(1, 1, C) * 3) / 4, 9)
  })

  it('le surplus de dégâts entame la vague suivante, sans jamais sauter le boss', () => {
    const pv1 = pvVague(1, 1, C)
    const pv2 = pvVague(1, 2, C)
    const avancement = avancerCombat(combatNeuf(1), pv1 + pv2 / 2, 100, C)
    expect(avancement.monstresTues).toBe(1)
    expect(avancement.combat.vague).toBe(2)
    expect(avancement.combat.cible?.pvCourants).toBeCloseTo(pv2 / 2, 9)
  })

  it('ne mute jamais le combat reçu', () => {
    const entree = Object.freeze(combatNeuf(1))
    const avancement = avancerCombat(entree, 1e12, 100, C)
    expect(entree.cible).toBeNull()
    expect(avancement.combat).not.toBe(entree)
  })

  it('un dégât non fini ou négatif ne casse pas la résolution', () => {
    for (const degats of [Number.NaN, Number.POSITIVE_INFINITY, -100]) {
      const avancement = avancerCombat(combatNeuf(1), degats, 100, C)
      expect(Number.isFinite(avancement.combat.cible?.pvCourants ?? Number.NaN)).toBe(true)
      expect(avancement.combat.vague).toBe(VAGUE_DEPART)
    }
  })
})

describe('EXG-30 — preuve non coopérative : aucune boucle par monstre ne peut passer', () => {
  // Les deux tests du bloc suivant documentent l'intention, mais ils lisent un compteur tenu par le
  // code lui-même : une boucle `while (reste >= pv)` introduite demain les laisserait verts.
  // Celui-ci ne mesure rien de déclaratif — il rend la boucle **impossible à terminer**.
  //
  // Levier : avec `croissance_vague = 1` (PV plats) et un million de millions de vagues par zone, un
  // seul pas de combat doit nettoyer 1e12 monstres. En forme fermée c'est une division ; monstre par
  // monstre ce sont 1e12 itérations, soit des heures — le timeout serré ci-dessous tranche entre
  // « instantané » et « jamais », pas entre deux pourcentages.
  const ZONE_PLATE_GEANTE: Constantes = {
    ...C,
    zones: { ...Z, croissanceVague: 1, nbVagues: 1e12 },
  }

  it(
    'nettoie 3e9 vagues plates en moins de 500 ms de temps réel (échec propre si une boucle apparaît)',
    () => {
      // Variante **terminante** du garde-fou : une boucle par monstre mettrait ici plusieurs secondes
      // (3e9 itérations, ~2 s), la forme fermée moins d'une milliseconde. L'écart est de trois à quatre
      // ordres de grandeur, donc la borne de 500 ms n'est pas une mesure fine : c'est un interrupteur.
      // Elle est déclarée avant le garde-fou 1e12 ci-dessous pour rougir *avant* qu'un run ne pende.
      const geante: Constantes = { ...C, zones: { ...Z, croissanceVague: 1, nbVagues: 3e9 } }
      // Budget calibré pile sur 3e9 monstres : une boucle par monstre fait 3e9 tours (~2 s) puis
      // **rend la main**, donc l'assertion de temps rougit proprement au lieu de faire pendre le run.
      const budget = pvVague(1, VAGUE_DEPART, geante) * 3e9
      const debut = Date.now()
      const avancement = avancerCombat(combatNeuf(1), budget, 100, geante)
      const ecouleMs = Date.now() - debut

      expect(avancement.monstresTues).toBe(3e9)
      expect(avancement.combat.phase).toBe('boss')
      expect(ecouleMs).toBeLessThan(500)
    },
    30_000,
  )

  it(
    'nettoie 1e12 vagues à PV plats en un seul pas, sans itérer et sans NaN',
    () => {
      // Garde-fou dur : 1e12 monstres à tuer dans un seul pas. Une boucle par monstre ne termine pas en
      // temps humain — et comme Vitest ne peut pas interrompre une boucle **synchrone**, le symptôme
      // serait un run qui pend, pas une assertion rouge. C'est voulu : le timeout ci-dessous n'est pas
      // de la fragilité de CI, c'est l'assertion elle-même. Retirer ce test pour « débloquer » un run
      // qui pend, c'est retirer le garde-fou qui vient de détecter la régression.
      
      const avancement = avancerCombat(combatNeuf(1), 1e20, 100, ZONE_PLATE_GEANTE)

      // Toute la zone est tombée d'un coup : impossible en itérant les monstres un par un.
      expect(avancement.monstresTues).toBe(1e12)
      expect(avancement.vaguesNettoyees).toBe(1e12)
      expect(avancement.combat.phase).toBe('boss')
      expect(avancement.combat.timerBossRestantMs).toBe(timerBossMs(ZONE_PLATE_GEANTE))

      const boss = avancement.combat.cible as Boss
      expect(Number.isFinite(boss.pvMax)).toBe(true)
      expect(Number.isNaN(boss.pvCourants)).toBe(false)
      expect(boss.pvMax).toBeGreaterThan(0)
    },
    1_000,
  )

  it(
    'compte les vagues nettoyées par une division, pas par un décompte (PV plats, budget 1e250)',
    () => {
      const pvPlat = pvVague(1, VAGUE_DEPART, ZONE_PLATE_GEANTE)
      expect(vaguesNettoyees(pvPlat, 1e250, ZONE_PLATE_GEANTE)).toBe(Math.floor(1e250 / pvPlat))
      expect(vaguesNettoyees(pvPlat, pvPlat * 1e18, ZONE_PLATE_GEANTE)).toBe(1e18)
      expect(Number.isFinite(pvCumulVagues(pvPlat, 1e18, ZONE_PLATE_GEANTE))).toBe(true)
    },
    1_000,
  )

  it(
    'enchaîne 200 pas sur une zone géante sans dériver ni ralentir',
    () => {
      // 200 pas dont chacun nettoierait 1e12 monstres en version naïve : 2e14 itérations, hors de
      // portée de tout timeout. En forme fermée, 200 divisions.
      let etat = etatAvec(combatNeuf(1), { feu: 100, glace: 100 })
      for (let pas = 0; pas < 200; pas += 1) {
        etat = avancerCombatJeu(etat, 100, ZONE_PLATE_GEANTE).etat
      }
      expect(Number.isFinite(etat.magicien.monstresTues)).toBe(true)
      expect(Number.isFinite(etat.bourse.or)).toBe(true)
      expect(Number.isNaN(etat.combat.cible?.pvCourants ?? Number.NaN)).toBe(false)
    },
    1_000,
  )
})

describe('coût constant de la résolution de combat — EXG-30', () => {
  it('un avancement à 1e20 de dégâts n\'itère pas plus qu\'un avancement à 10', () => {
    const petit = avancerCombat(combatNeuf(1), 10, 100, C)
    const enorme = avancerCombat(combatNeuf(1), 1e20, 100, C)

    expect(enorme.monstresTues).toBeGreaterThan(petit.monstresTues)
    expect(enorme.iterations).toBeLessThanOrEqual(petit.iterations)
  })

  it('le compteur cumulé du tick ne dépend pas du DPS ni de la profondeur atteinte', () => {
    const faible = etatAvec(combatNeuf(1), { feu: 1 })
    const colossal = etatAvec(combatNeuf(1), { feu: 500, glace: 500, ecole3: 500, ecole4: 500, ecole5: 500 })

    const iterations = (etat: EtatJeu): number =>
      avancerCombatJeu(etat, 100, C).etat.iterationsCombat - etat.iterationsCombat

    expect(iterations(colossal)).toBeLessThanOrEqual(iterations(faible))

    // 500 avancements d'affilée sur l'état colossal : le coût par appel reste plat.
    let courant = colossal
    const echantillons: number[] = []
    for (let i = 0; i < 500; i += 1) {
      const avant = courant.iterationsCombat
      courant = avancerCombatJeu(courant, 100, C).etat
      echantillons.push(courant.iterationsCombat - avant)
    }
    expect(Math.max(...echantillons)).toBeLessThanOrEqual(iterations(faible) + 2)
    expect(courant.combat.zone).toBeGreaterThan(1)
  })
})
