// `npm run equilibrage:empreinte` — **le fichier commité est-il encore la sortie du vecteur archivé ?**
//
// Le trou que cette commande bouche : `equilibrage:check` recharge `src/donnees/constantes.ts` et
// rejoue §8 dessus, donc il n'attrape une retouche manuelle que si elle **casse une contrainte**. Une
// valeur changée à la main qui garde 13/13 — exactement celle qu'un agent pressé écrirait — passait
// inaperçue, et l'invariant 2 de `CLAUDE.md` (« on ne modifie jamais une constante à la main »,
// ADR-10) reposait sur la parole des agents plutôt que sur un script.
//
// Méthode : régénérer les constantes **en mémoire** depuis le dernier vecteur archivé
// (`rapports/*.vecteur.json`, la même entrée que `EQUILIBRAGE_REGENERER=1`), puis comparer champ par
// champ au fichier commité. Aucune simulation n'est lancée : c'est une comparaison, pas une recherche.
//
// Usage : `tsx tools/idle-balance/empreinte.ts [module-de-constantes]`
//   défaut : `src/donnees/constantes.ts`
// Sortie : 0 si le fichier est conforme, 2 si un champ diverge, 1 si le vecteur ou le module est
// illisible.

import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import type { Constantes } from '../../src/domain/types.ts'
import { construireConstantes } from './parametres.ts'
import { serialiserNombre } from './sortie.ts'
import { dernierVecteurArchive, DOSSIER_RAPPORTS_RELATIF } from './vecteurs.ts'

const DEFAUT = 'src/donnees/constantes.ts'

export interface Ecart {
  /** Chemin du champ, ex. `CONSTANTES.ecoles.feu.coutBase`. */
  chemin: string
  nature: 'valeur' | 'type' | 'manquant' | 'en-trop' | 'longueur'
  /** Ce que le vecteur archivé produit. */
  attendu: string
  /** Ce que le fichier commité contient. */
  livre: string
}

function decrire(valeur: unknown): string {
  if (valeur === undefined) return '(absent)'
  if (valeur === null) return 'null'
  if (typeof valeur === 'number') return serialiserNombre(valeur)
  if (typeof valeur === 'string') return `'${valeur}'`
  if (Array.isArray(valeur)) return `[${valeur.length} élément(s)]`
  if (typeof valeur === 'object') return `{${Object.keys(valeur as object).join(', ')}}`
  return String(valeur)
}

/**
 * Comparaison profonde entre les constantes régénérées (`attendu`) et celles lues dans le fichier
 * commité (`livre`). Pure et sans effet de bord : c'est elle que les tests exercent.
 *
 * Les nombres sont comparés **à travers `serialiserNombre`**, la forme normale de l'écriture : sinon
 * `1.15 + 0.01` (soit `1.1600000000000001` en mémoire) divergerait du `1.16` écrit dans le fichier,
 * et la commande crierait au loup à chaque exécution.
 */
export function comparerValeurs(attendu: unknown, livre: unknown, chemin = 'CONSTANTES'): Ecart[] {
  if (typeof attendu === 'number' && typeof livre === 'number') {
    const a = serialiserNombre(attendu)
    const l = serialiserNombre(livre)
    return a === l ? [] : [{ chemin, nature: 'valeur', attendu: a, livre: l }]
  }
  if (Array.isArray(attendu) || Array.isArray(livre)) {
    if (!Array.isArray(attendu) || !Array.isArray(livre)) {
      return [{ chemin, nature: 'type', attendu: decrire(attendu), livre: decrire(livre) }]
    }
    const ecarts: Ecart[] = []
    if (attendu.length !== livre.length) {
      ecarts.push({
        chemin,
        nature: 'longueur',
        attendu: `${attendu.length} élément(s)`,
        livre: `${livre.length} élément(s)`,
      })
    }
    for (let i = 0; i < Math.max(attendu.length, livre.length); i += 1) {
      const sousChemin = `${chemin}[${i}]`
      if (i >= livre.length) {
        ecarts.push({ chemin: sousChemin, nature: 'manquant', attendu: decrire(attendu[i]), livre: '(absent)' })
      } else if (i >= attendu.length) {
        ecarts.push({ chemin: sousChemin, nature: 'en-trop', attendu: '(absent)', livre: decrire(livre[i]) })
      } else {
        ecarts.push(...comparerValeurs(attendu[i], livre[i], sousChemin))
      }
    }
    return ecarts
  }
  const attenduObjet = typeof attendu === 'object' && attendu !== null
  const livreObjet = typeof livre === 'object' && livre !== null
  if (attenduObjet || livreObjet) {
    if (!attenduObjet || !livreObjet) {
      return [{ chemin, nature: 'type', attendu: decrire(attendu), livre: decrire(livre) }]
    }
    const a = attendu as Record<string, unknown>
    const l = livre as Record<string, unknown>
    const cles = [...new Set([...Object.keys(a), ...Object.keys(l)])]
    const ecarts: Ecart[] = []
    for (const cle of cles) {
      const sousChemin = `${chemin}.${cle}`
      if (!(cle in l)) {
        ecarts.push({ chemin: sousChemin, nature: 'manquant', attendu: decrire(a[cle]), livre: '(absent)' })
      } else if (!(cle in a)) {
        ecarts.push({ chemin: sousChemin, nature: 'en-trop', attendu: '(absent)', livre: decrire(l[cle]) })
      } else {
        ecarts.push(...comparerValeurs(a[cle], l[cle], sousChemin))
      }
    }
    return ecarts
  }
  if (attendu === livre) return []
  return [{ chemin, nature: 'valeur', attendu: decrire(attendu), livre: decrire(livre) }]
}

/** Régénère les constantes en mémoire depuis le dernier vecteur archivé, sans rien écrire. */
export function constantesAttendues(): { nom: string; fichier: string; constantes: Constantes } {
  const dernier = dernierVecteurArchive()
  if (dernier === null) {
    throw new Error(
      `aucun vecteur archivé à comparer (${DOSSIER_RAPPORTS_RELATIF}/*.vecteur.json) — lancer \`npm run equilibrage:search\`.`,
    )
  }
  return { nom: dernier.nom, fichier: dernier.fichier, constantes: construireConstantes(dernier.parametres) }
}

async function chargerLivre(chemin: string): Promise<unknown> {
  const module = (await import(pathToFileURL(resolve(chemin)).href)) as Record<string, unknown>
  const candidat = module['CONSTANTES'] ?? module['default']
  if (candidat === undefined || typeof candidat !== 'object' || candidat === null) {
    throw new Error(`\`${chemin}\` n'exporte ni \`CONSTANTES\` ni export par défaut exploitable.`)
  }
  return candidat
}

async function principal(): Promise<number> {
  const chemin = process.argv[2] ?? DEFAUT
  const debut = Date.now()

  let reference: { nom: string; fichier: string; constantes: Constantes }
  let livre: unknown
  try {
    reference = constantesAttendues()
    livre = await chargerLivre(chemin)
  } catch (erreur) {
    console.error(`equilibrage:empreinte — ${String(erreur)}`)
    return 1
  }

  const ecarts = comparerValeurs(reference.constantes, livre)
  const duree = Date.now() - debut

  if (ecarts.length === 0) {
    console.log(
      `equilibrage:empreinte — \`${chemin}\` est conforme au ${reference.nom} (${DOSSIER_RAPPORTS_RELATIF}/${reference.fichier}), champ par champ. ${duree} ms.`,
    )
    return 0
  }

  console.error(
    `equilibrage:empreinte — ${ecarts.length} champ(s) divergent(s) entre \`${chemin}\` et le ${reference.nom} (${DOSSIER_RAPPORTS_RELATIF}/${reference.fichier}) :`,
  )
  for (const ecart of ecarts.slice(0, 30)) {
    console.error(`  ${ecart.chemin} — vecteur : ${ecart.attendu} · fichier : ${ecart.livre} [${ecart.nature}]`)
  }
  if (ecarts.length > 30) console.error(`  … et ${ecarts.length - 30} autre(s).`)
  console.error(
    [
      '',
      "Une valeur de `src/donnees/` est une **sortie** du simulateur, jamais une saisie (ADR-10, invariant 2",
      'de CLAUDE.md). Deux chemins, selon ce qui doit changer :',
      '  · une **valeur** doit changer → `npm run equilibrage:search` (recherche complète, nouveau rapport',
      '    et nouveau vecteur archivé) ;',
      '  · seule la **forme** du fichier change (champ déplacé, renommé) → `EQUILIBRAGE_REGENERER=1 npx tsx',
      '    tools/idle-balance/search.ts`, qui régénère depuis le vecteur archivé sans relancer de recherche.',
      "Si la divergence n'était pas voulue : `git checkout -- src/donnees/constantes.ts`.",
    ].join('\n'),
  )
  return 2
}

// Ce module est à la fois une commande et une bibliothèque : `comparerValeurs` est exercée par
// `tests/equilibrage/empreinte.test.ts`, qui ne doit surtout pas déclencher la commande en l'important.
// D'où la garde « exécuté directement ? » plutôt qu'un appel nu.
const executeDirectement = resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)
if (executeDirectement) {
  void principal().then(
    (code) => {
      process.exitCode = code
    },
    (erreur: unknown) => {
      console.error(`equilibrage:empreinte — erreur inattendue : ${String(erreur)}`)
      process.exitCode = 1
    },
  )
}
