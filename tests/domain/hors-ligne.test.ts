// Miroir de `src/domain/moteur.ts` — production hors-ligne (EXG-4, EXG-5, EXG-49).
// Aucune valeur d'équilibrage n'est écrite ici : tout vient de `tools/idle-balance/graines.ts`.

import { describe, expect, it } from 'vitest'

import { MS_PAR_HEURE, MS_PAR_SECONDE } from '../../src/domain/constantes-moteur.ts'
import { calculHorsLigne, degatsParSeconde, etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu, IdEcole } from '../../src/domain/types.ts'
import { GRAINES } from '../../tools/idle-balance/graines.ts'

const C = GRAINES
const T0 = 1_700_000_000_000
const PLAFOND_MS = C.horsLigne.plafondHeures * MS_PAR_HEURE

function etatSauvegardeA(
  horodatageMs: number,
  niveaux: Partial<Record<IdEcole, number>> = { feu: 20, glace: 6 },
): EtatJeu {
  const base = etatInitial(horodatageMs)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(niveaux) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return { ...base, ecoles, derniereSauvegardeMs: horodatageMs }
}

describe('calculHorsLigne — plafond H et résumé (EXG-4)', () => {
  it('une absence de 20 h ne crédite que H heures et signale le plafond', () => {
    const avant = etatSauvegardeA(T0)
    const { etat, resume } = calculHorsLigne(avant, T0 + 20 * MS_PAR_HEURE, C)

    expect(resume.tempsEcouleMs).toBe(PLAFOND_MS)
    expect(resume.plafondAtteint).toBe(true)

    const attendu =
      degatsParSeconde(avant, C) * C.or.orParDegatMoyen * (PLAFOND_MS / MS_PAR_SECONDE)
    expect(resume.orGagne).toBeCloseTo(attendu, 6)
    expect(etat.bourse.or).toBeCloseTo(avant.bourse.or + attendu, 6)
  })

  it('expose les trois valeurs du résumé exigées par EXG-4', () => {
    const { resume } = calculHorsLigne(etatSauvegardeA(T0), T0 + 3 * MS_PAR_HEURE, C)
    expect(Object.keys(resume).sort()).toEqual(['orGagne', 'plafondAtteint', 'tempsEcouleMs'])
    expect(resume.plafondAtteint).toBe(false)
    expect(resume.tempsEcouleMs).toBe(3 * MS_PAR_HEURE)
  })

  it('crédite au prorata sous le plafond et avance derniereSauvegardeMs (pas de double crédit)', () => {
    const avant = etatSauvegardeA(T0)
    const moitie = calculHorsLigne(avant, T0 + PLAFOND_MS / 2, C)
    expect(moitie.etat.derniereSauvegardeMs).toBe(T0 + PLAFOND_MS / 2)

    const rappelImmediat = calculHorsLigne(moitie.etat, T0 + PLAFOND_MS / 2, C)
    expect(rappelImmediat.resume.orGagne).toBe(0)
    expect(rappelImmediat.etat.bourse.or).toBe(moitie.etat.bourse.or)
  })

  it('n\'avance pas le temps de jeu simulé mais compte le temps hors-ligne (§8)', () => {
    const avant = etatSauvegardeA(T0)
    const { etat } = calculHorsLigne(avant, T0 + 2 * MS_PAR_HEURE, C)
    expect(etat.tempsJeuMs).toBe(avant.tempsJeuMs)
    expect(etat.tempsHorsLigneMs).toBe(2 * MS_PAR_HEURE)
  })

  it('ne mute pas l\'état d\'entrée', () => {
    const avant = etatSauvegardeA(T0)
    const copie = structuredClone(avant)
    calculHorsLigne(avant, T0 + MS_PAR_HEURE, C)
    expect(avant).toEqual(copie)
  })
})

describe('calculHorsLigne — seule la production passive compte (EXG-5)', () => {
  it('aucun niveau d\'école : aucun gain, même sur une très longue absence', () => {
    const avant = etatSauvegardeA(T0, {})
    const { etat, resume } = calculHorsLigne(avant, T0 + 20 * MS_PAR_HEURE, C)

    expect(resume.orGagne).toBe(0)
    expect(etat.bourse.or).toBe(avant.bourse.or)
    expect(resume.plafondAtteint).toBe(true)
  })

  it('ne crédite ni clic ni sort actif : le gain suit exactement le DPS passif', () => {
    const avant = etatSauvegardeA(T0, { feu: 10 })
    const { etat, resume } = calculHorsLigne(avant, T0 + MS_PAR_HEURE, C)

    const attendu = degatsParSeconde(avant, C) * C.or.orParDegatMoyen * 3_600
    expect(resume.orGagne).toBeCloseTo(attendu, 6)
    // Aucun clic comptabilisé, aucun cooldown consommé pendant l'absence.
    expect(etat.magicien.clicsCumules).toBe(avant.magicien.clicsCumules)
    expect(etat.sorts).toEqual(avant.sorts)
  })
})

describe('calculHorsLigne — protection de l\'écart de temps (EXG-49)', () => {
  it('horloge système reculée : Δt = 0, aucun crédit, aucun NaN', () => {
    const avant = etatSauvegardeA(T0)
    const { etat, resume } = calculHorsLigne(avant, T0 - 3 * MS_PAR_HEURE, C)

    expect(resume.tempsEcouleMs).toBe(0)
    expect(resume.orGagne).toBe(0)
    expect(resume.plafondAtteint).toBe(false)
    expect(etat.bourse.or).toBe(avant.bourse.or)
    expect(Number.isFinite(etat.bourse.or)).toBe(true)
    expect(Number.isNaN(etat.bourse.or)).toBe(false)
    // L'horodatage de référence ne recule pas : sinon l'absence suivante serait comptée deux fois.
    expect(etat.derniereSauvegardeMs).toBe(avant.derniereSauvegardeMs)
  })

  it('horodatage non fini ou absurde : Δt = 0 et or fini', () => {
    const avant = etatSauvegardeA(T0)
    for (const horodatage of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const { etat, resume } = calculHorsLigne(avant, horodatage, C)
      expect(resume.tempsEcouleMs).toBe(0)
      expect(resume.orGagne).toBe(0)
      expect(Number.isFinite(etat.bourse.or)).toBe(true)
      expect(etat.derniereSauvegardeMs).toBe(avant.derniereSauvegardeMs)
    }
  })

  it('l\'or crédité reste fini même avec un plafond de production élevé', () => {
    const avant = etatSauvegardeA(T0, { feu: 100, glace: 100, ecole3: 100, ecole4: 100, ecole5: 100 })
    const { etat, resume } = calculHorsLigne(avant, T0 + 50 * MS_PAR_HEURE, C)
    expect(Number.isFinite(resume.orGagne)).toBe(true)
    expect(Number.isFinite(etat.bourse.or)).toBe(true)
    expect(resume.tempsEcouleMs).toBe(PLAFOND_MS)
  })
})
