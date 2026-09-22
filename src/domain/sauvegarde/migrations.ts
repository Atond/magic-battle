// Chaîne de migrations de format de sauvegarde — T-10, EXG-26 : « quand une sauvegarde d'une version de
// schéma antérieure est chargée, appliquer les migrations successives **sans perte de progression** ».
//
// Le registre est indexé par **version de départ** : une migration `de → vers`, une seule par version
// de départ, et la chaîne se déroule jusqu'à la version courante. Aujourd'hui la chaîne est vide (le
// format est en version 1), mais le mécanisme et ses tests existent : le jour où le format change, on
// ajoute une entrée au registre et une fixture gelée dans `tests/migrations/fixtures/` — rien d'autre.
//
// Ordre du pipeline d'import, et il compte :
//   base64 → JSON → balayage des clés → **lecture de version** → **migrations** → schéma → normalisation
// Les migrations travaillent donc sur la charge **encore non fiable** : une migration ne doit rien
// supposer de la forme qu'elle reçoit, et sa sortie est validée par le schéma juste après. C'est
// volontaire : valider avant migrerait obligerait à conserver un schéma par version passée.

import { VERSION_SCHEMA } from '../constantes-moteur.ts'
import { estObjetSimple, refusImport } from './schema.ts'
import type { ErreurImport, Verdict } from './schema.ts'

/**
 * Une étape de migration. `appliquer` reçoit l'enveloppe telle qu'elle a été lue (ou telle que l'étape
 * précédente l'a rendue) et retourne l'enveloppe au format `vers`. Elle doit être **pure** et ne jamais
 * lever : une charge inattendue se laisse traverser, le schéma la refusera ensuite avec un motif propre.
 */
export interface Migration {
  readonly de: number
  readonly vers: number
  readonly appliquer: (charge: unknown) => unknown
}

/**
 * EXG-26 — registre des migrations, indexé par version de départ à la lecture.
 * **Vide** : la version 1 est la version initiale du format, il n'y a rien à migrer. Toute entrée
 * ajoutée ici s'accompagne d'une fixture gelée de la version de départ (spec §9).
 */
export const MIGRATIONS: readonly Migration[] = []

/** Résultat d'une chaîne de migrations : la charge migrée et le nombre d'étapes réellement appliquées. */
export type ResultatMigration =
  | { readonly ok: true; readonly valeur: unknown; readonly etapes: number }
  | { readonly ok: false; readonly erreur: ErreurImport }

/**
 * EXG-25 — lit le numéro de version de l'enveloppe, avant toute interprétation du reste. C'est la seule
 * valeur que l'on ose lire d'une charge non encore validée, parce que c'est elle qui décide quel
 * schéma s'appliquera.
 */
export function lireVersion(brut: unknown, versionCourante: number = VERSION_SCHEMA): Verdict<number> {
  if (!estObjetSimple(brut)) {
    return refusImport('typeIncorrect', 'sauvegarde', 'Sauvegarde illisible : objet attendu.')
  }
  if (!Object.prototype.hasOwnProperty.call(brut, 'version')) {
    return refusImport('versionInvalide', 'sauvegarde.version', 'Sauvegarde sans numéro de version.')
  }
  const version: unknown = brut.version
  if (typeof version !== 'number') {
    return refusImport('versionInvalide', 'sauvegarde.version', 'Numéro de version illisible.')
  }
  if (!Number.isFinite(version)) {
    return refusImport('valeurNonFinie', 'sauvegarde.version', 'Numéro de version non fini.')
  }
  if (!Number.isInteger(version) || version < 1) {
    return refusImport('versionInvalide', 'sauvegarde.version', 'Numéro de version invalide.')
  }
  if (version > versionCourante) {
    return refusImport(
      'versionFuture',
      'sauvegarde.version',
      `Sauvegarde écrite par une version plus récente du jeu (format ${version}, cette version lit le format ${versionCourante}).`,
    )
  }
  return { ok: true, valeur: version }
}

/** Indexe le registre par version de départ, en refusant deux migrations concurrentes ou une étape absurde. */
function indexer(registre: readonly Migration[], chemin: string): Verdict<ReadonlyMap<number, Migration>> {
  const index = new Map<number, Migration>()
  for (const migration of registre) {
    if (!Number.isInteger(migration.de) || !Number.isInteger(migration.vers) || migration.vers <= migration.de) {
      return refusImport('migrationManquante', chemin, 'Registre de migrations incohérent.')
    }
    if (index.has(migration.de)) {
      return refusImport('migrationManquante', chemin, 'Deux migrations pour la même version de départ.')
    }
    index.set(migration.de, migration)
  }
  return { ok: true, valeur: index }
}

/**
 * EXG-26 — applique la chaîne de migrations de `version` jusqu'à `versionCible`, dans l'ordre, sans
 * saut : s'il manque un maillon, l'import est refusé (`migrationManquante`) plutôt que de charger une
 * sauvegarde à moitié convertie. Le nombre d'étapes est borné par la taille du registre : un registre
 * cyclique ne fait pas tourner la boucle indéfiniment.
 */
export function migrer(
  brut: unknown,
  version: number,
  versionCible: number = VERSION_SCHEMA,
  registre: readonly Migration[] = MIGRATIONS,
): ResultatMigration {
  const chemin = 'sauvegarde.version'
  if (!Number.isInteger(versionCible) || versionCible < 1) {
    return refusImport('versionInvalide', chemin, 'Version cible de migration invalide.')
  }
  if (!Number.isInteger(version) || version < 1) {
    return refusImport('versionInvalide', chemin, 'Numéro de version invalide.')
  }
  if (version > versionCible) {
    return refusImport(
      'versionFuture',
      chemin,
      `Sauvegarde écrite par une version plus récente du jeu (format ${version}).`,
    )
  }

  const index = indexer(registre, chemin)
  if (!index.ok) return index

  let charge = brut
  let courante = version
  let etapes = 0
  while (courante < versionCible) {
    const migration = index.valeur.get(courante)
    if (migration === undefined || etapes >= registre.length) {
      return refusImport(
        'migrationManquante',
        chemin,
        `Aucune migration connue du format ${courante} vers le format ${versionCible}.`,
      )
    }
    charge = migration.appliquer(charge)
    courante = migration.vers
    etapes += 1
  }

  if (courante !== versionCible) {
    return refusImport(
      'migrationManquante',
      chemin,
      `La chaîne de migrations aboutit au format ${courante} au lieu de ${versionCible}.`,
    )
  }

  // La version inscrite dans l'enveloppe doit refléter la chaîne appliquée, sinon le schéma courant la
  // refuserait. Écriture sur une clé littérale, jamais sur une clé venue de la charge.
  const migree = etapes > 0 && estObjetSimple(charge) ? { ...charge, version: versionCible } : charge
  return { ok: true, valeur: migree, etapes }
}
