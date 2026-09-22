// Miroir de `src/domain/quetes/` — T-9, EXG-54 (jalon atteint → quête accomplie une seule fois, Renommée
// créditée) et EXG-10 (la Renommée ainsi gagnée ne sert qu'à l'équipement).
// ADR-11 — il n'existe **aucune entité « succès »** : une quête joue ce rôle.

import { describe, expect, it } from 'vitest'

import { acheterEquipement } from '../../src/domain/equipement/index.ts'
import { etatInitial, tick } from '../../src/domain/moteur.ts'
import * as moduleQuetes from '../../src/domain/quetes/index.ts'
import { evaluerQuetes, jalonAtteint, queteAccomplie } from '../../src/domain/quetes/index.ts'
import type { EtatJeu, ParametresQuete, TypeJalonQuete } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

const C = CONSTANTES
const HORODATAGE = 1_700_000_000_000

/** Première quête du contrat pour un type de jalon donné. */
function queteDeType(type: TypeJalonQuete): ParametresQuete {
  const quete = C.quetes.find((candidate) => candidate.typeJalon === type)
  if (quete === undefined) throw new Error(`aucune quête de type ${type} dans le contrat`)
  return quete
}

const QUETE_ZONE = queteDeType('zoneAtteinte')
const QUETE_MONSTRES = queteDeType('monstresTues')
const QUETE_PRESTIGE = queteDeType('premierPrestige')

function etatNeuf(): EtatJeu {
  return etatInitial(HORODATAGE)
}

describe('ADR-11 — les succès sont des quêtes, pas une entité séparée', () => {
  it('le domaine n\'expose aucun concept de succès', () => {
    for (const nom of Object.keys(moduleQuetes)) {
      expect(nom.toLowerCase()).not.toContain('succes')
    }
  })

  it('les jalons se limitent aux trois types de la spec', () => {
    const types = new Set(C.quetes.map((quete) => quete.typeJalon))
    for (const type of types) {
      expect(['zoneAtteinte', 'monstresTues', 'premierPrestige']).toContain(type)
    }
    expect(types.size).toBe(3)
  })
})

describe('EXG-54 — jalon « zone atteinte »', () => {
  it('reste en sommeil sous le seuil et s\'accomplit à l\'atteinte de la zone', () => {
    const base = etatNeuf()
    expect(jalonAtteint(base, QUETE_ZONE)).toBe(false)
    expect(evaluerQuetes(base, C).renommeeGagnee).toBe(0)

    const arrive: EtatJeu = { ...base, combat: { ...base.combat, zone: QUETE_ZONE.seuil } }
    expect(jalonAtteint(arrive, QUETE_ZONE)).toBe(true)

    const resultat = evaluerQuetes(arrive, C)
    expect(resultat.accomplies).toContain(QUETE_ZONE.id)
    expect(resultat.etat.bourse.renommee).toBe(QUETE_ZONE.renommeeGagnee)
    expect(queteAccomplie(resultat.etat, QUETE_ZONE.id)).toBe(true)
  })

  it('compte aussi la zone maximale du run, même après un retour en arrière (EXG-17)', () => {
    const base = etatNeuf()
    const revenu: EtatJeu = {
      ...base,
      combat: { ...base.combat, zone: 1 },
      prestige: { ...base.prestige, zoneMaxDuRun: QUETE_ZONE.seuil },
    }
    expect(jalonAtteint(revenu, QUETE_ZONE)).toBe(true)
  })
})

describe('EXG-54 — jalon « monstres tués »', () => {
  it('s\'accomplit au nombre exact de monstres tués et crédite le bon montant', () => {
    const base = etatNeuf()
    const presque: EtatJeu = {
      ...base,
      magicien: { ...base.magicien, monstresTues: QUETE_MONSTRES.seuil - 1 },
    }
    expect(jalonAtteint(presque, QUETE_MONSTRES)).toBe(false)

    const pile: EtatJeu = {
      ...base,
      magicien: { ...base.magicien, monstresTues: QUETE_MONSTRES.seuil },
    }
    const resultat = evaluerQuetes(pile, C)
    expect(resultat.accomplies).toContain(QUETE_MONSTRES.id)
    expect(resultat.renommeeGagnee).toBe(QUETE_MONSTRES.renommeeGagnee)
    expect(resultat.etat.bourse.renommee).toBe(QUETE_MONSTRES.renommeeGagnee)
  })
})

describe('EXG-54 — jalon « 1er prestige effectué »', () => {
  it('ne s\'accomplit qu\'après le premier prestige', () => {
    const base = etatNeuf()
    expect(jalonAtteint(base, QUETE_PRESTIGE)).toBe(false)

    const prestige: EtatJeu = {
      ...base,
      prestige: { ...base.prestige, prestigesTotal: 1, prestigesDuCycle: 1 },
    }
    expect(jalonAtteint(prestige, QUETE_PRESTIGE)).toBe(true)

    const resultat = evaluerQuetes(prestige, C)
    expect(resultat.accomplies).toEqual([QUETE_PRESTIGE.id])
    expect(resultat.etat.bourse.renommee).toBe(QUETE_PRESTIGE.renommeeGagnee)
  })
})

describe('EXG-54 — une seule fois, jamais deux', () => {
  it('rejouer le jalon ne crédite plus rien', () => {
    const base = etatNeuf()
    const arrive: EtatJeu = { ...base, combat: { ...base.combat, zone: QUETE_ZONE.seuil } }

    const premier = evaluerQuetes(arrive, C)
    const renommeeApresPremier = premier.etat.bourse.renommee
    expect(renommeeApresPremier).toBeGreaterThan(0)

    const second = evaluerQuetes(premier.etat, C)
    expect(second.accomplies).toEqual([])
    expect(second.renommeeGagnee).toBe(0)
    expect(second.etat.bourse.renommee).toBe(renommeeApresPremier)
    expect(second.etat).toBe(premier.etat) // aucun nouvel état inutile

    // Repasser par la zone après un retour en arrière ne recrédite pas non plus.
    const rejoue: EtatJeu = {
      ...premier.etat,
      combat: { ...premier.etat.combat, zone: QUETE_ZONE.seuil + 1 },
    }
    expect(evaluerQuetes(rejoue, C).etat.bourse.renommee).toBe(renommeeApresPremier)
    expect(new Set(evaluerQuetes(rejoue, C).etat.quetesAccomplies).size).toBe(
      evaluerQuetes(rejoue, C).etat.quetesAccomplies.length,
    )
  })

  it('accomplit plusieurs quêtes d\'un coup et additionne leur Renommée', () => {
    const base = etatNeuf()
    const glorieux: EtatJeu = {
      ...base,
      combat: { ...base.combat, zone: QUETE_ZONE.seuil },
      magicien: { ...base.magicien, monstresTues: QUETE_MONSTRES.seuil },
      prestige: { ...base.prestige, prestigesTotal: 1 },
    }
    const resultat = evaluerQuetes(glorieux, C)
    const attendu = C.quetes
      .filter((quete) => resultat.accomplies.includes(quete.id))
      .reduce((total, quete) => total + quete.renommeeGagnee, 0)

    expect(resultat.accomplies.length).toBeGreaterThanOrEqual(3)
    expect(resultat.renommeeGagnee).toBe(attendu)
    expect(resultat.etat.bourse.renommee).toBe(attendu)
  })
})

describe('EXG-10 — la Renommée des quêtes ne sert qu\'à l\'équipement', () => {
  it('la Renommée créditée paie un palier d\'équipement, et rien d\'autre', () => {
    const base = etatNeuf()
    // Toutes les quêtes accomplies d'un coup : la Renommée cumulée doit payer le premier palier
    // d'équipement (ordre de grandeur voulu par `tools/idle-balance/graines.ts`, tenu par le contrat).
    // Dérivé des seuils du contrat plutôt qu'un seul jalon, pour rester robuste à une future passe
    // d'équilibrage qui changerait les montants relatifs quête / équipement.
    const seuilZoneMax = Math.max(
      ...C.quetes.filter((quete) => quete.typeJalon === 'zoneAtteinte').map((quete) => quete.seuil),
    )
    const seuilMonstresMax = Math.max(
      ...C.quetes.filter((quete) => quete.typeJalon === 'monstresTues').map((quete) => quete.seuil),
    )
    const productif: EtatJeu = {
      ...base,
      ecoles: { ...base.ecoles, feu: { niveau: 8, debloquee: true, revelee: true } },
      combat: { ...base.combat, zone: seuilZoneMax },
      magicien: { ...base.magicien, monstresTues: seuilMonstresMax },
      prestige: { ...base.prestige, prestigesTotal: 1, zoneMaxDuRun: seuilZoneMax },
    }
    const apresQuete = evaluerQuetes(productif, C).etat
    const premierEquipement = C.equipement[0]
    expect(apresQuete.bourse.renommee).toBeGreaterThanOrEqual(premierEquipement.coutBase)

    const achat = acheterEquipement(apresQuete, premierEquipement.id, C)
    expect(achat.accepte).toBe(true)
    expect(achat.etat.bourse.renommee).toBeCloseTo(
      apresQuete.bourse.renommee - premierEquipement.coutBase,
      9,
    )
  })
})

describe('intégration dans le tick', () => {
  it('le tick évalue les jalons sans que l\'UI ait à le demander', () => {
    const base = etatNeuf()
    const arrive: EtatJeu = {
      ...base,
      ecoles: { ...base.ecoles, feu: { niveau: 3, debloquee: true, revelee: true } },
      magicien: { ...base.magicien, monstresTues: QUETE_MONSTRES.seuil },
    }
    const apres = tick(arrive, C)
    expect(apres.quetesAccomplies).toContain(QUETE_MONSTRES.id)
    expect(apres.bourse.renommee).toBeGreaterThanOrEqual(QUETE_MONSTRES.renommeeGagnee)
  })

  it('ne mute jamais l\'état d\'entrée', () => {
    const base = etatNeuf()
    const arrive: EtatJeu = { ...base, combat: { ...base.combat, zone: QUETE_ZONE.seuil } }
    Object.freeze(arrive)
    Object.freeze(arrive.bourse)
    evaluerQuetes(arrive, C)
    expect(arrive.quetesAccomplies).toEqual([])
    expect(arrive.bourse.renommee).toBe(0)
  })
})
