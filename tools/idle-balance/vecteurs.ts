// Lecture des **vecteurs de paramètres archivés** (`rapports/*.vecteur.json`).
//
// Un vecteur archivé est l'entrée exacte de `construireConstantes` qui a produit le
// `src/donnees/constantes.ts` commité. Deux consommateurs, et c'est pour cela que cette lecture vit
// ici plutôt que dans `search.ts` :
//   · `search.ts` s'en sert de **points de départ supplémentaires** de la descente (la recherche ne
//     peut donc pas régresser d'une exécution à l'autre) ;
//   · `empreinte.ts` s'en sert de **référence** : il régénère les constantes en mémoire depuis le
//     dernier vecteur et les compare au fichier commité (ADR-10, invariant 2).
//
// Les chemins sont résolus **relativement à ce module**, pas au répertoire courant : `npm test` et
// `verify.sh` ne lancent pas les commandes depuis le même endroit.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Parametres } from './parametres.ts'

/** Chemin d'affichage, tel qu'il apparaît dans les rapports et les messages d'erreur. */
export const DOSSIER_RAPPORTS_RELATIF = 'tools/idle-balance/rapports'

/** Chemin réel, résolu depuis l'emplacement de ce fichier. */
export const DOSSIER_RAPPORTS = fileURLToPath(new URL('./rapports', import.meta.url))

export interface VecteurArchive {
  /** Libellé lisible, ex. « vecteur archivé 2026-09-21 ». */
  nom: string
  /** Nom du fichier, ex. `2026-09-21.vecteur.json`. */
  fichier: string
  parametres: Parametres
}

/**
 * Vecteurs archivés, triés par nom de fichier (donc par date). Un fichier illisible est ignoré avec
 * un avertissement : un JSON cassé ne doit pas empêcher la recherche de repartir des autres.
 */
export function vecteursArchives(dossier: string = DOSSIER_RAPPORTS): VecteurArchive[] {
  if (!existsSync(dossier)) return []
  const trouves: VecteurArchive[] = []
  for (const fichier of readdirSync(dossier).sort()) {
    if (!fichier.endsWith('.vecteur.json')) continue
    try {
      const brut = JSON.parse(readFileSync(`${dossier}/${fichier}`, 'utf8')) as Parametres
      trouves.push({
        nom: `vecteur archivé ${fichier.replace('.vecteur.json', '')}`,
        fichier,
        parametres: brut,
      })
    } catch {
      console.log(`  (vecteur archivé illisible, ignoré : ${fichier})`)
    }
  }
  return trouves
}

/** Le dernier vecteur archivé — celui qui a produit `src/donnees/`. `null` s'il n'y en a aucun. */
export function dernierVecteurArchive(dossier: string = DOSSIER_RAPPORTS): VecteurArchive | null {
  const archives = vecteursArchives(dossier)
  return archives[archives.length - 1] ?? null
}
