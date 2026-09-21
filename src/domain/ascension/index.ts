// Ascension — T-7 : disponibilité après `prestigesParAscension` prestiges, gain de Points (§8), remise
// à zéro du cycle d'Éclats (EXG-20, ADR-14), confirmation à deux étapes (EXG-21), arbre permanent
// (EXG-40) et déblocage de la 6e école (EXG-41).
//
// ADR-14 — le partage des deux échelles de temps est le point à ne pas rater :
//   cycle d'Ascension → Éclats possédés, Éclats dépensables et **tous** les rangs de l'arbre d'Éclats
//                       repartent de zéro à chaque Ascension (EXG-20) ;
//   partie entière    → rangs de l'arbre d'Ascension, Points, Éclats cumulés à vie et compteurs à vie
//                       ne sont jamais réinitialisés (EXG-40).
//
// Module pur : l'état entre, un nouvel état sort, aucune valeur d'équilibrage locale, aucune horloge.

import { FACTEUR_NEUTRE } from '../constantes-moteur.ts'
import { perteDeRun, reinitialiserRun, synchroniserAutoCast } from '../prestige/index.ts'
import { acheterNoeudArbre, facteurArbre, noeudsDeLArbre, sommeArbre } from '../prestige/arbre.ts'
import { nombreFini, sommeBornee } from '../prestige/nombres.ts'
import type {
  ApercuAscension,
  Constantes,
  EtatJeu,
  ResultatAchat,
  ResultatReinitialisation,
} from '../types.ts'

/* ═══════════════════════════════════════════════════ §8 — disponibilité et gain de Points */

/**
 * EXG-20 / §8 — l'Ascension s'ouvre après `prestigesParAscension` prestiges dans le cycle **courant**
 * (fourchette 5-8 tranchée en interview, valeur exacte fixée par le rapport T-14). Le compteur de cycle
 * est remis à zéro par l'Ascension elle-même, jamais par un prestige.
 * EXG-28 / EXG-44 — une partie terminée n'ascensionne plus (condition de fin posée en T-13).
 */
export function ascensionDisponible(etat: EtatJeu, constantes: Constantes): boolean {
  if (etat.partieTerminee) return false
  const seuil = constantes.ascension.prestigesParAscension
  if (!Number.isFinite(seuil) || seuil <= 0) return false
  return etat.prestige.prestigesDuCycle >= seuil
}

/**
 * §8 — `Points = floor(k_ascension × √Éclats_cumulés_à_vie)`. Entrée : le cumul **à vie**, que ni le
 * prestige ni l'Ascension ne remettent à zéro — c'est ce qui fait croître les Ascensions successives.
 */
export function pointsDAscension(eclatsCumulesAVie: number, constantes: Constantes): number {
  if (!Number.isFinite(eclatsCumulesAVie) || eclatsCumulesAVie <= 0) return 0
  return nombreFini(Math.floor(constantes.ascension.kAscension * Math.sqrt(eclatsCumulesAVie)))
}

/* ══════════════════════════════════════════ EXG-40 — effets de l'arbre permanent (chaîne §8) */

/** Nombre d'écoles débloquées (EXG-7) : entrée des nœuds de synergie entre écoles (EXG-40). */
function ecolesDebloquees(etat: EtatJeu): number {
  let nombre = 0
  for (const ecole of Object.values(etat.ecoles)) if (ecole.debloquee) nombre += 1
  return nombre
}

/**
 * EXG-40 / §8 — `mult_arbre_Ascension` : produit des nœuds de dégâts de l'arbre permanent, multiplié par
 * la synergie entre écoles (`1 + bonus_par_rang × rangs × écoles_débloquées`), qui récompense une
 * progression large plutôt qu'une seule école montée à fond.
 */
export function multArbreAscension(etat: EtatJeu, constantes: Constantes): number {
  const degats = facteurArbre(etat, 'ascension', 'multDegats', constantes)
  const synergie = 1 + sommeArbre(etat, 'ascension', 'synergieEcoles', constantes) * ecolesDebloquees(etat)
  const facteur = nombreFini(degats * synergie)
  return facteur > 0 ? facteur : FACTEUR_NEUTRE
}

/* ══════════════════════════════════════════════════════════════════ EXG-40 — achat de nœuds */

/**
 * EXG-40 — guichet de l'arbre d'Ascension : paie en Points d'Ascension, et en Points seulement. Un nœud
 * de l'arbre d'Éclats présenté ici est refusé pour `mauvaiseMonnaie`. Un nœud d'auto-cast acheté arme
 * `EtatSort.autoCast` sur le sort visé : le sort part ensuite de lui-même au tick suivant (EXG-40).
 */
export function acheterNoeudAscension(
  etat: EtatJeu,
  id: string,
  quantite: number,
  constantes: Constantes,
): ResultatAchat {
  return acheterNoeudArbre(etat, id, quantite, 'ascension', constantes)
}

/* ══════════════════════════════════════════ EXG-21 — confirmation à deux étapes de l'Ascension */

/**
 * EXG-21, étape 1 — prévisualisation **en lecture seule** : les Points gagnés, le cycle d'Éclats perdu
 * (compteurs et nœuds, ADR-14), la perte de run et ce que l'Ascension débloque (EXG-41). Ne construit et
 * ne retourne aucun état : elle ne peut, par construction, rien modifier. L'étape 2 est `ascensionner`.
 */
export function apercuAscension(etat: EtatJeu, constantes: Constantes): ApercuAscension {
  const disponible = ascensionDisponible(etat, constantes)
  return {
    disponible,
    motifIndisponible: disponible ? null : 'verrouille',
    pointsGagnes: pointsDAscension(etat.prestige.eclatsCumulesAVie, constantes),
    prestigesDuCycle: etat.prestige.prestigesDuCycle,
    prestigesRequis: constantes.ascension.prestigesParAscension,
    eclatsPossedesPerdus: etat.bourse.eclatsPossedes,
    eclatsDepensablesPerdus: etat.bourse.eclatsDepensables,
    noeudsEclatsPerdus: noeudsDeLArbre('eclats', constantes).filter(
      (noeud) => (etat.prestige.rangsArbreEclats[noeud.id] ?? 0) > 0,
    ).length,
    perte: perteDeRun(etat),
    debloqueSixiemeEcole: !etat.ascension.sixiemeEcoleDebloquee,
  }
}

/**
 * EXG-20, étape 2 — applique l'Ascension. Dans l'ordre :
 *  1. le cycle d'Éclats est effacé — les deux compteurs d'Éclats **et** tous les rangs de l'arbre
 *     d'Éclats (ADR-14), donc le bonus passif d'EXG-38 retombe à son état zéro Éclat ;
 *  2. les Points sont crédités, `ascensionsEffectuees` avance et la 6e école est débloquée (EXG-41) ;
 *  3. le run est réinitialisé (même reset que le prestige, EXG-19) — après l'effacement, pour que la
 *     zone de reprise ne dépende plus que de l'arbre **permanent**.
 * L'arbre d'Ascension, le cumul d'Éclats à vie, les prestiges à vie et les compteurs du magicien ne
 * sont pas touchés. Un refus rend l'état d'entrée **par référence**.
 */
export function ascensionner(etat: EtatJeu, constantes: Constantes): ResultatReinitialisation {
  const apercu = apercuAscension(etat, constantes)
  if (!apercu.disponible) {
    return { etat, accepte: false, motifRefus: apercu.motifIndisponible, gain: 0 }
  }

  const gain = apercu.pointsGagnes
  const efface: EtatJeu = {
    ...etat,
    bourse: {
      ...etat.bourse,
      // EXG-20 / ADR-14 — les Éclats du cycle disparaissent ; le cumul à vie, lui, survit.
      eclatsPossedes: 0,
      eclatsDepensables: 0,
      pointsAscension: sommeBornee(etat.bourse.pointsAscension, gain),
    },
    prestige: {
      ...etat.prestige,
      prestigesDuCycle: 0,
      rangsArbreEclats: {},
    },
    ascension: {
      ...etat.ascension,
      ascensionsEffectuees: etat.ascension.ascensionsEffectuees + 1,
      // EXG-41 — la 6e école est révélée par la 1re Ascension ; la révélation ne se reperd jamais.
      sixiemeEcoleDebloquee: true,
    },
  }

  return {
    etat: synchroniserAutoCast(reinitialiserRun(efface, constantes), constantes),
    accepte: true,
    motifRefus: null,
    gain,
  }
}
