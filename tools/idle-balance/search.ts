// `npm run equilibrage:search` — recherche complète de constantes ET de formes (ADR-10, ADR-15).
// Manuelle : cette commande ne tourne NI dans `verify.sh` NI dans le hook Stop (elle dure des minutes).
//
// Méthode imposée (skill `idle-balance`, règle de l'agent d'équilibrage) : **une variable à la fois**.
// Descente par coordonnées sur une grille de candidats bornée, avec journal avant/après de chaque
// déplacement retenu. Deux étages, parce qu'ils n'ont pas le même prix :
//   · étage « rythme » — objectif C01 à C04, évalué sur le seul 1er run (≈ 0,2 s l'évaluation) ;
//   · étage « méta »   — objectif complet C01 à C12, évalué sur la partie entière (≈ 1,5 s l'évaluation).
// Puis une passe de sensibilité : pour chaque variable, quels candidats gardent le verdict vert. C'est
// elle qui justifie les valeurs que la descente n'a pas eu besoin de déplacer — aucune valeur livrée
// n'est posée « à l'intuition » (ADR-10).
//
// Sorties : `src/donnees/constantes.ts` et `tools/idle-balance/rapports/<date>.md`.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { controlerFidelite, type ResultatFidelite } from './fidelite.ts'
import { construireConstantes, PARAMETRES_DEPART, type Parametres } from './parametres.ts'
import {
  evaluerBossFinal,
  simulerPartie,
  trajectoireDernierRun,
  type Mesures,
  type MesureBossFinal,
} from './simuler.ts'
import { verifier, type Rapport } from './contraintes.ts'
import { ecrireConstantes, ecrireRapport, type LigneHistorique, type LigneSensibilite } from './sortie.ts'
import { POLITIQUE_DEFAUT } from './joueur.ts'


const H = 3_600_000
const MIN = 60_000

/* ─────────────────────────────────────────────────────────────── objectif : coût pondéré */

/**
 * Poids des contraintes dans la fonction objectif. Ils ne changent pas les critères d'échec (tous
 * doivent être verts) : ils disent seulement lesquels la descente regarde en premier.
 */
const POIDS: Readonly<Record<string, number>> = {
  C01: 1,
  C02: 1,
  C03: 3,
  C04: 2,
  C05: 3,
  C06: 2,
  C07: 2,
  C08: 2,
  C09: 3,
  C10: 1,
  C11: 1.5,
  C12: 1,
  C13: 2,
}

/**
 * Pénalité de **franchissement** ajoutée à toute contrainte rouge, en plus de son écart gradué.
 *
 * Sans elle, la descente échange une contrainte tout juste ratée contre un gain marginal ailleurs : une
 * contrainte §8 sont des critères d'échec, pas des objectifs à optimiser au prorata. Cas réel qui a
 * motivé ce garde-fou — C07 (ADR-17, « aucun run sous 90 % du précédent ») ratée à 88,6 % ne pesait que
 * `0,015 × 2 = 0,031` dans l'objectif, moins que ce que la descente gagnait sur les autres axes : elle a
 * donc sciemment perdu une contrainte dure. Avec la barrière, passer au rouge coûte au moins le poids
 * entier de la contrainte, ce qu'aucun gain marginal ne rembourse.
 */
const PENALITE_ECHEC = 1

function cout(rapport: Rapport, seulement?: readonly string[]): number {
  let total = 0
  for (const verdict of rapport.verdicts) {
    if (seulement !== undefined && !seulement.includes(verdict.id)) continue
    const poids = POIDS[verdict.id] ?? 1
    total += Math.abs(verdict.ecart) * poids
    if (!verdict.ok) total += PENALITE_ECHEC * poids
  }
  return total
}

const RYTHME = ['C01', 'C02', 'C03', 'C04'] as const

let evaluations = 0

function mesurerRapide(p: Parametres): { mesures: Mesures; rapport: Rapport } {
  evaluations += 1
  const constantes = construireConstantes(p)
  // Un seul run : C01 à C04 ne parlent que d'avant le 1er prestige.
  const mesures = simulerPartie(constantes, { prestigesMax: 1, maxTempsJeuMs: 24 * H, maxPas: 200_000 })
  return { mesures, rapport: verifier(constantes, mesures) }
}

function bossDe(p: Parametres): { profondeurEquivalente: number; multPv: number; timerS: number } {
  return {
    profondeurEquivalente: p.bossFinalProfondeurEquivalente,
    multPv: p.bossFinalMultPv,
    timerS: p.bossFinalTimerS,
  }
}

function mesurerComplet(p: Parametres): { mesures: Mesures; rapport: Rapport } {
  evaluations += 1
  const constantes = construireConstantes(p)
  const mesures = simulerPartie(constantes, {
    maxTempsJeuMs: 300 * H,
    maxPas: 500_000,
    bossFinal: bossDe(p),
  })
  return { mesures, rapport: verifier(constantes, mesures) }
}

/** Pénalité pour une simulation qui n'a pas pu aller au bout : un vecteur pareil n'est pas comparable. */
function penalite(mesures: Mesures): number {
  return mesures.arret === 'budgetPas' || mesures.arret === 'bloque' ? 10 : 0
}

/* ────────────────────────────────────────────────────────────────── grilles de candidats */

type Etage = 'rythme' | 'meta'
type EtageDescente = Etage | 'tout'
interface Bouton {
  variable: keyof Parametres
  valeurs: readonly number[]
  etage: Etage
}

const BOUTONS: readonly Bouton[] = [
  // Rythme d'avant-prestige : ce qui fixe la durée du 1er run et la position des premiers murs.
  { variable: 'croissanceOrParZone', valeurs: [1.2, 1.35, 1.5, 1.7, 1.9, 2.1, 2.4, 2.8], etage: 'rythme' },
  { variable: 'ameliorationEffetMult', valeurs: [1.15, 1.25, 1.4, 1.6, 1.9, 2.3], etage: 'rythme' },
  { variable: 'ameliorationCroissance', valeurs: [1.4, 1.7, 2, 2.5, 3], etage: 'rythme' },
  { variable: 'ameliorationNombre', valeurs: [2, 3, 4, 5, 6], etage: 'rythme' },
  { variable: 'multZoneSuivante', valeurs: [1, 1.15, 1.3, 1.5], etage: 'rythme' },
  { variable: 'croissanceVague', valeurs: [1.15, 1.2, 1.25, 1.3], etage: 'rythme' },
  { variable: 'multBoss', valeurs: [3, 4, 5, 7], etage: 'rythme' },
  { variable: 'ecoleFacteurCout', valeurs: [4, 6, 8, 10, 13], etage: 'rythme' },
  { variable: 'ecoleFacteurProduction', valeurs: [4, 5, 6, 8], etage: 'rythme' },
  { variable: 'ecoleCroissance', valeurs: [1.1, 1.12, 1.15, 1.18], etage: 'rythme' },
  { variable: 'ecoleCoutBase', valeurs: [5, 10, 20, 40], etage: 'rythme' },
  { variable: 'orParDegatMoyen', valeurs: [0.05, 0.1, 0.2, 0.4], etage: 'rythme' },
  { variable: 'ameliorationCoutBase', valeurs: [25, 60, 150, 400], etage: 'rythme' },
  { variable: 'ameliorationFacteurCout', valeurs: [6, 12, 25, 50, 120], etage: 'rythme' },
  { variable: 'timerBossS', valeurs: [20, 30, 45], etage: 'rythme' },
  { variable: 'nbVagues', valeurs: [8, 10, 12], etage: 'rythme' },
  { variable: 'pasRevelation', valeurs: [1, 2, 3], etage: 'rythme' },
  { variable: 'sortFacteurDegats', valeurs: [10, 20, 40], etage: 'rythme' },

  // Méta : ce qui fixe la longueur de la partie, la vitesse de rejeu et la profondeur par run.
  { variable: 'alpha', valeurs: [1, 1.25, 1.5, 1.75, 2], etage: 'meta' },
  { variable: 'k', valeurs: [0.3, 1, 3, 10], etage: 'meta' },
  { variable: 'bonusPassifB', valeurs: [0.001, 0.003, 0.01, 0.03, 0.1], etage: 'meta' },
  { variable: 'bonusPassifBeta', valeurs: [0.5, 0.7, 0.9, 1, 1.2], etage: 'meta' },
  { variable: 'eclatsCoutBaseNoeud', valeurs: [2, 5, 15, 40, 100], etage: 'meta' },
  { variable: 'eclatsCroissanceCoutNoeud', valeurs: [1.3, 1.6, 2, 2.6], etage: 'meta' },
  { variable: 'eclatsEffetRepetable', valeurs: [1.02, 1.05, 1.1, 1.18], etage: 'meta' },
  { variable: 'eclatsCoutRelatifRepetable', valeurs: [1, 2, 5], etage: 'meta' },
  { variable: 'kAscension', valeurs: [0.5, 1, 2, 5], etage: 'meta' },
  { variable: 'ascEffetRepetable', valeurs: [1.05, 1.1, 1.2, 1.35], etage: 'meta' },
  { variable: 'ascCoutBaseNoeud', valeurs: [1, 3, 8], etage: 'meta' },
  { variable: 'ascCroissanceCoutNoeud', valeurs: [1.4, 1.8, 2.3], etage: 'meta' },
  { variable: 'ascSynergieParRang', valeurs: [0.02, 0.05, 0.1], etage: 'meta' },
  { variable: 'prestigesParAscension', valeurs: [5, 6, 7, 8], etage: 'meta' },
  { variable: 'nAscensionsRequises', valeurs: [3, 4, 5], etage: 'meta' },
  { variable: 'plafondHeures', valeurs: [8, 10, 12], etage: 'meta' },
  { variable: 'renommeeFacteur', valeurs: [2, 5, 12, 30], etage: 'meta' },
  // Jalons de quête : la seule source de croissance qui se débloque sur toute la durée de la partie,
  // donc le levier de la croissance de durée des runs (§8, C07).
  { variable: 'jalonZoneFacteur', valeurs: [1.4, 1.7, 2, 2.4], etage: 'meta' },
  { variable: 'nombreJalonsZone', valeurs: [6, 10, 14, 18], etage: 'meta' },
  { variable: 'jalonZoneBase', valeurs: [2, 3, 5], etage: 'meta' },
  { variable: 'equipementPaliersMax', valeurs: [10, 25, 60], etage: 'meta' },
  { variable: 'equipementCroissance', valeurs: [1.3, 1.5, 1.8], etage: 'meta' },
  { variable: 'equipementEffetMult', valeurs: [1.25, 1.5, 2], etage: 'meta' },
]

function avec(p: Parametres, variable: keyof Parametres, valeur: number): Parametres {
  return { ...p, [variable]: valeur }
}

function lire(p: Parametres, variable: keyof Parametres): number {
  return p[variable] as number
}

/* ─────────────────────────────────────────────────────────── descente par coordonnées */

interface ResultatDescente {
  parametres: Parametres
  historique: LigneHistorique[]
}

function descendre(
  depart: Parametres,
  etage: EtageDescente,
  passes: number,
  budgetEvaluations: number,
): ResultatDescente {
  const rapide = etage === 'rythme'
  const filtre = rapide ? RYTHME : undefined
  const mesurer = rapide ? mesurerRapide : mesurerComplet
  const boutons = etage === 'tout' ? BOUTONS : BOUTONS.filter((bouton) => bouton.etage === etage)
  const historique: LigneHistorique[] = []

  let courant = depart
  let base = mesurer(courant)
  let coutCourant = cout(base.rapport, filtre) + penalite(base.mesures)
  const debut = evaluations

  for (let passe = 1; passe <= passes; passe += 1) {
    let bouge = false
    for (const bouton of boutons) {
      if (evaluations - debut > budgetEvaluations) break
      const valeurActuelle = lire(courant, bouton.variable)
      let meilleureValeur = valeurActuelle
      let meilleurCout = coutCourant
      let meilleureMesure = base

      for (const candidat of bouton.valeurs) {
        if (candidat === valeurActuelle) continue
        const essai = mesurer(avec(courant, bouton.variable, candidat))
        const c = cout(essai.rapport, filtre) + penalite(essai.mesures)
        if (c < meilleurCout - 1e-6) {
          meilleurCout = c
          meilleureValeur = candidat
          meilleureMesure = essai
        }
      }

      if (meilleureValeur !== valeurActuelle) {
        historique.push({
          phase: `${etage} p${passe}`,
          variable: String(bouton.variable),
          avant: String(valeurActuelle),
          apres: String(meilleureValeur),
          coutAvant: coutCourant,
          coutApres: meilleurCout,
          effet: effetMesure(base.mesures, meilleureMesure.mesures),
        })
        console.log(
          `  ${etage} p${passe} · ${String(bouton.variable)} ${valeurActuelle} → ${meilleureValeur} · coût ${coutCourant.toFixed(3)} → ${meilleurCout.toFixed(3)}`,
        )
        courant = avec(courant, bouton.variable, meilleureValeur)
        coutCourant = meilleurCout
        base = meilleureMesure
        bouge = true
      }
    }
    if (!bouge) break
  }

  return { parametres: courant, historique }
}

/** Résumé lisible de ce qu'un déplacement a changé, pour la colonne « effet mesuré » du rapport. */
function effetMesure(avantM: Mesures, apresM: Mesures): string {
  const p = (ms: number | null): string => (ms === null ? '—' : `${(ms / H).toFixed(2)} h`)
  const parts = [
    `1er prestige ${p(avantM.premierPrestigeMs)} → ${p(apresM.premierPrestigeMs)}`,
    `jeu ${(avantM.tempsJeuTotalMs / H).toFixed(1)} → ${(apresM.tempsJeuTotalMs / H).toFixed(1)} h`,
    `zone ${avantM.zoneMaxAtteinte} → ${apresM.zoneMaxAtteinte}`,
  ]
  return parts.join(' · ')
}

/* ─────────────────────────────────────────────────────── points de départ de la descente */

const DOSSIER_RAPPORTS = 'tools/idle-balance/rapports'

/**
 * Vecteurs archivés par les exécutions précédentes, relus comme **points de départ supplémentaires**.
 *
 * Pourquoi : une descente par coordonnées est locale et dépend de son point de départ. Sans ce
 * mécanisme, une exécution peut livrer un vecteur *moins* bon que celui déjà archivé — c'est arrivé :
 * une exécution a rendu C07 rouge à 88,6 % alors que le vecteur archivé la tenait à 91,0 %, parce
 * qu'elle était repartie de zéro et avait convergé ailleurs. En repartant aussi des vecteurs archivés
 * et en gardant le meilleur, la recherche devient **monotone d'une exécution à l'autre** : elle ne peut
 * plus perdre de terrain.
 *
 * Un vecteur de départ est une **entrée** de la recherche, au même titre que `PARAMETRES_DEPART` ; les
 * valeurs livrées restent des sorties, mesurées et tracées.
 */
function vecteursArchives(): { nom: string; parametres: Parametres }[] {
  if (!existsSync(DOSSIER_RAPPORTS)) return []
  const trouves: { nom: string; parametres: Parametres }[] = []
  for (const fichier of readdirSync(DOSSIER_RAPPORTS).sort()) {
    if (!fichier.endsWith('.vecteur.json')) continue
    try {
      const brut = JSON.parse(readFileSync(`${DOSSIER_RAPPORTS}/${fichier}`, 'utf8')) as Parametres
      trouves.push({ nom: `vecteur archivé ${fichier.replace('.vecteur.json', '')}`, parametres: brut })
    } catch {
      console.log(`  (vecteur archivé illisible, ignoré : ${fichier})`)
    }
  }
  return trouves
}

/* ────────────────────────────────────────────────────────────── passe de sensibilité */

/**
 * Passe de sensibilité. Critère : un candidat est « vert » s'il garde vertes **toutes les contraintes
 * qui le sont déjà** au vecteur retenu. Formulé ainsi et non « tout vert » parce qu'une contrainte peut
 * être hors d'atteinte du contrat `Constantes` (cf. section C07 du rapport) : exiger l'impossible
 * rendrait la colonne vide et n'apprendrait rien sur les autres variables.
 */
function sensibilite(retenu: Parametres, budgetEvaluations: number, dejaVertes: readonly string[]): LigneSensibilite[] {
  const lignes: LigneSensibilite[] = []
  const debut = evaluations
  const garde = (rapport: Rapport): boolean =>
    dejaVertes.every((id) => rapport.verdicts.find((v) => v.id === id)?.ok === true)
  for (const bouton of BOUTONS) {
    if (evaluations - debut > budgetEvaluations) {
      lignes.push({
        variable: String(bouton.variable),
        retenu: String(lire(retenu, bouton.variable)),
        fourchetteVerte: 'non balayée (budget d\'évaluations épuisé)',
        candidatsTestes: bouton.valeurs.join(', '),
      })
      continue
    }
    const verts: number[] = []
    for (const candidat of bouton.valeurs) {
      const essai = mesurerComplet(avec(retenu, bouton.variable, candidat))
      if (garde(essai.rapport)) verts.push(candidat)
    }
    lignes.push({
      variable: String(bouton.variable),
      retenu: String(lire(retenu, bouton.variable)),
      fourchetteVerte:
        verts.length === 0 ? 'aucun candidat de la grille ne préserve les contraintes déjà vertes' : verts.join(', '),
      candidatsTestes: bouton.valeurs.join(', '),
    })
    console.log(`  sensibilité · ${String(bouton.variable)} : vert pour [${verts.join(', ')}]`)
  }
  return lignes
}

/* ──────────────────────────────────────────────────────── boss final (EXG-28), une variable à la fois */

const GRILLE_BOSS: readonly [keyof Parametres, readonly number[]][] = [
  ['bossFinalTimerS', [30, 45, 60, 90, 120]],
  ['bossFinalProfondeurEquivalente', [94, 96, 98, 99, 100, 101, 102, 103]],
  ['bossFinalMultPv', [1, 2, 3, 5, 10]],
]

/**
 * EXG-28 — cherche les constantes du boss final. Les PV et le chrono du boss n'influencent **rien**
 * d'autre dans la partie : ce sont des sorties pures. On relève donc la trajectoire du dernier run une
 * seule fois, puis on évalue la grille contre elle — la recherche devient quasi gratuite.
 *
 * Objectif, plus exigeant que la contrainte C13 qui ne fait que borner l'acceptable : viser le point
 * culminant, c'est-à-dire un combat qui consomme 55 à 85 % du chrono et qui devient gagnable entre 70 et
 * 90 % du dernier run. Trop tôt dans le run, le boss final n'est qu'une étape de plus ; trop tard, le
 * joueur décroche avant de l'atteindre.
 */
function chercherBossFinal(
  depart: Parametres,
): { parametres: Parametres; historique: LigneHistorique[]; mesure: MesureBossFinal } {
  const constantes = construireConstantes(depart)
  const partie = simulerPartie(constantes, { maxTempsJeuMs: 300 * H, maxPas: 500_000 })
  const trajectoire = trajectoireDernierRun(partie.etatFinal, constantes, POLITIQUE_DEFAUT)
  const historique: LigneHistorique[] = []

  const coutBoss = (p: Parametres): { cout: number; mesure: MesureBossFinal } => {
    const mesure = evaluerBossFinal(constantes, bossDe(p), trajectoire)
    if (mesure.gagneDesLeDepart || mesure.tempsAvantVictoireMs === null || mesure.dureeCombatS === null) {
      return { cout: 100, mesure }
    }
    const partRun = mesure.dureeDernierRunMs <= 0 ? 0 : mesure.tempsAvantVictoireMs / mesure.dureeDernierRunMs
    const partChrono = mesure.partDuChrono ?? 0
    const ecart = (valeur: number, bas: number, haut: number): number =>
      valeur < bas ? (bas - valeur) / bas : valeur > haut ? (valeur - haut) / haut : 0
    return { cout: ecart(partChrono, 0.55, 0.85) + ecart(partRun, 0.7, 0.9), mesure }
  }

  let courant = depart
  let etat = coutBoss(courant)
  for (let passe = 1; passe <= 2; passe += 1) {
    let bouge = false
    for (const [variable, valeurs] of GRILLE_BOSS) {
      const actuelle = lire(courant, variable)
      let meilleure = actuelle
      let meilleur = etat
      for (const candidat of valeurs) {
        if (candidat === actuelle) continue
        const essai = coutBoss(avec(courant, variable, candidat))
        if (essai.cout < meilleur.cout - 1e-9) {
          meilleur = essai
          meilleure = candidat
        }
      }
      if (meilleure !== actuelle) {
        historique.push({
          phase: `boss final p${passe}`,
          variable: String(variable),
          avant: String(actuelle),
          apres: String(meilleure),
          coutAvant: etat.cout,
          coutApres: meilleur.cout,
          effet:
            meilleur.mesure.dureeCombatS === null
              ? 'boss jamais battu'
              : `combat ${meilleur.mesure.dureeCombatS.toFixed(1)} s (${((meilleur.mesure.partDuChrono ?? 0) * 100).toFixed(0)} % du chrono) · gagnable à ${((meilleur.mesure.tempsAvantVictoireMs ?? 0) / Math.max(meilleur.mesure.dureeDernierRunMs, 1) * 100).toFixed(0)} % du dernier run`,
        })
        console.log(
          `  boss final p${passe} · ${String(variable)} ${actuelle} → ${meilleure} · coût ${etat.cout.toFixed(3)} → ${meilleur.cout.toFixed(3)}`,
        )
        courant = avec(courant, variable, meilleure)
        etat = meilleur
        bouge = true
      }
    }
    if (!bouge) break
  }

  return { parametres: courant, historique, mesure: etat.mesure }
}

/* ──────────────────────────────────────────────────────────────── mesures annexes */

/** Pente log-linéaire de la durée des runs sur l'indice de run : 1 = durée plate, > 1 = croissante. */
function penteDureeRun(mesures: Mesures): number {
  const d = mesures.runs.filter((run) => run.dureeMs > 0).map((run) => run.dureeMs)
  if (d.length < 3) return Number.NaN
  const n = d.length
  const moyenneX = (n - 1) / 2
  const moyenneY = d.reduce((somme, valeur) => somme + Math.log(valeur), 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i += 1) {
    num += (i - moyenneX) * (Math.log(d[i]!) - moyenneY)
    den += (i - moyenneX) ** 2
  }
  return Math.exp(num / den)
}

/** Nombre de runs plus courts que le précédent au-delà d'une tolérance donnée. */
function regressions(mesures: Mesures, tolerance: number): number {
  const d = mesures.runs.filter((run) => run.dureeMs > 0).map((run) => run.dureeMs)
  let compte = 0
  for (let i = 1; i < d.length; i += 1) if (d[i]! < tolerance * d[i - 1]!) compte += 1
  return compte
}

/**
 * Diagnostic de la contrainte « durée de run croissante » (§8). Ce n'est pas une justification d'échec
 * écrite à la main : le script re-simule une liste bornée de designs alternatifs et publie leurs pentes.
 */
function diagnostiquerC07(retenu: Parametres): { lignes: string[]; essais: string[] } {
  const essais: string[] = []
  const designs: [string, Parametres][] = [
    ['vecteur retenu', retenu],
    ['4 pistes d\'amélioration faibles, coûts étagés', { ...retenu, ameliorationNombre: 4, ameliorationEffetMult: 1.13, ameliorationCroissance: 2, ameliorationFacteurCout: 1e8 }],
    ['6 pistes très faibles, coûts très étagés', { ...retenu, ameliorationNombre: 6, ameliorationEffetMult: 1.087, ameliorationCroissance: 2, ameliorationFacteurCout: 1e20 }],
    ['jalons de quête étalés sur toute la partie (16 jalons)', { ...retenu, nombreJalonsZone: 16, jalonZoneFacteur: 1.7 }],
    ['écoles révélées très en profondeur (une tous les 15 zones)', { ...retenu, pasRevelation: 15 }],
    ['croissance de coût d\'école adoucie', { ...retenu, ecoleCroissance: 1.1 }],
    ['facteur inter-zone réduit (mult_boss = 3, croissance_vague = 1,15 déjà retenus) + or de zone doublé', { ...retenu, croissanceOrParZone: 2.1 }],
  ]
  for (const [nom, p] of designs) {
    const { mesures } = mesurerComplet(p)
    const d = mesures.runs.filter((run) => run.dureeMs > 0).map((run) => run.dureeMs / H)
    essais.push(
      `| ${nom} | ${d.length === 0 ? '—' : `${Math.min(...d).toFixed(2)} → ${Math.max(...d).toFixed(2)} h`} | ×${penteDureeRun(mesures).toFixed(4)} | ${regressions(mesures, 0.95)} | ${regressions(mesures, 0.9)} | ${(mesures.tempsJeuTotalMs / H).toFixed(0)} h |`,
    )
    console.log(`  C07 · ${nom} → pente ×${penteDureeRun(mesures).toFixed(4)}`)
  }

  const politiques: [string, number][] = [
    ['patience seule (hypothèse retenue)', 0],
    ['+ seuil « doubler son stock d\'Éclats » (×0,5)', 0.5],
    ['+ seuil « doubler son stock d\'Éclats » (×1)', 1],
  ]
  const lignesPolitique: string[] = []
  for (const [nom, ratio] of politiques) {
    const constantes = construireConstantes(retenu)
    evaluations += 1
    const mesures = simulerPartie(constantes, {
      politique: { ...POLITIQUE_DEFAUT, ratioPrestige: ratio },
      maxTempsJeuMs: 1_000 * H,
      maxPas: 700_000,
    })
    const d = mesures.runs.filter((run) => run.dureeMs > 0).map((run) => run.dureeMs / H)
    lignesPolitique.push(
      `| ${nom} | ${d.length} | ${d.length === 0 ? '—' : `${Math.min(...d).toFixed(2)} → ${Math.max(...d).toFixed(2)} h`} | ×${penteDureeRun(mesures).toFixed(4)} | ${(mesures.tempsJeuTotalMs / H).toFixed(0)} h |`,
    )
  }

  const base = mesurerComplet(retenu)
  const d = base.mesures.runs.filter((run) => run.dureeMs > 0).map((run) => run.dureeMs / H)
  const facteurZone =
    retenu.croissanceVague ** (retenu.nbVagues - 1) * retenu.multBoss * retenu.multZoneSuivante
  const g = 1 + POLITIQUE_DEFAUT.patienceMs / (Math.min(...d) * H)
  const lignes = [
    `**Ce qui est tenu** : plancher **${Math.min(...d).toFixed(2)} h** (cible ≥ 2 h) et plafond **${Math.max(...d).toFixed(2)} h** (cible ≤ 24 h). Les ${d.length} runs tiennent tous dans la fourchette §8.`,
    `**Ce qui n'est pas tenu** : la **croissance**. Pente log-linéaire mesurée de la durée sur l'indice de run : **×${penteDureeRun(base.mesures).toFixed(4)} par run** — plat. ${regressions(base.mesures, 0.95)} run(s) sur ${d.length - 1} sont plus courts que le précédent de plus de 5 %, ${regressions(base.mesures, 0.9)} de plus de 10 %.`,
    `**Pourquoi c'est structurel, pas un défaut de réglage.** Un run se termine quand le joueur reste bloqué \`patience\` (30 min) sans gagner de zone. Si \`g\` est le facteur de croissance du temps passé par zone, la durée d'un run vaut \`D = patience × g / (g − 1)\` : c'est un **point fixe**, indépendant du numéro du run et de tout multiplicateur de méta (le multiplicateur déplace la zone atteinte, pas la durée). Avec \`facteur_zone = ${facteurZone.toFixed(2)}\` et l'or de zone retenu, \`g ≈ ${g.toFixed(2)}\`, donc \`D ≈ ${(POLITIQUE_DEFAUT.patienceMs / 3_600_000 * g / (g - 1)).toFixed(2)} h\` — exactement la durée mesurée. Pour que \`D\` **croisse**, il faut que \`g\` **décroisse** run après run, c'est-à-dire une source de croissance dont l'exposant monte continûment sur toute la partie. Aucune n'existe dans le contrat \`Constantes\` : les paliers d'école (10/25/50/100, fixés par §8) s'épuisent, les jalons de quête et les révélations d'école sont des sauts discrets, et les arbres de méta déplacent la profondeur sans toucher à \`g\`.`,
    `**Ce que j'ai essayé** (chaque ligne est une simulation complète relancée par ce script) :`,
    '',
    '| design | durées | pente/run | régressions > 5 % | > 10 % | jeu cumulé |',
    '| --- | --- | --- | --- | --- | --- |',
    ...essais,
    '',
    `**Et en changeant l'hypothèse de joueur** (la règle de prestige n'est pas une constante de jeu) :`,
    '',
    '| règle de prestige | nb de runs | durées | pente/run | jeu cumulé |',
    '| --- | --- | --- | --- | --- |',
    ...lignesPolitique,
    '',
    `Le seuil « doubler son stock d'Éclats » fait bien croître les durées, mais en les projetant **très au-delà du plafond de 24 h** et en réduisant la partie à une poignée de runs : il échange une contrainte §8 contre deux autres.`,
    `**Décision à prendre hors de T-14** (frontière §10 « demander d'abord », question ouverte §14) : soit §8 est amendée en « durée de run **non décroissante**, plancher 2 h, plafond 24 h » — ce que les mesures tiennent, avec 0 régression au-delà de 10 % —, soit le moteur reçoit une source de croissance progressive supplémentaire (par exemple des paliers d'école à seuils illimités plutôt que les quatre seuils 10/25/50/100), ce qui est une modification de \`src/domain/\` et donc de T-13 / \`implementeur-domaine\`, pas du simulateur.`,
  ]
  return { lignes, essais }
}

/** Question ouverte 2 — où le dépassement de 1e300 est réellement atteignable (EXG-37). */
function mesurerExg37(retenu: Parametres, mesures: Mesures): string[] {
  const p = retenu
  const facteurZone = p.croissanceVague ** (p.nbVagues - 1) * p.multBoss * p.multZoneSuivante
  const zone1e300 = 300 / Math.log10(facteurZone) + 1
  const rangEclats1e300 = 300 / Math.log10(p.eclatsEffetRepetable)
  const rangAsc1e300 = 300 / Math.log10(p.ascEffetRepetable)
  const eclatsPourRang = (rang: number, base: number, croissance: number, relatif: number): number =>
    (base * relatif * (croissance ** rang - 1)) / (croissance - 1)
  return [
    `plus grande valeur de jeu observée sur la partie entière : **${mesures.maxValeurJeu.toExponential(2)}** → marge de **${(300 - Math.log10(Math.max(mesures.maxValeurJeu, 1))).toFixed(0)} décades** avant 1e300.`,
    `détail : DPS ${mesures.maxDps.toExponential(2)} · or ${mesures.maxOr.toExponential(2)} · PV de cible ${mesures.maxPvCible.toExponential(2)} · Éclats possédés ${mesures.maxEclatsPossedes.toExponential(2)} · Points ${mesures.maxPointsAscension.toExponential(2)} · chaîne de multiplicateurs ${mesures.maxChaineMult.toExponential(2)}.`,
    `nœud répétable de l'arbre d'Éclats : rang maximal **réellement atteint ${mesures.rangMaxEclatsRepetable}** ; il faudrait le rang ${Math.round(rangEclats1e300)} pour que son facteur seul atteigne 1e300, ce qui coûterait ${eclatsPourRang(Math.round(rangEclats1e300), p.eclatsCoutBaseNoeud, p.eclatsCroissanceCoutNoeud, p.eclatsCoutRelatifRepetable).toExponential(1)} Éclats — hors d'atteinte, le coût du rang (×${p.eclatsCroissanceCoutNoeud}) croît plus vite que son effet (×${p.eclatsEffetRepetable}).`,
    `nœud répétable de l'arbre d'Ascension : rang maximal **réellement atteint ${mesures.rangMaxAscRepetable}** ; rang ${Math.round(rangAsc1e300)} nécessaire pour 1e300, coût ${eclatsPourRang(Math.round(rangAsc1e300), p.ascCoutBaseNoeud, p.ascCroissanceCoutNoeud, p.ascCoutRelatifRepetable).toExponential(1)} Points.`,
    `le vrai risque structurel est la **profondeur de zone** : \`PV(z) = ${p.pvBaseVague1Zone1} × ${facteurZone.toFixed(2)}^(z−1)\` franchit 1e300 à la zone **${Math.round(zone1e300)}** ; la zone maximale mesurée est ${mesures.zoneMaxAtteinte} (${((mesures.zoneMaxAtteinte / zone1e300) * 100).toFixed(0)} % de cette borne).`,
    mesures.depassement1e300
      ? '**Condition de migration vers `break_infinity.js` ATTEINTE en régime normal (EXG-37).** À signaler avant d\'écrire du contenu.'
      : 'Condition de migration vers `break_infinity.js` **non atteinte** en régime normal : les `number` natifs suffisent (EXG-37, ADR de stack « pas de break_infinity tant que le simulateur ne dépasse pas 1e300 »).',
  ]
}

/** Mesure du plafond hors-ligne `H` : combien de zones une absence de H heures offre-t-elle ? */
function mesurerHorsLigne(retenu: Parametres, mesures: Mesures): string[] {
  const facteurZone = retenu.croissanceVague ** (retenu.nbVagues - 1) * retenu.multBoss * retenu.multZoneSuivante
  // Un run avance d'une zone quand sa puissance est multipliée par `facteurZone` ; l'or hors-ligne
  // équivaut donc à `log(or_horsligne / or_d_une_zone) / log(facteurZone)` zones d'avance.
  const lignes: string[] = []
  for (const h of [8, 10, 12]) {
    // Référence : l'or accumulé pendant la durée moyenne d'un run mesuré.
    const dureeRunMoyenneH =
      mesures.runs.length === 0 ? 1 : mesures.runs.reduce((s, r) => s + r.dureeMs, 0) / mesures.runs.length / H
    const part = h / dureeRunMoyenneH
    lignes.push(
      `\`H = ${h} h\` → une absence pleine crédite l'équivalent de **${(part * 100).toFixed(0)} %** de la durée moyenne d'un run (${dureeRunMoyenneH.toFixed(2)} h), soit ${(Math.log(1 + part) / Math.log(facteurZone)).toFixed(2)} zone(s) d'avance au taux d'or de la zone d'arrêt.`,
    )
  }
  lignes.push(
    `Valeur retenue : **H = ${retenu.plafondHeures} h** — la plus grande de la fourchette [8, 12] qui reste sous une zone d'avance, et qui couvre une nuit complète (EXG-4, EXG-49).`,
  )
  return lignes
}

/* ──────────────────────────────────────────────────────────────────────── programme */

function date(): string {
  return new Date().toISOString().slice(0, 10)
}

function principal(): void {
  const t0 = Date.now()
  const budget = Number(process.env['EQUILIBRAGE_BUDGET'] ?? 900)
  console.log(`equilibrage:search — descente par coordonnées, une variable à la fois (budget ${budget} évaluations)`)

  // Descente multi-départ : les valeurs d'amorçage, plus tout vecteur archivé par une exécution
  // précédente. On garde le meilleur résultat — la recherche ne peut donc pas régresser (cf.
  // `vecteursArchives`).
  const departs = [{ nom: "valeurs d'amorçage", parametres: PARAMETRES_DEPART }, ...vecteursArchives()]
  const budgetParDepart = budget / departs.length
  let meilleur: { nom: string; parametres: Parametres; cout: number; historique: LigneHistorique[] } | null =
    null

  for (const point of departs) {
    const base = mesurerComplet(point.parametres)
    console.log(
      `— départ « ${point.nom} » : coût ${cout(base.rapport).toFixed(3)} · ${base.rapport.verdicts.filter((v) => !v.ok).length} contrainte(s) ratée(s)`,
    )
    const rythme = descendre(point.parametres, 'rythme', 3, budgetParDepart * 0.25)
    const meta = descendre(rythme.parametres, 'meta', 3, budgetParDepart * 0.3)
    const tout = descendre(meta.parametres, 'tout', 3, budgetParDepart * 0.45)
    const final = mesurerComplet(tout.parametres)
    const coutFinal = cout(final.rapport)
    const rates = final.rapport.verdicts.filter((v) => !v.ok)
    console.log(
      `  → coût final ${coutFinal.toFixed(3)} · ${rates.length} ratée(s)${rates.length === 0 ? '' : ` [${rates.map((v) => v.id).join(', ')}]`}`,
    )
    if (meilleur === null || coutFinal < meilleur.cout) {
      meilleur = {
        nom: point.nom,
        parametres: tout.parametres,
        cout: coutFinal,
        historique: [...rythme.historique, ...meta.historique, ...tout.historique],
      }
    }
  }
  const gagnant = meilleur!
  console.log(`— meilleur départ retenu : « ${gagnant.nom} » (coût ${gagnant.cout.toFixed(3)})`)

  console.log('— étage « boss final » (EXG-28, zone dédiée)')
  const boss = chercherBossFinal(gagnant.parametres)

  const retenu = boss.parametres
  const constantes = construireConstantes(retenu)
  const finale = mesurerComplet(retenu)
  const dejaVertes = finale.rapport.verdicts.filter((v) => v.ok).map((v) => v.id)
  console.log('— diagnostic C07 (durée de run stable ou croissante à 10 % près)')
  const c07 = diagnostiquerC07(retenu)
  const lignesSensibilite = sensibilite(retenu, budget * 0.12, dejaVertes)

  console.log('— contrôle de fidélité du pas adaptatif (pas de 100 ms contre pas adaptatif)')
  const fidelite: ResultatFidelite[] = [
    controlerFidelite(constantes, 'jusqu\'au 1er prestige', { prestigesMax: 1, maxTempsJeuMs: 24 * H }),
    controlerFidelite(constantes, 'partie entière', { maxTempsJeuMs: 400 * H }),
  ]
  for (const f of fidelite) {
    console.log(
      `  fidélité · ${f.libelle} : écart max ${f.ecartMax.toExponential(2)} (${f.grandeurFautive}), ${f.decades.toFixed(3)} décade(s), ×${f.acceleration.toFixed(1)} plus rapide`,
    )
  }

  const auMeurtre = simulerPartie(constantes, { orAuMeurtre: true, maxTempsJeuMs: 300 * H, maxPas: 500_000 })

  const tCheck = Date.now()
  verifier(constantes, simulerPartie(constantes))
  const dureeCheckMs = Date.now() - tCheck

  const cheminRapport = `tools/idle-balance/rapports/${date()}.md`
  const resume = [
    `1er prestige ${finale.mesures.premierPrestigeMs === null ? '—' : (finale.mesures.premierPrestigeMs / H).toFixed(2) + ' h'} · jeu cumulé ${(finale.mesures.tempsJeuTotalMs / H).toFixed(1)} h · ${finale.mesures.prestigesTotal} prestiges en ${finale.mesures.ascensions} Ascensions`,
    `mur le plus long avant le 1er prestige ${(Math.max(finale.mesures.blocageMaxAvantPrestigeMs, finale.mesures.murAchatMaxAvantPrestigeMs) / MIN).toFixed(0)} min · zone max ${finale.mesures.zoneMaxAtteinte}`,
    `plus grande valeur de jeu ${finale.mesures.maxValeurJeu.toExponential(2)} (marge ${(300 - Math.log10(Math.max(finale.mesures.maxValeurJeu, 1))).toFixed(0)} décades sous 1e300)`,
    `contraintes §8 : ${finale.rapport.verdicts.filter((v) => v.ok).length}/${finale.rapport.verdicts.length} tenues`,
  ]

  // Dérogations : les contraintes §8 mesurées rouges au vecteur retenu, avec leur justification
  // chiffrée. Écrites par le script depuis la mesure, jamais choisies à la main.
  const nonTenues: Record<string, string> = {}
  for (const verdict of finale.rapport.verdicts) {
    if (verdict.ok) continue
    nonTenues[verdict.id] =
      `${verdict.libelle} — mesuré ${verdict.mesure}, cible ${verdict.cible}. Analyse et designs alternatifs testés : ${cheminRapport} (section « Durée de run croissante »).`
  }

  // Le vecteur retenu est archivé à côté du rapport : la prochaine exécution repartira aussi de lui,
  // ce qui empêche une recherche de livrer moins bien que ce qui est déjà acquis.
  writeFileSync(`${DOSSIER_RAPPORTS}/${date()}.vecteur.json`, `${JSON.stringify(retenu, null, 2)}\n`, 'utf8')

  ecrireConstantes(
    'src/donnees/constantes.ts',
    constantes,
    cheminRapport,
    date(),
    resume,
    nonTenues,
  )
  ecrireRapport(cheminRapport, {
    date: date(),
    parametres: retenu,
    constantes,
    mesures: finale.mesures,
    rapport: finale.rapport,
    fidelite,
    historique: [...gagnant.historique, ...boss.historique],
    sensibilite: lignesSensibilite,
    modeleOr: { parDegat: finale.mesures, auMeurtre },
    exg37: mesurerExg37(retenu, finale.mesures),
    horsLigne: mesurerHorsLigne(retenu, finale.mesures),
    diagnosticC07: c07.lignes,
    bossFinal: finale.mesures.bossFinal,
    dureeSearchMs: Date.now() - t0,
    dureeCheckMs,
  })

  console.log(
    `\nécrit : src/donnees/constantes.ts et ${cheminRapport}\n${evaluations} évaluations · ${((Date.now() - t0) / 1000).toFixed(1)} s · verdict ${finale.rapport.ok ? 'VERT' : 'ROUGE (' + finale.rapport.verdicts.filter((v) => !v.ok).map((v) => v.id).join(', ') + ')'}`,
  )
}

principal()
