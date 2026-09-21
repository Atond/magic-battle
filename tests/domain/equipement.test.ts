// Miroir de `src/domain/equipement/` — T-8, EXG-43 (multiplicateur acheté en Renommée) et EXG-10 (la
// Renommée est **exclusivement** réservée à l'équipement, dans les deux sens).

import { describe, expect, it } from 'vitest'

import { acheterAmelioration } from '../../src/domain/ameliorations/index.ts'
import {
  acheterEquipement,
  coutPalierEquipement,
  multEquipement,
} from '../../src/domain/equipement/index.ts'
import { degatsParSeconde, etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu, IdEcole, ParametresAchatMultiplicatif } from '../../src/domain/types.ts'
import { GRAINES } from '../../tools/idle-balance/graines.ts'

const C = GRAINES
const HORODATAGE = 1_700_000_000_000
const PREMIER: ParametresAchatMultiplicatif = C.equipement[0]
const AMELIORATION: ParametresAchatMultiplicatif = C.ameliorations[0]

function etatRenomme(renommee: number, niveaux: Partial<Record<IdEcole, number>> = { feu: 8 }): EtatJeu {
  const base = etatInitial(HORODATAGE)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(niveaux) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return { ...base, ecoles, bourse: { ...base.bourse, renommee } }
}

describe('EXG-43 — coût et effet des paliers d\'équipement', () => {
  it('les 3 premiers paliers valent `coût_base × croissance^n`, à l\'unité', () => {
    for (let palier = 0; palier < 3; palier += 1) {
      expect(coutPalierEquipement(palier, PREMIER)).toBe(PREMIER.coutBase * PREMIER.croissance ** palier)
    }
  })

  it('`mult_équipement` est le produit des effets achetés', () => {
    const nu = etatRenomme(0)
    expect(multEquipement(nu, C)).toBe(1)

    const second = C.equipement[1]
    const equipe: EtatJeu = { ...nu, paliersEquipement: { [PREMIER.id]: 2, [second.id]: 1 } }
    expect(multEquipement(equipe, C)).toBeCloseTo(PREMIER.effetMult ** 2 * second.effetMult, 9)
  })

  it('l\'achat recalcule le multiplicateur et se voit dans `degatsParSeconde` (chaîne §8)', () => {
    const etat = etatRenomme(coutPalierEquipement(0, PREMIER))
    const dpsAvant = degatsParSeconde(etat, C)
    expect(dpsAvant).toBeGreaterThan(0)

    const achat = acheterEquipement(etat, PREMIER.id, C)
    expect(achat.accepte).toBe(true)
    expect(achat.coutPaye).toBe(coutPalierEquipement(0, PREMIER))
    expect(achat.etat.paliersEquipement[PREMIER.id]).toBe(1)
    expect(achat.etat.bourse.renommee).toBeCloseTo(0, 9)
    expect(degatsParSeconde(achat.etat, C)).toBeCloseTo(dpsAvant * PREMIER.effetMult, 9)
  })
})

describe('EXG-10 — la Renommée est réservée à l\'équipement, dans les deux sens', () => {
  it('un achat d\'équipement est refusé si la Renommée est insuffisante, accepté sinon', () => {
    const pauvre = etatRenomme(coutPalierEquipement(0, PREMIER) - 1)
    const refus = acheterEquipement(pauvre, PREMIER.id, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('monnaieInsuffisante')
    expect(refus.etat).toBe(pauvre)

    const riche = etatRenomme(coutPalierEquipement(0, PREMIER))
    expect(acheterEquipement(riche, PREMIER.id, C).accepte).toBe(true)
  })

  it('l\'or ne peut pas se substituer à la Renommée : un tas d\'or n\'achète aucun équipement', () => {
    const base = etatRenomme(0)
    const cousuDOr: EtatJeu = { ...base, bourse: { ...base.bourse, or: 1e12, renommee: 0 } }

    const refus = acheterEquipement(cousuDOr, PREMIER.id, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('monnaieInsuffisante')
    expect(refus.etat.bourse.or).toBe(1e12)
    expect(refus.etat.paliersEquipement[PREMIER.id]).toBeUndefined()
  })

  it('la Renommée ne peut pas se substituer à l\'or : une amélioration reste inaccessible', () => {
    const base = etatRenomme(1e12)
    const refus = acheterAmelioration(base, AMELIORATION.id, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('monnaieInsuffisante')
    expect(refus.etat.bourse.renommee).toBe(1e12)
  })

  it('une amélioration ne s\'achète pas par le guichet de l\'équipement', () => {
    const etat = etatRenomme(1e12)
    const refus = acheterEquipement(etat, AMELIORATION.id, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('mauvaiseMonnaie')
    expect(refus.etat).toBe(etat)
  })
})

describe('plafond de paliers et robustesse', () => {
  it('refuse au-delà du `paliersMax` du contrat', () => {
    const plafond = PREMIER.paliersMax
    expect(plafond).not.toBeNull()

    const paliers = plafond ?? 0
    const sature: EtatJeu = {
      ...etatRenomme(1e12),
      paliersEquipement: { [PREMIER.id]: paliers },
    }
    const refus = acheterEquipement(sature, PREMIER.id, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('paliersMaxAtteints')
  })

  it('refuse un identifiant inconnu et ne mute jamais l\'entrée', () => {
    const etat = Object.freeze(etatRenomme(1e12))
    expect(acheterEquipement(etat, 'equipement-fantome', C).motifRefus).toBe('inconnu')
    acheterEquipement(etat, PREMIER.id, C)
    expect(etat.bourse.renommee).toBe(1e12)
    expect(etat.paliersEquipement[PREMIER.id]).toBeUndefined()
  })
})
