import { describe, expect, it } from 'vitest'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { appliquerDelta, etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu, IdEcole } from '../../src/domain/types.ts'

const C = CONSTANTES
const H = 1_700_000_000_000
function etatProductif(niveaux: Partial<Record<IdEcole, number>> = { feu: 12, glace: 4 }): EtatJeu {
  const base = etatInitial(H)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(niveaux) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return { ...base, ecoles }
}
function log(...a: unknown[]) { process.stderr.write('LOG ' + a.join(' ') + '\n') }

describe('scratch chrono', () => {
  it('ratio début/fin sur 2 h', () => {
    for (let essai = 0; essai < 5; essai += 1) {
      // échauffement
      let chauffe = etatProductif()
      for (let f = 0; f < 300; f += 1) chauffe = appliquerDelta(chauffe, 1000, C)

      let etat = etatProductif()
      const BLOC = 300
      const t0 = performance.now()
      for (let f = 0; f < BLOC; f += 1) etat = appliquerDelta(etat, 1000, C)
      const debut = performance.now() - t0
      for (let f = BLOC; f < 7200 - BLOC; f += 1) etat = appliquerDelta(etat, 1000, C)
      const t1 = performance.now()
      for (let f = 0; f < BLOC; f += 1) etat = appliquerDelta(etat, 1000, C)
      const fin = performance.now() - t1
      log('essai', essai, 'debut', debut.toFixed(3), 'fin', fin.toFixed(3), 'ratio', (fin / debut).toFixed(3), 'ticks', etat.ticksEcoules, 'zone', etat.combat.zone)
    }
    expect(true).toBe(true)
  }, 120000)
})
