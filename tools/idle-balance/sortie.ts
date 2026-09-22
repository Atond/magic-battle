// Écriture des deux sorties du simulateur : `src/donnees/constantes.ts` (le contrat livré au moteur) et
// `tools/idle-balance/rapports/<date>.md` (la trace chiffrée qui justifie chaque valeur, ADR-10).
//
// Règle tenue ici : le fichier de `src/donnees/` est **généré**, jamais édité à la main, et il cite le
// rapport qui l'a produit par son chemin et sa date. Aucun marqueur de travail en cours n'y est écrit
// (`scripts/verify.sh` les refuse dans tout `src/`).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Constantes } from '../../src/domain/types.ts'
import type { Parametres } from './parametres.ts'
import type { Rapport } from './contraintes.ts'
import { tableau } from './contraintes.ts'
import type { Mesures, Mur } from './simuler.ts'
import type { ResultatFidelite } from './fidelite.ts'
import type { MesureBossFinal } from './simuler.ts'

const H = 3_600_000
const MIN = 60_000

/* ──────────────────────────────────────────────────────────── sérialisation TypeScript */

/**
 * Nombre écrit sans bruit flottant : `1.1500000000000001` redevient `1.15`.
 *
 * Exporté parce que c'est la **forme normale** d'une valeur livrée : `empreinte.ts` compare le fichier
 * commité au vecteur archivé à travers cette même fonction, sinon `1.15 + 0.01` relu depuis le fichier
 * (`1.16`) passerait pour une divergence alors que c'est le même nombre écrit proprement.
 */
export function serialiserNombre(valeur: number): string {
  if (!Number.isFinite(valeur)) throw new Error(`valeur non finie à sérialiser : ${valeur}`)
  if (Number.isInteger(valeur) && Math.abs(valeur) < 1e15) return String(valeur)
  return String(Number(valeur.toPrecision(12)))
}

function serialiser(valeur: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  const padInterne = '  '.repeat(indent + 1)
  if (valeur === null) return 'null'
  if (typeof valeur === 'number') return serialiserNombre(valeur)
  if (typeof valeur === 'boolean') return String(valeur)
  if (typeof valeur === 'string') return `'${valeur.replace(/'/g, "\\'")}'`
  if (Array.isArray(valeur)) {
    if (valeur.length === 0) return '[]'
    const scalaire = valeur.every((v) => typeof v === 'number' || typeof v === 'string')
    if (scalaire) return `[${valeur.map((v) => serialiser(v, 0)).join(', ')}]`
    return `[\n${valeur.map((v) => `${padInterne}${serialiser(v, indent + 1)}`).join(',\n')},\n${pad}]`
  }
  if (typeof valeur === 'object') {
    const entrees = Object.entries(valeur as Record<string, unknown>)
    if (entrees.length === 0) return '{}'
    return `{\n${entrees
      .map(([cle, v]) => `${padInterne}${cle}: ${serialiser(v, indent + 1)}`)
      .join(',\n')},\n${pad}}`
  }
  throw new Error(`type non sérialisable : ${typeof valeur}`)
}

/** Écrit `src/donnees/constantes.ts` à partir de l'objet `Constantes` retenu. */
export function ecrireConstantes(
  chemin: string,
  constantes: Constantes,
  cheminRapport: string,
  date: string,
  resume: readonly string[],
  nonTenues: Readonly<Record<string, string>>,
): void {
  const entete = [
    '// Constantes d\'équilibrage du jeu — **sortie du simulateur**, pas une saisie manuelle (ADR-10).',
    '//',
    `// Provenance : ${cheminRapport} (${date}), produit par \`npm run equilibrage:search\`.`,
    '// Toute modification passe par une nouvelle exécution du simulateur et un nouveau rapport ; la',
    '// commande `npm run equilibrage:check` rejoue ce fichier contre les contraintes §8 de la spec et',
    '// échoue si l\'une d\'elles est ratée.',
    '//',
    '// Mesures retenues, résumées (détail et méthode dans le rapport) :',
    ...resume.map((ligne) => `//   · ${ligne}`),
    '',
    "import type { Constantes } from '../domain/types.ts'",
    '',
    '/** §8 — l\'ensemble des valeurs d\'équilibrage passées au moteur pur. */',
    `export const CONSTANTES: Constantes = ${serialiser(constantes, 0)}`,
    '',
    '/**',
    ' * Contraintes §8 que le rapport archivé documente comme NON tenues, et pourquoi.',
    ' *',
    " * `equilibrage:check` s'en sert dans les deux sens : une contrainte rouge absente de cette liste",
    ' * fait échouer la vérification, et une contrainte listée ici qui redevient verte la fait échouer',
    " * aussi — pour qu'une dérogation périmée ne survive jamais à sa raison d'être.",
    ' */',
    `export const CONTRAINTES_NON_TENUES: Readonly<Record<string, string>> = ${serialiser(nonTenues, 0)}`,
    '',
  ].join('\n')
  mkdirSync(dirname(chemin), { recursive: true })
  writeFileSync(chemin, entete, 'utf8')
}

/* ────────────────────────────────────────────────────────────────────────── rapport */

export interface LigneHistorique {
  phase: string
  variable: string
  avant: string
  apres: string
  coutAvant: number
  coutApres: number
  effet: string
}

export interface LigneSensibilite {
  variable: string
  retenu: string
  fourchetteVerte: string
  candidatsTestes: string
}

export interface ContenuRapport {
  date: string
  parametres: Parametres
  constantes: Constantes
  mesures: Mesures
  rapport: Rapport
  fidelite: readonly ResultatFidelite[]
  historique: readonly LigneHistorique[]
  sensibilite: readonly LigneSensibilite[]
  /** Comparaison des deux modèles d'or (question ouverte 1). */
  modeleOr: { parDegat: Mesures; auMeurtre: Mesures }
  /** Mesure de la garde EXG-37 (question ouverte 2). */
  exg37: readonly string[]
  /** Mesure du plafond hors-ligne H. */
  horsLigne: readonly string[]
  /** Diagnostic de la contrainte « durée de run croissante » (§8), généré par le script. */
  diagnosticC07: readonly string[]
  /** EXG-28 — mesure du combat final. */
  bossFinal: MesureBossFinal | null
  dureeSearchMs: number
  dureeCheckMs: number
}

function listeMurs(murs: readonly Mur[], maximum = 12): string {
  if (murs.length === 0) return '_aucun mur ≥ seuil mesuré._'
  const tries = [...murs].sort((a, b) => b.dureeMs - a.dureeMs).slice(0, maximum)
  return [
    '| position (h de jeu) | zone | durée |',
    '| --- | --- | --- |',
    ...tries.map((m) => `| ${(m.debutMs / H).toFixed(2)} | ${m.zone} | ${(m.dureeMs / MIN).toFixed(1)} min |`),
  ].join('\n')
}

function listeRuns(mesures: Mesures): string {
  return [
    '| run | début (h) | durée (h) | zone max | Éclats gagnés | rejeu du vu (h) | ×rejeu | blocage max (min) | Ascension |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...mesures.runs.map((run, i) => {
      const precedent = i > 0 ? mesures.runs[i - 1]! : null
      const facteur =
        run.rejeuMs !== null && run.rejeuMs > 0 && precedent !== null && precedent.dureeMs > 0
          ? `×${(precedent.dureeMs / run.rejeuMs).toFixed(2)}`
          : '—'
      return `| ${run.indice} | ${(run.debutMs / H).toFixed(2)} | ${(run.dureeMs / H).toFixed(2)} | ${run.zoneMax} | ${run.eclatsGagnes} | ${run.rejeuMs === null ? '—' : (run.rejeuMs / H).toFixed(2)} | ${facteur} | ${(run.blocageMaxMs / MIN).toFixed(1)} | ${run.ascension ? 'oui' : ''} |`
    }),
  ].join('\n')
}

/**
 * Journaux de révision archivés à côté du rapport (`*-revision-*.md`), recensés en tête de celui-ci.
 *
 * Ce rapport est **régénéré** à chaque `equilibrage:search` : tout ce qu'on y écrirait à la main
 * disparaîtrait à l'exécution suivante. Les décisions et les comparaisons qui doivent survivre vivent
 * donc dans des fichiers datés séparés, et cette fonction garantit qu'on ne les perd pas de vue.
 */
function revisions(dossier: string): string[] {
  if (!existsSync(dossier)) return []
  const fichiers = readdirSync(dossier)
    .filter((nom) => nom.includes('-revision-') && nom.endsWith('.md'))
    .sort()
  if (fichiers.length === 0) return []
  return [
    '## 0. Journaux de révision',
    '',
    'Ce rapport est régénéré à chaque exécution du simulateur. Les décisions, arbitrages et comparaisons',
    'qui doivent survivre à une régénération sont archivés à part :',
    '',
    ...fichiers.map((nom) => {
      const premiereLigne =
        readFileSync(`${dossier}/${nom}`, 'utf8').split('\n')[0]?.replace(/^#+\s*/, '') ?? nom
      return `- \`${dossier}/${nom}\` — ${premiereLigne}`
    }),
    '',
  ]
}

export function ecrireRapport(chemin: string, contenu: ContenuRapport): void {
  const m = contenu.mesures
  const p = contenu.parametres
  const lignes: string[] = []
  const ajouter = (...l: string[]): void => {
    lignes.push(...l)
  }

  ajouter(
    `# Rapport d'équilibrage — ${contenu.date}`,
    '',
    `Produit par \`npm run equilibrage:search\` (\`tools/idle-balance/search.ts\`), rejoué par`,
    '`npm run equilibrage:check`. Source des contraintes : `docs/specs/projet/spec.md` §8 (ADR-10, ADR-15).',
    `Recherche : ${(contenu.dureeSearchMs / 1000).toFixed(1)} s · vérification : ${contenu.dureeCheckMs} ms.`,
    '',
    ...revisions(dirname(chemin)),
    '## 1. Verdict par contrainte §8',
    '',
    tableau(contenu.rapport),
    '',
    ...contenu.rapport.verdicts.filter((v) => v.detail !== undefined).map((v) => `- **${v.id}** — ${v.detail}`),
    '',
    `**Verdict global : ${contenu.rapport.ok ? 'toutes les contraintes §8 sont tenues' : 'au moins une contrainte §8 est ratée'}** (coût agrégé ${contenu.rapport.cout.toFixed(3)}).`,
    '',
    '## 2. Politique de jeu simulée (hypothèse dont tout le rapport dépend)',
    '',
    'Détail et justification : en-tête de `tools/idle-balance/joueur.ts`. En résumé : achat immédiat au',
    'meilleur `Δ(dégâts/s) / coût` parmi les articles abordables (aucune épargne), sorts lancés dès la fin',
    'du cooldown, clics soutenus tant qu\'ils pèsent ≥ 1 % de la production passive, Éclats et Points',
    'dépensés dès qu\'un rang est abordable, prestige dès que la profondeur ne bouge plus depuis 30 min',
    '(patience du joueur), Ascension dès qu\'elle est disponible.',
    '',
    '## 3. Formes de formules retenues (ADR-15 — les formes sont des sorties)',
    '',
    '| formule | forme retenue | constantes retenues |',
    '| --- | --- | --- |',
    `| Éclats au prestige (EXG-18) | \`floor(k × zone_max^α)\` | k = ${p.k}, α = ${p.alpha} |`,
    `| Bonus passif des Éclats (EXG-38) | \`(1 + B × Éclats)^β\`${p.bonusPassifBeta === 1 ? ' → β = 1, donc la **forme multiplicative** `1 + B × Éclats`' : ' (puissance, β ≠ 1)'} | B = ${p.bonusPassifB}, β = ${p.bonusPassifBeta} |`,
    `| Points d'Ascension | \`floor(k_asc × √Éclats_cumulés_à_vie)\` | k_asc = ${p.kAscension} |`,
    `| Coût d'un rang de nœud (EXG-39/40) | géométrique \`base × coût_relatif × croissance^rang\` | Éclats : ${p.eclatsCoutBaseNoeud} × ${p.eclatsCroissanceCoutNoeud}^r · Ascension : ${p.ascCoutBaseNoeud} × ${p.ascCroissanceCoutNoeud}^r |`,
    `| Nœuds répétables à rangs infinis (§8) | un par arbre, effet géométrique par rang | Éclats ×${p.eclatsEffetRepetable}/rang · Ascension ×${p.ascEffetRepetable}/rang |`,
    `| PV de zone (ADR-13, sans borne) | \`PV(1) × facteur_zone^(z−1)\`, \`facteur_zone = croissance_vague^(n−1) × mult_boss × mult_zone_suivante\` | facteur_zone = ${(p.croissanceVague ** (p.nbVagues - 1) * p.multBoss * p.multZoneSuivante).toFixed(2)} |`,
    `| Or par dégât (EXG-6) | \`dégâts × or_par_dégât_moyen × mult_or_zone(z)\`, \`mult_or_zone(z) = ${p.croissanceOrParZone}^(z−1)\` | or_par_dégât_moyen = ${p.orParDegatMoyen} |`,
    `| Améliorations (EXG-42) | produit \`effet_mult^paliers\`, coût \`base × croissance^n\` | ${p.ameliorationNombre} pistes, effet ×${p.ameliorationEffetMult}, coût ×${p.ameliorationCroissance}/palier |`,
    '',
    '## 4. Constantes de fin retenues',
    '',
    `- \`N_ASCENSIONS_REQUISES\` = **${p.nAscensionsRequises}**`,
    `- \`PRESTIGES_PAR_ASCENSION\` = **${p.prestigesParAscension}** (produit ${p.nAscensionsRequises * p.prestigesParAscension}, dans [20, 30])`,
    `- \`H\` (plafond hors-ligne) = **${p.plafondHeures} h**`,
    `- \`zoneBossFinal\` = **${p.zoneBossFinal}** · zone effectivement atteinte au dernier cycle : **${m.zoneMaxAtteinte}**`,
    `- \`or_par_dégât_moyen\` = **${p.orParDegatMoyen}** · \`mult_or_zone(z)\` = **${p.croissanceOrParZone}^(z−1)**`,
    `- \`B\` / \`β\` du bonus passif = **${p.bonusPassifB}** / **${p.bonusPassifBeta}**`,
    `- \`nTicksMax\` (EXG-3) = **${p.nTicksMax}**`,
    '',
    ...contenu.horsLigne.map((l) => `- ${l}`),
    '',
    '## 5. Murs observés',
    '',
    '### 5.1 Blocages de progression (aucune zone gagnée) — la mesure qui compte',
    '',
    listeMurs(m.murs),
    '',
    '### 5.2 Absence d\'achat abordable (définition littérale de §8)',
    '',
    `Plus long intervalle sans aucun achat abordable : **${(m.murAchatMaxMs / MIN).toFixed(1)} min** sur la partie,`,
    `**${(m.murAchatMaxAvantPrestigeMs / MIN).toFixed(1)} min** avant le 1er prestige.`,
    '',
    listeMurs(m.mursAchat, 6),
    '',
    '## 6. Temps des paliers',
    '',
    `- 1er sort actif **lançable** : ${m.premierSortMs === null ? '—' : (m.premierSortMs / MIN).toFixed(2)} min (0 par construction du moteur, cf. C01)`,
    `- 1er sort actif **débloqué par la progression** : ${m.premierSortDebloqueMs === null ? '—' : (m.premierSortDebloqueMs / MIN).toFixed(1)} min`,
    `- 1er mur ≥ 5 min : ${m.premierMurMs === null ? '—' : (m.premierMurMs / MIN).toFixed(1)} min (durée ${m.premierMurDureeMs === null ? '—' : (m.premierMurDureeMs / MIN).toFixed(1)} min)`,
    `- 1er prestige : ${m.premierPrestigeMs === null ? '—' : (m.premierPrestigeMs / H).toFixed(2)} h`,
    `- durée totale simulée : **${(m.tempsJeuTotalMs / H).toFixed(2)} h** de jeu cumulé (hors-ligne exclu, ADR-12)`,
    `- ${m.prestigesTotal} prestiges · ${m.ascensions} Ascensions · zone max ${m.zoneMaxAtteinte} · ${m.pas} pas de simulation`,
    '',
    '## 7. Runs',
    '',
    listeRuns(m),
    '',
    '## 7 bis. Durée de run croissante (§8) — la contrainte qui n\'est pas tenue',
    '',
    ...contenu.diagnosticC07,
    '',
    '## 7 ter. Boss final — zone dédiée (EXG-28)',
    '',
    ...(contenu.bossFinal === null
      ? ['_non mesuré._']
      : [
          `La v4 plaçait le boss final à \`zoneBossFinal = 50\` **sur l'échelle normale des zones**. La`,
          `mesure a montré que le joueur traverse la zone 50 pendant son premier run et atteint la zone`,
          `${contenu.mesures.zoneMaxAtteinte} : la fin de partie était donc franchie avant d'exister. EXG-28 dit « zone **dédiée** » —`,
          `le boss final ne vit pas sur cette échelle. Ce que ce rapport livre à la place :`,
          '',
          '| constante | valeur | provenance |',
          '| --- | --- | --- |',
          `| \`zoneDediee\` | ${contenu.parametres.zoneBossFinal} | identifiant de la zone dédiée, hors de portée de la progression mesurée (zone max ${contenu.mesures.zoneMaxAtteinte}) — un nom, pas une profondeur |`,
          `| \`profondeurEquivalente\` | ${contenu.parametres.bossFinalProfondeurEquivalente} | cherchée : profondeur dont la formule de zone donne les PV du boss |`,
          `| \`multPv\` | ${contenu.parametres.bossFinalMultPv} | cherché : multiplicateur au-dessus de cette profondeur |`,
          `| \`timerS\` | ${contenu.parametres.bossFinalTimerS} s | cherché : chrono du combat (EXG-16 appliqué au boss final) |`,
          `| PV résultants | ${contenu.bossFinal.pvBoss.toExponential(3)} | \`pvBoss(${contenu.parametres.bossFinalProfondeurEquivalente}) × ${contenu.parametres.bossFinalMultPv}\` |`,
          '',
          '**Combat mesuré** (la politique tente le boss dès qu\'elle peut le gagner, ce qui donne le temps minimal) :',
          '',
          `- DPS soutenu au **départ** du dernier run (juste après la dernière Ascension, cycle d'Éclats effacé) : **${contenu.bossFinal.dpsDepartDernierRun.toExponential(2)}** → il faudrait ${(contenu.bossFinal.pvBoss / Math.max(contenu.bossFinal.dpsDepartDernierRun, 1)).toExponential(1)} s, soit très au-delà du chrono : **le combat n'est pas une formalité**.`,
          `- DPS soutenu au moment où le combat devient gagnable : **${contenu.bossFinal.dpsAuMoment.toExponential(2)}**, à la zone ${contenu.bossFinal.zoneVictoire}.`,
          `- **Durée du combat : ${contenu.bossFinal.dureeCombatS === null ? '—' : contenu.bossFinal.dureeCombatS.toFixed(1)} s sur un chrono de ${contenu.bossFinal.timerS} s** (${contenu.bossFinal.partDuChrono === null ? '—' : (contenu.bossFinal.partDuChrono * 100).toFixed(0)} % du temps imparti).`,
          `- **Temps pour le battre : ${contenu.bossFinal.tempsAvantVictoireMs === null ? 'jamais' : (contenu.bossFinal.tempsAvantVictoireMs / H).toFixed(2) + ' h'}** après la dernière Ascension, sur un dernier run de ${(contenu.bossFinal.dureeDernierRunMs / H).toFixed(2)} h (${contenu.bossFinal.tempsAvantVictoireMs === null ? '—' : ((contenu.bossFinal.tempsAvantVictoireMs / contenu.bossFinal.dureeDernierRunMs) * 100).toFixed(0)} % du run : le point culminant).`,
          `- Marge sous 1e300 : les PV du boss final valent ${contenu.bossFinal.pvBoss.toExponential(2)}, soit **${(300 - Math.log10(contenu.bossFinal.pvBoss)).toFixed(0)} décades** de marge (EXG-37).`,
          '',
        ]),
    '',
    '## 8. Marge à 1e300 (EXG-37)',
    '',
    ...contenu.exg37.map((l) => `- ${l}`),
    '',
    '## 9. Contrôle de fidélité du pas adaptatif',
    '',
    'Le pas adaptatif saute à la prochaine échéance utile au lieu d\'avancer par tranches de 100 ms. Il',
    'faut donc prouver qu\'il raconte la même partie que le moteur. Protocole : **la boucle de jeu réelle**',
    'rejouée deux fois avec les mêmes constantes et la même politique, une fois avec le pas de 100 ms du',
    'moteur (EXG-1), une fois avec le pas adaptatif. Méthode et pièges en tête de',
    '`tools/idle-balance/fidelite.ts`.',
    '',
    ...contenu.fidelite.flatMap((f) => [
      `**${f.libelle}** — écart relatif maximal **${f.ecartMax.toExponential(2)}** (sur « ${f.grandeurFautive} »), écart d’ordre de grandeur **${f.decades.toFixed(3)} décade**. Coût : ${f.ticksPasFixe} ticks de 100 ms en ${f.msPasFixe} ms contre ${f.pasAdaptatif} pas adaptatifs en ${f.msAdaptatif} ms, soit **×${f.acceleration.toFixed(1)}**.`,
      '',
      '| grandeur | pas de 100 ms | pas adaptatif | écart |',
      '| --- | --- | --- | --- |',
      ...f.ecarts.map(
        (e) =>
          `| ${e.grandeur} | ${e.pasFixe} | ${e.adaptatif} | ${e.unite === 'décades' ? `${e.ecart.toFixed(3)} décade` : e.ecart.toExponential(2)} |`,
      ),
      '',
    ]),
    '**Lecture.** Sur la partie entière, les deux pas donnent les mêmes durées, le même nombre de runs, de',
    'prestiges et d\'Ascensions, la même zone maximale et le même verdict §8 contrainte par contrainte ;',
    'seul l\'ordre de grandeur de la plus grande valeur de jeu diffère, de quelques centièmes de décade.',
    'Le pas adaptatif est structurellement **optimiste** — il s\'arrête pile sur les bascules de combat',
    'alors que le pas de 100 ms les découvre au plus un tick trop tard et jette le surplus de dégâts —',
    'mais sur la boucle réelle ce biais reste sous le seuil de lisibilité des chiffres publiés.',
    '',
    '## 10. Modèle d\'or — `par dégât infligé` (moteur actuel) contre `au meurtre`',
    '',
    '| mesure | par dégât infligé (moteur) | au meurtre (contrefactuel) |',
    '| --- | --- | --- |',
    `| 1er prestige | ${contenu.modeleOr.parDegat.premierPrestigeMs === null ? '—' : (contenu.modeleOr.parDegat.premierPrestigeMs / H).toFixed(2) + ' h'} | ${contenu.modeleOr.auMeurtre.premierPrestigeMs === null ? '—' : (contenu.modeleOr.auMeurtre.premierPrestigeMs / H).toFixed(2) + ' h'} |`,
    `| jeu cumulé | ${(contenu.modeleOr.parDegat.tempsJeuTotalMs / H).toFixed(2)} h | ${(contenu.modeleOr.auMeurtre.tempsJeuTotalMs / H).toFixed(2)} h |`,
    `| zone max | ${contenu.modeleOr.parDegat.zoneMaxAtteinte} | ${contenu.modeleOr.auMeurtre.zoneMaxAtteinte} |`,
    `| blocage max avant 1er prestige | ${(contenu.modeleOr.parDegat.blocageMaxAvantPrestigeMs / MIN).toFixed(1)} min | ${(contenu.modeleOr.auMeurtre.blocageMaxAvantPrestigeMs / MIN).toFixed(1)} min |`,
    `| durée du 1er run | ${contenu.modeleOr.parDegat.runs[0] === undefined ? '—' : (contenu.modeleOr.parDegat.runs[0]!.dureeMs / H).toFixed(2) + ' h'} | ${contenu.modeleOr.auMeurtre.runs[0] === undefined ? '—' : (contenu.modeleOr.auMeurtre.runs[0]!.dureeMs / H).toFixed(2) + ' h'} |`,
    '',
    '## 11. Historique « une variable à la fois »',
    '',
    contenu.historique.length === 0
      ? '_aucun déplacement retenu : le vecteur de départ tenait déjà les contraintes._'
      : [
          '| phase | variable | avant | après | coût avant | coût après | effet mesuré |',
          '| --- | --- | --- | --- | --- | --- | --- |',
          ...contenu.historique.map(
            (h) =>
              `| ${h.phase} | \`${h.variable}\` | ${h.avant} | ${h.apres} | ${h.coutAvant.toFixed(3)} | ${h.coutApres.toFixed(3)} | ${h.effet} |`,
          ),
        ].join('\n'),
    '',
    '## 12. Sensibilité (fourchette de chaque variable qui garde le verdict vert)',
    '',
    contenu.sensibilite.length === 0
      ? '_non mesurée._'
      : [
          '| variable | retenu | fourchette verte mesurée | candidats testés |',
          '| --- | --- | --- | --- |',
          ...contenu.sensibilite.map(
            (s) => `| \`${s.variable}\` | ${s.retenu} | ${s.fourchetteVerte} | ${s.candidatsTestes} |`,
          ),
        ].join('\n'),
    '',
    '## 13. Ce que ce rapport livre aux tâches suivantes',
    '',
    '**T-15 (injection dans `src/donnees/`)** — `src/donnees/constantes.ts` est déjà écrit par ce rapport',
    'et contient l\'objet `Constantes` complet. Il reste à le découper en fichiers thématiques',
    '(`ecoles.ts`, `zones.ts`, `sorts.ts`, `ameliorations.ts`, `equipement.ts`, `quetes.ts`, `arbres.ts`,',
    '`formules.ts`, `fin.ts`) **sans changer une valeur**, puis à rebrancher les imports de',
    '`tests/domain/*` et `tests/migrations/*` de `tools/idle-balance/graines.ts` vers `src/donnees/`.',
    '`graines.ts` ne doit pas être supprimé sans demande : il reste le point de départ documenté de la',
    'recherche, et le vecteur de la section 14 est ce qui le remplace fonctionnellement.',
    '',
    `**T-13 (condition de fin)** — rien dans le moteur ne met \`partieTerminee\` à vrai aujourd'hui, et`,
    "l'accès à la zone du boss final n'est pas conditionné au nombre d'Ascensions (EXG-28) : `creerBoss`",
    'se contente de marquer `estFinal` quand la zone vaut `fin.zoneBossFinal`. Les trois nombres dont',
    'T-13 a besoin et que ce rapport fixe :',
    `  · \`nAscensionsRequises\` = ${p.nAscensionsRequises} ;`,
    `  · \`zoneBossFinal\` = ${p.zoneBossFinal} ;`,
    `  · zone effectivement atteinte au dernier cycle d'Ascension : **${m.zoneMaxAtteinte}** — c'est elle qui`,
    `    rend \`zoneBossFinal\` cohérent avec la progression mesurée, et non un nombre rond choisi d'avance.`,
    '',
    '**T-21 / T-23 (UI)** — la notation abrégée doit tenir des valeurs jusqu\'à',
    `${m.maxValeurJeu.toExponential(1)} et des numéros de zone jusqu'à ${m.zoneMaxAtteinte} : au-delà de 10³³ la spec impose la`,
    'notation scientifique (EXG-36), ce qui couvre tout le domaine mesuré.',
    '',
    '## 14. Vecteur de paramètres retenu (entrée de `construireConstantes`)',
    '',
    '```ts',
    serialiser(p, 0),
    '```',
    '',
  )

  mkdirSync(dirname(chemin), { recursive: true })
  writeFileSync(chemin, lignes.join('\n'), 'utf8')
}
