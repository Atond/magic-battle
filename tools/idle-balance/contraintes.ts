// Contraintes §8 — un verdict **chiffré** par contrainte : valeur mesurée, cible, écart. Jamais un
// booléen seul : un vérificateur qui répond « faux » sans dire de combien ne sert à rien pour régler.
//
// Ce fichier est la définition unique des critères d'échec du projet. `check.ts` le rejoue contre les
// constantes archivées (dans `verify.sh` et le hook Stop), `search.ts` s'en sert de fonction objectif.

import type { Constantes } from '../../src/domain/types.ts'
import { noeudsDeLArbre } from '../../src/domain/prestige/arbre.ts'
import type { Mesures } from './simuler.ts'

const MIN = 60_000
const H = 3_600_000

export interface Verdict {
  id: string
  libelle: string
  /** Valeur mesurée, formatée pour le rapport. */
  mesure: string
  /** Cible §8, formatée. */
  cible: string
  /** Écart relatif signé à la cible la plus proche (0 = dans la cible). */
  ecart: number
  ok: boolean
  /** Précision facultative (position d'un mur, run fautif…). */
  detail?: string
}

function mn(ms: number | null): string {
  return ms === null ? '—' : `${(ms / MIN).toFixed(1)} min`
}
function hh(ms: number | null): string {
  return ms === null ? '—' : `${(ms / H).toFixed(2)} h`
}

/** Écart relatif d'une valeur à un intervalle : 0 dedans, signé dehors. */
function ecartIntervalle(valeur: number | null, bas: number, haut: number): number {
  if (valeur === null) return -1
  if (valeur < bas) return (valeur - bas) / bas
  if (valeur > haut) return (valeur - haut) / haut
  return 0
}

/* ───────────────────────────────────────────────────────────────── contraintes une à une */

/** §8 — « 1er sort actif ~5 min ». Mesuré sur le 1er sort dont le déblocage dépend des constantes. */
export function c01PremierSort(m: Mesures): Verdict {
  const bas = 3 * MIN
  const haut = 10 * MIN
  const ecart = ecartIntervalle(m.premierSortDebloqueMs, bas, haut)
  return {
    id: 'C01',
    libelle: '1er sort actif débloqué (§8 ~5 min)',
    mesure: mn(m.premierSortDebloqueMs),
    cible: '3 à 10 min',
    ecart,
    ok: ecart === 0,
    detail: `le sort de l'école de départ répond dès 0 s (moteur : \`etatInitial\` livre le Feu débloqué, EXG-9) — non pilotable par les constantes`,
  }
}

/** §8 — « 1er mur ~1 h » : début du premier blocage de profondeur d'au moins 5 min. */
export function c02PremierMur(m: Mesures): Verdict {
  const bas = 30 * MIN
  const haut = 90 * MIN
  const ecart = ecartIntervalle(m.premierMurMs, bas, haut)
  return {
    id: 'C02',
    libelle: '1er mur de progression (§8 ~1 h)',
    mesure: mn(m.premierMurMs),
    cible: '30 à 90 min',
    ecart,
    ok: ecart === 0,
    detail: m.premierMurDureeMs === null ? undefined : `durée ${mn(m.premierMurDureeMs)}`,
  }
}

/** §8 — « 1er prestige en 2-3 h » (contrainte dure). */
export function c03PremierPrestige(m: Mesures): Verdict {
  const ecart = ecartIntervalle(m.premierPrestigeMs, 2 * H, 3 * H)
  return {
    id: 'C03',
    libelle: '1er prestige (§8 2-3 h)',
    mesure: hh(m.premierPrestigeMs),
    cible: '2 à 3 h',
    ecart,
    ok: ecart === 0,
  }
}

/**
 * §8 v5 — « aucun **blocage de progression** > 90 min avant le 1er prestige », où un blocage est un
 * intervalle sans aucune zone gagnée. Le mur au sens littéral « aucun achat abordable » est mesuré
 * séparément comme **garde secondaire à 15 min** : la question ouverte §14 a été fermée par les mesures
 * de T-14 (il ne dépasse jamais 0,5 min, donc il ne mesure rien tout seul). ADR-17.
 */
export function c04BlocageAvantPrestige(m: Mesures): Verdict {
  const plafondBlocage = 90 * MIN
  const plafondAchat = 15 * MIN
  const blocage = m.blocageMaxAvantPrestigeMs
  const achat = m.murAchatMaxAvantPrestigeMs
  const okBlocage = blocage <= plafondBlocage
  const okAchat = achat <= plafondAchat
  const ecart = Math.max(
    okBlocage ? 0 : (blocage - plafondBlocage) / plafondBlocage,
    okAchat ? 0 : (achat - plafondAchat) / plafondAchat,
  )
  return {
    id: 'C04',
    libelle: 'blocage de progression ≤ 90 min avant le 1er prestige (§8 v5)',
    mesure: mn(blocage),
    cible: '≤ 90 min',
    ecart,
    ok: okBlocage && okAchat,
    detail: `garde secondaire « aucun achat abordable » : ${mn(achat)} (seuil 15 min, ${okAchat ? 'tenu' : 'dépassé'})`,
  }
}

/** §8 — contrainte dure `20 ≤ N × P ≤ 30`, avec `N ∈ [3,5]` Ascensions et `P ∈ [5,8]` prestiges. */
export function c05CoupleFin(constantes: Constantes): Verdict {
  const n = constantes.fin.nAscensionsRequises
  const p = constantes.ascension.prestigesParAscension
  const total = n * p
  const dansBornes = n >= 3 && n <= 5 && p >= 5 && p <= 8 && total >= 20 && total <= 30
  return {
    id: 'C05',
    libelle: 'couple Ascensions × prestiges (§8)',
    mesure: `${n} × ${p} = ${total}`,
    cible: '3-5 × 5-8, produit dans [20, 30]',
    ecart: dansBornes ? 0 : ecartIntervalle(total, 20, 30),
    ok: dansBornes,
  }
}

/** §8 / ADR-12 — « ≥ 40 h de jeu cumulé en simulation continue » (le hors-ligne n'y entre pas). */
export function c06DureeTotale(m: Mesures): Verdict {
  const cible = 40 * H
  return {
    id: 'C06',
    libelle: 'jeu cumulé simulé (§8 ≥ 40 h, ADR-12)',
    mesure: hh(m.tempsJeuTotalMs),
    cible: '≥ 40 h',
    ecart: m.tempsJeuTotalMs >= cible ? 0 : (m.tempsJeuTotalMs - cible) / cible,
    ok: m.tempsJeuTotalMs >= cible,
    detail: `${m.prestigesTotal} prestiges · ${m.ascensions} Ascensions · arrêt « ${m.arret} »`,
  }
}

/**
 * §8 v5 / ADR-17 — durée d'un run **stable ou croissante à 10 % près** : aucun run ne dure moins de
 * 90 % du précédent, plancher 2 h, plafond 24 h. Le critère « croissante » de la v4 a été amendé après
 * la démonstration de T-14 : la durée d'un run vaut `patience × g/(g−1)`, un point fixe du design que
 * les multiplicateurs de méta ne déplacent pas. La tolérance de 10 % est explicite parce que la durée
 * oscille de quelques pour cent d'un run au suivant selon l'ordre des achats.
 */
export function c07DureesRun(m: Mesures): Verdict {
  const runs = m.runs.filter((run) => run.dureeMs > 0)
  if (runs.length === 0) {
    return {
      id: 'C07',
      libelle: 'durée de run (§8 v5, ADR-17)',
      mesure: 'aucun run',
      cible: 'stable ou croissante à 10 % près, 2 h ≤ durée ≤ 24 h',
      ecart: -1,
      ok: false,
    }
  }
  const durees = runs.map((run) => run.dureeMs)
  const plancher = Math.min(...durees)
  const plafond = Math.max(...durees)
  // ADR-17 — tolérance de 10 % : aucun run ne dure moins de 90 % du précédent.
  const TOLERANCE = 0.9
  const regressions: string[] = []
  let pireRapport = Number.POSITIVE_INFINITY
  for (let i = 1; i < durees.length; i += 1) {
    const rapport = durees[i]! / durees[i - 1]!
    if (rapport < pireRapport) pireRapport = rapport
    if (rapport < TOLERANCE) {
      regressions.push(
        `run ${i + 1} : ${(durees[i]! / H).toFixed(2)} h = ${(rapport * 100).toFixed(0)} % de ${(durees[i - 1]! / H).toFixed(2)} h`,
      )
    }
  }
  const ok = plancher >= 2 * H && plafond <= 24 * H && regressions.length === 0
  const ecart = Math.max(
    Math.abs(ecartIntervalle(plancher, 2 * H, 24 * H)),
    Math.abs(ecartIntervalle(plafond, 2 * H, 24 * H)),
    regressions.length > 0 ? (TOLERANCE - pireRapport) / TOLERANCE : 0,
  )
  return {
    id: 'C07',
    libelle: 'durée de run stable ou croissante à 10 % près, 2 h ≤ durée ≤ 24 h (§8 v5, ADR-17)',
    mesure: `${(plancher / H).toFixed(2)} h → ${(plafond / H).toFixed(2)} h sur ${runs.length} runs, pire rapport d'un run au suivant ${(pireRapport * 100).toFixed(1)} %`,
    cible: '≥ 90 % du run précédent, plancher 2 h, plafond 24 h',
    ecart: ok ? 0 : -ecart,
    ok,
    detail:
      regressions.length === 0
        ? `aucun run sous 90 % du précédent (marge ${((pireRapport - TOLERANCE) * 100).toFixed(1)} points)`
        : `${regressions.length} run(s) sous la tolérance : ${regressions.slice(0, 4).join(' · ')}`,
  }
}

/** §8 — « rejouer le contenu déjà vu est 2-3× plus rapide ». */
export function c08Rejeu(m: Mesures): Verdict {
  const facteurs: number[] = []
  const details: string[] = []
  for (let i = 1; i < m.runs.length; i += 1) {
    const precedent = m.runs[i - 1]!
    const courant = m.runs[i]!
    if (courant.rejeuMs === null || courant.rejeuMs <= 0 || precedent.dureeMs <= 0) continue
    const facteur = precedent.dureeMs / courant.rejeuMs
    facteurs.push(facteur)
    details.push(`run ${i + 1} : ×${facteur.toFixed(2)}`)
  }
  if (facteurs.length === 0) {
    return { id: 'C08', libelle: 'rejeu du contenu vu (§8 2-3× plus vite)', mesure: 'non mesurable', cible: '×2 à ×3', ecart: -1, ok: false }
  }
  const moyenne = facteurs.reduce((a, b) => a + b, 0) / facteurs.length
  const tries = [...facteurs].sort((a, b) => a - b)
  const mediane = tries[Math.floor(tries.length / 2)]!
  const hors = facteurs.filter((f) => f < 2 || f > 3).length
  // §8 énonce une propriété de rythme (« rejouer le contenu vu est 2-3× plus rapide »), pas un
  // invariant run par run : on juge la tendance centrale (moyenne ET médiane) et on publie la
  // dispersion complète, qui reste large dans un jeu à événements discrets.
  const ecart = Math.abs(ecartIntervalle(moyenne, 2, 3)) + Math.abs(ecartIntervalle(mediane, 2, 3))
  return {
    id: 'C08',
    libelle: 'rejeu du contenu vu (§8 2-3× plus vite)',
    mesure: `moyenne ×${moyenne.toFixed(2)}, médiane ×${mediane.toFixed(2)} (min ×${Math.min(...facteurs).toFixed(2)}, max ×${Math.max(...facteurs).toFixed(2)})`,
    cible: 'moyenne et médiane dans ×2 à ×3',
    ecart: -ecart,
    ok: ecart === 0,
    detail: `dispersion : ${facteurs.length - hors}/${facteurs.length} runs individuellement dans [×2, ×3] · ${details.slice(0, 6).join(' · ')}`,
  }
}

/** EXG-37 / §8 — toute valeur de jeu normale reste < 1e300. */
export function c09Grandeurs(m: Mesures): Verdict {
  const seuil = 1e300
  const marge = Math.log10(seuil) - Math.log10(Math.max(m.maxValeurJeu, 1))
  return {
    id: 'C09',
    libelle: 'toute valeur de jeu < 1e300 (EXG-37)',
    mesure: `max ${m.maxValeurJeu.toExponential(2)} (marge ${marge.toFixed(0)} décades)`,
    cible: '< 1e300',
    ecart: m.maxValeurJeu < seuil ? 0 : 1,
    ok: m.maxValeurJeu < seuil,
    detail: `DPS ${m.maxDps.toExponential(2)} · or ${m.maxOr.toExponential(2)} · PV ${m.maxPvCible.toExponential(2)} · Éclats ${m.maxEclatsPossedes.toExponential(2)} · rangs répétables ${m.rangMaxEclatsRepetable}/${m.rangMaxAscRepetable}`,
  }
}

/** §8 / EXG-4 — plafond hors-ligne `H ∈ [8, 12]`. */
export function c10PlafondHorsLigne(constantes: Constantes): Verdict {
  const h = constantes.horsLigne.plafondHeures
  const ecart = ecartIntervalle(h, 8, 12)
  return {
    id: 'C10',
    libelle: 'plafond hors-ligne H (§8 [8, 12] h)',
    mesure: `${h} h`,
    cible: '8 à 12 h',
    ecart,
    ok: ecart === 0,
  }
}

/** ADR-13 — chaque run atteint une zone strictement plus profonde que le précédent. */
export function c11ProfondeurCroissante(m: Mesures): Verdict {
  const runs = m.runs.filter((run) => run.dureeMs > 0)
  const fautes: string[] = []
  const chutesAscension: string[] = []
  let compares = 0
  for (let i = 1; i < runs.length; i += 1) {
    const precedent = runs[i - 1]!
    const courant = runs[i]!
    // ADR-13 énonce la croissance pour les runs « entre deux prestiges consécutifs ». Le run qui suit
    // une **Ascension** n'est pas dans ce cas : ADR-14 y efface volontairement les Éclats possédés ET
    // tout l'arbre d'Éclats, donc une perte de profondeur y est l'effet recherché, pas un défaut
    // d'équilibrage. On l'exclut du critère et on la publie séparément.
    if (precedent.ascension) {
      if (courant.zoneMax <= precedent.zoneMax) {
        chutesAscension.push(`après l'Ascension du run ${i} : zone ${precedent.zoneMax} → ${courant.zoneMax}`)
      }
      continue
    }
    compares += 1
    if (courant.zoneMax <= precedent.zoneMax) {
      fautes.push(`run ${i + 1} : zone ${courant.zoneMax} ≤ ${precedent.zoneMax}`)
    }
  }
  return {
    id: 'C11',
    libelle: 'run strictement plus profond entre deux prestiges (ADR-13)',
    mesure: `${fautes.length} run(s) sans gain de profondeur sur ${compares} comparés, zone max ${m.zoneMaxAtteinte}`,
    cible: '0',
    // Écart normalisé pour rester comparable aux autres contraintes dans la fonction objectif.
    ecart: fautes.length === 0 ? 0 : -fautes.length / Math.max(compares, 1),
    ok: fautes.length === 0,
    detail:
      (fautes.length === 0 ? 'profondeur strictement croissante entre prestiges' : fautes.slice(0, 4).join(' · ')) +
      (chutesAscension.length === 0
        ? ' · aucune perte de profondeur aux Ascensions'
        : ` · perte de profondeur aux Ascensions (effet voulu d'ADR-14) : ${chutesAscension.join(' · ')}`),
  }
}

/** EXG-39 / EXG-40 — tailles d'arbres et présence d'un nœud répétable dans chacun. */
export function c12Arbres(constantes: Constantes): Verdict {
  const eclats = noeudsDeLArbre('eclats', constantes)
  const ascension = noeudsDeLArbre('ascension', constantes)
  const repetableEclats = eclats.some((n) => n.rangMax === null)
  const repetableAsc = ascension.some((n) => n.rangMax === null)
  const ok =
    eclats.length >= 8 && eclats.length <= 12 && ascension.length >= 6 && ascension.length <= 10 && repetableEclats && repetableAsc
  return {
    id: 'C12',
    libelle: 'arbres : 8-12 nœuds Éclats, 6-10 Ascension, ≥ 1 répétable chacun (EXG-39, 40)',
    mesure: `Éclats ${eclats.length} (répétable ${repetableEclats ? 'oui' : 'non'}) · Ascension ${ascension.length} (répétable ${repetableAsc ? 'oui' : 'non'})`,
    cible: '8-12 / 6-10, ≥ 1 répétable',
    ecart: ok ? 0 : -1,
    ok,
  }
}

/**
 * EXG-28 — la zone **dédiée** du boss final doit héberger un vrai combat. Quatre conditions, chacune
 * mesurée sur le dernier run (celui qui suit la dernière Ascension requise) :
 *  1. le boss n'est **pas** battable au départ de ce run — sinon la fin de partie est une formalité,
 *     et c'est exactement ce que produisait `zoneBossFinal = 50` sur l'échelle normale des zones ;
 *  2. il est battable **avant** que le joueur cesse de progresser, sinon la fin est inatteignable ;
 *  3. le combat consomme entre 25 % et 95 % du chrono : ni gagné en un tick, ni photo-finish ;
 *  4. la victoire arrive dans la **seconde moitié** du dernier run (c'est le point culminant), sans
 *     coller au moment où le joueur décroche.
 */
export function c13BossFinal(m: Mesures): Verdict {
  const boss = m.bossFinal
  if (boss === null) {
    return {
      id: 'C13',
      libelle: 'boss final : vrai combat dans sa zone dédiée (EXG-28)',
      mesure: 'non mesuré — constantes du boss final absentes',
      cible: 'PV et chrono fournis par `src/donnees/`',
      ecart: -1,
      ok: false,
      detail: '`src/donnees/constantes.ts` doit exporter `BOSS_FINAL` (profondeur équivalente, multiplicateur de PV, chrono)',
    }
  }
  const partRun =
    boss.tempsAvantVictoireMs === null || boss.dureeDernierRunMs <= 0
      ? null
      : boss.tempsAvantVictoireMs / boss.dureeDernierRunMs
  const echecs: string[] = []
  if (boss.gagneDesLeDepart) echecs.push('battable dès le départ du dernier run (formalité)')
  if (boss.tempsAvantVictoireMs === null) echecs.push('jamais battable dans le dernier run')
  if (boss.partDuChrono !== null && (boss.partDuChrono < 0.25 || boss.partDuChrono > 0.95)) {
    echecs.push(`combat à ${(boss.partDuChrono * 100).toFixed(0)} % du chrono (cible 25-95 %)`)
  }
  if (partRun !== null && (partRun < 0.5 || partRun > 0.98)) {
    echecs.push(`victoire à ${(partRun * 100).toFixed(0)} % du dernier run (cible 50-98 %)`)
  }
  if (!(boss.pvBoss < 1e300)) echecs.push('PV du boss final ≥ 1e300')

  return {
    id: 'C13',
    libelle: 'boss final : vrai combat dans sa zone dédiée (EXG-28)',
    mesure:
      boss.tempsAvantVictoireMs === null
        ? `PV ${boss.pvBoss.toExponential(2)}, jamais battu (DPS soutenu max ${boss.dpsMaxDernierRun.toExponential(2)})`
        : `combat de ${boss.dureeCombatS!.toFixed(1)} s sur un chrono de ${boss.timerS} s (${(boss.partDuChrono! * 100).toFixed(0)} %), gagnable après ${(boss.tempsAvantVictoireMs / H).toFixed(2)} h du dernier run`,
    cible: 'combat 25-95 % du chrono, gagnable à 50-98 % du dernier run, jamais dès le départ',
    ecart: echecs.length === 0 ? 0 : -echecs.length,
    ok: echecs.length === 0,
    detail:
      echecs.length === 0
        ? `PV ${boss.pvBoss.toExponential(2)} · zone atteinte à la victoire ${boss.zoneVictoire} · DPS soutenu ${boss.dpsAuMoment.toExponential(2)} (départ du run ${boss.dpsDepartDernierRun.toExponential(2)}, soit ×${(boss.dpsAuMoment / Math.max(boss.dpsDepartDernierRun, 1)).toExponential(1)} de progression dans le run)`
        : echecs.join(' · '),
  }
}

/* ──────────────────────────────────────────────────────────────────────────── agrégation */

export interface Rapport {
  verdicts: readonly Verdict[]
  ok: boolean
  /** Somme des |écarts| : fonction objectif de `search.ts` (0 = toutes les contraintes tenues). */
  cout: number
}

export function verifier(constantes: Constantes, mesures: Mesures): Rapport {
  const verdicts: Verdict[] = [
    c01PremierSort(mesures),
    c02PremierMur(mesures),
    c03PremierPrestige(mesures),
    c04BlocageAvantPrestige(mesures),
    c05CoupleFin(constantes),
    c06DureeTotale(mesures),
    c07DureesRun(mesures),
    c08Rejeu(mesures),
    c09Grandeurs(mesures),
    c10PlafondHorsLigne(constantes),
    c11ProfondeurCroissante(mesures),
    c12Arbres(constantes),
    c13BossFinal(mesures),
  ]
  return {
    verdicts,
    ok: verdicts.every((v) => v.ok),
    cout: verdicts.reduce((total, v) => total + Math.abs(v.ecart), 0),
  }
}

/** Tableau texte pour le rapport et pour `check.ts`. */
export function tableau(rapport: Rapport): string {
  const lignes = ['| # | contrainte §8 | mesuré | cible | écart | verdict |', '| --- | --- | --- | --- | --- | --- |']
  for (const v of rapport.verdicts) {
    lignes.push(
      `| ${v.id} | ${v.libelle} | ${v.mesure} | ${v.cible} | ${v.ecart === 0 ? '0' : v.ecart.toFixed(3)} | ${v.ok ? 'OK' : 'ÉCHEC'} |`,
    )
  }
  return lignes.join('\n')
}
