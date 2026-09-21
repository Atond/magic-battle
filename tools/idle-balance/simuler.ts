// Simulateur — rejoue N heures de jeu avec **le moteur réel** (`src/domain/`), à pas adaptatif.
//
// Pourquoi pas le pas de 100 ms : 1 h de jeu = 36 000 ticks, 40 h = 1,44 M, et la partie complète
// mesurée ici en dépasse 100 h. Le pas de 100 ms est donc réservé au **contrôle de fidélité**
// (`fidelite.ts`), pas à la mesure.
//
// Principe du pas adaptatif — un pas = `N` ticks de 100 ms appliqués d'un coup, `N` choisi pour tomber
// **juste après la prochaine échéance utile** :
//   · fin des vagues normales de la zone (ouverture du boss, EXG-16) ;
//   · mort du boss ou expiration de son chrono (EXG-16, EXG-17) ;
//   · fin du cooldown du prochain sort (EXG-12) ;
//   · instant où le prochain achat devient abordable ;
//   · prochain clic, tant que le joueur clique (EXG-11).
// Un pas se décompose exactement comme `tick()`, à `dt` généralisé :
//   1. production passive + or, en **forme fermée** — c'est la branche EXG-3 de `appliquerDelta`,
//      forcée en passant `nTicksMax = 0` (« toujours la forme fermée ») ;
//   2. décompte des cooldowns par `avancerSorts` (EXG-12) ;
//   3. un avancement de combat de `dt` par `avancerCombatJeu`, qui nettoie les vagues en forme fermée ;
//   4. évaluation des jalons de quête (EXG-54).
// Aucune formule n'est réécrite ici : le simulateur ne fait que choisir `dt` et lire l'état.
//
// `N = ceil(échéance / 100 ms)` et jamais moins de 1 tick : on ne franchit une échéance qu'au premier
// tick où elle est déjà arrivée, exactement comme le vrai jeu.

import { PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import { multiplicateursAchats } from '../../src/domain/ameliorations/index.ts'
import {
  appliquerDelta,
  avancerCombatJeu,
  degatsParSeconde,
  etatInitial,

} from '../../src/domain/moteur.ts'
import { ascensionDisponible, ascensionner } from '../../src/domain/ascension/index.ts'
import { eclatsAuPrestige, facteurCooldownArbres, multOrArbres, prestiger } from '../../src/domain/prestige/index.ts'
import { evaluerQuetes } from '../../src/domain/quetes/index.ts'
import { avancerSorts, sortDisponible } from '../../src/domain/sorts/index.ts'
import { multOrZone, pvBoss, pvCumulVagues, pvVague, timerBossMs } from '../../src/domain/zones/index.ts'
import { nbVagues } from '../../src/domain/zones/formules.ts'
import type { Constantes, EtatJeu } from '../../src/domain/types.ts'
import {
  acheterAuMieux,
  candidats,
  chaineMultiplicateurs,
  cliqueEncore,
  cliquer,

  degatsClicParSeconde,
  delaiProchainSortMs,
  depenserArbre,
  lancerSortsPrets,
  POLITIQUE_DEFAUT,
  rangDeNoeud,
  type Politique,
} from './joueur.ts'

const MS_PAR_H = 3_600_000
const SEUIL_1E300 = 1e300

/* ────────────────────────────────────────────────────────────────────────────── mesures */

/** Un mur : intervalle mesuré, avec sa position dans la partie. */
export interface Mur {
  debutMs: number
  dureeMs: number
  zone: number
}

export interface MesureRun {
  indice: number
  dureeMs: number
  debutMs: number
  zoneDepart: number
  zoneMax: number
  eclatsGagnes: number
  /** Temps mis pour re-atteindre la `zoneMax` du run précédent (mesure du « rejeu 2-3× plus vite »). */
  rejeuMs: number | null
  /** Plus long blocage de profondeur du run (aucune zone gagnée). */
  blocageMaxMs: number
  achats: number
  ascension: boolean
}

export interface Mesures {
  premierSortMs: number | null
  /**
   * Instant où un sort **débloqué en cours de partie** devient lançable. `premierSortMs` vaut 0 par
   * construction du moteur (`etatInitial` livre l'École du Feu déjà débloquée, EXG-9, donc son sort
   * répond dès la 1re frame) : ce n'est pas une sortie d'équilibrage. La cible « 1er sort actif ~5 min »
   * de §8 est donc mesurée sur le premier sort dont le déblocage dépend des constantes — celui de la 2e
   * école, révélée par un boss (EXG-8).
   */
  premierSortDebloqueMs: number | null
  premierPrestigeMs: number | null
  /** Début du premier blocage de profondeur d'au moins `seuilMurMs`. */
  premierMurMs: number | null
  premierMurDureeMs: number | null
  blocageMaxAvantPrestigeMs: number
  murAchatMaxMs: number
  murAchatMaxAvantPrestigeMs: number
  murs: readonly Mur[]
  mursAchat: readonly Mur[]
  tempsJeuTotalMs: number
  runs: readonly MesureRun[]
  prestigesTotal: number
  ascensions: number
  zoneMaxAtteinte: number
  maxDps: number
  maxOr: number
  maxPvCible: number
  maxEclatsPossedes: number
  maxPointsAscension: number
  maxChaineMult: number
  rangMaxEclatsRepetable: number
  rangMaxAscRepetable: number
  /** Plus grande valeur de jeu observée, toutes grandeurs confondues (signal EXG-37). */
  maxValeurJeu: number
  depassement1e300: boolean
  pas: number
  clics: number
  /** Or crédité pour des dégâts qui n'ont détruit AUCUN PV (surkill, boss raté) — question ouverte. */
  orGaspille: number
  /** Or qui correspond à des PV réellement détruits. */
  orUtile: number
  arret: 'objectif' | 'budgetTemps' | 'budgetPas' | 'bloque'
  /** EXG-28 — mesure du combat final, `null` si `options.bossFinal` n'a pas été fourni. */
  bossFinal: MesureBossFinal | null
  etatFinal: EtatJeu
}

export interface OptionsSimulation {
  politique?: Politique
  /** Budget de temps de jeu simulé ; au-delà on s'arrête et on le dit. */
  maxTempsJeuMs?: number
  maxPas?: number
  /** Au-delà de cette durée sans gagner de zone, on compte un mur (mesure, pas politique). */
  seuilMurMs?: number
  /** Arrêter après ce nombre de prestiges (`null` = jusqu'à la dernière Ascension requise). */
  prestigesMax?: number | null
  /** Interdire le prestige : sert à mesurer les murs sans que la politique les tronque. */
  sansPrestige?: boolean
  /** Plafond de durée d'un run, garde-fou anti-boucle (n'est PAS le plafond §8 de 24 h). */
  dureeRunMaxMs?: number
  /** Modèle d'or « au meurtre » : l'or ne suit plus les dégâts infligés mais les PV détruits. */
  orAuMeurtre?: boolean
  /**
   * EXG-28 — constantes de la zone dédiée du boss final. Fournies par l'appelant et non lues dans
   * `Constantes` : le type `ConstantesFin` de `src/domain/types.ts` ne porte pas encore ces champs, et
   * ce lot n'a pas le droit d'y toucher (c'est T-13). `src/donnees/constantes.ts` les exporte à côté.
   * Absentes, la mesure du boss final vaut `null` et la contrainte correspondante échoue.
   */
  bossFinal?: { profondeurEquivalente: number; multPv: number; timerS: number }
  /**
   * Force le pas de 100 ms du moteur (EXG-1) au lieu du pas adaptatif : c'est le jeu tel qu'il tourne
   * vraiment. Beaucoup plus lent (quelques millions de ticks sur une partie entière), donc réservé à la
   * validation finale d'un vecteur retenu — jamais à la boucle de recherche ni à `equilibrage:check`.
   */
  pasFixe?: boolean
}

/* ──────────────────────────────────────────────────────────── échéances du pas adaptatif */

/** Délai avant la prochaine bascule de combat : ouverture du boss, mort du boss, ou fin de chrono. */
export function delaiProchainCombatMs(etat: EtatJeu, constantes: Constantes, degatsSeconde: number): number {
  if (!(degatsSeconde > 0)) return Number.POSITIVE_INFINITY
  const combat = etat.combat
  if (combat.phase === 'boss') {
    const pv = combat.cible === null ? pvBoss(combat.zone, constantes) : combat.cible.pvCourants
    const timer = combat.timerBossRestantMs ?? timerBossMs(constantes)
    return Math.min((pv / degatsSeconde) * 1_000, timer)
  }
  const total = nbVagues(constantes)
  const vague = Math.min(Math.max(combat.vague, 1), total)
  const pvCible = combat.cible === null ? pvVague(combat.zone, vague, constantes) : combat.cible.pvCourants
  let besoin = pvCible
  if (vague < total) {
    besoin += pvCumulVagues(pvVague(combat.zone, vague + 1, constantes), total - vague, constantes)
  }
  return (besoin / degatsSeconde) * 1_000
}

/**
 * PV qu'il reste à détruire avant la prochaine bascule de phase (fin des vagues normales, ou mort du
 * boss). Sert deux usages : le choix du pas, et la comptabilité du modèle d'or « au meurtre ».
 */
function resteADetruire(etat: EtatJeu, constantes: Constantes): number {
  const combat = etat.combat
  if (combat.phase === 'boss') {
    return combat.cible === null ? pvBoss(combat.zone, constantes) : combat.cible.pvCourants
  }
  const total = nbVagues(constantes)
  const vague = Math.min(Math.max(combat.vague, 1), total)
  const pvCible = combat.cible === null ? pvVague(combat.zone, vague, constantes) : combat.cible.pvCourants
  let reste = pvCible
  if (vague < total) {
    reste += pvCumulVagues(pvVague(combat.zone, vague + 1, constantes), total - vague, constantes)
  }
  return reste
}

/** Taux d'or instantané (or/s), tel que le moteur le crédite : EXG-6 agrégé sur les dégâts infligés. */
function tauxOrParSeconde(
  etat: EtatJeu,
  constantes: Constantes,
  politique: Politique,
  clique: boolean,
): number {
  const degats =
    degatsParSeconde(etat, constantes) + (clique ? degatsClicParSeconde(etat, constantes, politique) : 0)
  return degats * constantes.or.orParDegatMoyen * multOrZone(etat.combat.zone, constantes) * multOrArbres(etat, constantes)
}

/** Délai avant que le prochain achat en or devienne abordable. */
function delaiProchainAchatMs(etat: EtatJeu, constantes: Constantes, tauxOr: number, politique: Politique): number {
  const liste = candidats(etat, constantes, politique)
  let manqueMin = Number.POSITIVE_INFINITY
  for (const candidat of liste) {
    if (candidat.gain <= 0) continue
    if (candidat.sorte === 'achat' && candidat.monnaie === 'renommee') continue
    const manque = candidat.cout - etat.bourse.or
    if (manque <= 0) return 0
    if (manque < manqueMin) manqueMin = manque
  }
  if (!Number.isFinite(manqueMin) || !(tauxOr > 0)) return Number.POSITIVE_INFINITY
  return (manqueMin / tauxOr) * 1_000
}

/* ────────────────────────────────────────────────────────────────────────── un pas de jeu */

/**
 * Applique `nbTicks` ticks de 100 ms d'un seul coup, dans l'ordre exact de `tick()`. Voir l'en-tête pour
 * la justification de chaque étape ; `constantesFermees` est `constantes` avec `nTicksMax = 0`, ce qui
 * force la branche « forme fermée » d'`appliquerDelta` (EXG-3) et en fait un crédit de production pur.
 */
export function pasDeJeu(
  etat: EtatJeu,
  nbTicks: number,
  constantes: Constantes,
  constantesFermees: Constantes,
  constantesSansAutoCast: Constantes,
): EtatJeu {
  const dtMs = nbTicks * PAS_TICK_MS
  const production = appliquerDelta(etat, dtMs, constantesFermees)
  const facteur = facteurCooldownArbres(production, constantes)
  // Les sorts sont lancés par la politique (`lancerSortsPrets`), qui passe par `lancerSort` et crédite
  // donc l'or de leurs dégâts. On ne garde ici que le décompte des cooldowns : d'où le catalogue de
  // sorts vidé, qui neutralise l'auto-cast interne d'`avancerSorts` sans toucher au moteur.
  const sorts = avancerSorts(
    production,
    dtMs / facteur,
    constantesSansAutoCast,
    multiplicateursAchats(production, constantes),
  )
  const combat = avancerCombatJeu(sorts.etat, dtMs, constantes, 0)
  const quetes = evaluerQuetes(combat.etat, constantes)
  return { ...quetes.etat, ticksRattrapes: quetes.etat.ticksRattrapes + nbTicks }
}

/* ────────────────────────────────────────────────────────────────── simulation d'une partie */

function maxFini(a: number, b: number): number {
  return Number.isFinite(b) && b > a ? b : a
}

export function simulerPartie(constantes: Constantes, options: OptionsSimulation = {}): Mesures {
  const politique = options.politique ?? POLITIQUE_DEFAUT
  const maxTempsJeuMs = options.maxTempsJeuMs ?? 400 * MS_PAR_H
  const maxPas = options.maxPas ?? 4_000_000
  const seuilMurMs = options.seuilMurMs ?? 5 * 60_000
  const dureeRunMaxMs = options.dureeRunMaxMs ?? 72 * MS_PAR_H
  const prestigesMax = options.prestigesMax ?? null
  const cible = constantes.fin.nAscensionsRequises

  // Modèle d'or « au meurtre » (question ouverte du lot) : on coupe le crédit automatique du moteur
  // (`orParDegatMoyen = 0`, donc `orPourDegats` rend 0 partout) et on crédite soi-même les PV
  // **effectivement détruits**, au même taux et au même multiplicateur de zone (EXG-6 par monstre).
  // Le moteur n'est pas modifié : on mesure un contrefactuel, on ne change pas le jeu.
  const auMeurtre = options.orAuMeurtre === true
  const constantesMoteur: Constantes = auMeurtre
    ? { ...constantes, or: { ...constantes.or, orParDegatMoyen: 0 } }
    : constantes
  const constantesFermees: Constantes = { ...constantesMoteur, tick: { nTicksMax: 0 } }
  const constantesSansAutoCast: Constantes = { ...constantesMoteur, sorts: [] }
  let orGaspille = 0
  let orCredite = 0

  let etat = etatInitial(0)
  let pas = 0
  let clics = 0
  let prochainClicMs = 0
  let arret: Mesures['arret'] = 'objectif'

  const murs: Mur[] = []
  const mursAchat: Mur[] = []
  const runs: MesureRun[] = []

  let premierSortMs: number | null = null
  let premierSortDebloqueMs: number | null = null
  let premierPrestigeMs: number | null = null
  // Sorts dont le déblocage dépend des constantes (école révélée par un boss, EXG-8) : eux seuls
  // portent la cible « 1er sort actif ~5 min » de §8.
  const sortsRevelables = new Set(
    constantes.sorts
      .filter((sort) => {
        const ecole = constantes.ecoles[sort.idEcole]
        return ecole !== undefined && ecole.zoneRevelation !== null && !ecole.requiertAscension
      })
      .map((sort) => sort.id),
  )

  let maxDps = 0
  let maxOr = 0
  let maxPvCible = 0
  let maxEclatsPossedes = 0
  let maxPointsAscension = 0
  let maxChaineMult = 1
  let rangMaxEclatsRepetable = 0
  let rangMaxAscRepetable = 0

  // Suivi du run courant
  let runDebutMs = 0
  let runAchats = 0
  let zonePrecedenteMax = 0
  let rejeuMs: number | null = null
  let derniereZoneMs = 0
  let derniereZone = etat.combat.zone
  let blocageMaxRun = 0
  let murAchatDebutMs = 0

  const finRun = (ascension: boolean): void => {
    const maintenant = etat.tempsJeuMs
    const blocage = maintenant - derniereZoneMs
    if (blocage > blocageMaxRun) blocageMaxRun = blocage
    if (blocage >= seuilMurMs) murs.push({ debutMs: derniereZoneMs, dureeMs: blocage, zone: etat.prestige.zoneMaxDuRun })
    runs.push({
      indice: runs.length + 1,
      debutMs: runDebutMs,
      dureeMs: maintenant - runDebutMs,
      zoneDepart: 0,
      zoneMax: etat.prestige.zoneMaxDuRun,
      eclatsGagnes: eclatsAuPrestige(etat.prestige.zoneMaxDuRun, constantes),
      rejeuMs,
      blocageMaxMs: blocageMaxRun,
      achats: runAchats,
      ascension,
    })
    zonePrecedenteMax = Math.max(zonePrecedenteMax, etat.prestige.zoneMaxDuRun)
    runDebutMs = maintenant
    runAchats = 0
    rejeuMs = null
    blocageMaxRun = 0
    derniereZoneMs = maintenant
  }

  while (pas < maxPas) {
    /* — 1. décisions instantanées : achats, sorts, clics — */
    const resteAvant = resteADetruire(etat, constantesMoteur)
    const zoneAvant = etat.combat.zone
    const phaseAvant = etat.combat.phase

    const achat = acheterAuMieux(etat, constantesMoteur, politique)
    etat = achat.etat
    runAchats += achat.achats

    // Mur d'achat, au sens strict de §8 : intervalle pendant lequel RIEN du catalogue n'est abordable.
    // La politique n'épargnant pas (règle 1), cet intervalle est exactement le délai entre deux achats :
    // dès qu'un article redevient abordable il est acheté dans la même itération.
    if (achat.achats > 0) {
      const duree = etat.tempsJeuMs - murAchatDebutMs
      if (duree > 0) mursAchat.push({ debutMs: murAchatDebutMs, dureeMs: duree, zone: etat.combat.zone })
      murAchatDebutMs = etat.tempsJeuMs
    }

    if (premierSortDebloqueMs === null) {
      for (const id of sortsRevelables) {
        if (sortDisponible(etat, id, constantesMoteur)) {
          premierSortDebloqueMs = etat.tempsJeuMs
          break
        }
      }
    }
    const tirs = lancerSortsPrets(etat, constantesMoteur)
    etat = tirs.etat
    if (premierSortMs === null && tirs.tirs > 0) premierSortMs = etat.tempsJeuMs

    // Clics (EXG-11) : cadence tenue par une échéance absolue, pas par pas de simulation, pour que le
    // pas adaptatif et le pas de 100 ms produisent EXACTEMENT la même suite de clics (cf. `fidelite.ts`).
    const clique = cliqueEncore(etat, constantesMoteur, politique)
    if (clique) {
      const intervalle = 1_000 / politique.clicsParSeconde
      let dus = 0
      while (etat.tempsJeuMs >= prochainClicMs && dus < 10_000) {
        prochainClicMs += intervalle
        dus += 1
      }
      if (dus > 0) {
        etat = cliquer(etat, constantesMoteur, dus)
        clics += dus
      }
    } else {
      prochainClicMs = etat.tempsJeuMs
    }

    /* — 2. relevés de grandeurs (surveillance EXG-37) — */
    const dps = degatsParSeconde(etat, constantesMoteur)
    maxDps = maxFini(maxDps, dps)
    maxOr = maxFini(maxOr, etat.bourse.or)
    maxPvCible = maxFini(maxPvCible, etat.combat.cible?.pvMax ?? 0)
    maxEclatsPossedes = maxFini(maxEclatsPossedes, etat.bourse.eclatsPossedes)
    maxPointsAscension = maxFini(maxPointsAscension, etat.bourse.pointsAscension)
    maxChaineMult = maxFini(maxChaineMult, chaineMultiplicateurs(etat, constantesMoteur))
    rangMaxEclatsRepetable = Math.max(rangMaxEclatsRepetable, rangDeNoeud(etat, 'eclats-degats-infini', constantesMoteur))
    rangMaxAscRepetable = Math.max(rangMaxAscRepetable, rangDeNoeud(etat, 'ascension-degats-infini', constantesMoteur))

    /* — 3. suivi de profondeur, rejeu et blocage — */
    if (etat.combat.zone > derniereZone) {
      derniereZone = etat.combat.zone
      const blocage = etat.tempsJeuMs - derniereZoneMs
      if (blocage > blocageMaxRun) blocageMaxRun = blocage
      if (blocage >= seuilMurMs) {
        murs.push({ debutMs: derniereZoneMs, dureeMs: blocage, zone: etat.combat.zone - 1 })
      }
      derniereZoneMs = etat.tempsJeuMs
      if (rejeuMs === null && zonePrecedenteMax > 0 && etat.prestige.zoneMaxDuRun >= zonePrecedenteMax) {
        rejeuMs = etat.tempsJeuMs - runDebutMs
      }
    }

    /* — 4. prestige / ascension (règle 5 de la politique) — */
    const bloqueDepuis = etat.tempsJeuMs - derniereZoneMs
    const runTrop = etat.tempsJeuMs - runDebutMs >= dureeRunMaxMs
    const gainPrestige = eclatsAuPrestige(etat.prestige.zoneMaxDuRun, constantesMoteur)
    // Seuil d'Éclats : le joueur s'accroche au-delà de sa patience tant que le run n'a pas rapporté
    // `ratioPrestige` fois son stock. Le plafond de durée de run reste la seule coupure dure.
    const seuilEclats =
      politique.ratioPrestige > 0
        ? Math.max(1, politique.ratioPrestige * Math.max(etat.bourse.eclatsPossedes, 1))
        : 1
    // Le plafond de durée de run est une coupure DURE : un seuil d'Éclats non atteint ne doit pas
    // pouvoir prolonger un run indéfiniment (sinon la mesure du plafond §8 de 24 h ne veut plus rien
    // dire — c'est ce qu'un premier jet de cette règle avait produit, avec des runs de 260 h).
    const veutPrestiger =
      options.sansPrestige !== true &&
      gainPrestige >= 1 &&
      (runTrop || (bloqueDepuis >= politique.patienceMs && gainPrestige >= seuilEclats))

    if (veutPrestiger) {
      if (ascensionDisponible(etat, constantesMoteur)) {
        const asc = ascensionner(etat, constantesMoteur)
        if (asc.accepte) {
          finRun(true)
          etat = asc.etat
          derniereZone = etat.combat.zone
          const points = depenserArbre(etat, 'ascension', constantesMoteur, politique)
          etat = points.etat
          if (etat.ascension.ascensionsEffectuees >= cible) break
          continue
        }
      }
      const resultat = prestiger(etat, constantesMoteur)
      if (resultat.accepte) {
        finRun(false)
        etat = resultat.etat
        derniereZone = etat.combat.zone
        if (premierPrestigeMs === null) premierPrestigeMs = etat.tempsJeuMs
        const eclats = depenserArbre(etat, 'eclats', constantesMoteur, politique)
        etat = eclats.etat
        if (prestigesMax !== null && etat.prestige.prestigesTotal >= prestigesMax) break
        continue
      }
    }

    /* — 5. choix du pas : la plus proche échéance utile — */
    const tauxOr = tauxOrParSeconde(etat, constantesMoteur, politique, clique)
    const echeances = [
      delaiProchainCombatMs(etat, constantesMoteur, dps),
      delaiProchainSortMs(etat, constantesMoteur),
      delaiProchainAchatMs(etat, constantesMoteur, tauxOr, politique),
      clique ? Math.max(prochainClicMs - etat.tempsJeuMs, 0) : Number.POSITIVE_INFINITY,
      // Plafond de pas : borne la granularité des mesures de mur et du décompte de quêtes.
      300_000,
    ]
    let delai = Number.POSITIVE_INFINITY
    for (const e of echeances) if (Number.isFinite(e) && e >= 0 && e < delai) delai = e
    if (!Number.isFinite(delai)) {
      // Plus rien ne peut arriver : ni or, ni dégâts, ni sort. La partie est morte.
      arret = 'bloque'
      break
    }

    const nbTicks = options.pasFixe === true ? 1 : Math.max(1, Math.ceil(delai / PAS_TICK_MS))
    const degatsProduits =
      degatsParSeconde(etat, constantesMoteur) * ((nbTicks * PAS_TICK_MS) / 1_000)
    etat = pasDeJeu(etat, nbTicks, constantesMoteur, constantesFermees, constantesSansAutoCast)
    pas += 1

    // Comptabilité du modèle « au meurtre » : PV détruits sur les vagues normales + PV du boss à sa
    // mort ; les dégâts encaissés par un boss qui survit au chrono (EXG-17) ne rapportent RIEN, alors
    // que le modèle « par dégât infligé » du moteur les paie plein tarif. C'est là que les deux
    // modèles divergent, et c'est ce que le rapport chiffre.
    {
      const phaseApres = etat.combat.phase
      const zoneApres = etat.combat.zone
      const resteApres = resteADetruire(etat, constantesMoteur)
      // Quatre transitions possibles en un pas, parce que le pas s'arrête sur les bascules de combat.
      // La 1re est le cas de loin le plus fréquent ; la 3e couvre le pas qui part de la phase de vagues
      // et finit une zone plus loin (un clic a ouvert la phase de boss, le pas l'a tué).
      let detruits = 0
      if (phaseAvant === 'vague' && zoneApres === zoneAvant) {
        // Vagues normales entamées (ou phase de boss ouverte, `resteApres` valant alors les PV du boss).
        detruits = phaseApres === 'boss' ? resteAvant : Math.max(resteAvant - resteApres, 0)
      } else if (phaseAvant === 'boss' && zoneApres > zoneAvant) {
        // Boss mort : il paie ses PV max, et rien de ce qu'il a encaissé avant ce pas.
        detruits = pvBoss(zoneAvant, constantesMoteur)
      } else if (phaseAvant === 'vague' && zoneApres > zoneAvant) {
        detruits = resteAvant + pvBoss(zoneAvant, constantesMoteur)
      }
      // Reste le cas `boss → boss` et le boss raté au chrono (EXG-17) : zéro PV détruit, donc zéro or
      // dans ce modèle — c'est exactement là que les deux modèles d'or divergent.
      const taux =
        constantes.or.orParDegatMoyen *
        multOrZone(zoneAvant, constantesMoteur) *
        multOrArbres(etat, constantesMoteur)
      orCredite += detruits * taux
      orGaspille += Math.max(degatsProduits - detruits, 0) * taux
      if (auMeurtre) {
        etat = { ...etat, bourse: { ...etat.bourse, or: etat.bourse.or + detruits * taux } }
      }
    }

    if (etat.tempsJeuMs >= maxTempsJeuMs) {
      arret = 'budgetTemps'
      break
    }
  }
  if (pas >= maxPas) arret = 'budgetPas'

  if (runs.length === 0 || runs[runs.length - 1]!.dureeMs !== etat.tempsJeuMs - runDebutMs) {
    // Le dernier run n'a pas été clôturé par un prestige : on le mesure quand même.
    finRun(false)
  }
  if (etat.tempsJeuMs > murAchatDebutMs) {
    mursAchat.push({
      debutMs: murAchatDebutMs,
      dureeMs: etat.tempsJeuMs - murAchatDebutMs,
      zone: etat.combat.zone,
    })
  }

  const avantPrestige = (liste: readonly Mur[]): number => {
    const borne = premierPrestigeMs ?? etat.tempsJeuMs
    let max = 0
    for (const mur of liste) if (mur.debutMs < borne && mur.dureeMs > max) max = mur.dureeMs
    return max
  }
  const premier = murs.find((mur) => mur.dureeMs >= seuilMurMs) ?? null

  // EXG-28 — le combat final se joue pendant le run qui suit la dernière Ascension requise. On relève
  // la trajectoire de ce run une fois (≈ 0,1 s) puis on évalue le boss contre elle.
  let bossFinal: MesureBossFinal | null = null
  if (options.bossFinal !== undefined && arret === 'objectif') {
    const trajectoire = trajectoireDernierRun(etat, constantesMoteur, politique)
    bossFinal = evaluerBossFinal(constantesMoteur, options.bossFinal, trajectoire)
  }

  const maxValeurJeu = Math.max(
    maxDps,
    maxOr,
    maxPvCible,
    maxEclatsPossedes,
    maxPointsAscension,
    maxChaineMult,
    bossFinal === null ? 0 : bossFinal.pvBoss,
  )

  return {
    premierSortMs,
    premierSortDebloqueMs,
    premierPrestigeMs,
    premierMurMs: premier === null ? null : premier.debutMs,
    premierMurDureeMs: premier === null ? null : premier.dureeMs,
    blocageMaxAvantPrestigeMs: avantPrestige(murs),
    murAchatMaxMs: mursAchat.reduce((max, mur) => Math.max(max, mur.dureeMs), 0),
    murAchatMaxAvantPrestigeMs: avantPrestige(mursAchat),
    murs,
    mursAchat,
    tempsJeuTotalMs: etat.tempsJeuMs,
    runs,
    prestigesTotal: etat.prestige.prestigesTotal,
    ascensions: etat.ascension.ascensionsEffectuees,
    zoneMaxAtteinte: Math.max(...runs.map((run) => run.zoneMax), etat.combat.zone),
    maxDps,
    maxOr,
    maxPvCible,
    maxEclatsPossedes,
    maxPointsAscension,
    maxChaineMult,
    rangMaxEclatsRepetable,
    rangMaxAscRepetable,
    maxValeurJeu,
    depassement1e300: maxValeurJeu >= SEUIL_1E300,
    pas,
    clics,
    orGaspille,
    orUtile: orCredite,
    arret,
    bossFinal,
    etatFinal: etat,
  }
}

/* ────────────────────────────────────────────────────── boss final (EXG-28), zone dédiée */

export interface MesureBossFinal {
  /** PV du boss final : `pvBoss(profondeurEquivalente) × multPv`. */
  pvBoss: number
  /** DPS soutenu au départ du dernier run (juste après la dernière Ascension : le cycle est effacé). */
  dpsDepartDernierRun: number
  /** DPS soutenu maximal atteint pendant le dernier run. */
  dpsMaxDernierRun: number
  /** DPS soutenu au moment où le boss devient tuable dans le chrono. */
  dpsAuMoment: number
  /** Temps écoulé depuis la dernière Ascension avant que le combat devienne gagnable. */
  tempsAvantVictoireMs: number | null
  /** Durée totale du dernier run mesuré. */
  dureeDernierRunMs: number
  /** Durée du combat lui-même, en secondes (`PV / DPS_soutenu`). */
  dureeCombatS: number | null
  /** Le boss est-il déjà tuable dès le départ du dernier run ? (= formalité, à éviter) */
  gagneDesLeDepart: boolean
  /** Fraction du chrono consommée par le combat quand il devient gagnable. */
  partDuChrono: number | null
  /** Zone où le joueur en est quand le combat devient gagnable. */
  zoneVictoire: number | null
  timerS: number
}

/**
 * Dégâts par seconde **soutenus** : production passive (EXG-9) plus la cadence moyenne des sorts actifs
 * lancés dès la fin de leur cooldown (EXG-12), qui est ce que la politique tient réellement. C'est le
 * bon taux pour un combat chronométré de plusieurs dizaines de secondes, où les sorts partent plusieurs
 * fois — la production passive seule sous-estimerait le joueur.
 */
export function degatsSoutenusParSeconde(etat: EtatJeu, constantes: Constantes): number {
  const passif = degatsParSeconde(etat, constantes)
  const multAchats = multiplicateursAchats(etat, constantes)
  const facteur = facteurCooldownArbres(etat, constantes)
  let sorts = 0
  for (const parametres of constantes.sorts) {
    if (!sortDisponible(etat, parametres.id, constantes)) continue
    const cooldownS = (parametres.cooldownMs * facteur) / 1_000
    if (!(cooldownS > 0)) continue
    sorts += (parametres.degatsBase * multAchats) / cooldownS
  }
  return passif + sorts
}

/** Un relevé de la trajectoire du dernier run : instant et dégâts soutenus disponibles. */
export interface PointTrajectoire {
  tMs: number
  dpsSoutenu: number
  zone: number
}

/**
 * EXG-28 — rejoue le **dernier run** (celui qui suit la dernière Ascension requise) et relève la
 * trajectoire des dégâts soutenus. Cette trajectoire ne dépend pas des constantes du boss final : on la
 * mesure **une fois**, puis on évalue autant de couples (profondeur, multiplicateur, chrono) qu'on veut
 * contre elle, ce qui rend la recherche du boss final quasi gratuite.
 *
 * Le run se joue avec la même politique que les autres, mais sans prestiger : on veut savoir jusqu'où
 * le joueur monte avant que sa patience ne s'épuise.
 */
export function trajectoireDernierRun(
  etatDepart: EtatJeu,
  constantes: Constantes,
  politique: Politique = POLITIQUE_DEFAUT,
): readonly PointTrajectoire[] {
  const constantesFermees: Constantes = { ...constantes, tick: { nTicksMax: 0 } }
  const constantesSansAutoCast: Constantes = { ...constantes, sorts: [] }
  let etat = etatDepart
  const depart = etat.tempsJeuMs
  const points: PointTrajectoire[] = []
  let derniereZone = etat.combat.zone
  let derniereZoneMs = etat.tempsJeuMs
  let prochainClicMs = etat.tempsJeuMs
  let pas = 0

  while (pas < 400_000) {
    etat = acheterAuMieux(etat, constantes, politique).etat
    etat = lancerSortsPrets(etat, constantes).etat
    if (cliqueEncore(etat, constantes, politique)) {
      const intervalle = 1_000 / politique.clicsParSeconde
      let dus = 0
      while (etat.tempsJeuMs >= prochainClicMs && dus < 10_000) {
        prochainClicMs += intervalle
        dus += 1
      }
      if (dus > 0) etat = cliquer(etat, constantes, dus)
    } else {
      prochainClicMs = etat.tempsJeuMs
    }

    points.push({
      tMs: etat.tempsJeuMs - depart,
      dpsSoutenu: degatsSoutenusParSeconde(etat, constantes),
      zone: etat.combat.zone,
    })

    if (etat.combat.zone > derniereZone) {
      derniereZone = etat.combat.zone
      derniereZoneMs = etat.tempsJeuMs
    }
    // Le joueur qui ne progresse plus ne gagnera pas non plus le combat final : le run s'arrête là.
    if (etat.tempsJeuMs - derniereZoneMs >= politique.patienceMs) break

    const dps = degatsParSeconde(etat, constantes)
    const echeances = [
      delaiProchainCombatMs(etat, constantes, dps),
      delaiProchainSortMs(etat, constantes),
      delaiProchainAchatMs(etat, constantes, tauxOrParSeconde(etat, constantes, politique, false), politique),
      60_000,
    ]
    let delai = Number.POSITIVE_INFINITY
    for (const e of echeances) if (Number.isFinite(e) && e >= 0 && e < delai) delai = e
    if (!Number.isFinite(delai)) break
    etat = pasDeJeu(
      etat,
      Math.max(1, Math.ceil(delai / PAS_TICK_MS)),
      constantes,
      constantesFermees,
      constantesSansAutoCast,
    )
    pas += 1
  }

  return points
}

/**
 * EXG-28 — évalue un jeu de constantes de boss final contre la trajectoire du dernier run. Le combat
 * suit la règle des boss du moteur (EXG-16) : le joueur gagne si ses dégâts soutenus viennent à bout des
 * PV dans le chrono, donc dès que `PV / DPS_soutenu ≤ chrono`.
 *
 * Les PV sont exprimés sur la formule de zone du moteur pour rester cohérents avec `pvBaseVague1` et
 * `multBoss` : `PV = pvBoss(profondeurEquivalente) × multPv`. Aucune formule n'est réécrite ici.
 */
export function evaluerBossFinal(
  constantes: Constantes,
  parametres: { profondeurEquivalente: number; multPv: number; timerS: number },
  trajectoire: readonly PointTrajectoire[],
): MesureBossFinal {
  const pv = pvBoss(parametres.profondeurEquivalente, constantes) * parametres.multPv
  const premier = trajectoire[0]
  const dpsDepart = premier === undefined ? 0 : premier.dpsSoutenu
  const gagneDesLeDepart = dpsDepart > 0 && pv / dpsDepart <= parametres.timerS

  let tempsAvantVictoireMs: number | null = null
  let dpsAuMoment = dpsDepart
  let dureeCombatS: number | null = null
  let zoneVictoire: number | null = null
  for (const point of trajectoire) {
    if (!(point.dpsSoutenu > 0)) continue
    const duree = pv / point.dpsSoutenu
    if (duree <= parametres.timerS) {
      tempsAvantVictoireMs = point.tMs
      dpsAuMoment = point.dpsSoutenu
      dureeCombatS = duree
      zoneVictoire = point.zone
      break
    }
  }

  const dernier = trajectoire[trajectoire.length - 1]
  return {
    pvBoss: pv,
    dpsDepartDernierRun: dpsDepart,
    dpsMaxDernierRun: dernier === undefined ? 0 : Math.max(...trajectoire.map((t) => t.dpsSoutenu)),
    dpsAuMoment,
    tempsAvantVictoireMs,
    dureeDernierRunMs: dernier === undefined ? 0 : dernier.tMs,
    dureeCombatS,
    gagneDesLeDepart,
    partDuChrono: dureeCombatS === null ? null : dureeCombatS / parametres.timerS,
    zoneVictoire,
    timerS: parametres.timerS,
  }
}

export { MS_PAR_H, SEUIL_1E300 }
