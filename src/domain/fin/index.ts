// Fin de partie et boss final — T-13 : zone dédiée accessible au seuil d'Ascensions (EXG-28), combat
// chronométré selon EXG-16 mais avec son propre chrono, victoire qui termine la partie et fige l'écran
// de fin (EXG-28, EXG-44).
//
// Trois décisions structurent ce fichier :
//
//  1. **le combat final vit hors d'`EtatCombat`** (`EtatJeu.bossFinal`). La zone dédiée n'est pas une
//     profondeur : `fin.zoneBossFinal` en est le *nom*. La faire transiter par `combat.zone` la ferait
//     entrer dans `zoneMaxDuRun` (donc dans le gain d'Éclats d'EXG-18) et obligerait le chemin chaud du
//     tick à la tester à chaque pas. Séparée, la progression normale ne peut structurellement pas
//     l'atteindre : le seul chemin vers `bossFinal` est `entrerZoneFinale`, sous le seuil d'EXG-28 ;
//
//  2. **aucune valeur d'équilibrage ici** : le seuil, le numéro de la zone, les PV et le chrono
//     arrivent par `Constantes.fin` (sortie du simulateur, T-14/T-15) ;
//
//  3. **les statistiques de fin sont figées** au moment de la victoire, pas recalculées à l'affichage :
//     la partie terminée ne gèle pas l'horloge du jeu, une lecture tardive mentirait sur la durée.
//
// Le refus de prestige et d'Ascension après la fin (EXG-44) n'est pas réimplémenté ici : il est déjà
// tenu à la source, par `prestige/apercuPrestige` et `ascension/ascensionDisponible`, qui lisent
// `partieTerminee`. Ce module se contente de poser ce drapeau ; `tests/domain/fin.test.ts` en prouve
// l'effet de bout en bout.

import { ZONE_DEPART } from '../constantes-moteur.ts'
import type {
  ApercuFin,
  AvancementBossFinal,
  Constantes,
  EtatBossFinal,
  EtatJeu,
  ResultatEntreeFinale,
  StatistiquesFin,
} from '../types.ts'
import { pvBossFinal, timerBossFinalMs } from '../zones/formules.ts'

/* ═══════════════════════════════════════════════════════ EXG-28 — accès à la zone dédiée */

/**
 * EXG-28 — la zone dédiée s'ouvre à `ascensions ≥ nAscensionsRequises`, et se referme définitivement
 * quand la partie est terminée (EXG-44 : on ne rejoue pas le boss final pour le plaisir).
 * Un seuil absurde (non fini, négatif) ne déverrouille rien : une constante cassée ferme la porte
 * plutôt que de l'ouvrir en grand.
 */
export function zoneFinaleAccessible(etat: EtatJeu, constantes: Constantes): boolean {
  if (etat.partieTerminee) return false
  const seuil = constantes.fin.nAscensionsRequises
  if (!Number.isFinite(seuil) || seuil < 0) return false
  return etat.ascension.ascensionsEffectuees >= seuil
}

/**
 * EXG-28 / EXG-21 — prévisualisation **en lecture seule** de la zone dédiée : le seuil, où en est le
 * joueur, ce qui l'attend. Ne construit et ne retourne aucun état : elle ne peut, par construction,
 * rien modifier.
 */
export function apercuFin(etat: EtatJeu, constantes: Constantes): ApercuFin {
  const accessible = zoneFinaleAccessible(etat, constantes)
  return {
    accessible,
    motifIndisponible: accessible ? null : 'verrouille',
    ascensionsEffectuees: etat.ascension.ascensionsEffectuees,
    ascensionsRequises: constantes.fin.nAscensionsRequises,
    pvBossFinal: pvBossFinal(constantes),
    timerMs: timerBossFinalMs(constantes),
    engage: etat.bossFinal !== undefined,
  }
}

/**
 * EXG-28 — entre dans la zone dédiée : le boss final est armé à PV pleins et chrono plein. C'est le
 * **seul** chemin qui pose `EtatJeu.bossFinal` ; aucun avancement de combat ordinaire ne l'ouvre.
 * Un refus rend l'état d'entrée **par référence**, comme partout ailleurs dans le moteur.
 * Entrer alors qu'un combat est déjà engagé le relance à neuf (l'échec au chrono l'ayant refermé,
 * ce cas ne se présente qu'à un appelant qui insiste : il ne doit pas pouvoir tricher en le faisant).
 */
export function entrerZoneFinale(etat: EtatJeu, constantes: Constantes): ResultatEntreeFinale {
  if (!zoneFinaleAccessible(etat, constantes)) {
    return { etat, accepte: false, motifRefus: 'verrouille' }
  }
  const bossFinal: EtatBossFinal = {
    pvCourants: pvBossFinal(constantes),
    timerRestantMs: timerBossFinalMs(constantes),
  }
  return { etat: { ...etat, bossFinal }, accepte: true, motifRefus: null }
}

/* ═════════════════════════════════════════════ EXG-28 — écran de fin (statistiques figées) */

/**
 * EXG-28 — les statistiques du run, prises à l'instant de la victoire. `zoneMaxAtteinte` est celle de
 * la **progression** : `combat.zone` et `zoneMaxDuRun` ne portent jamais la zone dédiée (le combat
 * final vit ailleurs), donc l'écran de fin ne peut pas afficher un 1000 qui ne veut rien dire.
 */
function figerStatistiques(etat: EtatJeu): StatistiquesFin {
  return {
    dureeTotaleMs: etat.tempsJeuMs,
    zoneMaxAtteinte: Math.max(etat.prestige.zoneMaxDuRun, etat.combat.zone, ZONE_DEPART),
    ascensions: etat.ascension.ascensionsEffectuees,
    prestigesTotal: etat.prestige.prestigesTotal,
  }
}

/**
 * EXG-28 — lecture de l'écran de fin pour l'UI (T-27). `null` tant que la partie n'est pas gagnée :
 * l'écran de fin n'existe pas avant la victoire, il ne se pré-calcule pas.
 */
export function statistiquesDeFin(etat: EtatJeu): StatistiquesFin | null {
  return etat.partieTerminee ? (etat.statistiquesFin ?? null) : null
}

/* ═════════════════════════════════════ EXG-16 / EXG-44 — un pas du combat du boss final */

/** Résultat d'un pas qui n'a rien à faire : aucun combat engagé, état rendu par référence. */
function pasSansCombat(etat: EtatJeu): AvancementBossFinal {
  return {
    etat,
    engage: false,
    bossVaincu: false,
    bossEchoue: false,
    pvRestants: 0,
    timerRestantMs: 0,
    iterations: 0,
  }
}

/** Referme le combat final sans laisser de clé orpheline dans l'état (le champ est facultatif). */
function refermerCombat(etat: EtatJeu): EtatJeu {
  const { bossFinal: _abandonne, ...reste } = etat
  return reste
}

/**
 * EXG-16 / EXG-28 / EXG-44 — un pas du combat final, de `dtMs` avec un budget de `degats`.
 *
 * Même règle d'arbitrage que les boss de zone : si le boss meurt et que le chrono expire dans le même
 * pas, la mort l'emporte — on ne punit pas le joueur pour un arrondi de 100 ms. Et comme tout boss, il
 * ne se résout jamais « en lot » : un pas, un décompte, des dégâts. Le coût est donc constant quel que
 * soit le budget de dégâts (EXG-30), même à 1e300.
 *
 * Victoire → `partieTerminee` (EXG-44, qui ferme prestige et Ascension à la source) et statistiques
 * figées (EXG-28). Échec au chrono → le combat se referme, **et rien d'autre ne bouge** : ni or, ni
 * niveaux, ni Éclats, ni Ascensions (EXG-17, même esprit). La zone dédiée se rouvre gratuitement.
 */
export function avancerBossFinal(
  etat: EtatJeu,
  degats: number,
  dtMs: number,
  constantes: Constantes,
): AvancementBossFinal {
  const combat = etat.bossFinal
  if (combat === undefined) return pasSansCombat(etat)

  const budget = Number.isFinite(degats) && degats > 0 ? degats : 0
  const ecoule = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0
  // Le combat lu est ramené dans les bornes des constantes avant d'être avancé : `src/state/` peut
  // appeler cette fonction sur un état qui n'est pas passé par la normalisation d'un import.
  const pvLus = Math.min(Math.max(combat.pvCourants, 0), pvBossFinal(constantes))
  const timerLu = Math.min(Math.max(combat.timerRestantMs, 0), timerBossFinalMs(constantes))
  const pvCourants = pvLus - budget
  const timerRestantMs = timerLu - ecoule

  if (pvCourants <= 0) {
    const termine: EtatJeu = {
      ...refermerCombat(etat),
      partieTerminee: true,
      statistiquesFin: figerStatistiques(etat),
    }
    return {
      etat: termine,
      engage: true,
      bossVaincu: true,
      bossEchoue: false,
      pvRestants: 0,
      timerRestantMs: Math.max(timerRestantMs, 0),
      iterations: 1,
    }
  }

  if (timerRestantMs <= 0) {
    return {
      etat: refermerCombat(etat),
      engage: true,
      bossVaincu: false,
      bossEchoue: true,
      pvRestants: pvCourants,
      timerRestantMs: 0,
      iterations: 1,
    }
  }

  return {
    etat: { ...etat, bossFinal: { pvCourants, timerRestantMs } },
    engage: true,
    bossVaincu: false,
    bossEchoue: false,
    pvRestants: pvCourants,
    timerRestantMs,
    iterations: 1,
  }
}
