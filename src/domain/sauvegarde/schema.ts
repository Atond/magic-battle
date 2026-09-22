// Schéma déclaratif de la sauvegarde et validateur générique — T-10, EXG-45.
//
// L'import de sauvegarde est la **seule entrée non fiable de tout le système** (spec §6). Ce fichier est
// donc l'unique frontière de confiance du jeu, et il est écrit pour être relu d'un coup d'œil : une
// table de schéma (un champ = un type, des bornes, entier ou non) et un validateur générique qui la
// parcourt. La spec §9 proposait une bibliothèque de validation « ou équivalent, à fixer en vague 1 » ;
// ADR de vague 1 : validateur maison déclaratif, aucune dépendance ajoutée — le schéma est petit et
// fixe, `src/domain/` doit rester testable en isolation, et le jeu est 100 % statique (on ne charge pas
// un validateur dans le paquet pour un seul point d'entrée).
//
// Trois propriétés tenues ici, par **construction** et non par vigilance :
//  1. **liste blanche** — l'état de sortie est reconstruit champ par champ depuis le schéma. Ce que le
//     schéma ne nomme pas n'existe pas : aucun `spread`, aucun `Object.assign`, aucune fusion de la
//     charge importée dans un état. « Les clés inconnues sont ignorées plutôt que fusionnées » (EXG-45)
//     est donc vrai sans liste de clés interdites à maintenir ;
//  2. **exhaustivité vérifiée par le compilateur** — `objet<T>()` exige une entrée par champ de `T`.
//     Le jour où T-13 ajoute un champ à `EtatJeu`, `npm run typecheck` tombe avant la production ;
//  3. **coût borné** — validation linéaire en taille d'entrée, récursion bornée par `PROFONDEUR_MAX`,
//     et parcours des clés borné par `NOEUDS_MAX` **et** par un ensemble de nœuds déjà vus. Ces deux
//     dernières bornes vivent dans le parcours lui-même, pas dans la porte d'entrée : elles protègent
//     donc aussi `deserialiser()`, à qui l'on passe un objet que personne n'a mesuré.
//
// Aucune valeur d'équilibrage ici : chaque borne vient soit d'une constante de structure du moteur
// (`constantes-moteur.ts`), soit du catalogue reçu en paramètre (`Constantes`), soit de la borne du
// type `number` lui-même.

import { PAS_TICK_MS, VAGUE_DEPART, VERSION_SCHEMA, ZONE_DEPART } from '../constantes-moteur.ts'
import { noeudsDeLArbre } from '../prestige/arbre.ts'
import { nbVagues, pvBossFinal, timerBossFinalMs, timerBossMs } from '../zones/formules.ts'
import type {
  Boss,
  Bourse,
  Constantes,
  EtatAscension,
  EtatBossFinal,
  EtatCombat,
  EtatEcole,
  EtatJeu,
  EtatPrestige,
  EtatSort,
  IdArbre,
  IdEcole,
  Magicien,
  Monstre,
  ParametresSort,
  PhaseCombat,
  Sauvegarde,
  StatistiquesFin,
} from '../types.ts'

/* ═══════════════════════════════════════════════════════════ motifs de refus (exploitables par l'UI) */

/**
 * EXG-45 / EXG-27 — motif d'un refus d'import. Jamais un booléen nu : l'UI (T-23, T-28) doit pouvoir
 * dire au joueur *ce qui* cloche, et le refus est toujours accompagné du chemin du champ fautif.
 */
export type MotifRefusImport =
  /** Charge au-delà de la taille (ou de la longueur de liste / de texte) acceptée. */
  | 'tropLong'
  /** Le texte d'import n'est pas du base64 valide. */
  | 'base64Invalide'
  /** EXG-27 — JSON tronqué ou illisible (y compris les littéraux `NaN`/`Infinity`, hors JSON). */
  | 'jsonIllisible'
  /** EXG-45 — clé `__proto__` / `constructor` / `prototype`, à n'importe quelle profondeur. */
  | 'clePolluante'
  /** Imbrication au-delà de la profondeur acceptée : la validation est bornée, pas la charge. */
  | 'profondeurExcessive'
  /** Type autre que celui déclaré (chaîne pour un nombre, tableau pour un objet, `null`…). */
  | 'typeIncorrect'
  /** Champ déclaré obligatoire et absent de la charge. */
  | 'champManquant'
  /** EXG-45 — `NaN`, `Infinity`, `-Infinity` là où un nombre est attendu. */
  | 'valeurNonFinie'
  /** EXG-45 — champ positif reçu négatif. */
  | 'valeurNegative'
  /** EXG-45 — valeur hors des bornes déclarées du schéma (au-dessus ou en dessous). */
  | 'horsBornes'
  /** Valeur hors du jeu de valeurs déclaré (phase de combat, identifiant de quête…). */
  | 'valeurInattendue'
  /** EXG-25 — champ `version` absent, non entier ou nul. */
  | 'versionInvalide'
  /** EXG-25 — sauvegarde écrite par une version du jeu postérieure à celle qui la relit. */
  | 'versionFuture'
  /** EXG-26 — aucune migration connue pour passer de la version lue à la version courante. */
  | 'migrationManquante'
  /** EXG-46 — restauration demandée alors qu'aucune sauvegarde de secours n'existe. */
  | 'secoursAbsent'

/** Refus circonstancié : le motif pour la logique, le chemin et le message pour l'affichage. */
export interface ErreurImport {
  readonly motif: MotifRefusImport
  /** Chemin du champ fautif, de la racine vers la feuille (ex. `sauvegarde.etat.bourse.or`). */
  readonly chemin: string
  /** Message en français, destiné au joueur ; ne contient jamais la valeur brute importée. */
  readonly message: string
}

/**
 * Branche « refus » d'un verdict, nommée à part : ainsi `refusImport()` a un type qui dit « ceci est un
 * refus », assignable à n'importe quel `Verdict<T>` sans que l'appelant ait à ré-élargir quoi que ce soit.
 */
export interface RefusImport {
  readonly ok: false
  readonly erreur: ErreurImport
}

/** Verdict d'une validation : la valeur reconstruite, ou le refus circonstancié. */
export type Verdict<T> = { readonly ok: true; readonly valeur: T } | RefusImport

/** Fabrique de refus : un seul endroit qui compose motif, chemin et message. */
export function refusImport(motif: MotifRefusImport, chemin: string, message: string): RefusImport {
  return { ok: false, erreur: { motif, chemin, message } }
}

/* ══════════════════════════════════════════════ bornes de sûreté de l'entrée non fiable (spec §6) */
// Ce ne sont pas des valeurs de jeu : aucune ne change l'équilibre, toutes bornent une entrée hostile.
// Elles n'ont donc rien à faire dans le rapport du simulateur (T-14) ni dans `src/donnees/`.

/**
 * Profondeur d'imbrication acceptée. Le schéma réel de l'état plafonne à 4 niveaux
 * (enveloppe → état → combat → cible) ; 16 laisse largement la place aux extensions (T-13) tout en
 * bornant la récursion du validateur, donc la pile, quelle que soit la charge reçue.
 */
export const PROFONDEUR_MAX = 16

/**
 * Longueur maximale d'un texte d'import, **en unités de code UTF-16** — c'est-à-dire en `texte.length`,
 * l'unité dans laquelle la borne est réellement comparée. Le nom le dit : une version précédente
 * annonçait des octets, ce qui mentait d'un facteur allant jusqu'à 3 sur du texte non ASCII (le code
 * base64 en entrée, lui, est ASCII : une unité = un octet).
 *
 * Pourquoi cette unité est la bonne : ce que cette borne protège, c'est le **travail** en aval
 * (décodage, `JSON.parse`, parcours), et ce travail est proportionnel au nombre d'unités de code, pas
 * au poids en octets d'un encodage particulier. Une sauvegarde réelle de fin de partie pèse quelques
 * milliers de caractères (les dictionnaires sont dimensionnés par le catalogue, pas par la durée de
 * jeu) : 262 144, c'est deux ordres de grandeur de marge, et un refus immédiat au-delà.
 */
export const LONGUEUR_MAX_IMPORT_CARACTERES = 262_144

/**
 * Nombre maximal de nœuds (objets et tableaux) qu'un parcours de charge inspecte avant de refuser.
 *
 * Pourquoi cette borne existe **en plus** de la précédente : la longueur du texte ne borne que l'import
 * par texte. Le parcours des clés, lui, est traversé par **toutes** les portes d'entrée — `deserialiser()`
 * comprise, où la charge est un graphe d'objets déjà construit que personne n'a mesuré. Et un graphe
 * peut partager ses nœuds : `x = {k0: x, …, k9: x}` empilé seize fois tient sous `PROFONDEUR_MAX` et
 * sous quelques kilo-octets en mémoire, tout en offrant 10¹⁶ chemins à un parcours naïf.
 *
 * Valeur : la même que la borne de longueur de texte. Un JSON qui tient en `L` caractères ne peut pas
 * décrire plus de `L / 2` nœuds (il faut au moins `{}` pour en écrire un) : cette borne ne refuse donc
 * jamais une charge que la borne de texte accepte. Elle ne ferme qu'une porte — celle des graphes.
 */
export const NOEUDS_MAX = LONGUEUR_MAX_IMPORT_CARACTERES

/** Longueur maximale d'un champ texte de la sauvegarde (nom du magicien, nom de monstre). */
export const LONGUEUR_TEXTE_MAX = 120

/** EXG-45 — les trois clés que la spec nomme : elles ne sont jamais une clé légitime de sauvegarde. */
export const CLES_INTERDITES = ['__proto__', 'constructor', 'prototype'] as const
const ENSEMBLE_CLES_INTERDITES: ReadonlySet<string> = new Set<string>(CLES_INTERDITES)

/** Borne des quantités continues : celle du type `number`, pas un plafond de jeu. */
const QUANTITE_MAX = Number.MAX_VALUE
/** Borne des compteurs entiers : le plus grand entier exactement représentable. */
const COMPTEUR_MAX = Number.MAX_SAFE_INTEGER

/* ═════════════════════════════════════════════════════════════════════ table de schéma (déclarative) */

/** Forme d'un nœud de schéma : c'est la grammaire, volontairement courte, que le validateur parcourt. */
type Forme =
  | { readonly genre: 'nombre'; readonly min: number; readonly max: number; readonly entier: boolean }
  | { readonly genre: 'booleen' }
  | { readonly genre: 'texte'; readonly longueurMax: number }
  | { readonly genre: 'litteral'; readonly valeur: string | number | boolean }
  | { readonly genre: 'choix'; readonly valeurs: readonly string[] }
  | { readonly genre: 'objet'; readonly champs: readonly (readonly [string, Schema<unknown>])[] }
  | { readonly genre: 'dictionnaire'; readonly entrees: readonly (readonly [string, Schema<unknown>])[] }
  | { readonly genre: 'liste'; readonly element: Schema<unknown>; readonly longueurMax: number }
  | { readonly genre: 'nullable'; readonly interne: Schema<unknown> }
  | { readonly genre: 'facultatif'; readonly interne: Schema<unknown> }
  | { readonly genre: 'ou'; readonly options: readonly Schema<unknown>[] }

/**
 * Nœud de schéma typé. `_type` est un **marqueur de type seul**, jamais lu à l'exécution : c'est lui
 * qui permet au compilateur de vérifier que le schéma décrit bien `EtatJeu` et rien d'autre.
 */
export interface Schema<T> {
  readonly forme: Forme
  readonly _type?: T
}

/** Une entrée de schéma par champ de `T`, sans exception : c'est la clause d'exhaustivité. */
export type ChampsDe<T> = { readonly [K in keyof T]-?: Schema<T[K]> }

/** Nombre réel borné. Une borne inférieure ≥ 0 fait du champ un champ « positif » (EXG-45). */
export function nombre(min: number, max: number): Schema<number> {
  return { forme: { genre: 'nombre', min, max, entier: false } }
}

/** Entier borné (niveau, palier, rang, compteur). */
export function entier(min: number, max: number): Schema<number> {
  return { forme: { genre: 'nombre', min, max, entier: true } }
}

export function booleen(): Schema<boolean> {
  return { forme: { genre: 'booleen' } }
}

export function texte(longueurMax: number): Schema<string> {
  return { forme: { genre: 'texte', longueurMax } }
}

/** Valeur unique imposée (marqueur de type comme `estBoss: true`). */
export function litteral<T extends string | number | boolean>(valeur: T): Schema<T> {
  return { forme: { genre: 'litteral', valeur } }
}

/** Jeu fermé de valeurs textuelles (phase de combat, identifiant issu du catalogue). */
export function choix<T extends string>(valeurs: readonly T[]): Schema<T> {
  return { forme: { genre: 'choix', valeurs } }
}

/** Objet à champs nommés : **tous** obligatoires, et aucun autre n'est lu. */
export function objet<T>(champs: ChampsDe<T>): Schema<T> {
  const entrees = Object.entries(champs as Record<string, Schema<unknown>>)
  return { forme: { genre: 'objet', champs: entrees.map(([cle, sous]) => [cle, sous] as const) } }
}

/**
 * Dictionnaire indexé dont les clés légitimes sont **énumérées par le catalogue** (identifiants de
 * sorts, de nœuds d'arbre, d'améliorations). La validation parcourt le catalogue, jamais les clés de
 * l'entrée : une clé absente du catalogue n'est donc même pas lue (EXG-45), et le coût de validation
 * d'un dictionnaire ne dépend pas de la taille de la charge reçue.
 */
export function dictionnaire<V>(
  entrees: readonly (readonly [string, Schema<V>])[],
): Schema<Readonly<Record<string, V>>> {
  return { forme: { genre: 'dictionnaire', entrees: entrees.map(([cle, sous]) => [cle, sous] as const) } }
}

/** Liste homogène de longueur bornée. */
export function liste<E>(element: Schema<E>, longueurMax: number): Schema<readonly E[]> {
  return { forme: { genre: 'liste', element, longueurMax } }
}

/** Champ qui accepte `null` en plus de sa forme interne (`cible`, `timerBossRestantMs`). */
export function nullable<T>(interne: Schema<T>): Schema<T | null> {
  return { forme: { genre: 'nullable', interne } }
}

/**
 * Champ **facultatif** : absent de la charge, il reste absent de l'état reconstruit — il n'est ni
 * inventé, ni comblé par un `null` qui ressemblerait à une valeur. Présent, il est validé comme
 * n'importe quel autre champ, bornes comprises.
 *
 * Pourquoi cette forme existe (T-13) : `bossFinal` et `statistiquesFin` sont apparus après la version 1
 * du format. Les déclarer obligatoires rejetterait toutes les sauvegardes écrites avant — c'est-à-dire
 * toutes celles qui existent — pour un champ qui n'a de sens que dans la toute fin de partie. Et
 * « absent » est ici une information exacte : cette partie n'a jamais ouvert la zone dédiée.
 * Le jour où un champ facultatif doit acquérir une valeur par défaut calculée, c'est une **migration**
 * (EXG-26) qu'il faut écrire, pas une valeur inventée dans le validateur.
 */
export function facultatif<T>(interne: Schema<T>): Schema<T | undefined> {
  return { forme: { genre: 'facultatif', interne } }
}

/**
 * Alternative : la première forme qui valide gagne (donc de la plus spécifique à la plus générale).
 * En cas d'échec de toutes, c'est le refus de la **dernière** (la plus générale) qui est rendu : c'est
 * celui qui décrit le mieux « ce n'était aucune des deux ».
 */
export function ou<A, B>(a: Schema<A>, b: Schema<B>): Schema<A | B> {
  return { forme: { genre: 'ou', options: [a as Schema<unknown>, b as Schema<unknown>] } }
}

/* ══════════════════════════════════════════════════════════════════════════════ outils de lecture */

/**
 * Vrai pour un objet « simple » : pas `null`, pas un tableau, et dont le prototype est celui d'`Object`
 * (ou aucun). Refuse donc aussi les instances de classe qu'un appelant interne bogué enverrait.
 */
export function estObjetSimple(valeur: unknown): valeur is Record<string, unknown> {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return false
  const parent: unknown = Object.getPrototypeOf(valeur)
  return parent === Object.prototype || parent === null
}

/**
 * Écriture d'une clé dans un objet reconstruit, **sans affectation**. `sortie[cle] = valeur` passerait
 * par l'accesseur `__proto__` d'`Object.prototype` si `cle` valait `__proto__` : l'objet reconstruit
 * changerait alors de prototype au lieu de gagner une propriété.
 *
 * Pour un `objet`, les clés viennent du schéma : elles sont littérales et connues à la compilation.
 * Pour un `dictionnaire`, elles viennent du **catalogue** (`src/donnees/`) — de confiance, mais généré,
 * donc pas littéral. `defineProperty` rend la phrase « aucune clé hostile ne peut être posée ici » vraie
 * des deux côtés, par construction plutôt que parce qu'on a relu le catalogue.
 */
function poser(sortie: Record<string, unknown>, cle: string, valeur: unknown): void {
  Object.defineProperty(sortie, cle, { value: valeur, writable: true, enumerable: true, configurable: true })
}

/** Lecture d'une propriété **propre** : jamais une propriété héritée du prototype. */
function proprietePropre(source: Record<string, unknown>, cle: string): { presente: boolean; valeur: unknown } {
  if (!Object.prototype.hasOwnProperty.call(source, cle)) return { presente: false, valeur: undefined }
  return { presente: true, valeur: source[cle] }
}

/* ══════════════════════════════════════════════════════ EXG-45 — balayage des clés polluantes */

/**
 * EXG-45 — refuse toute charge contenant une clé `__proto__`, `constructor` ou `prototype`, **à
 * n'importe quelle profondeur** et y compris comme clé d'un dictionnaire (rangs d'arbres, paliers).
 *
 * Pourquoi un balayage complet alors que la reconstruction par liste blanche suffirait : la liste
 * blanche empêche la pollution, ce balayage empêche le *silence*. Une sauvegarde qui transporte une
 * clé de prototype n'est pas une sauvegarde à nettoyer, c'est une sauvegarde à refuser bruyamment.
 * Itératif (pile explicite), donc insensible à la profondeur de la charge : c'est la borne
 * `PROFONDEUR_MAX` qui tranche, pas la pile d'appels.
 *
 * Coût borné **quelle que soit la porte d'entrée**, par deux garde-fous qui ne supposent rien de
 * l'origine de la charge (texte importé, objet relu du stockage, sortie d'une migration) :
 *  - `vus` — un nœud déjà inspecté ne l'est pas deux fois. Sans lui, un graphe qui partage ses nœuds
 *    reste sous `PROFONDEUR_MAX` tout en offrant un nombre exponentiel de *chemins* ; et un cycle
 *    (`a.soi = a`) ne rendrait jamais la main. `JSON.parse` ne produit qu'un arbre, mais `deserialiser()`
 *    accepte n'importe quel objet : la propriété doit tenir sans cette hypothèse ;
 *  - `NOEUDS_MAX` — un budget dur de nœuds inspectés, qui borne le travail même si un cas d'espèce
 *    échappait au premier garde-fou.
 */
export function verifierClesSures(brut: unknown, chemin = 'sauvegarde'): Verdict<true> {
  const aVisiter: { valeur: unknown; chemin: string; profondeur: number }[] = [
    { valeur: brut, chemin, profondeur: 0 },
  ]
  const vus = new Set<object>()
  let inspectes = 0

  while (aVisiter.length > 0) {
    const noeud = aVisiter.pop()
    if (noeud === undefined) break
    if (typeof noeud.valeur !== 'object' || noeud.valeur === null) continue

    if (noeud.profondeur > PROFONDEUR_MAX) {
      return refusImport(
        'profondeurExcessive',
        noeud.chemin,
        'Sauvegarde trop profondément imbriquée : elle ne ressemble pas à une sauvegarde du jeu.',
      )
    }

    inspectes += 1
    if (inspectes > NOEUDS_MAX) {
      return refusImport(
        'tropLong',
        noeud.chemin,
        'Sauvegarde démesurée : elle contient trop d’éléments pour être lue.',
      )
    }

    // Un nœud partagé par plusieurs parents (ou par lui-même) ne se réinspecte pas : les clés qu'il
    // porte ont déjà été jugées, et le verdict ne dépend pas du chemin emprunté pour y arriver.
    if (vus.has(noeud.valeur)) continue
    vus.add(noeud.valeur)

    if (Array.isArray(noeud.valeur)) {
      for (let i = 0; i < noeud.valeur.length; i += 1) {
        const element: unknown = noeud.valeur[i]
        if (typeof element === 'object' && element !== null) {
          aVisiter.push({ valeur: element, chemin: `${noeud.chemin}[${i}]`, profondeur: noeud.profondeur + 1 })
        }
      }
      continue
    }

    const source = noeud.valeur as Record<string, unknown>
    for (const cle of Object.keys(source)) {
      if (ENSEMBLE_CLES_INTERDITES.has(cle)) {
        return refusImport(
          'clePolluante',
          `${noeud.chemin}.${cle}`,
          `Sauvegarde refusée : elle contient la clé interdite « ${cle} ».`,
        )
      }
      const enfant: unknown = source[cle]
      if (typeof enfant === 'object' && enfant !== null) {
        aVisiter.push({ valeur: enfant, chemin: `${noeud.chemin}.${cle}`, profondeur: noeud.profondeur + 1 })
      }
    }
  }

  return { ok: true, valeur: true }
}

/* ═══════════════════════════════════════════════════════════════════════ validateur générique */

/** Valide `brut` selon `schema` et **reconstruit** la valeur : rien n'est repris de la charge telle quelle. */
export function valider<T>(brut: unknown, schema: Schema<T>, chemin = 'sauvegarde'): Verdict<T> {
  const verdict = validerForme(brut, schema as Schema<unknown>, chemin, 0)
  return verdict.ok ? { ok: true, valeur: verdict.valeur as T } : verdict
}

function validerForme(
  brut: unknown,
  schema: Schema<unknown>,
  chemin: string,
  profondeur: number,
): Verdict<unknown> {
  if (profondeur > PROFONDEUR_MAX) {
    return refusImport('profondeurExcessive', chemin, 'Sauvegarde trop profondément imbriquée.')
  }
  const forme = schema.forme

  switch (forme.genre) {
    case 'nombre':
      return validerNombre(brut, forme, chemin)

    case 'booleen':
      return typeof brut === 'boolean'
        ? { ok: true, valeur: brut }
        : refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : vrai ou faux attendu.`)

    case 'texte': {
      if (typeof brut !== 'string') {
        return refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : texte attendu.`)
      }
      if (brut.length > forme.longueurMax) {
        return refusImport('tropLong', chemin, `Champ « ${chemin} » : texte trop long (maximum ${forme.longueurMax}).`)
      }
      // Le texte ressort tel quel : le domaine garantit « c'est une chaîne », pas « c'est inoffensif
      // en HTML ». L'échappement est la responsabilité de l'UI (vague 2) — voir EXG-47.
      return { ok: true, valeur: brut }
    }

    case 'litteral':
      return brut === forme.valeur
        ? { ok: true, valeur: forme.valeur }
        : refusImport('valeurInattendue', chemin, `Champ « ${chemin} » : valeur imposée non respectée.`)

    case 'choix': {
      if (typeof brut !== 'string') {
        return refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : texte attendu.`)
      }
      return forme.valeurs.includes(brut)
        ? { ok: true, valeur: brut }
        : refusImport('valeurInattendue', chemin, `Champ « ${chemin} » : valeur inconnue du jeu.`)
    }

    case 'objet':
      return validerObjet(brut, forme.champs, chemin, profondeur)

    case 'dictionnaire':
      return validerDictionnaire(brut, forme.entrees, chemin, profondeur)

    case 'liste':
      return validerListe(brut, forme.element, forme.longueurMax, chemin, profondeur)

    case 'nullable':
      // `null` est une valeur déclarée du champ, pas une absence : elle ne descend pas d'un niveau.
      return brut === null ? { ok: true, valeur: null } : validerForme(brut, forme.interne, chemin, profondeur)

    case 'facultatif':
      // L'absence est traitée par `validerObjet`, qui seul sait si la clé était là. Ici, la valeur est
      // présente : elle doit donc être valide, un champ facultatif n'est pas un champ laxiste.
      return validerForme(brut, forme.interne, chemin, profondeur)

    case 'ou': {
      let dernier: Verdict<unknown> = refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : forme inconnue.`)
      for (const option of forme.options) {
        const verdict = validerForme(brut, option, chemin, profondeur)
        if (verdict.ok) return verdict
        dernier = verdict
      }
      return dernier
    }
  }
}

/** EXG-45 — non fini, négatif quand le champ est positif, hors des bornes déclarées, non entier. */
function validerNombre(
  brut: unknown,
  forme: { readonly min: number; readonly max: number; readonly entier: boolean },
  chemin: string,
): Verdict<unknown> {
  if (typeof brut !== 'number') {
    return refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : nombre attendu.`)
  }
  if (!Number.isFinite(brut)) {
    return refusImport('valeurNonFinie', chemin, `Champ « ${chemin} » : valeur non finie refusée.`)
  }
  if (forme.entier && !Number.isInteger(brut)) {
    return refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : nombre entier attendu.`)
  }
  if (brut < 0 && forme.min >= 0) {
    return refusImport('valeurNegative', chemin, `Champ « ${chemin} » : valeur négative refusée.`)
  }
  if (brut < forme.min || brut > forme.max) {
    return refusImport(
      'horsBornes',
      chemin,
      `Champ « ${chemin} » : valeur hors des bornes admises [${forme.min} ; ${forme.max}].`,
    )
  }
  return { ok: true, valeur: brut }
}

/**
 * Objet à champs nommés : on lit **les champs du schéma**, un par un, et on écrit dans un objet neuf.
 * Les clés de la charge qui ne figurent pas au schéma ne sont jamais lues — donc jamais fusionnées.
 */
function validerObjet(
  brut: unknown,
  champs: readonly (readonly [string, Schema<unknown>])[],
  chemin: string,
  profondeur: number,
): Verdict<unknown> {
  if (!estObjetSimple(brut)) {
    return refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : objet attendu.`)
  }
  const sortie: Record<string, unknown> = {}
  for (const [cle, sous] of champs) {
    const cheminChamp = `${chemin}.${cle}`
    const lue = proprietePropre(brut, cle)
    if (!lue.presente) {
      // Un champ facultatif absent le reste : aucune clé n'est écrite, aucune valeur n'est inventée.
      if (sous.forme.genre === 'facultatif') continue
      return refusImport('champManquant', cheminChamp, `Champ « ${cheminChamp} » absent de la sauvegarde.`)
    }
    const verdict = validerForme(lue.valeur, sous, cheminChamp, profondeur + 1)
    if (!verdict.ok) return verdict
    // Écriture sur une clé issue du **schéma**, jamais de la charge, et posée sans affectation :
    // aucune clé hostile ne peut être posée ici, même si le balayage préalable était contourné.
    poser(sortie, cle, verdict.valeur)
  }
  return { ok: true, valeur: sortie }
}

/** Dictionnaire indexé : on parcourt le catalogue, pas la charge (coût indépendant de la taille reçue). */
function validerDictionnaire(
  brut: unknown,
  entrees: readonly (readonly [string, Schema<unknown>])[],
  chemin: string,
  profondeur: number,
): Verdict<unknown> {
  if (!estObjetSimple(brut)) {
    return refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : objet attendu.`)
  }
  const sortie: Record<string, unknown> = {}
  for (const [cle, sous] of entrees) {
    const lue = proprietePropre(brut, cle)
    // Une entrée absente reste absente : le moteur sait lire un dictionnaire creux (rang 0, palier 0).
    if (!lue.presente) continue
    const cheminChamp = `${chemin}.${cle}`
    const verdict = validerForme(lue.valeur, sous, cheminChamp, profondeur + 1)
    if (!verdict.ok) return verdict
    // Même règle qu'au-dessus, et elle compte davantage ici : la clé vient du catalogue, pas d'un
    // littéral. Un identifiant de catalogue qui vaudrait `__proto__` ne peut pas changer le prototype
    // de l'objet reconstruit — il devient une propriété propre, inerte.
    poser(sortie, cle, verdict.valeur)
  }
  return { ok: true, valeur: sortie }
}

function validerListe(
  brut: unknown,
  element: Schema<unknown>,
  longueurMax: number,
  chemin: string,
  profondeur: number,
): Verdict<unknown> {
  if (!Array.isArray(brut)) {
    return refusImport('typeIncorrect', chemin, `Champ « ${chemin} » : liste attendue.`)
  }
  if (brut.length > longueurMax) {
    return refusImport('tropLong', chemin, `Champ « ${chemin} » : liste trop longue (maximum ${longueurMax}).`)
  }
  const sortie: unknown[] = []
  for (let i = 0; i < brut.length; i += 1) {
    const verdict = validerForme(brut[i], element, `${chemin}[${i}]`, profondeur + 1)
    if (!verdict.ok) return verdict
    sortie.push(verdict.valeur)
  }
  return { ok: true, valeur: sortie }
}

/* ═════════════════════════════════════════════════════════ LE SCHÉMA — la table à relire d'abord */

/** Quantité continue positive (or, dégâts cumulés, temps) : bornée par le type, pas par le jeu. */
function quantite(): Schema<number> {
  return nombre(0, QUANTITE_MAX)
}

/** Compteur entier positif (clics, monstres tués, ticks, prestiges). */
function compteur(): Schema<number> {
  return entier(0, COMPTEUR_MAX)
}

const SCHEMA_ECOLE: Schema<EtatEcole> = objet<EtatEcole>({
  niveau: compteur(),
  debloquee: booleen(),
  revelee: booleen(),
})

const SCHEMA_MONSTRE: Schema<Monstre> = objet<Monstre>({
  nom: texte(LONGUEUR_TEXTE_MAX),
  pvMax: quantite(),
  pvCourants: quantite(),
  orAuMeurtre: quantite(),
})

const SCHEMA_BOSS: Schema<Boss> = objet<Boss>({
  nom: texte(LONGUEUR_TEXTE_MAX),
  pvMax: quantite(),
  pvCourants: quantite(),
  orAuMeurtre: quantite(),
  zone: entier(ZONE_DEPART, COMPTEUR_MAX),
  estBoss: litteral(true as const),
  estFinal: booleen(),
})

/** EXG-12 / EXG-39 — un cooldown restant ne dépasse jamais le cooldown du catalogue (l'arbre le raccourcit). */
function schemaSort(parametres: ParametresSort): Schema<EtatSort> {
  return objet<EtatSort>({
    debloque: booleen(),
    cooldownRestantMs: nombre(0, Math.max(parametres.cooldownMs, 0)),
    autoCast: booleen(),
  })
}

/** EXG-39 / EXG-40 — un rang acheté ne dépasse jamais le `rangMax` du nœud (`null` = rangs infinis). */
function schemaRangsArbre(arbre: IdArbre, constantes: Constantes): Schema<Readonly<Record<string, number>>> {
  return dictionnaire(
    noeudsDeLArbre(arbre, constantes).map(
      (noeud) => [noeud.id, entier(0, noeud.rangMax ?? COMPTEUR_MAX)] as const,
    ),
  )
}

function schemaCombat(constantes: Constantes): Schema<EtatCombat> {
  return objet<EtatCombat>({
    zone: entier(ZONE_DEPART, COMPTEUR_MAX),
    // EXG-15 / EXG-16 — les vagues normales d'une zone sont numérotées 1..nb_vagues, boss exclu.
    vague: entier(VAGUE_DEPART, nbVagues(constantes)),
    phase: choix<PhaseCombat>(['vague', 'boss']),
    // Boss d'abord : c'est la forme la plus spécifique (elle porte son marqueur `estBoss`).
    cible: nullable(ou(SCHEMA_BOSS, SCHEMA_MONSTRE)),
    timerBossRestantMs: nullable(nombre(0, Math.max(timerBossMs(constantes), 0))),
  })
}

/**
 * §5 / §4.7 — **la** table de schéma de l'état de jeu. Une ligne par champ d'`EtatJeu` : le compilateur
 * exige l'exhaustivité, donc cette table ne peut pas prendre du retard sur le type.
 */
export function construireSchemaEtat(constantes: Constantes): Schema<EtatJeu> {
  return objet<EtatJeu>({
    version: entier(1, VERSION_SCHEMA),
    magicien: objet<Magicien>({
      nom: texte(LONGUEUR_TEXTE_MAX),
      clicsCumules: compteur(),
      degatsCumules: quantite(),
      monstresTues: compteur(),
    }),
    bourse: objet<Bourse>({
      or: quantite(),
      renommee: quantite(),
      eclatsPossedes: quantite(),
      eclatsDepensables: quantite(),
      pointsAscension: quantite(),
    }),
    // Les six emplacements d'école sont énumérés : ajouter une école au type casse la compilation ici.
    ecoles: objet<Readonly<Record<IdEcole, EtatEcole>>>({
      feu: SCHEMA_ECOLE,
      glace: SCHEMA_ECOLE,
      ecole3: SCHEMA_ECOLE,
      ecole4: SCHEMA_ECOLE,
      ecole5: SCHEMA_ECOLE,
      lumiere: SCHEMA_ECOLE,
    }),
    sorts: dictionnaire(constantes.sorts.map((sort) => [sort.id, schemaSort(sort)] as const)),
    combat: schemaCombat(constantes),
    paliersAmeliorations: dictionnaire(
      constantes.ameliorations.map((achat) => [achat.id, entier(0, achat.paliersMax ?? COMPTEUR_MAX)] as const),
    ),
    paliersEquipement: dictionnaire(
      constantes.equipement.map((achat) => [achat.id, entier(0, achat.paliersMax ?? COMPTEUR_MAX)] as const),
    ),
    // EXG-54 — une quête est créditée une seule fois : la liste ne peut pas être plus longue que le catalogue.
    quetesAccomplies: liste(
      choix(constantes.quetes.map((quete) => quete.id)),
      constantes.quetes.length,
    ),
    prestige: objet<EtatPrestige>({
      prestigesDuCycle: compteur(),
      prestigesTotal: compteur(),
      zoneMaxDuRun: entier(ZONE_DEPART, COMPTEUR_MAX),
      eclatsCumulesAVie: quantite(),
      rangsArbreEclats: schemaRangsArbre('eclats', constantes),
    }),
    ascension: objet<EtatAscension>({
      ascensionsEffectuees: compteur(),
      rangsArbreAscension: schemaRangsArbre('ascension', constantes),
      sixiemeEcoleDebloquee: booleen(),
    }),
    partieTerminee: booleen(),
    // EXG-28 — combat du boss final en cours. Bornes tirées des constantes de fin, pas de celles des
    // boss de zone : le boss final a ses propres PV et son propre chrono. Le schéma dit « dans les
    // bornes » ; l'invariant croisé « ce combat n'existe qu'au seuil d'Ascensions » se répare dans
    // `normalisation.ts`, il ne se rejette pas.
    bossFinal: facultatif(
      objet<EtatBossFinal>({
        pvCourants: nombre(0, Math.max(pvBossFinal(constantes), 0)),
        timerRestantMs: nombre(0, Math.max(timerBossFinalMs(constantes), 0)),
      }),
    ),
    // EXG-28 — écran de fin figé. `zoneMaxAtteinte` est une zone de progression : elle est bornée par
    // le type, comme les autres numéros de zone, jamais par le numéro de la zone dédiée.
    statistiquesFin: facultatif(
      objet<StatistiquesFin>({
        dureeTotaleMs: quantite(),
        zoneMaxAtteinte: entier(ZONE_DEPART, COMPTEUR_MAX),
        ascensions: compteur(),
        prestigesTotal: compteur(),
      }),
    ),
    tempsJeuMs: quantite(),
    ticksEcoules: compteur(),
    ticksRattrapes: compteur(),
    iterationsCombat: compteur(),
    // EXG-2 — le reste de delta-time est par construction sous un pas de tick.
    resteDeltaMs: nombre(0, PAS_TICK_MS),
    derniereSauvegardeMs: nombre(0, COMPTEUR_MAX),
    tempsHorsLigneMs: quantite(),
  })
}

/** §4.7 — schéma de l'enveloppe persistée : version de schéma (EXG-25), horodatage (EXG-49) et état. */
export function construireSchemaSauvegarde(constantes: Constantes): Schema<Sauvegarde> {
  return objet<Sauvegarde>({
    version: entier(1, VERSION_SCHEMA),
    horodatageMs: nombre(0, COMPTEUR_MAX),
    etat: construireSchemaEtat(constantes),
  })
}
