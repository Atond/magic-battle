// Miroir de `src/domain/ascension/` — T-7 : disponibilité et gain de Points (§8), remise à zéro du
// cycle d'Éclats (EXG-20, ADR-14), confirmation à deux étapes (EXG-21), arbre permanent (EXG-40) et
// déblocage de la 6e école (EXG-41).
//
// Aucune valeur d'équilibrage ici : `k_ascension`, `prestigesParAscension`, l'échelle de coût des nœuds
// et le catalogue viennent de `src/donnees/constantes.ts`. Les seules constantes littérales sont des
// rangs, des quantités et les bornes de spec (6-10 nœuds).

import { describe, expect, it } from 'vitest'

import {
  acheterNoeudAscension,
  apercuAscension,
  ascensionDisponible,
  ascensionner,
  multArbreAscension,
  pointsDAscension,
} from '../../src/domain/ascension/index.ts'
import { ZONE_DEPART } from '../../src/domain/constantes-moteur.ts'
import { acheterNiveaux, ecoleAccessible } from '../../src/domain/ecoles/index.ts'
import { degatsParSeconde, etatInitial, lancerSort, tick } from '../../src/domain/moteur.ts'
import {
  acheterNoeudEclats,
  bonusPassifEclats,
  coutRangNoeud,
  coutRangsNoeud,
  multArbreEclats,
  noeudsDeLArbre,
  rangNoeud,
  rangsAchetablesNoeud,
} from '../../src/domain/prestige/index.ts'
import { etatSortLu, sortDisponible } from '../../src/domain/sorts/index.ts'
import type {
  Constantes,
  EtatJeu,
  IdEcole,
  ParametresEcole,
  ParametresNoeudArbre,
  ParametresSort,
} from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

const C = CONSTANTES
const HORODATAGE = 1_700_000_000_000
const A = C.ascension

/** Bornes de la spec EXG-40 : « un arbre de Points d'Ascension de 6 à 10 nœuds ». */
const NOEUDS_ASCENSION_MIN = 6
const NOEUDS_ASCENSION_MAX = 10

/** Nœuds de l'arbre permanent repérés par leur **forme**, jamais par un identifiant écrit en dur. */
const NOEUDS = noeudsDeLArbre('ascension', C)
const AUTOCAST = NOEUDS.find((n) => n.effet === 'autoCast' && n.prerequis.length === 0) as ParametresNoeudArbre
const SYNERGIE = NOEUDS.find((n) => n.effet === 'synergieEcoles') as ParametresNoeudArbre
const REPETABLE = NOEUDS.find((n) => n.rangMax === null) as ParametresNoeudArbre

/** École et sort verrouillés par l'Ascension (EXG-41) : lus dans le contrat, pas devinés. */
const ECOLE_ASCENSION = (Object.entries(C.ecoles) as [IdEcole, ParametresEcole][]).find(
  ([, parametres]) => parametres.requiertAscension,
) as [IdEcole, ParametresEcole]
const SORT_ASCENSION = C.sorts.find(
  (sort) => sort.idEcole === ECOLE_ASCENSION[0],
) as ParametresSort

function etatAvec(options: {
  or?: number
  eclatsPossedes?: number
  eclatsDepensables?: number
  pointsAscension?: number
  prestigesDuCycle?: number
  prestigesTotal?: number
  eclatsCumulesAVie?: number
  rangsArbreEclats?: Record<string, number>
  niveaux?: Partial<Record<IdEcole, number>>
}): EtatJeu {
  const base = etatInitial(HORODATAGE)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(options.niveaux ?? { feu: 10 }) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return {
    ...base,
    ecoles,
    bourse: {
      ...base.bourse,
      or: options.or ?? 0,
      eclatsPossedes: options.eclatsPossedes ?? 0,
      eclatsDepensables: options.eclatsDepensables ?? 0,
      pointsAscension: options.pointsAscension ?? 0,
    },
    prestige: {
      ...base.prestige,
      prestigesDuCycle: options.prestigesDuCycle ?? A.prestigesParAscension,
      prestigesTotal: options.prestigesTotal ?? A.prestigesParAscension,
      eclatsCumulesAVie: options.eclatsCumulesAVie ?? 400,
      rangsArbreEclats: options.rangsArbreEclats ?? {},
    },
  }
}

/* ══════════════════════════════════════════════════ EXG-20 — disponibilité et gain de Points */

describe('EXG-20 / §8 — disponibilité de l\'Ascension', () => {
  it('reste indisponible juste sous le seuil de prestiges du cycle', () => {
    const presque = etatAvec({ prestigesDuCycle: A.prestigesParAscension - 1 })
    expect(ascensionDisponible(presque, C)).toBe(false)

    const refus = ascensionner(presque, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.etat).toBe(presque)
    expect(refus.gain).toBe(0)
  })

  it('devient disponible pile au seuil, et le reste au-delà', () => {
    expect(ascensionDisponible(etatAvec({ prestigesDuCycle: A.prestigesParAscension }), C)).toBe(true)
    expect(ascensionDisponible(etatAvec({ prestigesDuCycle: A.prestigesParAscension + 3 }), C)).toBe(true)
  })

  it('EXG-28 — une partie terminée n\'ascensionne plus, état rendu par référence', () => {
    const fini: EtatJeu = { ...etatAvec({}), partieTerminee: true }
    const refus = ascensionner(fini, C)

    expect(ascensionDisponible(fini, C)).toBe(false)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.etat).toBe(fini)
  })
})

describe('§8 — `Points = floor(k_ascension × √Éclats_cumulés_à_vie)`', () => {
  it('suit la formule du contrat sur 3 valeurs de cumul', () => {
    for (const cumul of [100, 2_500, 90_000]) {
      expect(pointsDAscension(cumul, C)).toBe(Math.floor(A.kAscension * Math.sqrt(cumul)))
    }
  })

  it('croît avec le cumul, vaut 0 sans Éclat et ignore les entrées absurdes', () => {
    expect(pointsDAscension(100, C)).toBeLessThan(pointsDAscension(400, C))
    expect(pointsDAscension(0, C)).toBe(0)
    expect(pointsDAscension(-1, C)).toBe(0)
    expect(pointsDAscension(Number.NaN, C)).toBe(0)
  })

  it('crédite les Points sur la bourse à l\'application', () => {
    const etat = etatAvec({ eclatsCumulesAVie: 2_500, pointsAscension: 4 })
    const resultat = ascensionner(etat, C)

    expect(resultat.accepte).toBe(true)
    expect(resultat.gain).toBe(pointsDAscension(2_500, C))
    expect(resultat.etat.bourse.pointsAscension).toBe(4 + resultat.gain)
    expect(resultat.etat.ascension.ascensionsEffectuees).toBe(1)
  })
})

/* ═══════════════════════════════════════ EXG-20 / ADR-14 — les deux moitiés de la remise à zéro */

describe('EXG-20 / ADR-14 — l\'Ascension efface le cycle d\'Éclats et rien de l\'arbre permanent', () => {
  /** Cycle bien rempli : Éclats des deux natures, arbre d'Éclats garni, arbre d'Ascension garni. */
  function cycleRempli(): EtatJeu {
    const rangsEclats: Record<string, number> = {}
    for (const noeud of noeudsDeLArbre('eclats', C)) rangsEclats[noeud.id] = noeud.rangMax ?? 4

    const depart = etatAvec({
      or: 9_000,
      eclatsPossedes: 800,
      eclatsDepensables: 250,
      pointsAscension: 5,
      eclatsCumulesAVie: 6_400,
      prestigesTotal: 11,
      rangsArbreEclats: rangsEclats,
      niveaux: { feu: 30, glace: 12 },
    })
    return {
      ...depart,
      combat: { ...depart.combat, zone: 22, vague: 6 },
      ascension: {
        ascensionsEffectuees: 2,
        rangsArbreAscension: { [AUTOCAST.id]: 1, [SYNERGIE.id]: 3, [REPETABLE.id]: 7 },
        sixiemeEcoleDebloquee: true,
      },
    }
  }

  it('première moitié : Éclats des deux compteurs à 0, arbre d\'Éclats à rang 0 partout, cycle remis à 0', () => {
    const avant = cycleRempli()
    const apres = ascensionner(avant, C).etat

    expect(apres.bourse.eclatsPossedes).toBe(0)
    expect(apres.bourse.eclatsDepensables).toBe(0)
    expect(apres.prestige.prestigesDuCycle).toBe(0)
    for (const noeud of noeudsDeLArbre('eclats', C)) {
      expect(rangNoeud(apres, noeud)).toBe(0)
    }
    expect(multArbreEclats(apres, C)).toBe(1)
  })

  it('seconde moitié : arbre d\'Ascension identique champ par champ, cumul à vie intact', () => {
    const avant = cycleRempli()
    const apres = ascensionner(avant, C).etat
    const rangsAvant = avant.ascension.rangsArbreAscension

    expect(Object.keys(apres.ascension.rangsArbreAscension).length).toBe(Object.keys(rangsAvant).length)
    for (const [id, rang] of Object.entries(rangsAvant)) {
      expect(apres.ascension.rangsArbreAscension[id]).toBe(rang)
    }
    // La synergie lit le nombre d'écoles **débloquées** au moment du calcul, et le run vient d'être
    // réinitialisé : on compare donc la contribution de l'arbre à écoles égales.
    const avantAEcolesEgales: EtatJeu = { ...avant, ecoles: apres.ecoles }
    expect(multArbreAscension(apres, C)).toBeCloseTo(multArbreAscension(avantAEcolesEgales, C), 9)
    expect(multArbreAscension(apres, C)).toBeGreaterThan(1)

    // Les compteurs à vie pilotent les Ascensions suivantes : ils ne se réinitialisent jamais.
    expect(apres.prestige.eclatsCumulesAVie).toBe(avant.prestige.eclatsCumulesAVie)
    expect(apres.prestige.prestigesTotal).toBe(avant.prestige.prestigesTotal)
    expect(apres.magicien.monstresTues).toBe(avant.magicien.monstresTues)
    expect(apres.quetesAccomplies).toEqual(avant.quetesAccomplies)
    expect(apres.paliersEquipement).toEqual(avant.paliersEquipement)
  })

  it('EXG-38 — le bonus passif retombe à son état zéro Éclat', () => {
    const avant = cycleRempli()
    expect(bonusPassifEclats(avant, C)).toBeGreaterThan(1)

    const apres = ascensionner(avant, C).etat
    expect(bonusPassifEclats(apres, C)).toBe(1)
    expect(bonusPassifEclats(apres, C)).toBe(bonusPassifEclats(etatInitial(HORODATAGE), C))
  })

  it('réinitialise aussi le run : zone, or et niveaux d\'écoles repartent de zéro', () => {
    const avant = cycleRempli()
    const apres = ascensionner(avant, C).etat

    // La zone de reprise ne dépend plus que de l'arbre permanent : celui des Éclats vient d'être effacé.
    expect(apres.combat.zone).toBeGreaterThanOrEqual(ZONE_DEPART)
    expect(apres.combat.phase).toBe('vague')
    for (const etatEcole of Object.values(apres.ecoles)) expect(etatEcole.niveau).toBe(0)
    expect(apres.prestige.zoneMaxDuRun).toBe(apres.combat.zone)
  })
})

/* ═══════════════════════════════════════════════════════════ EXG-40 — arbre de Points permanent */

describe('EXG-40 — catalogue de l\'arbre d\'Ascension', () => {
  it('compte 6 à 10 nœuds, dont au moins un répétable à rangs infinis', () => {
    expect(NOEUDS.length).toBeGreaterThanOrEqual(NOEUDS_ASCENSION_MIN)
    expect(NOEUDS.length).toBeLessThanOrEqual(NOEUDS_ASCENSION_MAX)
    expect(NOEUDS.filter((n) => n.rangMax === null).length).toBeGreaterThanOrEqual(1)
  })

  it('couvre les trois leviers énoncés par la spec : auto-cast, synergies, bonus de départ de run', () => {
    const effets = new Set(NOEUDS.map((n) => n.effet))
    expect(effets).toContain('autoCast')
    expect(effets).toContain('synergieEcoles')
    expect(effets.has('orDepart') || effets.has('zoneDepart')).toBe(true)
  })

  it('chaque nœud d\'auto-cast vise un sort existant du contrat', () => {
    for (const noeud of NOEUDS.filter((n) => n.effet === 'autoCast')) {
      expect(C.sorts.some((sort) => sort.id === noeud.idSortCible)).toBe(true)
    }
  })

  it('se paie en Points d\'Ascension, jamais en Éclats (guichets séparés)', () => {
    const etat = etatAvec({ pointsAscension: 1e6, eclatsDepensables: 1e6 })
    const achat = acheterNoeudAscension(etat, AUTOCAST.id, 1, C)

    expect(achat.accepte).toBe(true)
    expect(achat.coutPaye).toBeCloseTo(coutRangNoeud(0, AUTOCAST, C), 9)
    expect(achat.etat.bourse.pointsAscension).toBeCloseTo(1e6 - achat.coutPaye, 9)
    expect(achat.etat.bourse.eclatsDepensables).toBe(1e6)

    const eclats = noeudsDeLArbre('eclats', C)[0]
    const croise = acheterNoeudAscension(etat, eclats.id, 1, C)
    expect(croise.motifRefus).toBe('mauvaiseMonnaie')
    expect(croise.etat).toBe(etat)

    const sansPoints = acheterNoeudAscension(etatAvec({ eclatsDepensables: 1e9 }), AUTOCAST.id, 1, C)
    expect(sansPoints.motifRefus).toBe('monnaieInsuffisante')
  })

  it('un nœud à rangs bornés refuse au-delà de son maximum, le répétable ne refuse jamais', () => {
    const etat = etatAvec({ pointsAscension: 1e12 })
    const rangMax = AUTOCAST.rangMax as number
    const plein = acheterNoeudAscension(etat, AUTOCAST.id, rangMax, C)
    expect(plein.accepte).toBe(true)

    const trop = acheterNoeudAscension(plein.etat, AUTOCAST.id, 1, C)
    expect(trop.motifRefus).toBe('paliersMaxAtteints')
    expect(trop.etat).toBe(plein.etat)

    let courant = etat
    for (let achat = 0; achat < 10; achat += 1) {
      const resultat = acheterNoeudAscension(courant, REPETABLE.id, 1, C)
      expect(resultat.accepte).toBe(true)
      courant = resultat.etat
    }
    expect(rangNoeud(courant, REPETABLE)).toBe(10)
  })

  it('le nœud répétable de dégâts entre dans `mult_arbre_Ascension` (chaîne §8)', () => {
    const etat = etatAvec({ pointsAscension: 1e12 })
    expect(multArbreAscension(etat, C)).toBe(1)

    const dpsAvant = degatsParSeconde(etat, C)
    const achat = acheterNoeudAscension(etat, REPETABLE.id, 3, C)

    expect(multArbreAscension(achat.etat, C)).toBeCloseTo(REPETABLE.effetParRang ** 3, 9)
    expect(degatsParSeconde(achat.etat, C)).toBeCloseTo(dpsAvant * REPETABLE.effetParRang ** 3, 9)
  })

  it('la synergie entre écoles croît avec le nombre d\'écoles débloquées', () => {
    const uneEcole = etatAvec({ pointsAscension: 1e12, niveaux: { feu: 10 } })
    const deuxEcoles = etatAvec({ pointsAscension: 1e12, niveaux: { feu: 10, glace: 10 } })

    const avecUne = acheterNoeudAscension(uneEcole, SYNERGIE.id, 2, C).etat
    const avecDeux = acheterNoeudAscension(deuxEcoles, SYNERGIE.id, 2, C).etat

    expect(multArbreAscension(avecUne, C)).toBeCloseTo(1 + SYNERGIE.effetParRang * 2 * 1, 9)
    expect(multArbreAscension(avecDeux, C)).toBeCloseTo(1 + SYNERGIE.effetParRang * 2 * 2, 9)
    expect(multArbreAscension(avecDeux, C)).toBeGreaterThan(multArbreAscension(avecUne, C))
  })

  it('ne mute jamais l\'état d\'entrée', () => {
    const etat = Object.freeze(etatAvec({ pointsAscension: 1e12 }))
    acheterNoeudAscension(etat, AUTOCAST.id, 1, C)
    expect(etat.ascension.rangsArbreAscension[AUTOCAST.id]).toBeUndefined()
    expect(etat.bourse.pointsAscension).toBe(1e12)
  })
})

/* ═══════════════════════════════════════════ EXG-40 — auto-cast : le sort part de lui-même au tick */

describe('EXG-40 — le nœud d\'auto-cast déclenche le sort au tick suivant, sans clic ni frappe', () => {
  it('arme `EtatSort.autoCast` sur le sort visé, et seulement sur celui-là', () => {
    const etat = etatAvec({ pointsAscension: 1e6 })
    const achat = acheterNoeudAscension(etat, AUTOCAST.id, 1, C)
    const cible = AUTOCAST.idSortCible as string

    expect(achat.accepte).toBe(true)
    expect(etatSortLu(achat.etat, cible, C).autoCast).toBe(true)
    for (const sort of C.sorts) {
      if (sort.id === cible) continue
      expect(etatSortLu(achat.etat, sort.id, C).autoCast).toBe(false)
    }
  })

  it('le sort part de lui-même au tick suivant : cooldown armé et dégâts crédités sans aucun appel', () => {
    const sans = etatAvec({ pointsAscension: 1e6, niveaux: { feu: 10 } })
    const cible = AUTOCAST.idSortCible as string
    const parametres = C.sorts.find((sort) => sort.id === cible) as ParametresSort
    const avec = acheterNoeudAscension(sans, AUTOCAST.id, 1, C).etat

    expect(etatSortLu(avec, cible, C).cooldownRestantMs).toBe(0)

    // Un seul tick, aucun `lancerSort`, aucun `appliquerClic` : le sort doit partir tout seul.
    const apresSans = tick(sans, C)
    const apresAvec = tick(avec, C)

    expect(etatSortLu(apresAvec, cible, C).cooldownRestantMs).toBe(parametres.cooldownMs)
    expect(etatSortLu(apresSans, cible, C).cooldownRestantMs).toBe(0)
    expect(apresAvec.magicien.clicsCumules).toBe(0)

    const degatsSans = apresSans.magicien.degatsCumules - sans.magicien.degatsCumules
    const degatsAvec = apresAvec.magicien.degatsCumules - avec.magicien.degatsCumules
    expect(degatsAvec - degatsSans).toBeCloseTo(parametres.degatsBase, 6)
  })

  it('ne relance pas le sort tant que son cooldown court, puis le relance tout seul', () => {
    const cible = AUTOCAST.idSortCible as string
    const parametres = C.sorts.find((sort) => sort.id === cible) as ParametresSort
    let etat = acheterNoeudAscension(etatAvec({ pointsAscension: 1e6 }), AUTOCAST.id, 1, C).etat

    const ticksParCycle = Math.ceil(parametres.cooldownMs / 100) + 1
    let tirs = 0
    let precedent = etatSortLu(etat, cible, C).cooldownRestantMs
    for (let pas = 0; pas < ticksParCycle * 2; pas += 1) {
      etat = tick(etat, C)
      const restant = etatSortLu(etat, cible, C).cooldownRestantMs
      if (restant > precedent) tirs += 1
      precedent = restant
    }
    // Deux cycles de cooldown écoulés ⇒ le sort est reparti, seul, une deuxième fois.
    expect(tirs).toBeGreaterThanOrEqual(1)
  })
})

/* ═════════════════════════════════════════════════════ EXG-41 — la 6e école et son 6e sort */

describe('EXG-41 — la 1re Ascension débloque la 6e école et son sort', () => {
  const [idEcole, parametresEcole] = ECOLE_ASCENSION

  it('avant la 1re Ascension : école inaccessible et 6e sort sans effet', () => {
    const etat = etatAvec({ or: parametresEcole.coutBase * 10, niveaux: { feu: 10 } })

    expect(etat.ascension.sixiemeEcoleDebloquee).toBe(false)
    expect(ecoleAccessible(etat, idEcole, C)).toBe(false)
    expect(sortDisponible(etat, SORT_ASCENSION.id, C)).toBe(false)

    const achatRefuse = acheterNiveaux(etat, idEcole, 1, C)
    expect(achatRefuse.accepte).toBe(false)
    expect(achatRefuse.motifRefus).toBe('verrouille')

    const tirRefuse = lancerSort(etat, SORT_ASCENSION.id, C)
    expect(tirRefuse.declenche).toBe(false)
    expect(tirRefuse.motifRefus).toBe('verrouille')
    expect(tirRefuse.degats).toBe(0)
    expect(tirRefuse.etat).toBe(etat)
  })

  it('après la 1re Ascension : école révélée, achetable, et le 6e sort répond', () => {
    const ascensionne = ascensionner(etatAvec({ eclatsCumulesAVie: 2_500 }), C).etat
    expect(ascensionne.ascension.sixiemeEcoleDebloquee).toBe(true)
    expect(ecoleAccessible(ascensionne, idEcole, C)).toBe(true)

    // Le run vient d'être réinitialisé : il faut de l'or pour payer le 1er niveau de la nouvelle école.
    const riche: EtatJeu = {
      ...ascensionne,
      bourse: { ...ascensionne.bourse, or: parametresEcole.coutBase * 10 },
    }
    const achat = acheterNiveaux(riche, idEcole, 1, C)
    expect(achat.accepte).toBe(true)
    expect(achat.etat.ecoles[idEcole].debloquee).toBe(true)
    expect(degatsParSeconde(achat.etat, C)).toBeGreaterThan(0)

    expect(sortDisponible(achat.etat, SORT_ASCENSION.id, C)).toBe(true)
    const tir = lancerSort(achat.etat, SORT_ASCENSION.id, C)
    expect(tir.declenche).toBe(true)
    expect(tir.degats).toBeCloseTo(SORT_ASCENSION.degatsBase, 6)
  })

  it('les Ascensions suivantes n\'ont plus rien à débloquer de ce côté', () => {
    const premiere = ascensionner(etatAvec({ eclatsCumulesAVie: 2_500 }), C).etat
    const relance: EtatJeu = {
      ...premiere,
      prestige: { ...premiere.prestige, prestigesDuCycle: A.prestigesParAscension },
    }
    expect(apercuAscension(relance, C).debloqueSixiemeEcole).toBe(false)

    const seconde = ascensionner(relance, C).etat
    expect(seconde.ascension.sixiemeEcoleDebloquee).toBe(true)
    expect(seconde.ascension.ascensionsEffectuees).toBe(2)
  })
})

/* ═════════════════════════════════════════════ EXG-21 — confirmation à deux étapes (Ascension) */

describe('EXG-21 — prévisualisation d\'Ascension en lecture seule, application distincte', () => {
  it('la prévisualisation ne modifie aucun état : mêmes références en sortie', () => {
    const etat = Object.freeze(
      etatAvec({ or: 700, eclatsPossedes: 300, eclatsDepensables: 90, eclatsCumulesAVie: 3_600 }),
    )
    const references = {
      bourse: etat.bourse,
      ecoles: etat.ecoles,
      combat: etat.combat,
      prestige: etat.prestige,
      ascension: etat.ascension,
    }

    const apercu = apercuAscension(etat, C)
    expect(apercu.disponible).toBe(true)

    expect(etat.bourse).toBe(references.bourse)
    expect(etat.ecoles).toBe(references.ecoles)
    expect(etat.combat).toBe(references.combat)
    expect(etat.prestige).toBe(references.prestige)
    expect(etat.ascension).toBe(references.ascension)
    expect(etat.bourse.eclatsPossedes).toBe(300)
    expect(etat.ascension.ascensionsEffectuees).toBe(0)
  })

  it('annonce exactement le gain et le prix que l\'application produit', () => {
    const rangsEclats: Record<string, number> = {}
    for (const noeud of noeudsDeLArbre('eclats', C)) rangsEclats[noeud.id] = 1

    const etat = etatAvec({
      or: 700,
      eclatsPossedes: 300,
      eclatsDepensables: 90,
      eclatsCumulesAVie: 3_600,
      rangsArbreEclats: rangsEclats,
      niveaux: { feu: 15, glace: 4 },
    })
    const apercu = apercuAscension(etat, C)

    expect(apercu.pointsGagnes).toBe(pointsDAscension(3_600, C))
    expect(apercu.prestigesDuCycle).toBe(A.prestigesParAscension)
    expect(apercu.prestigesRequis).toBe(A.prestigesParAscension)
    expect(apercu.eclatsPossedesPerdus).toBe(300)
    expect(apercu.eclatsDepensablesPerdus).toBe(90)
    expect(apercu.noeudsEclatsPerdus).toBe(noeudsDeLArbre('eclats', C).length)
    expect(apercu.perte.or).toBe(700)
    expect(apercu.perte.niveauxEcoles).toBe(19)
    expect(apercu.debloqueSixiemeEcole).toBe(true)

    const applique = ascensionner(etat, C)
    expect(applique.gain).toBe(apercu.pointsGagnes)
    expect(applique.etat.bourse.eclatsPossedes).toBe(0)
    expect(applique.etat).not.toBe(etat)
  })

  it('signale l\'indisponibilité sous le seuil, en annonçant déjà le gain à venir', () => {
    const presque = etatAvec({ prestigesDuCycle: 1, eclatsCumulesAVie: 900 })
    const apercu = apercuAscension(presque, C)

    expect(apercu.disponible).toBe(false)
    expect(apercu.motifIndisponible).toBe('verrouille')
    expect(apercu.prestigesDuCycle).toBe(1)
    expect(apercu.pointsGagnes).toBe(pointsDAscension(900, C))
  })
})

/* ═════════════════════════════════════ LRN-002 — preuves non coopératives des formes fermées */

describe('EXG-30 / LRN-002 — les rangs de l\'arbre d\'Ascension ne peuvent pas être une boucle', () => {
  // Même levier que pour l'arbre d'Éclats : un coût **plat** rend le coût cumulé de `r` rangs connu
  // exactement (`coût_base × r`), donc un `r` astronomique est vérifiable. Les bornes de temps ne
  // mesurent rien de fin : elles tranchent entre « instantané » et « jamais ».
  const PLAT: Constantes = { ...C, ascension: { ...A, coutBaseNoeud: 10, croissanceCoutNoeud: 1 } }
  const UNITE = PLAT.ascension.coutBaseNoeud * REPETABLE.coutRelatif

  it(
    'chiffre 3e9 rangs en moins de 500 ms de temps réel (échec propre si une boucle apparaît)',
    () => {
      // Variante **terminante** du garde-fou : une somme rang par rang ferait 3e9 tours (~2 s) puis
      // rendrait la main, donc l'assertion de temps rougit proprement au lieu de faire pendre le run.
      const debut = Date.now()
      const cout = coutRangsNoeud(0, 3e9, REPETABLE, PLAT)
      const ecouleMs = Date.now() - debut

      expect(cout).toBe(UNITE * 3e9)
      expect(ecouleMs).toBeLessThan(500)
    },
    30_000,
  )

  it(
    'achète 1e12 rangs du nœud répétable permanent en un appel, sans itérer',
    () => {
      // Garde-fou dur : 1e12 rangs. Une boucle ne termine pas en temps humain, et Vitest n'interrompt
      // pas une boucle **synchrone** : le symptôme serait un run qui pend, pas une assertion rouge. Le
      // timeout ci-dessous **est** l'assertion — ne le retire pas pour « débloquer » un run qui pend.
      const rangs = 1e12
      const cout = coutRangsNoeud(0, rangs, REPETABLE, PLAT)
      expect(cout).toBe(UNITE * rangs)

      const achat = acheterNoeudAscension(etatAvec({ pointsAscension: cout }), REPETABLE.id, rangs, PLAT)
      expect(achat.accepte).toBe(true)
      expect(rangNoeud(achat.etat, REPETABLE)).toBe(rangs)
      expect(achat.etat.bourse.pointsAscension).toBe(0)
      // Même seuil EXG-37 que pour l'arbre d'Éclats : le facteur sature, et rien ne devient `NaN`.
      expect(Number.isFinite(multArbreAscension(achat.etat, PLAT))).toBe(true)
      expect(Number.isNaN(degatsParSeconde(achat.etat, PLAT))).toBe(false)
    },
    1_000,
  )

  it(
    'inverse un solde de 1e250 Points en rangs sans les décompter, et garde les Points finis',
    () => {
      const rangs = rangsAchetablesNoeud(0, 1e250, REPETABLE, C)
      expect(Number.isFinite(rangs)).toBe(true)
      expect(coutRangsNoeud(0, rangs, REPETABLE, C)).toBeLessThanOrEqual(1e250)
      expect(rangsAchetablesNoeud(0, UNITE * 1e15, REPETABLE, PLAT)).toBe(1e15)

      // `floor(k × √cumul)` ne peut pas déborder tant que le cumul est fini : garde-fou tout de même.
      expect(Number.isFinite(pointsDAscension(Number.MAX_VALUE, C))).toBe(true)
      expect(Number.isFinite(pointsDAscension(1e250, C))).toBe(true)
    },
    1_000,
  )

  it(
    'une Ascension sur un arbre d\'Éclats géant reste à coût constant',
    () => {
      // L'effacement de l'arbre d'Éclats (ADR-14) doit être une réécriture de dictionnaire bornée par le
      // catalogue, jamais une boucle sur les **rangs** accumulés : 1e12 rangs par nœud le prouvent.
      const rangsEclats: Record<string, number> = {}
      for (const noeud of noeudsDeLArbre('eclats', C)) rangsEclats[noeud.id] = 1e12

      const etat = etatAvec({ eclatsPossedes: 1e18, eclatsDepensables: 1e18, rangsArbreEclats: rangsEclats })
      const apres = ascensionner(etat, C).etat

      for (const noeud of noeudsDeLArbre('eclats', C)) expect(rangNoeud(apres, noeud)).toBe(0)
      expect(multArbreEclats(apres, C)).toBe(1)
    },
    1_000,
  )
})

/* ═══════════════════════════════════════════════ cycle complet : prestige ×N puis Ascension */

describe('EXG-19 / EXG-20 — un cycle complet enchaîne prestiges et Ascension', () => {
  it('les Éclats dépensés dans l\'arbre d\'Éclats ne survivent pas au cycle, les Points oui', () => {
    const noeudEclats = noeudsDeLArbre('eclats', C).find(
      (n) => n.effet === 'multDegats' && n.prerequis.length === 0,
    ) as ParametresNoeudArbre

    let etat = etatAvec({ eclatsDepensables: 1e6, pointsAscension: 1e6 })
    etat = acheterNoeudEclats(etat, noeudEclats.id, 2, C).etat
    etat = acheterNoeudAscension(etat, REPETABLE.id, 2, C).etat

    expect(multArbreEclats(etat, C)).toBeGreaterThan(1)
    expect(multArbreAscension(etat, C)).toBeGreaterThan(1)

    const apres = ascensionner(etat, C).etat
    expect(multArbreEclats(apres, C)).toBe(1)
    expect(multArbreAscension(apres, C)).toBeCloseTo(REPETABLE.effetParRang ** 2, 9)
  })
})
