// Miroir de `src/domain/prestige/` — T-6 : gain d'Éclats (EXG-18), réinitialisation du run (EXG-19),
// confirmation à deux étapes (EXG-21), bonus passif (EXG-38) et arbre d'Éclats (EXG-39, ADR-8).
//
// Aucune valeur d'équilibrage ici : `k`, `α`, `B`, `β`, l'échelle de coût des nœuds et le catalogue
// lui-même viennent de `src/donnees/constantes.ts`. Les seules constantes littérales des tests sont des
// rangs, des quantités et des bornes de spec (8-12 nœuds, zone 1).

import { describe, expect, it } from 'vitest'

import { PAS_TICK_MS, ZONE_DEPART } from '../../src/domain/constantes-moteur.ts'
import { appliquerClic, degatsParSeconde, etatInitial, lancerSort, tick } from '../../src/domain/moteur.ts'
import {
  acheterNoeudEclats,
  apercuPrestige,
  bonusPassifEclats,
  coutRangNoeud,
  coutRangsNoeud,
  eclatsAuPrestige,
  facteurCooldownArbres,
  multArbreEclats,
  multOrArbres,
  noeudParId,
  noeudsDeLArbre,
  orDepartRun,
  prestiger,
  rangNoeud,
  rangsAchetablesNoeud,
  zoneDepartRun,
} from '../../src/domain/prestige/index.ts'
import { acheterNoeudAscension } from '../../src/domain/ascension/index.ts'
import { etatSortLu } from '../../src/domain/sorts/index.ts'
import type {
  Constantes,
  EtatJeu,
  IdEcole,
  ParametresNoeudArbre,
} from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

const C = CONSTANTES
const HORODATAGE = 1_700_000_000_000
const P = C.prestige

/** Bornes de la spec EXG-39 : « un arbre de dépense des Éclats de 8 à 12 nœuds ». */
const NOEUDS_ECLATS_MIN = 8
const NOEUDS_ECLATS_MAX = 12

/** Nœud racine de dégâts à rangs bornés, et le nœud répétable exigé par §8 — trouvés par leur forme. */
const RACINE = noeudsDeLArbre('eclats', C).find(
  (n) => n.effet === 'multDegats' && n.prerequis.length === 0 && n.rangMax !== null,
) as ParametresNoeudArbre
const REPETABLE = noeudsDeLArbre('eclats', C).find((n) => n.rangMax === null) as ParametresNoeudArbre

/** État de jeu paramétrable : écoles montées, bourse garnie, profondeur de run atteinte. */
function etatAvec(options: {
  or?: number
  eclatsPossedes?: number
  eclatsDepensables?: number
  pointsAscension?: number
  zoneMaxDuRun?: number
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
    prestige: { ...base.prestige, zoneMaxDuRun: options.zoneMaxDuRun ?? ZONE_DEPART },
  }
}

/* ══════════════════════════════════════════════════════════════════ EXG-18 — gain d'Éclats */

describe('EXG-18 — `Éclats = floor(k × zone_max^α)`', () => {
  it('suit la formule du contrat sur 3 valeurs de zone maximale', () => {
    for (const zoneMax of [5, 10, 20]) {
      expect(eclatsAuPrestige(zoneMax, C)).toBe(Math.floor(P.k * zoneMax ** P.alpha))
    }
  })

  it('croît strictement avec la zone maximale atteinte', () => {
    expect(eclatsAuPrestige(10, C)).toBeLessThan(eclatsAuPrestige(20, C))
    expect(eclatsAuPrestige(20, C)).toBeLessThan(eclatsAuPrestige(40, C))
  })

  // Un prestige à la zone de départ rapporte **0** Éclat avec les constantes réelles (k = 0,3, α = 1 :
  // il faut la zone 4 pour en gagner un). Ce n'est pas un défaut : EXG-18 exige la formule et la
  // croissance stricte, pas un plancher à 1, et le 1er prestige réel survient bien plus profond (2,77 h
  // de jeu mesurées par le rapport `tools/idle-balance/rapports/2026-09-21.md`). Ce que le test doit
  // donc verrouiller, c'est qu'un gain nul reste un **entier fini non négatif** et n'empoisonne rien en
  // aval — un `-0`, un `NaN` ou un flottant casserait le solde d'Éclats et le bonus passif d'EXG-38.
  // Conséquence produit pour T-23 : la confirmation à deux étapes doit afficher le gain, y compris nul,
  // pour qu'un joueur ne réinitialise jamais son run sans rien recevoir en échange.
  it('rend un entier fini non négatif à la zone de départ, gain nul compris', () => {
    const gain = eclatsAuPrestige(ZONE_DEPART, C)
    expect(gain).toBe(Math.floor(P.k * ZONE_DEPART ** P.alpha))
    expect(Number.isInteger(gain)).toBe(true)
    expect(Number.isFinite(gain)).toBe(true)
    expect(gain).toBeGreaterThanOrEqual(0)
    expect(Object.is(gain, -0)).toBe(false)
  })

  it('franchit le seuil de 1 Éclat à la profondeur prévue par les constantes réelles', () => {
    const zoneSeuil = Math.ceil((1 / P.k) ** (1 / P.alpha))
    expect(eclatsAuPrestige(zoneSeuil, C)).toBeGreaterThanOrEqual(1)
    expect(eclatsAuPrestige(zoneSeuil - 1, C)).toBe(0)
  })

  it('refuse les entrées absurdes sans propager de NaN', () => {
    expect(eclatsAuPrestige(Number.NaN, C)).toBe(eclatsAuPrestige(ZONE_DEPART, C))
    expect(eclatsAuPrestige(-5, C)).toBe(eclatsAuPrestige(ZONE_DEPART, C))
    expect(eclatsAuPrestige(Number.POSITIVE_INFINITY, C)).toBeLessThan(Number.POSITIVE_INFINITY)
  })
})

/* ════════════════════════════════════════════════════════════ EXG-38 — bonus passif (ADR-8) */

describe('EXG-38 — bonus passif `(1 + B × Éclats_possédés)^β`', () => {
  it('vaut exactement 1 à 0 Éclat possédé (facteur neutre de la chaîne §8)', () => {
    expect(bonusPassifEclats(etatAvec({}), C)).toBe(1)
  })

  it('les dégâts à 10 Éclats suivent exactement la formule du contrat', () => {
    const nu = etatAvec({})
    const dixEclats = etatAvec({ eclatsPossedes: 10 })
    const attendu = (1 + P.bonusPassifB * 10) ** P.bonusPassifBeta

    expect(bonusPassifEclats(dixEclats, C)).toBeCloseTo(attendu, 12)
    expect(degatsParSeconde(nu, C)).toBeGreaterThan(0)
    expect(degatsParSeconde(dixEclats, C)).toBeCloseTo(degatsParSeconde(nu, C) * attendu, 9)
  })

  it('croît avec les Éclats possédés et reste fini pour un solde astronomique', () => {
    expect(bonusPassifEclats(etatAvec({ eclatsPossedes: 100 }), C)).toBeGreaterThan(
      bonusPassifEclats(etatAvec({ eclatsPossedes: 10 }), C),
    )
    const enorme = bonusPassifEclats(etatAvec({ eclatsPossedes: 1e250 }), C)
    expect(Number.isFinite(enorme)).toBe(true)
  })
})

/* ═══════════════════════════════════════════════════ EXG-39 — arbre d'Éclats : forme du catalogue */

describe('EXG-39 — catalogue de l\'arbre d\'Éclats (en donnée, jamais en dur)', () => {
  it('compte 8 à 12 nœuds, dont au moins un répétable à rangs infinis', () => {
    const noeuds = noeudsDeLArbre('eclats', C)
    expect(noeuds.length).toBeGreaterThanOrEqual(NOEUDS_ECLATS_MIN)
    expect(noeuds.length).toBeLessThanOrEqual(NOEUDS_ECLATS_MAX)
    expect(noeuds.filter((n) => n.rangMax === null).length).toBeGreaterThanOrEqual(1)
  })

  it('couvre les quatre leviers énoncés par la spec : dégâts, or, zone de départ, cooldowns', () => {
    const effets = new Set(noeudsDeLArbre('eclats', C).map((n) => n.effet))
    expect(effets).toContain('multDegats')
    expect(effets).toContain('multOr')
    expect(effets).toContain('zoneDepart')
    expect(effets).toContain('reductionCooldown')
  })

  it('ne référence que des prérequis et des sorts existants', () => {
    for (const noeud of noeudsDeLArbre('eclats', C)) {
      for (const prerequis of noeud.prerequis) {
        expect(noeudParId(prerequis, C)?.arbre).toBe('eclats')
      }
      expect(noeud.idSortCible).toBeNull()
    }
  })
})

/* ══════════════════════════════════════════════════════ EXG-39 — coûts des rangs (forme fermée) */

describe('EXG-39 — coût du rang r : `coûtBase × croissance^r`', () => {
  it('suit la formule du contrat sur les 3 premiers rangs', () => {
    for (let rang = 0; rang < 3; rang += 1) {
      const attendu = P.coutBaseNoeud * RACINE.coutRelatif * P.croissanceCoutNoeud ** rang
      expect(coutRangNoeud(rang, RACINE, C)).toBeCloseTo(attendu, 9)
    }
  })

  it('le coût cumulé de plusieurs rangs égale la somme itérée (forme fermée)', () => {
    let somme = 0
    for (let rang = 0; rang < 6; rang += 1) somme += coutRangNoeud(rang, REPETABLE, C)
    expect(Math.abs(coutRangsNoeud(0, 6, REPETABLE, C) - somme) / somme).toBeLessThan(1e-9)
  })

  it('un nœud plus lourd coûte plus cher au même rang', () => {
    const lourd = noeudsDeLArbre('eclats', C).reduce((a, b) => (a.coutRelatif >= b.coutRelatif ? a : b))
    expect(coutRangNoeud(0, lourd, C)).toBeGreaterThan(coutRangNoeud(0, RACINE, C))
  })
})

/* ══════════════════════════════════════════════════════════ ADR-8 — le double usage des Éclats */

describe('ADR-8 / EXG-39 — dépenser dans l\'arbre ne réduit jamais le bonus passif', () => {
  it('l\'achat décrémente `eclatsDepensables` et laisse `eclatsPossedes` intact', () => {
    const etat = etatAvec({ eclatsPossedes: 100, eclatsDepensables: 100 })
    const bonusAvant = bonusPassifEclats(etat, C)

    const achat = acheterNoeudEclats(etat, RACINE.id, 1, C)

    expect(achat.accepte).toBe(true)
    expect(achat.coutPaye).toBeCloseTo(coutRangNoeud(0, RACINE, C), 9)
    expect(achat.etat.bourse.eclatsDepensables).toBeCloseTo(100 - achat.coutPaye, 9)
    // Le compteur qui alimente EXG-38 ne bouge pas : c'est tout le sens d'ADR-8.
    expect(achat.etat.bourse.eclatsPossedes).toBe(100)
    expect(bonusPassifEclats(achat.etat, C)).toBe(bonusAvant)
  })

  it('le prestige crédite les **deux** compteurs du même montant', () => {
    const etat = etatAvec({ zoneMaxDuRun: 12 })
    const resultat = prestiger(etat, C)
    const gain = eclatsAuPrestige(12, C)

    expect(resultat.accepte).toBe(true)
    expect(resultat.gain).toBe(gain)
    expect(resultat.etat.bourse.eclatsPossedes).toBe(gain)
    expect(resultat.etat.bourse.eclatsDepensables).toBe(gain)
    expect(resultat.etat.prestige.eclatsCumulesAVie).toBe(gain)
  })
})

/* ═══════════════════════════════════════════════════════════ EXG-39 — effets des nœuds achetés */

describe('EXG-39 — les effets des nœuds entrent dans les formules du moteur', () => {
  it('un nœud de dégâts multiplie `mult_arbre_Éclats` dans la chaîne de DPS (§8)', () => {
    const etat = etatAvec({ eclatsDepensables: 1e6 })
    const dpsAvant = degatsParSeconde(etat, C)
    expect(multArbreEclats(etat, C)).toBe(1)

    const premier = acheterNoeudEclats(etat, RACINE.id, 1, C)
    const second = acheterNoeudEclats(premier.etat, RACINE.id, 1, C)

    expect(rangNoeud(second.etat, RACINE)).toBe(2)
    expect(multArbreEclats(second.etat, C)).toBeCloseTo(RACINE.effetParRang ** 2, 9)
    expect(degatsParSeconde(second.etat, C)).toBeCloseTo(dpsAvant * RACINE.effetParRang ** 2, 9)
  })

  it('un nœud d\'or multiplie l\'or crédité par le tick, sans toucher aux dégâts', () => {
    const noeudOr = noeudsDeLArbre('eclats', C).find((n) => n.effet === 'multOr') as ParametresNoeudArbre
    const etat = etatAvec({ eclatsDepensables: 1e6 })
    const achat = acheterNoeudEclats(etat, noeudOr.id, 1, C)

    expect(multOrArbres(etat, C)).toBe(1)
    expect(multOrArbres(achat.etat, C)).toBeCloseTo(noeudOr.effetParRang, 9)
    expect(degatsParSeconde(achat.etat, C)).toBeCloseTo(degatsParSeconde(etat, C), 9)

    const orSans = tick(etat, C).bourse.or - etat.bourse.or
    const orAvec = tick(achat.etat, C).bourse.or - achat.etat.bourse.or
    expect(orSans).toBeGreaterThan(0)
    expect(orAvec).toBeCloseTo(orSans * noeudOr.effetParRang, 9)
  })

  it('un nœud de cooldown raccourcit l\'attente d\'un sort (EXG-12), sans jamais l\'annuler', () => {
    const noeudCd = noeudsDeLArbre('eclats', C).find(
      (n) => n.effet === 'reductionCooldown',
    ) as ParametresNoeudArbre
    const sortFeu = C.sorts[0]
    const base = etatAvec({ eclatsDepensables: 1e6, niveaux: { feu: 10 } })

    const rangs = noeudCd.rangMax ?? 1
    const equipe = acheterNoeudEclats(base, noeudCd.id, rangs, C)
    expect(equipe.accepte).toBe(true)

    const facteur = facteurCooldownArbres(equipe.etat, C)
    expect(facteur).toBeLessThan(1)
    expect(facteur).toBeGreaterThan(0)
    expect(facteur).toBeCloseTo(noeudCd.effetParRang ** rangs, 9)

    /** Nombre de ticks à passer avant que le sort reparte, cooldown effectif compris. */
    const ticksPourEtrePret = (depart: EtatJeu): number => {
      let etat = lancerSort(depart, sortFeu.id, C).etat
      let ticks = 0
      while (etatSortLu(etat, sortFeu.id, C).cooldownRestantMs > 0 && ticks < 1_000) {
        etat = tick(etat, C)
        ticks += 1
      }
      return ticks
    }

    // Le cooldown effectif vaut `cooldownMs × facteur` : l'horloge de recharge tourne `1/facteur` fois
    // plus vite, ce qui est exactement équivalent et se mesure en nombre de ticks (EXG-1).
    const ticksSans = ticksPourEtrePret(base)
    const ticksAvec = ticksPourEtrePret(equipe.etat)
    expect(ticksSans).toBe(Math.ceil(sortFeu.cooldownMs / PAS_TICK_MS))
    expect(ticksAvec).toBe(Math.ceil(sortFeu.cooldownMs / (PAS_TICK_MS / facteur)))
    expect(ticksAvec).toBeLessThan(ticksSans)
  })

  it('un nœud de zone de départ décale la reprise du run (EXG-19)', () => {
    const noeudZone = noeudsDeLArbre('eclats', C).find(
      (n) => n.effet === 'zoneDepart',
    ) as ParametresNoeudArbre
    const etat = etatAvec({ eclatsDepensables: 1e9, zoneMaxDuRun: 12 })
    expect(zoneDepartRun(etat, C)).toBe(ZONE_DEPART)

    const achat = acheterNoeudEclats(etat, noeudZone.id, 2, C)
    expect(zoneDepartRun(achat.etat, C)).toBe(ZONE_DEPART + noeudZone.effetParRang * 2)

    const apres = prestiger(achat.etat, C)
    expect(apres.etat.combat.zone).toBe(ZONE_DEPART + noeudZone.effetParRang * 2)
    expect(apres.etat.prestige.zoneMaxDuRun).toBe(apres.etat.combat.zone)
  })
})

/* ════════════════════════════════════════════════════════════ EXG-39 — guichet d'achat (lot B) */

describe('EXG-39 — guichet d\'achat des nœuds : mêmes refus que le lot B', () => {
  it('un nœud à rangs bornés refuse au-delà de son maximum', () => {
    const etat = etatAvec({ eclatsDepensables: 1e12 })
    const rangMax = RACINE.rangMax as number
    const plein = acheterNoeudEclats(etat, RACINE.id, rangMax, C)

    expect(plein.accepte).toBe(true)
    expect(rangNoeud(plein.etat, RACINE)).toBe(rangMax)

    const trop = acheterNoeudEclats(plein.etat, RACINE.id, 1, C)
    expect(trop.accepte).toBe(false)
    expect(trop.motifRefus).toBe('paliersMaxAtteints')
    expect(trop.etat).toBe(plein.etat)
  })

  it('une quantité qui dépasse le rang maximal est refusée en bloc, sans achat partiel', () => {
    const etat = etatAvec({ eclatsDepensables: 1e12 })
    const trop = acheterNoeudEclats(etat, RACINE.id, (RACINE.rangMax as number) + 1, C)

    expect(trop.accepte).toBe(false)
    expect(trop.motifRefus).toBe('paliersMaxAtteints')
    expect(trop.etat).toBe(etat)
  })

  it('le nœud répétable reste achetable indéfiniment, à coût croissant', () => {
    let etat = etatAvec({ eclatsDepensables: 1e12 })
    let coutPrecedent = 0
    for (let achat = 0; achat < 12; achat += 1) {
      const resultat = acheterNoeudEclats(etat, REPETABLE.id, 1, C)
      expect(resultat.accepte).toBe(true)
      expect(resultat.coutPaye).toBeGreaterThan(coutPrecedent)
      coutPrecedent = resultat.coutPaye
      etat = resultat.etat
    }
    expect(rangNoeud(etat, REPETABLE)).toBe(12)
  })

  it('un nœud verrouillé par ses prérequis est refusé, puis s\'ouvre quand ils sont remplis', () => {
    const enfant = noeudsDeLArbre('eclats', C).find((n) => n.prerequis.length > 0) as ParametresNoeudArbre
    const etat = etatAvec({ eclatsDepensables: 1e12 })

    const refus = acheterNoeudEclats(etat, enfant.id, 1, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.etat).toBe(etat)

    let ouvert = etat
    for (const prerequis of enfant.prerequis) {
      ouvert = acheterNoeudEclats(ouvert, prerequis, 1, C).etat
    }
    expect(acheterNoeudEclats(ouvert, enfant.id, 1, C).accepte).toBe(true)
  })

  it('refuse un solde insuffisant en rendant l\'état d\'entrée par référence', () => {
    const etat = etatAvec({ eclatsDepensables: coutRangNoeud(0, RACINE, C) - 1 })
    const refus = acheterNoeudEclats(etat, RACINE.id, 1, C)

    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('monnaieInsuffisante')
    expect(refus.etat).toBe(etat)
    expect(refus.coutPaye).toBe(0)
    expect(refus.quantite).toBe(0)
  })

  it('ADR-8 — un stock d\'Éclats possédés n\'achète rien : seul le solde dépensable paie', () => {
    const etat = etatAvec({ eclatsPossedes: 1e12, eclatsDepensables: 0 })
    const refus = acheterNoeudEclats(etat, RACINE.id, 1, C)
    expect(refus.motifRefus).toBe('monnaieInsuffisante')
    expect(refus.etat.bourse.eclatsPossedes).toBe(1e12)
  })

  it('refuse un identifiant inconnu, un nœud de l\'autre arbre et une quantité invalide', () => {
    const etat = etatAvec({ eclatsDepensables: 1e12, pointsAscension: 1e12 })
    expect(acheterNoeudEclats(etat, 'noeud-fantome', 1, C).motifRefus).toBe('inconnu')

    const ascension = noeudsDeLArbre('ascension', C)[0]
    const croise = acheterNoeudEclats(etat, ascension.id, 1, C)
    expect(croise.motifRefus).toBe('mauvaiseMonnaie')
    expect(croise.etat).toBe(etat)
    expect(croise.etat.ascension.rangsArbreAscension[ascension.id]).toBeUndefined()

    expect(acheterNoeudEclats(etat, RACINE.id, 0, C).motifRefus).toBe('quantiteInvalide')
    expect(acheterNoeudEclats(etat, RACINE.id, Number.NaN, C).motifRefus).toBe('quantiteInvalide')
  })

  it('ne mute jamais l\'état d\'entrée', () => {
    const etat = Object.freeze(etatAvec({ eclatsDepensables: 1e12 }))
    acheterNoeudEclats(etat, RACINE.id, 3, C)
    expect(etat.prestige.rangsArbreEclats[RACINE.id]).toBeUndefined()
    expect(etat.bourse.eclatsDepensables).toBe(1e12)
  })
})

/* ════════════════════════════════════════════════════ EXG-19 — réinitialisation du run (reset) */

describe('EXG-19 — ce que le prestige remet à zéro et ce qui survit', () => {
  /** Run bien avancé : écoles montées, or en poche, améliorations, quêtes, arbres, compteurs à vie. */
  function runAvance(): EtatJeu {
    const depart = etatAvec({
      or: 5_000,
      eclatsPossedes: 40,
      eclatsDepensables: 40,
      pointsAscension: 7,
      zoneMaxDuRun: 15,
      niveaux: { feu: 20, glace: 5 },
    })
    const clique = appliquerClic(depart, C)
    return {
      ...clique,
      combat: { ...clique.combat, zone: 15, vague: 4, phase: 'boss', timerBossRestantMs: 1_200 },
      paliersAmeliorations: { [C.ameliorations[0].id]: 3 },
      paliersEquipement: { [C.equipement[0].id]: 2 },
      quetesAccomplies: [C.quetes[0].id],
      bourse: { ...clique.bourse, renommee: 120 },
      prestige: {
        ...clique.prestige,
        prestigesDuCycle: 2,
        prestigesTotal: 9,
        eclatsCumulesAVie: 500,
        rangsArbreEclats: { [RACINE.id]: 2 },
      },
      ascension: {
        ascensionsEffectuees: 1,
        rangsArbreAscension: { [noeudsDeLArbre('ascension', C)[0].id]: 1 },
        sixiemeEcoleDebloquee: true,
      },
    }
  }

  it('remet à zéro : zone, vague, phase, or, niveaux d\'écoles, paliers achetés en or', () => {
    const avant = runAvance()
    const apres = prestiger(avant, C).etat

    expect(apres.combat.zone).toBe(ZONE_DEPART)
    expect(apres.combat.vague).toBe(1)
    expect(apres.combat.phase).toBe('vague')
    expect(apres.combat.cible).toBeNull()
    expect(apres.combat.timerBossRestantMs).toBeNull()
    expect(apres.bourse.or).toBe(0)
    for (const etatEcole of Object.values(apres.ecoles)) expect(etatEcole.niveau).toBe(0)
    expect(apres.ecoles.glace.debloquee).toBe(false)
    // L'École du Feu reste le point d'entrée du run suivant (EXG-9), à niveau 0.
    expect(apres.ecoles.feu.revelee).toBe(true)
    // Les paliers payés en or sont du run, comme l'or lui-même (EXG-42) ; la Renommée est à vie (EXG-10).
    expect(apres.paliersAmeliorations).toEqual({})
    expect(apres.prestige.zoneMaxDuRun).toBe(ZONE_DEPART)
  })

  it('laisse intacts : Renommée, équipement, quêtes, les deux arbres, l\'Ascension, les compteurs à vie', () => {
    const avant = runAvance()
    const apres = prestiger(avant, C).etat

    expect(apres.bourse.renommee).toBe(avant.bourse.renommee)
    expect(apres.paliersEquipement).toEqual(avant.paliersEquipement)
    expect(apres.quetesAccomplies).toEqual(avant.quetesAccomplies)
    expect(apres.prestige.rangsArbreEclats).toEqual(avant.prestige.rangsArbreEclats)
    expect(apres.ascension).toEqual(avant.ascension)
    expect(apres.magicien.clicsCumules).toBe(avant.magicien.clicsCumules)
    expect(apres.magicien.degatsCumules).toBe(avant.magicien.degatsCumules)
    expect(apres.magicien.monstresTues).toBe(avant.magicien.monstresTues)
    expect(apres.tempsJeuMs).toBe(avant.tempsJeuMs)
    expect(apres.version).toBe(avant.version)
    expect(apres.derniereSauvegardeMs).toBe(avant.derniereSauvegardeMs)
  })

  it('crédite les Éclats sur les deux compteurs et incrémente les compteurs de prestige', () => {
    const avant = runAvance()
    const resultat = prestiger(avant, C)
    const gain = eclatsAuPrestige(avant.prestige.zoneMaxDuRun, C)

    expect(resultat.gain).toBe(gain)
    expect(resultat.etat.bourse.eclatsPossedes).toBe(avant.bourse.eclatsPossedes + gain)
    expect(resultat.etat.bourse.eclatsDepensables).toBe(avant.bourse.eclatsDepensables + gain)
    expect(resultat.etat.prestige.eclatsCumulesAVie).toBe(avant.prestige.eclatsCumulesAVie + gain)
    // Le compteur du cycle pilote la disponibilité de l'Ascension (EXG-20).
    expect(resultat.etat.prestige.prestigesDuCycle).toBe(avant.prestige.prestigesDuCycle + 1)
    expect(resultat.etat.prestige.prestigesTotal).toBe(avant.prestige.prestigesTotal + 1)
  })

  it('remet les cooldowns de sorts à zéro mais conserve l\'auto-cast acquis (EXG-40)', () => {
    const avant = runAvance()
    const enCooldown: EtatJeu = {
      ...avant,
      sorts: { [C.sorts[0].id]: { debloque: true, cooldownRestantMs: 2_500, autoCast: true } },
    }
    const apres = prestiger(enCooldown, C).etat

    expect(apres.sorts[C.sorts[0].id].cooldownRestantMs).toBe(0)
    expect(apres.sorts[C.sorts[0].id].autoCast).toBe(true)
  })

  it('EXG-40 — le bonus de départ de run survit au prestige et crédite l\'or de reprise', () => {
    const noeudOrDepart = noeudsDeLArbre('ascension', C).find(
      (n) => n.effet === 'orDepart',
    ) as ParametresNoeudArbre
    const etat = etatAvec({ pointsAscension: 1e9, zoneMaxDuRun: 10 })
    const achat = acheterNoeudAscension(etat, noeudOrDepart.id, 2, C)
    expect(achat.accepte).toBe(true)
    expect(orDepartRun(achat.etat, C)).toBe(noeudOrDepart.effetParRang * 2)

    const apres = prestiger(achat.etat, C).etat
    expect(apres.bourse.or).toBe(noeudOrDepart.effetParRang * 2)
    expect(apres.ascension.rangsArbreAscension[noeudOrDepart.id]).toBe(2)
  })

  it('EXG-28 — une partie terminée ne prestige plus, état rendu par référence', () => {
    const fini: EtatJeu = { ...etatAvec({ zoneMaxDuRun: 20 }), partieTerminee: true }
    const refus = prestiger(fini, C)

    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.etat).toBe(fini)
    expect(refus.gain).toBe(0)
  })
})

/* ══════════════════════════════════════════════ EXG-21 — confirmation à deux étapes (prestige) */

describe('EXG-21 — prévisualisation en lecture seule, application distincte', () => {
  it('la prévisualisation ne modifie aucun état : mêmes références en sortie', () => {
    const etat = Object.freeze(etatAvec({ or: 900, eclatsPossedes: 3, eclatsDepensables: 3, zoneMaxDuRun: 14 }))
    const references = {
      bourse: etat.bourse,
      ecoles: etat.ecoles,
      combat: etat.combat,
      prestige: etat.prestige,
      ascension: etat.ascension,
    }

    const apercu = apercuPrestige(etat, C)
    expect(apercu.disponible).toBe(true)

    expect(etat.bourse).toBe(references.bourse)
    expect(etat.ecoles).toBe(references.ecoles)
    expect(etat.combat).toBe(references.combat)
    expect(etat.prestige).toBe(references.prestige)
    expect(etat.ascension).toBe(references.ascension)
    expect(etat.bourse.or).toBe(900)
    expect(etat.prestige.prestigesTotal).toBe(0)
  })

  it('annonce exactement le gain et la perte que l\'application produit', () => {
    const etat = etatAvec({ or: 900, zoneMaxDuRun: 14, niveaux: { feu: 20, glace: 5 } })
    const apercu = apercuPrestige(etat, C)

    expect(apercu.eclatsGagnes).toBe(eclatsAuPrestige(14, C))
    expect(apercu.zoneMaxDuRun).toBe(14)
    expect(apercu.perte.or).toBe(900)
    expect(apercu.perte.niveauxEcoles).toBe(25)
    expect(apercu.perte.zoneAtteinte).toBe(14)
    expect(apercu.zoneReprise).toBe(ZONE_DEPART)
    expect(apercu.orDeDepart).toBe(0)

    const applique = prestiger(etat, C)
    expect(applique.gain).toBe(apercu.eclatsGagnes)
    expect(applique.etat.combat.zone).toBe(apercu.zoneReprise)
    expect(applique.etat.bourse.or).toBe(apercu.orDeDepart)
    expect(applique.etat).not.toBe(etat)
  })

  it('signale l\'indisponibilité quand la partie est terminée, sans toucher à l\'état', () => {
    const fini: EtatJeu = { ...etatAvec({ zoneMaxDuRun: 20 }), partieTerminee: true }
    const apercu = apercuPrestige(fini, C)

    expect(apercu.disponible).toBe(false)
    expect(apercu.motifIndisponible).toBe('verrouille')
    expect(apercu.eclatsGagnes).toBe(eclatsAuPrestige(20, C))
  })
})

/* ═════════════════════════════════════ LRN-002 — preuves non coopératives des formes fermées */

describe('EXG-30 / LRN-002 — les coûts cumulés de rangs ne peuvent pas être une boucle', () => {
  // Levier : un nœud à coût **plat** (croissance 1) permet d'exiger un nombre de rangs astronomique dont
  // le coût cumulé est connu exactement (`coût_base × r`). En forme fermée c'est une multiplication ;
  // rang par rang ce sont des milliards d'itérations. Les bornes de temps ci-dessous ne mesurent rien de
  // fin : elles tranchent entre « instantané » et « jamais ».
  const PLAT: Constantes = { ...C, prestige: { ...P, coutBaseNoeud: 10, croissanceCoutNoeud: 1 } }
  const UNITE = PLAT.prestige.coutBaseNoeud * REPETABLE.coutRelatif

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
    'chiffre et achète 1e12 rangs du nœud répétable en un appel, sans itérer',
    () => {
      // Garde-fou dur : 1e12 rangs. Une boucle ne termine pas en temps humain — et comme Vitest
      // n'interrompt pas une boucle **synchrone**, le symptôme serait un run qui pend, pas une
      // assertion rouge. Le timeout ci-dessous **est** l'assertion : ne le retire pas pour « débloquer »
      // un run qui pend, c'est la régression qu'il vient de détecter.
      const rangs = 1e12
      const cout = coutRangsNoeud(0, rangs, REPETABLE, PLAT)
      expect(cout).toBe(UNITE * rangs)

      const etat = etatAvec({ eclatsDepensables: cout })
      const achat = acheterNoeudEclats(etat, REPETABLE.id, rangs, PLAT)
      expect(achat.accepte).toBe(true)
      expect(rangNoeud(achat.etat, REPETABLE)).toBe(rangs)
      expect(achat.etat.bourse.eclatsDepensables).toBe(0)
      // 1e12 rangs à ×1,1 débordent le double : le facteur **sature** (c'est le seuil EXG-37 que le
      // simulateur doit voir), et le moteur ne doit surtout pas produire de `NaN` au passage.
      expect(Number.isFinite(multArbreEclats(achat.etat, PLAT))).toBe(true)
      expect(Number.isNaN(degatsParSeconde(achat.etat, PLAT))).toBe(false)
    },
    1_000,
  )

  it(
    'inverse un solde d\'Éclats de 1e250 en rangs sans les décompter',
    () => {
      const rangs = rangsAchetablesNoeud(0, 1e250, REPETABLE, C)
      expect(Number.isFinite(rangs)).toBe(true)
      expect(rangs).toBeGreaterThan(0)
      expect(coutRangsNoeud(0, rangs, REPETABLE, C)).toBeLessThanOrEqual(1e250)
      expect(coutRangsNoeud(0, rangs + 1, REPETABLE, C)).toBeGreaterThan(1e250)

      // Même inversion sur un nœud plat : le compte est exact, pas seulement fini.
      expect(rangsAchetablesNoeud(0, UNITE * 1e15, REPETABLE, PLAT)).toBe(1e15)
    },
    1_000,
  )

  it(
    'garde un gain d\'Éclats fini pour une zone maximale astronomique (signal EXG-37)',
    () => {
      // `floor(k × zone_max^α)` déborde le double bien avant d'être atteignable en jeu (α = 1,5 →
      // zone_max ~1e200). Le moteur doit rendre un nombre **fini** plutôt que laisser fuir `Infinity`
      // dans la bourse : un dépassement mesuré en régime normal est le signal EXG-37, pas un NaN.
      for (const zoneMax of [1e6, 1e150, 1e250, Number.MAX_VALUE]) {
        const gain = eclatsAuPrestige(zoneMax, C)
        expect(Number.isFinite(gain)).toBe(true)
        expect(Number.isNaN(gain)).toBe(false)
        expect(gain).toBeGreaterThan(0)
      }

      const profond = { ...etatAvec({}), prestige: { ...etatInitial(HORODATAGE).prestige, zoneMaxDuRun: 1e250 } }
      const apres = prestiger(profond, C)
      expect(Number.isFinite(apres.etat.bourse.eclatsPossedes)).toBe(true)
      expect(Number.isFinite(apres.etat.prestige.eclatsCumulesAVie)).toBe(true)
      expect(Number.isFinite(bonusPassifEclats(apres.etat, C))).toBe(true)
    },
    1_000,
  )
})
