// Politique de jeu déterministe — **aucun hasard**.
//
// Une politique est une HYPOTHÈSE SUR LE JOUEUR, et tout le rapport en dépend. Celle-ci, en une phrase :
// un joueur attentif mais pas optimisateur, qui clique tant que ça change quelque chose, presse ses
// touches de sort dès la fin du cooldown, dépense son or sur-le-champ sur le meilleur rapport
// « gain de dégâts par pièce d'or », dépense ses Éclats et ses Points dès qu'un rang est abordable, et
// prestige quand il est bloqué plus longtemps que sa patience.
//
// Les cinq règles, explicitées parce qu'elles sont falsifiables :
//  1. ACHAT D'OR — à chaque instant où quelque chose est abordable, achète l'article au meilleur
//     `Δ(dégâts/s) / coût` parmi les articles **abordables** (écoles, améliorations), et répète jusqu'à
//     ce que plus rien ne soit abordable. Le joueur n'épargne pas : il ne laisse jamais dormir son or.
//     (Variante `epargne` mesurée à part : garder l'or pour le meilleur ratio du catalogue, même non
//     abordable, tant qu'il dépasse le meilleur ratio abordable d'un facteur donné.)
//  2. RENOMMÉE — même règle, budget séparé (EXG-10) : la Renommée n'achète que de l'équipement.
//  3. SORTS — tout sort débloqué et hors cooldown part immédiatement (EXG-12). Conséquence à assumer :
//     les nœuds d'auto-cast (EXG-40) n'apportent AUCUN dégât dans cette simulation, seulement du confort ;
//     leur valeur est mesurée nulle ici, ce qui est une borne basse honnête, pas un oubli.
//  4. CLICS — `clicsParSeconde` clics soutenus tant que les dégâts de clic pèsent au moins
//     `partClicsMin` de la production passive ; sinon le joueur lâche la souris. Au départ d'une partie
//     la production passive est nulle : le clic est la **seule** source d'or (EXG-11), donc il est
//     structurellement obligatoire, pas décoratif.
//  5. MÉTA — Éclats et Points dépensés dès qu'un rang est abordable, au meilleur `Δscore / coût` où
//     `score` agrège les effets hétérogènes des nœuds (dégâts, or, zone de départ, or de départ,
//     cooldown) sur une échelle logarithmique commune. Prestige dès que la profondeur ne bouge plus
//     depuis `patienceMs`. Ascension dès qu'elle est disponible (EXG-20).

import { multAmeliorations, multEquipement, coutPalier } from '../../src/domain/ameliorations/index.ts'
import { multArbreAscension } from '../../src/domain/ascension/index.ts'
import {
  coutProchainNiveau,
  ecoleAccessible,
  productionEcole,
} from '../../src/domain/ecoles/index.ts'
import { degatsParSeconde, lancerSort, appliquerClic, productionPassive } from '../../src/domain/moteur.ts'
import {
  bonusPassifEclats,
  coutRangNoeud,
  facteurCooldownArbres,
  multArbreEclats,
  multOrArbres,
  noeudParId,
  orDepartRun,
  prerequisRemplis,
  rangNoeud,
  zoneDepartRun,
} from '../../src/domain/prestige/index.ts'
import { acheterNoeudArbre } from '../../src/domain/prestige/arbre.ts'
import { acheterNiveaux } from '../../src/domain/ecoles/index.ts'
import { acheterPalier } from '../../src/domain/ameliorations/index.ts'
import { etatSortLu, sortDisponible, degatsClic } from '../../src/domain/sorts/index.ts'
import type { Constantes, EtatJeu, IdArbre, IdEcole } from '../../src/domain/types.ts'

/** Réglages de la politique. Ce sont des hypothèses de joueur, pas des constantes de jeu. */
export interface Politique {
  clicsParSeconde: number
  /** Le joueur lâche la souris quand les clics pèsent moins que cette fraction de la production passive. */
  partClicsMin: number
  /** Patience devant un mur : au-delà, il prestige (EXG-18). */
  patienceMs: number
  /** `Δor` vaut `Δdégâts^exposantOr` dans le score méta : mesuré, puis balayé en sensibilité. */
  exposantOr: number
  poidsOrDepart: number
  poidsCooldown: number
  /** Si > 1, le joueur épargne pour le meilleur ratio du catalogue quand il dépasse ce facteur. */
  facteurEpargne: number
  /**
   * Deuxième condition de prestige, en plus de la patience : ne prestiger que si le gain d'Éclats
   * atteint `ratioPrestige × Éclats déjà possédés` (règle classique du genre « prestiger quand on
   * double son stock »). `0` désactive la condition — le joueur prestige dès qu'il est bloqué.
   * Ce paramètre change la **forme de la partie**, pas seulement son rythme : avec un seuil, le joueur
   * s'accroche au-delà de sa patience et les runs s'allongent au fil d'un cycle. Les deux hypothèses
   * sont mesurées et comparées dans le rapport.
   */
  ratioPrestige: number
}

export const POLITIQUE_DEFAUT: Politique = {
  clicsParSeconde: 3,
  partClicsMin: 0.01,
  patienceMs: 30 * 60_000,
  exposantOr: 0.85,
  poidsOrDepart: 0.02,
  poidsCooldown: 0.05,
  facteurEpargne: 1,
  ratioPrestige: 0,
}

/* ──────────────────────────────────────────────────────────── lectures dérivées de la chaîne §8 */

/**
 * Produit des facteurs de la chaîne de DPS §8 **hors** production des écoles. Utile là où la production
 * vaut 0 (juste après un prestige) et où `degatsParSeconde` ne dit donc rien de la puissance acquise.
 */
export function chaineMultiplicateurs(etat: EtatJeu, constantes: Constantes): number {
  return (
    multAmeliorations(etat, constantes) *
    multEquipement(etat, constantes) *
    bonusPassifEclats(etat, constantes) *
    multArbreEclats(etat, constantes) *
    multArbreAscension(etat, constantes)
  )
}

/** Dégâts par seconde apportés par les clics à la cadence de la politique (EXG-11). */
export function degatsClicParSeconde(etat: EtatJeu, constantes: Constantes, politique: Politique): number {
  return degatsClic(etat, constantes) * politique.clicsParSeconde
}

/** Le joueur clique-t-il encore ? (règle 4) */
export function cliqueEncore(etat: EtatJeu, constantes: Constantes, politique: Politique): boolean {
  if (politique.clicsParSeconde <= 0) return false
  const passif = degatsParSeconde(etat, constantes)
  return degatsClicParSeconde(etat, constantes, politique) >= politique.partClicsMin * passif
}

/* ─────────────────────────────────────────────────────────────────── achats en or / en renommée */

type Candidat =
  | { sorte: 'ecole'; id: IdEcole; cout: number; gain: number }
  | { sorte: 'achat'; id: string; monnaie: 'or' | 'renommee'; cout: number; gain: number }

/**
 * Catalogue des achats possibles avec leur `Δ(dégâts/s)` et leur coût. Un seul endroit où le « meilleur
 * ratio » est défini, donc un seul endroit à relire pour contester la politique.
 */
export function candidats(
  etat: EtatJeu,
  constantes: Constantes,
  politique: Politique,
): readonly Candidat[] {
  const liste: Candidat[] = []
  const chaine = chaineMultiplicateurs(etat, constantes)
  const dps = productionPassive(etat, constantes) * chaine
  const clics = politique.clicsParSeconde

  for (const id of Object.keys(etat.ecoles) as IdEcole[]) {
    if (!ecoleAccessible(etat, id, constantes)) continue
    const parametres = constantes.ecoles[id]
    const ecole = etat.ecoles[id]
    if (parametres === undefined || ecole === undefined) continue
    const avant = productionEcole({ ...ecole, debloquee: true }, parametres)
    const apres = productionEcole({ ...ecole, niveau: ecole.niveau + 1, debloquee: true }, parametres)
    const cout = coutProchainNiveau(ecole.niveau, parametres)
    if (!Number.isFinite(cout) || cout <= 0) continue
    liste.push({ sorte: 'ecole', id, cout, gain: (apres - avant) * chaine })
  }

  for (const achat of constantes.ameliorations) {
    const palier = etat.paliersAmeliorations[achat.id] ?? 0
    if (achat.paliersMax !== null && palier >= achat.paliersMax) continue
    const cout = coutPalier(palier, achat)
    if (!Number.isFinite(cout) || cout <= 0) continue
    // EXG-42 : facteur sur la chaîne de DPS ; EXG-11 : bonus **additif** sur le clic (§8, deux formes).
    const gain = dps * (achat.effetMult - 1) + constantes.or.baseClic * (achat.effetMult - 1) * clics
    liste.push({ sorte: 'achat', id: achat.id, monnaie: 'or', cout, gain })
  }

  for (const achat of constantes.equipement) {
    const palier = etat.paliersEquipement[achat.id] ?? 0
    if (achat.paliersMax !== null && palier >= achat.paliersMax) continue
    const cout = coutPalier(palier, achat)
    if (!Number.isFinite(cout) || cout <= 0) continue
    liste.push({ sorte: 'achat', id: achat.id, monnaie: 'renommee', cout, gain: dps * (achat.effetMult - 1) })
  }

  return liste
}

function solde(etat: EtatJeu, monnaie: 'or' | 'renommee'): number {
  return monnaie === 'or' ? etat.bourse.or : etat.bourse.renommee
}

function monnaieDe(candidat: Candidat): 'or' | 'renommee' {
  return candidat.sorte === 'ecole' ? 'or' : candidat.monnaie
}

/** Coût du moins cher des achats du catalogue dans une monnaie donnée (borne du « mur d'achat »). */
export function coutMinimal(
  liste: readonly Candidat[],
  monnaie: 'or' | 'renommee',
): number {
  let minimum = Number.POSITIVE_INFINITY
  for (const candidat of liste) {
    if (monnaieDe(candidat) !== monnaie) continue
    if (candidat.gain <= 0) continue
    if (candidat.cout < minimum) minimum = candidat.cout
  }
  return minimum
}

/**
 * Règles 1 et 2 — achète tant que quelque chose d'utile est abordable, au meilleur ratio. Retourne aussi
 * le nombre d'achats effectués (le journal en a besoin pour repérer les murs).
 */
export function acheterAuMieux(
  etat: EtatJeu,
  constantes: Constantes,
  politique: Politique,
): { etat: EtatJeu; achats: number } {
  let courant = etat
  let achats = 0
  // Garde-fou de boucle : un catalogue de ~10 articles ne justifie jamais des millions d'achats
  // d'affilée ; au-delà, c'est un bug de ratio, pas une partie.
  const plafond = 200_000

  while (achats < plafond) {
    const liste = candidats(courant, constantes, politique)
    let meilleur: Candidat | null = null
    let meilleurRatio = 0
    let meilleurRatioGlobal = 0
    for (const candidat of liste) {
      if (candidat.gain <= 0 || !Number.isFinite(candidat.gain)) continue
      const ratio = candidat.gain / candidat.cout
      if (ratio > meilleurRatioGlobal) meilleurRatioGlobal = ratio
      if (candidat.cout > solde(courant, monnaieDe(candidat))) continue
      if (ratio > meilleurRatio) {
        meilleurRatio = ratio
        meilleur = candidat
      }
    }
    if (meilleur === null) break
    // Variante « épargne » : renoncer à un achat abordable médiocre pour viser bien mieux (facteur > 1).
    if (politique.facteurEpargne > 1 && meilleurRatioGlobal > politique.facteurEpargne * meilleurRatio) break

    const resultat =
      meilleur.sorte === 'ecole'
        ? acheterNiveaux(courant, meilleur.id, 1, constantes)
        : acheterPalier(courant, meilleur.id, meilleur.monnaie, constantes)
    if (!resultat.accepte) break
    courant = resultat.etat
    achats += 1
  }

  return { etat: courant, achats }
}

/* ────────────────────────────────────────────────────────────────────── sorts (règle 3) */

/** Lance tous les sorts débloqués et prêts. Retourne l'état et le nombre de tirs. */
export function lancerSortsPrets(etat: EtatJeu, constantes: Constantes): { etat: EtatJeu; tirs: number } {
  let courant = etat
  let tirs = 0
  for (const parametres of constantes.sorts) {
    if (!sortDisponible(courant, parametres.id, constantes)) continue
    if (etatSortLu(courant, parametres.id, constantes).cooldownRestantMs > 0) continue
    const tir = lancerSort(courant, parametres.id, constantes)
    if (!tir.declenche) continue
    courant = tir.etat
    tirs += 1
  }
  return { etat: courant, tirs }
}

/** Délai réel avant le prochain sort disponible, en ms (`Infinity` si aucun sort n'attend). */
export function delaiProchainSortMs(etat: EtatJeu, constantes: Constantes): number {
  const facteur = facteurCooldownArbres(etat, constantes)
  let minimum = Number.POSITIVE_INFINITY
  for (const parametres of constantes.sorts) {
    if (!sortDisponible(etat, parametres.id, constantes)) continue
    const restant = etatSortLu(etat, parametres.id, constantes).cooldownRestantMs
    // Le moteur décompte les cooldowns à `dt / facteur` : le délai réel est donc `restant × facteur`.
    const reel = restant * facteur
    if (reel < minimum) minimum = reel
  }
  return minimum
}

/** Applique `nombre` clics (EXG-11) : dégâts instantanés + or, sans consommer de temps. */
export function cliquer(etat: EtatJeu, constantes: Constantes, nombre: number): EtatJeu {
  let courant = etat
  for (let i = 0; i < nombre; i += 1) courant = appliquerClic(courant, constantes)
  return courant
}

/* ───────────────────────────────────────────────────────────── méta : arbres (règle 5) */

/**
 * Score méta : agrège sur une échelle logarithmique commune ce que les nœuds font de différent
 * (dégâts, or, profondeur de départ, or de départ, cooldowns). Les poids sont des hypothèses de joueur
 * déclarées dans `Politique`, balayées en sensibilité par `search.ts` — pas des vérités.
 * `exposantOr` traduit « ×M sur l'or » en « ×M^exposantOr sur les dégâts » : c'est l'exposant agrégé
 * mesuré de la courbe dégâts(or), pas une intuition.
 */
export function scoreMeta(etat: EtatJeu, constantes: Constantes, politique: Politique): number {
  const chaine = chaineMultiplicateurs(etat, constantes)
  const zone = zoneDepartRun(etat, constantes)
  const or = orDepartRun(etat, constantes)
  return (
    Math.log(Math.max(chaine, Number.MIN_VALUE)) +
    politique.exposantOr * Math.log(Math.max(multOrArbres(etat, constantes), Number.MIN_VALUE)) +
    Math.log(constantes.or.croissanceOrParZone) * (zone - 1) +
    politique.poidsOrDepart * Math.log(1 + Math.max(or, 0)) +
    politique.poidsCooldown * -Math.log(facteurCooldownArbres(etat, constantes))
  )
}

/** Solde de la monnaie d'un arbre (EXG-39 Éclats dépensables, EXG-40 Points). */
function soldeArbre(etat: EtatJeu, arbre: IdArbre): number {
  return arbre === 'eclats' ? etat.bourse.eclatsDepensables : etat.bourse.pointsAscension
}

/**
 * Règle 5 — dépense la monnaie d'un arbre rang par rang, au meilleur `Δscore / coût`, tant qu'un rang
 * est abordable. Rang par rang et non en lot : le score d'un rang dépend des rangs déjà pris.
 */
export function depenserArbre(
  etat: EtatJeu,
  arbre: IdArbre,
  constantes: Constantes,
  politique: Politique,
): { etat: EtatJeu; rangs: number } {
  let courant = etat
  let rangs = 0
  const plafond = 100_000

  while (rangs < plafond) {
    const base = scoreMeta(courant, constantes, politique)
    const budget = soldeArbre(courant, arbre)
    let meilleurId: string | null = null
    let meilleurRatio = 0

    for (const noeud of constantes.noeuds) {
      if (noeud.arbre !== arbre) continue
      if (!prerequisRemplis(courant, noeud, constantes)) continue
      const rang = rangNoeud(courant, noeud)
      if (noeud.rangMax !== null && rang >= noeud.rangMax) continue
      const cout = coutRangNoeud(rang, noeud, constantes)
      if (!Number.isFinite(cout) || cout <= 0 || cout > budget) continue
      const essai = acheterNoeudArbre(courant, noeud.id, 1, arbre, constantes)
      if (!essai.accepte) continue
      const delta = scoreMeta(essai.etat, constantes, politique) - base
      if (delta <= 0) continue
      const ratio = delta / cout
      if (ratio > meilleurRatio) {
        meilleurRatio = ratio
        meilleurId = noeud.id
      }
    }

    if (meilleurId === null) break
    const achat = acheterNoeudArbre(courant, meilleurId, 1, arbre, constantes)
    if (!achat.accepte) break
    courant = achat.etat
    rangs += 1
  }

  return { etat: courant, rangs }
}

/** Nombre de rangs pris sur un nœud donné (pour la surveillance EXG-37 des nœuds répétables). */
export function rangDeNoeud(etat: EtatJeu, id: string, constantes: Constantes): number {
  const noeud = noeudParId(id, constantes)
  return noeud === undefined ? 0 : rangNoeud(etat, noeud)
}
