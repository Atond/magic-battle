// Boucle de simulation du moteur pur : tick à pas fixe, rattrapage de delta-time, bascule en forme
// fermée, production hors-ligne (EXG-1 à EXG-5, EXG-30, EXG-49).
//
// Trois règles tenues par ce fichier :
//  1. pureté — l'état entre en paramètre, un NOUVEL état sort ; aucun `Date.now()` (l'horodatage courant
//     est toujours un paramètre), aucun accès au navigateur ni au stockage, aucune dépendance d'UI ;
//  2. aucune valeur d'équilibrage locale — tout nombre de jeu arrive par `constantes` (§8) ;
//  3. coût constant par appel — aucune boucle proportionnelle à l'historique de jeu (EXG-30).

import {
  FACTEUR_NEUTRE,
  MS_PAR_HEURE,
  MS_PAR_SECONDE,
  PAS_TICK_MS,
  VAGUE_DEPART,
  VERSION_SCHEMA,
  ZONE_DEPART,
} from './constantes-moteur.ts'
import type {
  Constantes,
  EtatEcole,
  EtatJeu,
  IdEcole,
  ParametresEcole,
  ResumeHorsLigne,
} from './types.ts'

/* ────────────────────────────────────────────────────────────────────────── état initial */

/** École à niveau 0, ni révélée ni débloquée : l'état par défaut de toutes les écoles sauf le Feu. */
const ECOLE_VIERGE: EtatEcole = { niveau: 0, debloquee: false, revelee: false }

/**
 * État d'une nouvelle partie. `horodatageMs` est fourni par l'appelant (`src/state/`) : le domaine ne
 * lit jamais l'horloge lui-même. Seule l'École du Feu est disponible au départ (EXG-9) ; les suivantes
 * sont révélées par les boss (EXG-8) et Lumière par la 1re Ascension (EXG-41).
 */
export function etatInitial(horodatageMs: number): EtatJeu {
  return {
    version: VERSION_SCHEMA,
    magicien: { nom: 'Magicien', clicsCumules: 0, degatsCumules: 0, monstresTues: 0 },
    bourse: { or: 0, renommee: 0, eclatsPossedes: 0, eclatsDepensables: 0, pointsAscension: 0 },
    ecoles: {
      feu: { niveau: 0, debloquee: true, revelee: true },
      glace: ECOLE_VIERGE,
      ecole3: ECOLE_VIERGE,
      ecole4: ECOLE_VIERGE,
      ecole5: ECOLE_VIERGE,
      lumiere: ECOLE_VIERGE,
    },
    sorts: {}, // peuplé en T-4 depuis `src/donnees/sorts.ts` (lot B)
    combat: {
      zone: ZONE_DEPART,
      vague: VAGUE_DEPART,
      phase: 'vague',
      cible: null, // les monstres sont générés en T-5 (lot C)
      timerBossRestantMs: null,
    },
    paliersAmeliorations: {}, // T-8
    paliersEquipement: {}, // T-8
    quetesAccomplies: [],
    prestige: {
      prestigesDuCycle: 0,
      prestigesTotal: 0,
      zoneMaxDuRun: ZONE_DEPART,
      eclatsCumulesAVie: 0,
      rangsArbreEclats: {},
    },
    ascension: {
      ascensionsEffectuees: 0,
      rangsArbreAscension: {},
      sixiemeEcoleDebloquee: false,
    },
    partieTerminee: false,
    tempsJeuMs: 0,
    ticksEcoules: 0,
    ticksRattrapes: 0,
    resteDeltaMs: 0,
    derniereSauvegardeMs: horodatageMs,
    tempsHorsLigneMs: 0,
  }
}

/* ──────────────────────────────────────────────────────────── chaîne de dégâts (§8) */

/** §8 — ×`multiplicateurParPalier` à chaque seuil de `paliersSeuils` franchi. Coût borné par le nombre de seuils. */
function multiplicateurPalier(niveau: number, parametres: ParametresEcole): number {
  let paliersFranchis = 0
  for (const seuil of parametres.paliersSeuils) {
    if (niveau >= seuil) paliersFranchis += 1
  }
  return parametres.multiplicateurParPalier ** paliersFranchis
}

/**
 * §8 — production passive totale, en dégâts par seconde :
 * `Σ(niveau_école × production_base × palier_école)`. La somme parcourt les écoles présentes dans
 * l'état, jamais une liste en dur ; une école non débloquée ne compte pas (EXG-7).
 */
export function productionPassive(etat: EtatJeu, constantes: Constantes): number {
  let production = 0
  for (const [id, ecole] of Object.entries(etat.ecoles) as [IdEcole, EtatEcole][]) {
    if (!ecole.debloquee || ecole.niveau <= 0) continue
    const parametres = constantes.ecoles[id]
    if (parametres === undefined) continue
    production += ecole.niveau * parametres.productionBase * multiplicateurPalier(ecole.niveau, parametres)
  }
  return production
}

/**
 * §8 — chaîne complète des multiplicateurs de dégâts. Les facteurs des briques pas encore implémentées
 * valent `FACTEUR_NEUTRE` (= 1, propriété du produit, pas une valeur d'équilibrage) :
 *  - `mult_améliorations` (EXG-42) et `mult_équipement` (EXG-43) → branchés en T-8 ;
 *  - `(1 + B × Éclats)^β` (EXG-38) et `mult_arbre_Éclats` (EXG-39) → branchés en T-6 ;
 *  - `mult_arbre_Ascension` (EXG-40) → branché en T-7.
 */
export function degatsParSeconde(etat: EtatJeu, constantes: Constantes): number {
  const multAmeliorations = FACTEUR_NEUTRE
  const multEquipement = FACTEUR_NEUTRE
  const bonusPassifEclats = FACTEUR_NEUTRE
  const multArbreEclats = FACTEUR_NEUTRE
  const multArbreAscension = FACTEUR_NEUTRE

  return (
    productionPassive(etat, constantes) *
    multAmeliorations *
    multEquipement *
    bonusPassifEclats *
    multArbreEclats *
    multArbreAscension
  )
}

/* ──────────────────────────────────────────────────────────────── tick & delta-time */

/** Convertit un nombre de ticks en secondes de simulation. */
function secondesPourTicks(nbTicks: number): number {
  return (nbTicks * PAS_TICK_MS) / MS_PAR_SECONDE
}

/** Crédite `nbTicks` pas de production passive en une seule opération arithmétique (forme fermée). */
function crediterProduction(etat: EtatJeu, nbTicks: number, constantes: Constantes): EtatJeu {
  const degats = degatsParSeconde(etat, constantes) * secondesPourTicks(nbTicks)
  const or = degats * constantes.or.orParDegatMoyen
  return {
    ...etat,
    bourse: { ...etat.bourse, or: etat.bourse.or + or },
    magicien: { ...etat.magicien, degatsCumules: etat.magicien.degatsCumules + degats },
    tempsJeuMs: etat.tempsJeuMs + nbTicks * PAS_TICK_MS,
    ticksEcoules: etat.ticksEcoules + nbTicks,
  }
}

/**
 * EXG-1 — avance la simulation d'exactement un pas de `PAS_TICK_MS`. Coût constant : la production est
 * une somme sur un nombre fixe d'écoles, jamais sur l'historique (EXG-30).
 * Le combat (vagues, boss, projectiles) est branché en T-5 (lot C) et consommera la même production.
 */
export function tick(etat: EtatJeu, constantes: Constantes): EtatJeu {
  const avance = crediterProduction(etat, 1, constantes)
  return { ...avance, ticksRattrapes: avance.ticksRattrapes + 1 }
}

/** EXG-3 — seuil N de ticks au-delà duquel on cesse d'itérer. Lu dans les constantes, jamais deviné. */
function seuilRattrapage(constantes: Constantes): number {
  const seuil = constantes.tick.nTicksMax
  return Number.isFinite(seuil) && seuil > 0 ? Math.floor(seuil) : 0
}

/**
 * EXG-2 — applique un delta-time quelconque : exécute `floor(dt_accumulé / PAS_TICK_MS)` ticks et
 * conserve le reste sous 100 ms pour la frame suivante (jamais perdu).
 * EXG-3 — au-delà de `constantes.tick.nTicksMax` ticks à rattraper, bascule en forme fermée : aucune
 * itération, donc `ticksRattrapes` n'augmente pas et le coût reste constant quelle que soit l'absence.
 * Un delta négatif, nul ou non fini est ignoré (garde-fou d'horloge, même esprit qu'EXG-49).
 */
export function appliquerDelta(etat: EtatJeu, dtMs: number, constantes: Constantes): EtatJeu {
  const delta = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0
  const accumuleMs = etat.resteDeltaMs + delta
  const nbTicks = Math.floor(accumuleMs / PAS_TICK_MS)
  const resteDeltaMs = accumuleMs - nbTicks * PAS_TICK_MS

  if (nbTicks <= 0) return { ...etat, resteDeltaMs }

  if (nbTicks > seuilRattrapage(constantes)) {
    return { ...crediterProduction(etat, nbTicks, constantes), resteDeltaMs }
  }

  let courant = etat
  for (let i = 0; i < nbTicks; i += 1) courant = tick(courant, constantes)
  return { ...courant, resteDeltaMs }
}

/* ────────────────────────────────────────────────────────────────── hors-ligne */

/**
 * EXG-4 / EXG-5 / EXG-49 — crédite la production hors-ligne au retour du joueur.
 * `Δt = clamp(horodatageActuel − etat.derniereSauvegardeMs, 0, H)` avec `H = plafondHeures` : une
 * horloge système reculée donne `Δt = 0`, jamais un crédit négatif ni un `NaN` (EXG-49). Seule la
 * production passive des écoles est comptée — ni sort de clic, ni sort actif (EXG-5). Forme fermée :
 * une multiplication, indépendante de la durée d'absence (§8, budget de calcul).
 * `resume` porte les trois valeurs exigées par EXG-4 et affichées par T-23 (encart non bloquant, EXG-53).
 */
export function calculHorsLigne(
  etat: EtatJeu,
  horodatageActuelMs: number,
  constantes: Constantes,
): { etat: EtatJeu; resume: ResumeHorsLigne } {
  const plafondHeures = constantes.horsLigne.plafondHeures
  const plafondMs = Number.isFinite(plafondHeures) && plafondHeures > 0 ? plafondHeures * MS_PAR_HEURE : 0

  const horodatageValide = Number.isFinite(horodatageActuelMs)
  const ecartBrutMs = horodatageValide ? horodatageActuelMs - etat.derniereSauvegardeMs : 0
  const tempsEcouleMs = Number.isFinite(ecartBrutMs)
    ? Math.min(Math.max(ecartBrutMs, 0), plafondMs)
    : 0
  const plafondAtteint = ecartBrutMs > plafondMs

  const degatsBruts = degatsParSeconde(etat, constantes) * (tempsEcouleMs / MS_PAR_SECONDE)
  const degats = Number.isFinite(degatsBruts) && degatsBruts > 0 ? degatsBruts : 0
  const orBrut = degats * constantes.or.orParDegatMoyen
  const orGagne = Number.isFinite(orBrut) && orBrut > 0 ? orBrut : 0

  // L'horodatage de référence ne recule jamais : une horloge remise à l'heure ne doit pas offrir
  // une seconde fois la même absence.
  const derniereSauvegardeMs = horodatageValide
    ? Math.max(etat.derniereSauvegardeMs, horodatageActuelMs)
    : etat.derniereSauvegardeMs

  return {
    etat: {
      ...etat,
      bourse: { ...etat.bourse, or: etat.bourse.or + orGagne },
      magicien: { ...etat.magicien, degatsCumules: etat.magicien.degatsCumules + degats },
      // Le hors-ligne n'entre pas dans le temps de jeu simulé (cible « ≥ 40 h » de §8) : compteur séparé.
      tempsHorsLigneMs: etat.tempsHorsLigneMs + tempsEcouleMs,
      derniereSauvegardeMs,
    },
    resume: { orGagne, tempsEcouleMs, plafondAtteint },
  }
}
