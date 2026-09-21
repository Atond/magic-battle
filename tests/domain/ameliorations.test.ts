// Miroir de `src/domain/ameliorations/` — T-8, EXG-42 (multiplicateur de dégâts acheté en or) et EXG-10
// (l'or et la Renommée ne se substituent jamais l'un à l'autre).
// Aucune valeur d'équilibrage ici : coûts, croissances et effets viennent de `src/donnees/constantes.ts`.

import { describe, expect, it } from 'vitest'

import {
  acheterAmelioration,
  coutPalier,
  coutPaliers,
  multAmeliorations,
  multiplicateursAchats,
} from '../../src/domain/ameliorations/index.ts'
import { degatsParSeconde, etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu, IdEcole, ParametresAchatMultiplicatif } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

const C = CONSTANTES
const HORODATAGE = 1_700_000_000_000
const PREMIERE: ParametresAchatMultiplicatif = C.ameliorations[0]
const EQUIPEMENT: ParametresAchatMultiplicatif = C.equipement[0]

/** État productif (sinon le DPS vaut 0 et un multiplicateur ne prouve rien), avec bourse garnie. */
function etatRiche(or: number, niveaux: Partial<Record<IdEcole, number>> = { feu: 8 }): EtatJeu {
  const base = etatInitial(HORODATAGE)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(niveaux) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return { ...base, ecoles, bourse: { ...base.bourse, or } }
}

describe('EXG-42 — coût des paliers d\'amélioration', () => {
  it('les 3 premiers paliers valent `coût_base × croissance^n`, à l\'unité', () => {
    for (let palier = 0; palier < 3; palier += 1) {
      expect(coutPalier(palier, PREMIERE)).toBe(PREMIERE.coutBase * PREMIERE.croissance ** palier)
    }
  })

  it('le coût de plusieurs paliers d\'un coup égale la somme itérée (forme fermée)', () => {
    let somme = 0
    for (let palier = 0; palier < 6; palier += 1) somme += coutPalier(palier, PREMIERE)
    expect(Math.abs(coutPaliers(0, 6, PREMIERE) - somme) / somme).toBeLessThan(1e-9)
  })
})

describe('EXG-42 — multiplicateur de dégâts', () => {
  it('`mult_améliorations` est le **produit** des effets des paliers achetés', () => {
    const nu = etatRiche(0)
    expect(multAmeliorations(nu, C)).toBe(1)

    const seconde = C.ameliorations[1]
    const achete: EtatJeu = {
      ...nu,
      paliersAmeliorations: { [PREMIERE.id]: 3, [seconde.id]: 2 },
    }
    const attendu = PREMIERE.effetMult ** 3 * seconde.effetMult ** 2
    expect(multAmeliorations(achete, C)).toBeCloseTo(attendu, 9)
    expect(multiplicateursAchats(achete, C)).toBeCloseTo(attendu, 9)
  })

  it('l\'achat recalcule le multiplicateur et se voit dans `degatsParSeconde` (chaîne §8)', () => {
    const etat = etatRiche(coutPalier(0, PREMIERE))
    const dpsAvant = degatsParSeconde(etat, C)
    expect(dpsAvant).toBeGreaterThan(0)

    const achat = acheterAmelioration(etat, PREMIERE.id, C)
    expect(achat.accepte).toBe(true)
    expect(achat.coutPaye).toBe(coutPalier(0, PREMIERE))
    expect(achat.etat.paliersAmeliorations[PREMIERE.id]).toBe(1)
    expect(achat.etat.bourse.or).toBeCloseTo(0, 9)
    expect(degatsParSeconde(achat.etat, C)).toBeCloseTo(dpsAvant * PREMIERE.effetMult, 9)
  })

  it('deux paliers composent leurs effets dans la chaîne de DPS', () => {
    const etat = etatRiche(coutPaliers(0, 2, PREMIERE))
    const dpsAvant = degatsParSeconde(etat, C)

    const premier = acheterAmelioration(etat, PREMIERE.id, C)
    const second = acheterAmelioration(premier.etat, PREMIERE.id, C)

    expect(second.accepte).toBe(true)
    expect(second.coutPaye).toBe(coutPalier(1, PREMIERE))
    expect(degatsParSeconde(second.etat, C)).toBeCloseTo(dpsAvant * PREMIERE.effetMult ** 2, 9)
  })
})

describe('refus d\'achat', () => {
  it('or insuffisant : refus motivé, état rendu tel quel', () => {
    const etat = etatRiche(coutPalier(0, PREMIERE) - 1)
    const refus = acheterAmelioration(etat, PREMIERE.id, C)

    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('monnaieInsuffisante')
    expect(refus.etat).toBe(etat)
    expect(refus.coutPaye).toBe(0)
  })

  it('EXG-10 — la Renommée ne se substitue pas à l\'or', () => {
    const base = etatRiche(0)
    const renomme: EtatJeu = { ...base, bourse: { ...base.bourse, or: 0, renommee: 1e9 } }
    const refus = acheterAmelioration(renomme, PREMIERE.id, C)

    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('monnaieInsuffisante')
    expect(refus.etat.bourse.renommee).toBe(1e9)
  })

  it('EXG-10 — un équipement ne s\'achète pas par le guichet des améliorations', () => {
    const etat = etatRiche(1e9)
    const refus = acheterAmelioration(etat, EQUIPEMENT.id, C)

    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('mauvaiseMonnaie')
    expect(refus.etat).toBe(etat)
    expect(refus.etat.paliersEquipement[EQUIPEMENT.id]).toBeUndefined()
  })

  it('un identifiant inconnu est refusé', () => {
    const etat = etatRiche(1e9)
    expect(acheterAmelioration(etat, 'amelioration-fantome', C).motifRefus).toBe('inconnu')
  })

  it('respecte un plafond de paliers quand le contrat en fixe un', () => {
    const plafonnee: ParametresAchatMultiplicatif = { ...PREMIERE, paliersMax: 2 }
    const constantes = { ...C, ameliorations: [plafonnee] }
    let etat = etatRiche(1e12)

    for (let achat = 0; achat < 2; achat += 1) {
      const resultat = acheterAmelioration(etat, plafonnee.id, constantes)
      expect(resultat.accepte).toBe(true)
      etat = resultat.etat
    }
    const refus = acheterAmelioration(etat, plafonnee.id, constantes)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('paliersMaxAtteints')
  })

  it('ne mute jamais l\'état d\'entrée', () => {
    const etat = Object.freeze(etatRiche(1e9))
    acheterAmelioration(etat, PREMIERE.id, C)
    expect(etat.paliersAmeliorations[PREMIERE.id]).toBeUndefined()
    expect(etat.bourse.or).toBe(1e9)
  })
})
