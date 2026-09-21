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
  TAILLE_MAX_IMPORT_OCTETS,
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
  LONGUEUR_TEXTE_MAX,
  PROFONDEUR_MAX,
  TAILLE_MAX_IMPORT_OCTETS,
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
 */
export type ResultatImport =
  | {
      readonly ok: true
      readonly etat: EtatJeu
      readonly sauvegarde: Sauvegarde
      /** EXG-26 — nombre d'étapes de migration appliquées (0 pour une sauvegarde déjà à jour). */
      readonly migrationsAppliquees: number
    }
  | { readonly ok: false; readonly etat: EtatJeu; readonly erreur: ErreurImport }

/** Ce qui déclenche la mise à l'abri de la sauvegarde courante (EXG-46), ou son retour. */
export type MotifEcrasement = 'import' | 'nouvellePartie' | 'restauration'

/** Une écriture à effectuer par `src/state/` : un emplacement logique, un contenu (`null` = effacer). */
export interface Ecriture {
  readonly nom: string
  readonly contenu: string | null
}

/** Plan d'écriture **pur** : ce qu'il faut écrire et où, sans rien écrire. */
export interface PlanEcrasement {
  readonly motif: MotifEcrasement
  readonly ecritures: readonly Ecriture[]
  /** Vrai si une sauvegarde de secours existe (ou vient d'être planifiée) : pilote le bouton « restaurer ». */
  readonly secoursDisponible: boolean
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
 */
export function deserialiser(
  brut: unknown,
  etatCourant: EtatJeu,
  constantes: Constantes,
  registre: readonly Migration[] = MIGRATIONS,
): ResultatImport {
  // 4. clés polluantes, à toute profondeur, y compris dans les dictionnaires de rangs (EXG-45).
  const sures = verifierClesSures(brut)
  if (!sures.ok) return refusDeVerdict(etatCourant, sures)

  // 5. version (EXG-25) puis 6. migrations (EXG-26).
  const version = lireVersion(brut, VERSION_SCHEMA)
  if (!version.ok) return refusDeVerdict(etatCourant, version)

  const migre = migrer(brut, version.valeur, VERSION_SCHEMA, registre)
  if (!migre.ok) return refusDeVerdict(etatCourant, migre)

  // Une migration produit une charge encore non fiable : on rebalaie avant de valider.
  if (migre.etapes > 0) {
    const suresApres = verifierClesSures(migre.valeur)
    if (!suresApres.ok) return refusDeVerdict(etatCourant, suresApres)
  }

  // 7. schéma : reconstruction champ par champ, les clés inconnues ne sont même pas lues (EXG-45).
  const verdict = valider(migre.valeur, construireSchemaSauvegarde(constantes), 'sauvegarde')
  if (!verdict.ok) return refusDeVerdict(etatCourant, verdict)

  // 8. cohérence inter-champs : on répare, on ne rejette pas.
  const etat = normaliserEtat(verdict.valeur.etat, constantes)
  return {
    ok: true,
    etat,
    sauvegarde: { ...verdict.valeur, etat },
    migrationsAppliquees: migre.etapes,
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
  registre: readonly Migration[] = MIGRATIONS,
): ResultatImport {
  // 1. borne de taille avant tout travail : une charge démesurée est refusée sans être décodée.
  if (typeof texte !== 'string' || texte.length === 0) {
    return refusDeVerdict(
      etatCourant,
      refusImport('base64Invalide', NOM_PRINCIPAL, 'Aucun code de sauvegarde à importer.'),
    )
  }
  if (texte.length > TAILLE_MAX_IMPORT_OCTETS) {
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
  if (json.length > TAILLE_MAX_IMPORT_OCTETS) {
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

  return deserialiser(brut, etatCourant, constantes, registre)
}

/* ══════════════════════════════════════════════════════════════ EXG-46 — sauvegarde de secours */

/**
 * EXG-46 — avant tout import ou toute nouvelle partie qui écraserait la sauvegarde existante, la
 * sauvegarde courante part vers l'emplacement de secours. Politique **pure** : cette fonction dit quoi
 * écrire et où, `src/state/` l'exécute (et doit l'exécuter **avant** l'écrasement, pas après).
 * Rien à sauver (première partie, stockage vide) ⇒ aucune écriture, et pas de secours factice.
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
  registre: readonly Migration[] = MIGRATIONS,
): ResultatImport {
  if (typeof contenuSecours !== 'string' || contenuSecours.length === 0) {
    return refusDeVerdict(
      etatCourant,
      refusImport('secoursAbsent', NOM_SECOURS, 'Aucune sauvegarde de secours à restaurer.'),
    )
  }
  return importerTexte(contenuSecours, etatCourant, constantes, registre)
}
