// Boucle de simulation du moteur pur : tick à pas fixe, rattrapage de delta-time, bascule en forme
// fermée, production hors-ligne (EXG-1 à EXG-5, EXG-30, EXG-49).
//
// Trois règles tenues par ce fichier :
//  1. pureté — l'état entre en paramètre, un NOUVEL état sort ; aucun `Date.now()` (l'horodatage courant
//     est toujours un paramètre), aucun accès au navigateur ni au stockage, aucune dépendance d'UI ;
//  2. aucune valeur d'équilibrage locale — tout nombre de jeu arrive par `constantes` (§8) ;
//  3. coût constant par appel — aucune boucle proportionnelle à l'historique de jeu (EXG-30).

import {
  MS_PAR_HEURE,
  MS_PAR_SECONDE,
  PAS_TICK_MS,
  VAGUE_DEPART,
  VERSION_SCHEMA,
  ZONE_DEPART,
} from './constantes-moteur.ts'
import { multAmeliorations, multEquipement, multiplicateursAchats } from './ameliorations/index.ts'
import { multArbreAscension } from './ascension/index.ts'
import { productionEcoles, revelerEcolesDeZone } from './ecoles/index.ts'
import {
  bonusPassifEclats,
  facteurCooldownArbres,
  multArbreEclats,
  multOrArbres,
} from './prestige/index.ts'
import { evaluerQuetes } from './quetes/index.ts'
import { avancerSorts, declencherSort, degatsClic } from './sorts/index.ts'
import type {
  AvancementCombat,
  Constantes,
  EtatEcole,
  EtatJeu,
  ResultatDeclenchement,
  ResumeHorsLigne,
} from './types.ts'
import { avancerCombat, orPourDegats } from './zones/index.ts'

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
    iterationsCombat: 0,
    resteDeltaMs: 0,
    derniereSauvegardeMs: horodatageMs,
    tempsHorsLigneMs: 0,
  }
}

/* ──────────────────────────────────────────────────────────── chaîne de dégâts (§8) */

/**
 * §8 — production passive totale, en dégâts par seconde :
 * `Σ(niveau_école × production_base × palier_école)`. La formule et les paliers vivent dans
 * `ecoles/` (T-3), source unique : le moteur ne fait que l'appeler (EXG-7 y est tenu).
 */
export function productionPassive(etat: EtatJeu, constantes: Constantes): number {
  return productionEcoles(etat, constantes)
}

/**
 * §8 — chaîne complète des multiplicateurs de dégâts, dans l'ordre de la spec. Les cinq facteurs sont
 * branchés sur leur source unique, aucun ne vaut plus un facteur neutre de remplacement :
 *  - `mult_améliorations` (EXG-42) et `mult_équipement` (EXG-43) → `ameliorations/` (T-8) ;
 *  - `(1 + B × Éclats_possédés)^β` (EXG-38) et `mult_arbre_Éclats` (EXG-39) → `prestige/` (T-6) ;
 *  - `mult_arbre_Ascension` (EXG-40) → `ascension/` (T-7).
 */
export function degatsParSeconde(etat: EtatJeu, constantes: Constantes): number {
  return (
    productionPassive(etat, constantes) *
    multAmeliorations(etat, constantes) *
    multEquipement(etat, constantes) *
    bonusPassifEclats(etat, constantes) *
    multArbreEclats(etat, constantes) *
    multArbreAscension(etat, constantes)
  )
}

/**
 * EXG-6 / EXG-39 — or gagné pour un paquet de dégâts : le taux agrégé de la zone courante, multiplié par
 * les nœuds d'arbre qui portent sur l'or. Un seul point de conversion dégâts → or dans tout le moteur
 * (tick, dégâts instantanés, hors-ligne), donc un seul endroit où ce facteur s'applique.
 */
function orDesDegats(etat: EtatJeu, degats: number, constantes: Constantes): number {
  return orPourDegats(degats, etat.combat.zone, constantes) * multOrArbres(etat, constantes)
}

/* ──────────────────────────────────────────────────────────────── tick & delta-time */

/** Convertit un nombre de ticks en secondes de simulation. */
function secondesPourTicks(nbTicks: number): number {
  return (nbTicks * PAS_TICK_MS) / MS_PAR_SECONDE
}

/** Crédite `nbTicks` pas de production passive en une seule opération arithmétique (forme fermée). */
function crediterProduction(etat: EtatJeu, nbTicks: number, constantes: Constantes): EtatJeu {
  const degats = degatsParSeconde(etat, constantes) * secondesPourTicks(nbTicks)
  // EXG-6 agrégé : l'or suit les dégâts infligés, au multiplicateur de la zone courante près
  // (`mult_or_zone(1) = 1`, donc la zone de départ ne change rien) et aux nœuds d'or près (EXG-39).
  const or = orDesDegats(etat, degats, constantes)
  return {
    ...etat,
    bourse: { ...etat.bourse, or: etat.bourse.or + or },
    magicien: { ...etat.magicien, degatsCumules: etat.magicien.degatsCumules + degats },
    tempsJeuMs: etat.tempsJeuMs + nbTicks * PAS_TICK_MS,
    ticksEcoules: etat.ticksEcoules + nbTicks,
  }
}

/* ─────────────────────────────────────────────────── combat dans le tick (T-5, EXG-30) */

/**
 * Avance le combat d'un pas et en tire les conséquences hors combat : monstres tués, zone maximale du
 * run (entrée du gain d'Éclats, EXG-18), révélation d'école par boss vaincu (EXG-8) et compteur de coût.
 * `degatsInstantanes` porte les dégâts de clic et de sorts du pas (EXG-11, EXG-12) ; la production
 * passive est ajoutée ici à partir de la chaîne de DPS (§8).
 * Coût constant : au plus quelques étapes de résolution, quel que soit le DPS (EXG-30).
 */
export function avancerCombatJeu(
  etat: EtatJeu,
  dtMs: number,
  constantes: Constantes,
  degatsInstantanes = 0,
): { etat: EtatJeu; avancement: AvancementCombat } {
  const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0
  const instantanes = Number.isFinite(degatsInstantanes) && degatsInstantanes > 0 ? degatsInstantanes : 0
  const degats = degatsParSeconde(etat, constantes) * (dt / MS_PAR_SECONDE) + instantanes
  const avancement = avancerCombat(etat.combat, degats, dt, constantes)

  const apresCombat: EtatJeu = {
    ...etat,
    combat: avancement.combat,
    magicien: {
      ...etat.magicien,
      monstresTues: etat.magicien.monstresTues + avancement.monstresTues,
    },
    prestige: {
      ...etat.prestige,
      // EXG-18 — la zone maximale du run ne recule jamais, même après un échec de boss (EXG-17).
      zoneMaxDuRun: Math.max(etat.prestige.zoneMaxDuRun, avancement.combat.zone),
    },
    iterationsCombat: etat.iterationsCombat + avancement.iterations,
  }

  // EXG-8 — le boss d'une zone de déblocage révèle l'école suivante (nom + coût, production masquée).
  const suivant =
    avancement.zoneVaincue === null
      ? apresCombat
      : revelerEcolesDeZone(apresCombat, avancement.zoneVaincue, constantes)

  return { etat: suivant, avancement }
}

/**
 * Crédite l'or et la statistique de dégâts d'un paquet de dégâts **instantanés** (clic EXG-11, sort
 * EXG-12), au même taux agrégé que la production passive (EXG-6). Hors-ligne, ces dégâts n'existent
 * pas : seule la production passive compte (EXG-5).
 */
function crediterDegatsInstantanes(etat: EtatJeu, degats: number, constantes: Constantes): EtatJeu {
  if (!Number.isFinite(degats) || degats <= 0) return etat
  return {
    ...etat,
    bourse: { ...etat.bourse, or: etat.bourse.or + orDesDegats(etat, degats, constantes) },
    magicien: { ...etat.magicien, degatsCumules: etat.magicien.degatsCumules + degats },
  }
}

/**
 * EXG-11 — applique un clic du sort de clic : aucun cooldown, aucune ressource, les dégâts partent
 * immédiatement sur la cible courante. `dtMs = 0` : un clic n'est pas un pas de temps, il ne fait donc
 * pas avancer le chrono du boss (EXG-16).
 */
export function appliquerClic(etat: EtatJeu, constantes: Constantes): EtatJeu {
  const degats = degatsClic(etat, constantes)
  const compte: EtatJeu = {
    ...etat,
    magicien: { ...etat.magicien, clicsCumules: etat.magicien.clicsCumules + 1 },
  }
  const credite = crediterDegatsInstantanes(compte, degats, constantes)
  return avancerCombatJeu(credite, 0, constantes, degats).etat
}

/**
 * EXG-12 / EXG-13 — déclenche un sort actif et applique ses dégâts à la cible courante. Un refus
 * (verrouillé, en cooldown, inconnu) rend l'état d'entrée **tel quel** : aucune ressource consommée.
 * T-20 branchera les touches 1 à 6 sur cette fonction ; le domaine ne connaît pas le clavier.
 */
export function lancerSort(etat: EtatJeu, idSort: string, constantes: Constantes): ResultatDeclenchement {
  const tir = declencherSort(etat, idSort, constantes, multiplicateursAchats(etat, constantes))
  if (!tir.declenche) return tir

  const credite = crediterDegatsInstantanes(tir.etat, tir.degats, constantes)
  return { ...tir, etat: avancerCombatJeu(credite, 0, constantes, tir.degats).etat }
}

/**
 * EXG-1 — avance la simulation d'exactement un pas de `PAS_TICK_MS` : production passive créditée,
 * cooldowns de sorts décomptés et auto-cast déclenché (EXG-12, EXG-40), combat avancé (T-5), jalons de
 * quête évalués (EXG-54). Coût constant : sommes sur un nombre fixe d'écoles, de sorts et de quêtes,
 * résolution de combat en forme fermée — jamais de boucle sur l'historique (EXG-30).
 */
export function tick(etat: EtatJeu, constantes: Constantes): EtatJeu {
  const production = crediterProduction(etat, 1, constantes)
  // EXG-12 / EXG-39 — un nœud de cooldown fait tourner l'horloge de recharge `1/facteur` fois plus vite,
  // ce qui est exactement équivalent à raccourcir `cooldownMs` sans dupliquer la durée du contrat.
  const dtCooldownMs = PAS_TICK_MS / facteurCooldownArbres(etat, constantes)
  const sorts = avancerSorts(production, dtCooldownMs, constantes, multiplicateursAchats(etat, constantes))
  const apresSorts = crediterDegatsInstantanes(sorts.etat, sorts.degats, constantes)
  const combat = avancerCombatJeu(apresSorts, PAS_TICK_MS, constantes, sorts.degats)
  const quetes = evaluerQuetes(combat.etat, constantes)
  return { ...quetes.etat, ticksRattrapes: quetes.etat.ticksRattrapes + 1 }
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
 * (`ticksRattrapes` documente cette bascule ; ce qui la vérifie est le test de durée sur une session
 * de 2 h — un compteur que le moteur s'attribue lui-même ne mesure pas son propre coût.)
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
  // Même conversion qu'en ligne (EXG-6 agrégé), au multiplicateur de la zone où le joueur s'est arrêté.
  const orBrut = orDesDegats(etat, degats, constantes)
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
