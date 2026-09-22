// Avancement du combat — T-5 : progression des vagues en forme fermée (EXG-30), boss chronométré
// (EXG-16) et échec de boss (EXG-17). Fonction pure sur `EtatCombat` : un combat entre, un nouveau
// combat sort, accompagné du résumé de ce qui s'est passé.
//
// Le nettoyage de plusieurs vagues par un même paquet de dégâts est fermé : les PV des vagues
// successives forment une série géométrique, donc le nombre de vagues tombées s'obtient par logarithme
// — jamais monstre par monstre, même avec un DPS de fin de partie. Le boss, chronométré, ne se résout
// jamais en lot : il est traité à part, un pas de temps à la fois.

import { VAGUE_DEPART } from '../constantes-moteur.ts'
import type { AvancementCombat, Boss, Constantes, EtatCombat, Monstre } from '../types.ts'
import {
  creerBoss,
  creerMonstre,
  degatsSains,
  nbVagues,
  pvCumulVagues,
  pvVague,
  timerBossMs,
  vagueSaine,
  vaguesNettoyees,
  zoneSaine,
} from './formules.ts'

/** Cible attendue par la phase courante, engendrée à la demande (ouverture de partie, reprise de save). */
function creerCible(combat: EtatCombat, constantes: Constantes): Monstre | Boss {
  return combat.phase === 'boss'
    ? creerBoss(combat.zone, constantes)
    : creerMonstre(combat.zone, combat.vague, constantes)
}

/* ────────────────────────────────────────────────────── avancement du combat (EXG-16, 17, 30) */

/** Avancement sans effet : la cible a seulement encaissé (ou rien du tout). */
function avancementNeutre(combat: EtatCombat, iterations: number): AvancementCombat {
  return { combat, monstresTues: 0, vaguesNettoyees: 0, bossVaincu: false, bossEchoue: false, zoneVaincue: null, iterations }
}

/**
 * EXG-16 / EXG-17 — un pas de combat de boss. Le boss ne se résout **jamais** en lot : un pas décompte
 * le chrono et applique les dégâts du pas. Si le boss meurt et que le chrono expire dans le même pas,
 * la mort l'emporte (on ne punit pas le joueur pour un arrondi de 100 ms).
 */
function avancerBoss(
  combat: EtatCombat,
  cible: Monstre,
  degats: number,
  dtMs: number,
  constantes: Constantes,
  iterations: number,
): AvancementCombat {
  const ecoule = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0
  const timerRestant = (combat.timerBossRestantMs ?? timerBossMs(constantes)) - ecoule
  const pvCourants = cible.pvCourants - degats
  const zone = zoneSaine(combat.zone)

  if (pvCourants <= 0) {
    const zoneSuivante = zone + 1
    return {
      combat: {
        zone: zoneSuivante,
        vague: VAGUE_DEPART,
        phase: 'vague',
        cible: creerMonstre(zoneSuivante, VAGUE_DEPART, constantes),
        timerBossRestantMs: null,
      },
      monstresTues: 1,
      vaguesNettoyees: 0,
      bossVaincu: true,
      bossEchoue: false,
      zoneVaincue: zone,
      iterations,
    }
  }

  if (timerRestant <= 0) {
    // EXG-17 — retour à la vague précédente, dans la même zone : aucune perte d'or ni de niveaux
    // (cette fonction ne touche qu'au combat), et le boss est relançable gratuitement.
    const vague = Math.max(VAGUE_DEPART, nbVagues(constantes) - 1)
    return {
      combat: {
        zone,
        vague,
        phase: 'vague',
        cible: creerMonstre(zone, vague, constantes),
        timerBossRestantMs: null,
      },
      monstresTues: 0,
      vaguesNettoyees: 0,
      bossVaincu: false,
      bossEchoue: true,
      zoneVaincue: null,
      iterations,
    }
  }

  return avancementNeutre(
    { ...combat, zone, cible: { ...cible, pvCourants }, timerBossRestantMs: timerRestant },
    iterations,
  )
}

/**
 * Un pas de combat de vagues normales. Au plus trois étapes, quel que soit le DPS (EXG-30) :
 *  1. la cible courante encaisse ;
 *  2. si elle tombe, le reste des dégâts nettoie d'un coup un paquet de vagues (forme fermée) ;
 *  3. si toutes les vagues normales sont tombées, la phase boss s'ouvre avec son chrono plein (EXG-16)
 *     — le surplus de dégâts s'arrête là : le boss se bat à partir du pas suivant.
 */
function avancerVagues(
  combat: EtatCombat,
  cible: Monstre,
  degats: number,
  constantes: Constantes,
  iterationsInitiales: number,
): AvancementCombat {
  // Deux étapes de résolution, comptées d'avance et **inconditionnellement** : l'encaissement de la
  // cible et le paquet de vagues en forme fermée. Cette ligne **documente l'intention** — « ce pas coûte
  // deux étapes, pour 10 points de dégâts comme pour 1e20 » — elle ne mesure rien : c'est une constante
  // littérale, elle n'observe pas le travail réellement effectué. La preuve du coût constant est
  // ailleurs, dans les tests sous chronomètre et sous timeout (LRN-002).
  const iterations = iterationsInitiales + 2
  const zone = zoneSaine(combat.zone)
  const total = nbVagues(constantes)

  if (degats < cible.pvCourants) {
    return avancementNeutre({ ...combat, zone, cible: { ...cible, pvCourants: cible.pvCourants - degats } }, iterations)
  }

  let reste = degats - cible.pvCourants
  let tues = 1
  let vague = vagueSaine(combat.vague, constantes) + 1

  if (vague <= total) {
    const pvProchaine = pvVague(zone, vague, constantes)
    const paquet = Math.min(vaguesNettoyees(pvProchaine, reste, constantes), total - vague + 1)
    if (paquet > 0) {
      reste -= pvCumulVagues(pvProchaine, paquet, constantes)
      tues += paquet
      vague += paquet
    }
  }

  if (vague > total) {
    return {
      combat: {
        zone,
        vague: total,
        phase: 'boss',
        cible: creerBoss(zone, constantes),
        timerBossRestantMs: timerBossMs(constantes),
      },
      monstresTues: tues,
      vaguesNettoyees: tues,
      bossVaincu: false,
      bossEchoue: false,
      zoneVaincue: null,
      iterations,
    }
  }

  const suivant = creerMonstre(zone, vague, constantes)
  // Le reste de dégâts entame la vague suivante. Bornes de sûreté : jamais plus que ses PV max (arrondi
  // flottant de la somme fermée), jamais moins que 0 (le monstre tombera au pas suivant).
  const pvEntames = Math.min(Math.max(suivant.pvMax - reste, 0), suivant.pvMax)
  return {
    combat: {
      zone,
      vague,
      phase: 'vague',
      cible: { ...suivant, pvCourants: pvEntames },
      timerBossRestantMs: null,
    },
    monstresTues: tues,
    vaguesNettoyees: tues,
    bossVaincu: false,
    bossEchoue: false,
    zoneVaincue: null,
    iterations,
  }
}

/**
 * EXG-15 à 17 / EXG-30 — avance le combat d'un pas de `dtMs` avec un budget de `degats`. Fonction pure
 * sur `EtatCombat` : le combat entre, un nouveau combat sort, plus le résumé de ce qui s'est passé
 * (monstres tués, boss vaincu ou échoué, zone dont le boss est tombé pour EXG-8).
 * `iterations` **documente** le coût prévu de l'algorithme (il ne dépend ni du DPS ni de la profondeur
 * atteinte) ; il ne le mesure pas, puisque c'est le code lui-même qui se l'attribue. Ce que ce compteur
 * sert à dire, c'est l'intention ; ce qui la vérifie, ce sont les tests chronométrés (LRN-002).
 */
export function avancerCombat(
  combat: EtatCombat,
  degats: number,
  dtMs: number,
  constantes: Constantes,
): AvancementCombat {
  let iterations = 0
  let courant = combat
  if (courant.cible === null) {
    courant = { ...courant, cible: creerCible(courant, constantes) }
    iterations += 1
  }

  const cible = courant.cible as Monstre
  const budget = degatsSains(degats)

  return courant.phase === 'boss'
    ? avancerBoss(courant, cible, budget, dtMs, constantes, iterations + 1)
    : avancerVagues(courant, cible, budget, constantes, iterations)
}
