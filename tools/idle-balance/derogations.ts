// Tri des verdicts §8 face à la table des dérogations (`CONTRAINTES_NON_TENUES`).
//
// C'est ce tri qui fait d'`equilibrage:check` un garde-fou de non-régression plutôt qu'un thermomètre.
// Il est ici, pur et sans entrée/sortie, parce qu'un vérificateur qu'on n'a jamais vu échouer ne
// vérifie rien (LRN-002) : une fonction qui prend des verdicts et une table et rend un classement se
// teste avec des verdicts fabriqués, en millisecondes, sans simuler 72 h de jeu. `check.ts` ne garde
// que le chargement du module, la simulation et l'affichage.
//
// Quatre cas, et chacun a sa raison d'exister :
//   · rouge non documenté  → régression, échec ;
//   · rouge documenté      → affiché en clair à chaque exécution, n'échoue pas ;
//   · vert mais documenté  → la dérogation a survécu à sa raison, échec (elle doit être retirée) ;
//   · clé sans verdict     → faute de frappe (`C7` pour `C07`), échec : avalée en silence, elle
//                            transformait la dérogation en no-op et masquait la contrainte visée.

import type { Verdict } from './contraintes.ts'

export interface EchecDocumente {
  verdict: Verdict
  justification: string
}

export interface TriDerogations {
  /** Rouges non documentés : régressions franches. */
  regressions: readonly Verdict[]
  /** Rouges documentés : tolérés, mais réaffichés à chaque exécution. */
  echecsDocumentes: readonly EchecDocumente[]
  /** Verts encore listés : dérogations périmées, à retirer. */
  derogationsPerimees: readonly Verdict[]
  /** Clés de la table qui ne correspondent à aucun `verdict.id`. */
  clesOrphelines: readonly string[]
  /** Vrai si l'un des trois cas bloquants est présent. */
  bloquant: boolean
}

/** Lecture sûre de la table : `hasOwnProperty` et non `in`, pour ne pas hériter de `Object.prototype`. */
function documentee(nonTenues: Readonly<Record<string, string>>, id: string): boolean {
  return Object.prototype.hasOwnProperty.call(nonTenues, id)
}

export function trierDerogations(
  verdicts: readonly Verdict[],
  nonTenues: Readonly<Record<string, string>>,
): TriDerogations {
  const regressions: Verdict[] = []
  const echecsDocumentes: EchecDocumente[] = []
  const derogationsPerimees: Verdict[] = []

  for (const verdict of verdicts) {
    const listee = documentee(nonTenues, verdict.id)
    if (!verdict.ok && !listee) regressions.push(verdict)
    else if (!verdict.ok && listee) {
      echecsDocumentes.push({ verdict, justification: nonTenues[verdict.id] ?? '' })
    } else if (verdict.ok && listee) derogationsPerimees.push(verdict)
  }

  const connus = new Set(verdicts.map((v) => v.id))
  const clesOrphelines = Object.keys(nonTenues).filter((cle) => !connus.has(cle))

  return {
    regressions,
    echecsDocumentes,
    derogationsPerimees,
    clesOrphelines,
    bloquant: regressions.length > 0 || derogationsPerimees.length > 0 || clesOrphelines.length > 0,
  }
}

/** Lignes à afficher sur la sortie normale : les rouges tolérés et leur justification. */
export function lignesInformatives(tri: TriDerogations): string[] {
  return tri.echecsDocumentes.flatMap(({ verdict, justification }) => [
    `  ÉCHEC DOCUMENTÉ ${verdict.id} — mesuré ${verdict.mesure}, cible ${verdict.cible}`,
    `    ${justification}`,
  ])
}

/** Lignes à afficher sur la sortie d'erreur, une par motif d'échec. */
export function lignesBloquantes(tri: TriDerogations): string[] {
  return [
    ...tri.regressions.map(
      (v) =>
        `  RÉGRESSION ${v.id} — ${v.libelle} : mesuré ${v.mesure}, cible ${v.cible}${v.detail === undefined ? '' : ` (${v.detail})`}`,
    ),
    ...tri.derogationsPerimees.map(
      (v) =>
        `  DÉROGATION PÉRIMÉE ${v.id} — la contrainte est redevenue verte (${v.mesure}) : retirer l'entrée de \`CONTRAINTES_NON_TENUES\`.`,
    ),
    ...tri.clesOrphelines.map(
      (cle) =>
        `  CLÉ ORPHELINE « ${cle} » — aucune contrainte §8 ne porte cet identifiant (faute de frappe ? \`C7\` pour \`C07\` ?). Cette dérogation ne protège rien et masque la contrainte qu'elle visait.`,
    ),
  ]
}

/** Phrase de conclusion quand le tri bloque. */
export function conclusionBloquante(tri: TriDerogations): string {
  return `equilibrage:check — ${tri.regressions.length} régression(s), ${tri.derogationsPerimees.length} dérogation(s) périmée(s), ${tri.clesOrphelines.length} clé(s) orpheline(s). Relancer \`npm run equilibrage:search\` et archiver un nouveau rapport (ADR-10).`
}
