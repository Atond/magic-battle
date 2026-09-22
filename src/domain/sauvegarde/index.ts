// Sauvegarde — T-10 : sérialisation versionnée (EXG-25), export/import base64 (EXG-24), validation de
// la seule entrée non fiable du système (EXG-45), sauvegarde de secours (EXG-46), sauvegarde illisible
// (EXG-27), migrations (EXG-26) et non-injection (EXG-47).
//
// Ce module est **pur**, comme tout `src/domain/` : aucun accès au navigateur ni au stockage, aucune
// lecture d'horloge (l'horodatage est toujours un paramètre). Il décide *quoi* écrire et *où*, il
// n'écrit rien : `src/state/` branchera le stockage réel en vague 2 (EXG-22, EXG-23).
//
// ── Pipeline d'import, dans cet ordre exact ───────────────────────────────────────────────────────
//   1. longueur du texte              → refus `tropLong`            (borne avant tout travail)
//   2. base64 → UTF-8                 → refus `base64Invalide`
//   3. JSON.parse                     → refus `jsonIllisible`       (EXG-27 ; tue `NaN`/`Infinity` littéraux)
//   4. balayage des clés polluantes   → refus `clePolluante`        (EXG-45, à toute profondeur)
//   5. lecture de version             → refus `versionInvalide` / `versionFuture` (EXG-25)
//   6. chaîne de migrations           → refus `migrationManquante`  (EXG-26)
//   7. validation par schéma          → refus typé, chemin du champ (EXG-45)
//   8. normalisation inter-champs     → réparation, jamais un refus
//   9. plan d'écriture                → `.bak` puis principal, dans cette séquence (EXG-46)
// Chaque refus rend l'état courant **par référence** : rien n'est écrit, rien n'est fusionné, et
// l'appelant peut comparer les références pour s'en convaincre.
//
// ── EXG-47, la règle et sa frontière ──────────────────────────────────────────────────────────────
// Le domaine ne produit **jamais** de balisage. Un champ texte importé traverse ce module comme une
// donnée et ressort identique : ni échappé, ni interprété. Le domaine garantit « c'est une chaîne de
// caractères », pas « c'est inoffensif dans du balisage » ; l'échappement est la responsabilité de la
// couche d'affichage (vague 2, T-19/T-23), qui ne doit jamais injecter un champ de sauvegarde comme
// HTML brut. Échapper ici serait pire que de ne rien faire : le joueur verrait « &lt;img » dans son
// nom, et la couche d'affichage échapperait une seconde fois.

import { VERSION_SCHEMA } from '../constantes-moteur.ts'
import type { Constantes, EtatJeu, Sauvegarde } from '../types.ts'
import { base64VersTexte, texteVersBase64 } from './base64.ts'
import { MIGRATIONS, lireVersion, migrer } from './migrations.ts'
import type { Migration } from './migrations.ts'
import { normaliserEtat } from './normalisation.ts'
import {
  LONGUEUR_MAX_IMPORT_CARACTERES,
  construireSchemaSauvegarde,
  refusImport,
  valider,
  verifierClesSures,
} from './schema.ts'
import type { ErreurImport, RefusImport } from './schema.ts'

export { base64VersTexte, decoderBase64, encoderBase64, texteVersBase64 } from './base64.ts'
export { MIGRATIONS, lireVersion, migrer } from './migrations.ts'
export type { Migration, ResultatMigration } from './migrations.ts'
export { normaliserEtat } from './normalisation.ts'
export {
  CLES_INTERDITES,
  LONGUEUR_MAX_IMPORT_CARACTERES,
  LONGUEUR_TEXTE_MAX,
  NOEUDS_MAX,
  PROFONDEUR_MAX,
  construireSchemaEtat,
  construireSchemaSauvegarde,
  valider,
  verifierClesSures,
} from './schema.ts'
export type { ErreurImport, MotifRefusImport, RefusImport, Schema, Verdict } from './schema.ts'
export {
  evaluerDroitEcriture,
  liberer,
  renouveler,
  revendiquer,
  verrouExpire,
} from './verrou.ts'
export type { EtatVerrou, MotifVerrou, VerdictVerrou } from './verrou.ts'

/* ═══════════════════════════════════════════════════════════ emplacements de stockage (EXG-46) */
// Noms **logiques** : `src/domain/` ne connaît aucun stockage. C'est `src/state/` qui les préfixe de
// son espace de noms et les écrit réellement (vague 2).

/** Emplacement de la sauvegarde active. */
export const NOM_PRINCIPAL = 'sauvegarde'
/** EXG-46 — emplacement de la copie de secours, restaurable en un clic. */
export const NOM_SECOURS = 'sauvegarde.bak'

/* ════════════════════════════════════════════════════════════════════ résultats (types de retour) */

/**
 * Verdict d'un import. En cas de refus, `etat` est **l'état d'entrée lui-même** (même référence) : la
 * garantie « l'état courant reste strictement intact » est vérifiable par identité, pas par égalité.
 *
 * EXG-46 — un import **réussi** porte son `plan` : la liste ordonnée des écritures à effectuer, mise à
 * l'abri comprise. C'est ce qui rend l'ordre « `.bak` d'abord » structurel plutôt que documentaire —
 * voir `planifierImport`.
 */
export type ResultatImport =
  | {
      readonly ok: true
      readonly etat: EtatJeu
      readonly sauvegarde: Sauvegarde
      /** EXG-26 — nombre d'étapes de migration appliquées (0 pour une sauvegarde déjà à jour). */
      readonly migrationsAppliquees: number
      /** EXG-46 — les écritures à exécuter **dans l'ordre du tableau**, et rien d'autre. */
      readonly plan: PlanEcrasement
    }
  | { readonly ok: false; readonly etat: EtatJeu; readonly erreur: ErreurImport }

/** Ce qui déclenche la mise à l'abri de la sauvegarde courante (EXG-46), ou son retour. */
export type MotifEcrasement = 'import' | 'nouvellePartie' | 'restauration'

/** Une écriture à effectuer par `src/state/` : un emplacement logique, un contenu (`null` = effacer). */
export interface Ecriture {
  readonly nom: string
  readonly contenu: string | null
}

/**
 * Plan d'écriture **pur** : ce qu'il faut écrire et où, sans rien écrire.
 *
 * `ecritures` est une **séquence**, pas un ensemble : `src/state/` l'exécute du premier au dernier
 * élément. C'est là que vit l'ordre exigé par EXG-46 (la copie de secours avant l'écrasement), et non
 * dans une phrase de documentation que l'appelant serait libre de ne pas lire.
 */
export interface PlanEcrasement {
  readonly motif: MotifEcrasement
  readonly ecritures: readonly Ecriture[]
  /** Vrai si une sauvegarde de secours existe (ou vient d'être planifiée) : pilote le bouton « restaurer ». */
  readonly secoursDisponible: boolean
}

/**
 * Réglages d'un import. Tous facultatifs : un appel à trois arguments fait la chose attendue.
 *
 * Pourquoi un objet plutôt que des paramètres positionnels : ces trois réglages n'ont rien à voir
 * entre eux, et deux d'entre eux existent déjà sous cette forme sur `migrer`/`lireVersion`. Un objet
 * nommé se lit sur le site d'appel — `{ contenuCourant }` dit ce qu'il fait, un cinquième argument
 * positionnel non.
 */
export interface OptionsImport {
  /** EXG-26 — registre de migrations à appliquer. Par défaut, le registre réel du jeu. */
  readonly registre?: readonly Migration[]
  /**
   * EXG-46 — contenu actuel de l'emplacement principal : ce que l'écrasement va détruire, `null` s'il
   * n'y a rien. Ne sert qu'à construire le `plan` du résultat. Le passer, c'est obtenir la mise à
   * l'abri ; ne pas le passer, c'est déclarer qu'il n'y a rien à mettre à l'abri (première partie,
   * simple relecture du stockage).
   */
  readonly contenuCourant?: string | null
  /**
   * EXG-25 — version de format visée par la chaîne de migrations. Par défaut celle du code qui relit
   * (`VERSION_SCHEMA`) ; injectable, exactement comme celle de `migrer` et de `lireVersion`, pour que
   * le mécanisme de migration reste éprouvable quand le registre réel est vide.
   */
  readonly versionCible?: number
}

function refus(etat: EtatJeu, erreur: ErreurImport): ResultatImport {
  return { ok: false, etat, erreur }
}

/** Convertit un verdict de validation en refus d'import, en conservant l'état courant par référence. */
function refusDeVerdict(etat: EtatJeu, verdict: RefusImport): ResultatImport {
  return refus(etat, verdict.erreur)
}

/* ═══════════════════════════════════════════════════════════════ EXG-25 — sérialisation versionnée */

/**
 * EXG-25 — enveloppe l'état dans une sauvegarde versionnée. La version est une constante **du domaine**
 * (`VERSION_SCHEMA`), pas une valeur d'équilibrage : elle change quand le format change, jamais quand
 * l'équilibre change.
 * `horodatageMs` est aussi recopié dans `etat.derniereSauvegardeMs` : c'est la définition du champ
 * (« horodatage de la dernière sauvegarde ») et la base du calcul hors-ligne au retour (EXG-49). Un
 * horodatage non fini ou négatif est ramené à 0 plutôt que de contaminer l'état.
 * Ne mute jamais l'état reçu.
 */
export function serialiser(etat: EtatJeu, horodatageMs: number): Sauvegarde {
  const horodatage = Number.isFinite(horodatageMs) && horodatageMs > 0 ? horodatageMs : 0
  return {
    version: VERSION_SCHEMA,
    horodatageMs: horodatage,
    etat: { ...etat, version: VERSION_SCHEMA, derniereSauvegardeMs: horodatage },
  }
}

/**
 * Inverse de `serialiser` : valide une enveloppe **déjà analysée** (objet), applique les migrations
 * puis la normalisation. C'est l'entrée à utiliser quand la charge ne vient pas d'un texte base64
 * (relecture du stockage local par `src/state/`, tests).
 *
 * Cette porte-là ne voit passer aucun texte, donc aucune des deux bornes de longueur d'`importerTexte`.
 * Ce n'est pas un trou : les bornes de volume qui comptent (`NOEUDS_MAX`, ensemble des nœuds déjà vus,
 * `PROFONDEUR_MAX`) vivent dans le **parcours** `verifierClesSures`, traversé ici comme ailleurs. Un
 * graphe d'objets partagés ou cyclique — impossible à produire par `JSON.parse`, trivial à écrire à la
 * main — y est borné de la même façon qu'une charge venue d'un texte.
 *
 * Les réglages facultatifs (registre, contenu à mettre à l'abri, version cible) passent par
 * `OptionsImport`.
 */
export function deserialiser(
  brut: unknown,
  etatCourant: EtatJeu,
  constantes: Constantes,
  options: OptionsImport = {},
): ResultatImport {
  const registre = options.registre ?? MIGRATIONS
  const versionCible = options.versionCible ?? VERSION_SCHEMA
  const contenuCourant = options.contenuCourant ?? null

  // 4. clés polluantes, à toute profondeur, y compris dans les dictionnaires de rangs (EXG-45).
  const sures = verifierClesSures(brut)
  if (!sures.ok) return refusDeVerdict(etatCourant, sures)

  // 5. version (EXG-25) puis 6. migrations (EXG-26).
  const version = lireVersion(brut, versionCible)
  if (!version.ok) return refusDeVerdict(etatCourant, version)

  const migre = migrer(brut, version.valeur, versionCible, registre)
  if (!migre.ok) return refusDeVerdict(etatCourant, migre)

  // Une migration produit une charge encore non fiable : on rebalaie avant de valider. C'est le seul
  // endroit où une clé polluante peut entrer **après** le premier balayage — une migration est du code
  // du jeu, mais elle travaille sur une charge hostile et peut en recopier n'importe quoi.
  if (migre.etapes > 0) {
    const suresApres = verifierClesSures(migre.valeur)
    if (!suresApres.ok) return refusDeVerdict(etatCourant, suresApres)
  }

  // 7. schéma : reconstruction champ par champ, les clés inconnues ne sont même pas lues (EXG-45).
  const verdict = valider(migre.valeur, construireSchemaSauvegarde(constantes), 'sauvegarde')
  if (!verdict.ok) return refusDeVerdict(etatCourant, verdict)

  // 8. cohérence inter-champs : on répare, on ne rejette pas.
  const etat = normaliserEtat(verdict.valeur.etat, constantes)
  const sauvegarde: Sauvegarde = { ...verdict.valeur, etat }
  return {
    ok: true,
    etat,
    sauvegarde,
    migrationsAppliquees: migre.etapes,
    // 9. EXG-46 — le plan d'écriture part avec le résultat : l'appelant ne peut pas écrire la nouvelle
    // sauvegarde sans passer par ce tableau, donc sans voir la mise à l'abri qui l'y précède.
    plan: planifierImport(contenuCourant, exporterTexte(etat, sauvegarde.horodatageMs)),
  }
}

/* ══════════════════════════════════════════════════════════════════ EXG-24 — export / import texte */

/** EXG-24 — l'état, en une chaîne base64 transportable dans un champ texte (accents et emojis compris). */
export function exporterTexte(etat: EtatJeu, horodatageMs: number): string {
  return texteVersBase64(JSON.stringify(serialiser(etat, horodatageMs)))
}

/**
 * EXG-24 / EXG-27 / EXG-45 — importe un texte d'export. Tout refus laisse l'état courant intact et
 * rend un motif affichable. Aucune exception n'est levée : un import raté est une valeur de retour.
 */
export function importerTexte(
  texte: string,
  etatCourant: EtatJeu,
  constantes: Constantes,
  options: OptionsImport = {},
): ResultatImport {
  // 1. borne de taille avant tout travail : une charge démesurée est refusée sans être décodée.
  if (typeof texte !== 'string' || texte.length === 0) {
    return refusDeVerdict(
      etatCourant,
      refusImport('base64Invalide', NOM_PRINCIPAL, 'Aucun code de sauvegarde à importer.'),
    )
  }
  if (texte.length > LONGUEUR_MAX_IMPORT_CARACTERES) {
    return refusDeVerdict(
      etatCourant,
      refusImport('tropLong', NOM_PRINCIPAL, 'Ce code de sauvegarde est démesuré : import refusé.'),
    )
  }

  // 2. base64 → texte.
  const json = base64VersTexte(texte)
  if (json === null) {
    return refusDeVerdict(
      etatCourant,
      refusImport('base64Invalide', NOM_PRINCIPAL, 'Ce code de sauvegarde est illisible (base64 invalide).'),
    )
  }
  if (json.length > LONGUEUR_MAX_IMPORT_CARACTERES) {
    return refusDeVerdict(
      etatCourant,
      refusImport('tropLong', NOM_PRINCIPAL, 'Cette sauvegarde est démesurée : import refusé.'),
    )
  }

  // 3. EXG-27 — JSON tronqué ou illisible. C'est aussi ici que meurent les littéraux `NaN`,
  // `Infinity` et `-Infinity` : ils n'appartiennent pas à la grammaire JSON.
  let brut: unknown
  try {
    brut = JSON.parse(json) as unknown
  } catch {
    return refusDeVerdict(
      etatCourant,
      refusImport('jsonIllisible', NOM_PRINCIPAL, 'Sauvegarde corrompue ou tronquée : impossible de la lire.'),
    )
  }

  return deserialiser(brut, etatCourant, constantes, options)
}

/* ══════════════════════════════════════════════════════════════ EXG-46 — sauvegarde de secours */

/**
 * EXG-46 — avant tout import ou toute nouvelle partie qui écraserait la sauvegarde existante, la
 * sauvegarde courante part vers l'emplacement de secours. Politique **pure** : cette fonction dit quoi
 * écrire et où, `src/state/` l'exécute.
 * Rien à sauver (première partie, stockage vide) ⇒ aucune écriture, et pas de secours factice.
 *
 * Note d'usage : cette fonction ne planifie **que** la mise à l'abri. Pour un import, c'est
 * `planifierImport` (ou, mieux, le `plan` que porte déjà le résultat d'import) qu'il faut lire :
 * l'écrasement y figure, après la mise à l'abri, dans la même séquence — de sorte qu'aucun appelant ne
 * puisse écrire la nouvelle sauvegarde sans avoir traversé l'ancienne.
 */
export function planifierEcrasement(
  contenuCourant: string | null,
  motif: MotifEcrasement = 'import',
): PlanEcrasement {
  if (typeof contenuCourant !== 'string' || contenuCourant.length === 0) {
    return { motif, ecritures: [], secoursDisponible: false }
  }
  return {
    motif,
    ecritures: [{ nom: NOM_SECOURS, contenu: contenuCourant }],
    secoursDisponible: true,
  }
}

/**
 * EXG-46 — le plan complet d'un écrasement : mise à l'abri **puis** écriture de la nouvelle sauvegarde,
 * dans cet ordre, dans une seule séquence.
 *
 * Pourquoi cette fonction existe alors que `planifierEcrasement` suffisait : « l'appelant doit copier
 * l'ancienne sauvegarde avant d'écrire la nouvelle » n'était qu'une phrase de commentaire. Rien
 * n'empêchait `src/state/` d'écrire d'abord, de copier ensuite (donc de copier la nouvelle sur
 * l'ancienne), ni d'oublier la copie — et le test qui « vérifiait » l'ordre le mettait lui-même dans le
 * bon ordre : il validait le test, pas le code. En faisant porter la séquence par le résultat d'import,
 * l'invariant devient structurel : il n'existe qu'un seul objet qui dit quoi écrire, et il porte déjà
 * l'ancienne sauvegarde en première position.
 *
 * Deux propriétés distinctes, à ne pas confondre :
 *  - **complétude** — la mise à l'abri et l'écrasement sont dans la même liste. Un appelant qui exécute
 *    la liste ne peut pas oublier la première : il n'y a pas deux appels à passer, il y en a un ;
 *  - **ordre** — la mise à l'abri vient en tête. Ce point est le moins critique des deux, parce que
 *    chaque écriture porte son **contenu** (une valeur déjà capturée) et non une consigne « recopie
 *    l'emplacement X » : même exécutée à l'envers, la copie de secours reçoit l'ancienne sauvegarde.
 *    L'ordre reste celui qu'on écrit, pour qu'une interruption au milieu laisse toujours au moins une
 *    copie lisible de la partie précédente.
 */
export function planifierImport(
  contenuCourant: string | null,
  nouveauContenu: string,
  motif: MotifEcrasement = 'import',
): PlanEcrasement {
  const miseALAbri = planifierEcrasement(contenuCourant, motif)
  return {
    motif,
    ecritures: [...miseALAbri.ecritures, { nom: NOM_PRINCIPAL, contenu: nouveauContenu }],
    secoursDisponible: miseALAbri.secoursDisponible,
  }
}

/** EXG-46 — chemin retour : la copie de secours redevient la sauvegarde active (« restaurer en un clic »). */
export function planifierRestauration(contenuSecours: string | null): PlanEcrasement {
  if (typeof contenuSecours !== 'string' || contenuSecours.length === 0) {
    return { motif: 'restauration', ecritures: [], secoursDisponible: false }
  }
  return {
    motif: 'restauration',
    ecritures: [{ nom: NOM_PRINCIPAL, contenu: contenuSecours }],
    secoursDisponible: true,
  }
}

/**
 * EXG-46 — relit la sauvegarde de secours. Elle repasse par **tout** le pipeline d'import : une copie
 * de secours est une donnée persistée, donc non fiable elle aussi (le stockage local est modifiable à
 * la main). Un secours absent se signale (`secoursAbsent`) au lieu d'effacer l'état courant.
 */
export function restaurerSecours(
  contenuSecours: string | null,
  etatCourant: EtatJeu,
  constantes: Constantes,
  options: OptionsImport = {},
): ResultatImport {
  if (typeof contenuSecours !== 'string' || contenuSecours.length === 0) {
    return refusDeVerdict(
      etatCourant,
      refusImport('secoursAbsent', NOM_SECOURS, 'Aucune sauvegarde de secours à restaurer.'),
    )
  }
  const resultat = importerTexte(contenuSecours, etatCourant, constantes, options)
  if (!resultat.ok) return resultat
  // Le chemin retour ne met rien à l'abri : la copie de secours est justement ce qu'on relit, l'écraser
  // avec son propre contenu n'apporterait rien et la perdrait en cas d'interruption. Le plan se réduit
  // donc à réinstaller la sauvegarde active.
  return { ...resultat, plan: planifierRestauration(contenuSecours) }
}
