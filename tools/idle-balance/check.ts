// `npm run equilibrage:check` — rejoue **uniquement** les constantes déjà archivées contre les
// contraintes §8, et échoue si l'une d'elles est ratée.
//
// Contrat de vitesse : cette commande tourne dans `scripts/verify.sh` ET dans le hook Stop, donc à
// chaque fin de tour d'agent. Budget : < 10 s. Elle ne cherche rien, ne balaie rien, n'écrit rien.
// La recherche de nouvelles constantes est `equilibrage:search`, manuelle.
//
// Usage : `tsx tools/idle-balance/check.ts [module-de-constantes]`
//   défaut : `src/donnees/constantes.ts`
//   ex.    : `tsx tools/idle-balance/check.ts tools/idle-balance/fixtures/desequilibre.ts`
// Sortie : 0 si tout est vert, 2 si une contrainte §8 est ratée, 1 si le module est illisible.

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import type { Constantes } from '../../src/domain/types.ts'
import { tableau, verifier } from './contraintes.ts'
import { simulerPartie, type OptionsSimulation } from './simuler.ts'

const BUDGET_MS = 10_000
const DEFAUT = 'src/donnees/constantes.ts'

/** Charge un module de constantes : l'objet `Constantes` et les dérogations §8 qu'il documente. */
async function chargerConstantes(chemin: string): Promise<{
  constantes: Constantes
  nonTenues: Readonly<Record<string, string>>
  bossFinal: OptionsSimulation['bossFinal']
}> {
  const module = (await import(pathToFileURL(resolve(chemin)).href)) as Record<string, unknown>
  const candidat = module['CONSTANTES'] ?? module['default']
  if (candidat === undefined || typeof candidat !== 'object' || candidat === null) {
    throw new Error(`\`${chemin}\` n'exporte ni \`CONSTANTES\` ni export par défaut exploitable.`)
  }
  const nonTenues = module['CONTRAINTES_NON_TENUES']
  // EXG-28 — les constantes de la zone dédiée du boss final sont exportées à côté de `CONSTANTES` :
  // le type `ConstantesFin` ne les porte pas encore (T-13). Absentes, la contrainte C13 échoue.
  const boss = module['BOSS_FINAL']
  return {
    constantes: candidat as Constantes,
    nonTenues:
      typeof nonTenues === 'object' && nonTenues !== null
        ? (nonTenues as Readonly<Record<string, string>>)
        : {},
    bossFinal:
      typeof boss === 'object' && boss !== null
        ? (boss as OptionsSimulation['bossFinal'])
        : undefined,
  }
}

async function principal(): Promise<number> {
  const chemin = process.argv[2] ?? DEFAUT
  const debut = Date.now()

  let constantes: Constantes
  let nonTenues: Readonly<Record<string, string>>
  let bossFinal: OptionsSimulation['bossFinal']
  try {
    const charge = await chargerConstantes(chemin)
    constantes = charge.constantes
    nonTenues = charge.nonTenues
    bossFinal = charge.bossFinal
  } catch (erreur) {
    console.error(`equilibrage:check — impossible de charger les constantes : ${String(erreur)}`)
    return 1
  }

  const mesures = simulerPartie(constantes, { bossFinal })
  const rapport = verifier(constantes, mesures)
  const duree = Date.now() - debut

  console.log(`equilibrage:check — ${chemin}`)
  console.log(tableau(rapport))

  // Trois cas, et c'est ce tri qui fait de cette commande un garde-fou de non-régression plutôt qu'un
  // simple thermomètre :
  //  · rouge non documenté  → régression, échec ;
  //  · rouge documenté      → affiché en clair à chaque exécution, n'échoue pas ;
  //  · vert mais documenté  → la dérogation a survécu à sa raison, échec (elle doit être retirée).
  const regressions: string[] = []
  const derogationsPerimees: string[] = []
  for (const verdict of rapport.verdicts) {
    const documentee = Object.prototype.hasOwnProperty.call(nonTenues, verdict.id)
    if (!verdict.ok && !documentee) {
      regressions.push(
        `  RÉGRESSION ${verdict.id} — ${verdict.libelle} : mesuré ${verdict.mesure}, cible ${verdict.cible}${verdict.detail === undefined ? '' : ` (${verdict.detail})`}`,
      )
    } else if (!verdict.ok && documentee) {
      console.log(`  ÉCHEC DOCUMENTÉ ${verdict.id} — mesuré ${verdict.mesure}, cible ${verdict.cible}`)
      console.log(`    ${nonTenues[verdict.id]}`)
    } else if (verdict.ok && documentee) {
      derogationsPerimees.push(
        `  DÉROGATION PÉRIMÉE ${verdict.id} — la contrainte est redevenue verte (${verdict.mesure}) : retirer l'entrée de \`CONTRAINTES_NON_TENUES\`.`,
      )
    }
  }
  console.log(
    `durée ${duree} ms (budget ${BUDGET_MS} ms) · ${mesures.pas} pas · ${(mesures.tempsJeuTotalMs / 3_600_000).toFixed(2)} h de jeu simulé`,
  )

  if (duree > BUDGET_MS) {
    console.error(
      `equilibrage:check — budget de temps dépassé : ${duree} ms > ${BUDGET_MS} ms. Cette commande tourne dans verify.sh et dans le hook Stop, elle doit rester sous 10 s.`,
    )
    return 2
  }
  if (regressions.length > 0 || derogationsPerimees.length > 0) {
    for (const ligne of [...regressions, ...derogationsPerimees]) console.error(ligne)
    console.error(
      `equilibrage:check — ${regressions.length} régression(s) et ${derogationsPerimees.length} dérogation(s) périmée(s). Relancer \`npm run equilibrage:search\` et archiver un nouveau rapport (ADR-10).`,
    )
    return 2
  }
  const documentees = Object.keys(nonTenues).length
  console.log(
    documentees === 0
      ? 'equilibrage:check — toutes les contraintes §8 sont tenues.'
      : `equilibrage:check — aucune régression ; ${documentees} contrainte(s) §8 restent documentées comme non tenues (voir ci-dessus).`,
  )
  return 0
}

principal().then(
  (code) => {
    process.exitCode = code
  },
  (erreur: unknown) => {
    console.error(`equilibrage:check — erreur inattendue : ${String(erreur)}`)
    process.exitCode = 1
  },
)
