// Miroir de `tools/idle-balance/derogations.ts` — le mécanisme anti-péremption des dérogations §8.
//
// Pourquoi ce fichier existe (LRN-002, revue de fin de vague 1) : ce mécanisme n'avait jamais rougi,
// dans aucun des deux sens. Le sens « rouge non listé » n'était exercé que par une commande manuelle
// en commentaire de `tools/idle-balance/fixtures/desequilibre.ts` ; le sens « vert encore listé »
// n'était exercé nulle part — c'était du code mort, alors que c'est la seule chose qui protège un
// futur rapport contre une dérogation fossilisée.
//
// Contrat de vitesse : aucun test d'ici ne simule une partie. Les verdicts sont **fabriqués** ; les
// trois contraintes §8 calculables sans mesure (C05, C10, C12 ne prennent que `Constantes`) servent à
// brancher la fixture déséquilibrée sur de vrais verdicts pour quelques millisecondes.

import { describe, expect, it } from 'vitest'

import {
  c05CoupleFin,
  c10PlafondHorsLigne,
  c12Arbres,
  type Verdict,
} from '../../tools/idle-balance/contraintes.ts'
import {
  conclusionBloquante,
  lignesBloquantes,
  lignesInformatives,
  trierDerogations,
} from '../../tools/idle-balance/derogations.ts'
import { CONSTANTES as DESEQUILIBRE } from '../../tools/idle-balance/fixtures/desequilibre.ts'
import { CONSTANTES, CONTRAINTES_NON_TENUES } from '../../src/donnees/constantes.ts'

/** Verdict fabriqué : on ne teste pas ici la mesure, mais le tri qui en est fait. */
function verdict(id: string, ok: boolean): Verdict {
  return {
    id,
    libelle: `contrainte ${id}`,
    mesure: ok ? '2.50 h' : '7.10 h',
    cible: '2 à 3 h',
    ecart: ok ? 0 : 1.37,
    ok,
  }
}

describe('tri des dérogations §8 — les quatre cas', () => {
  it('rouge non listé : régression, et ça bloque', () => {
    const tri = trierDerogations([verdict('C03', false), verdict('C06', true)], {})

    expect(tri.regressions.map((v) => v.id)).toEqual(['C03'])
    expect(tri.derogationsPerimees).toHaveLength(0)
    expect(tri.bloquant).toBe(true)
    expect(lignesBloquantes(tri).join('\n')).toContain('RÉGRESSION C03')
  })

  it('rouge listé : toléré, mais réaffiché avec sa justification à chaque exécution', () => {
    const tri = trierDerogations([verdict('C07', false)], {
      C07: 'durée de run croissante — hors de portée du contrat `Constantes`, cf. rapport §7 bis.',
    })

    expect(tri.regressions).toHaveLength(0)
    expect(tri.echecsDocumentes.map((e) => e.verdict.id)).toEqual(['C07'])
    expect(tri.bloquant).toBe(false)
    expect(lignesInformatives(tri).join('\n')).toContain('ÉCHEC DOCUMENTÉ C07')
    expect(lignesInformatives(tri).join('\n')).toContain('hors de portée du contrat')
  })

  it('vert encore listé : dérogation périmée, et ça bloque', () => {
    const tri = trierDerogations([verdict('C07', true)], {
      C07: 'la raison qui avait justifié cette dérogation a disparu depuis.',
    })

    expect(tri.regressions).toHaveLength(0)
    expect(tri.derogationsPerimees.map((v) => v.id)).toEqual(['C07'])
    expect(tri.bloquant).toBe(true)
    expect(lignesBloquantes(tri).join('\n')).toContain('DÉROGATION PÉRIMÉE C07')
    expect(lignesBloquantes(tri).join('\n')).toContain('retirer')
  })

  it('clé sans verdict : signalée comme orpheline au lieu d’être avalée', () => {
    const tri = trierDerogations([verdict('C07', false)], { C7: 'faute de frappe : C7 au lieu de C07.' })

    // La faute de frappe rendait la dérogation inopérante ET masquait la contrainte visée : C07
    // redevient une régression franche, et la clé morte est nommée.
    expect(tri.regressions.map((v) => v.id)).toEqual(['C07'])
    expect(tri.clesOrphelines).toEqual(['C7'])
    expect(tri.bloquant).toBe(true)
    expect(lignesBloquantes(tri).join('\n')).toContain('CLÉ ORPHELINE « C7 »')
  })

  it('tout vert et table vide : rien à signaler', () => {
    const tri = trierDerogations([verdict('C01', true), verdict('C02', true)], {})

    expect(tri.bloquant).toBe(false)
    expect(lignesBloquantes(tri)).toHaveLength(0)
    expect(lignesInformatives(tri)).toHaveLength(0)
  })

  it('un identifiant hérité de `Object.prototype` ne compte pas comme documenté', () => {
    // `'toString' in {}` vaut vrai : une lecture naïve aurait cru la contrainte documentée et aurait
    // laissé passer un rouge.
    const tri = trierDerogations([verdict('toString', false)], {})

    expect(tri.regressions.map((v) => v.id)).toEqual(['toString'])
    expect(tri.bloquant).toBe(true)
  })

  it('la conclusion compte les trois motifs bloquants', () => {
    const tri = trierDerogations([verdict('C03', false), verdict('C06', true)], {
      C06: 'dérogation périmée.',
      C99: 'clé orpheline.',
    })

    expect(conclusionBloquante(tri)).toContain('1 régression(s)')
    expect(conclusionBloquante(tri)).toContain('1 dérogation(s) périmée(s)')
    expect(conclusionBloquante(tri)).toContain('1 clé(s) orpheline(s)')
  })
})

describe('fixture déséquilibrée — elle est branchée sur la CI, plus seulement sur une commande manuelle', () => {
  // Seules les contraintes calculables sans simulation sont rejouées ici (elles ne prennent que
  // `Constantes`) : la partie entière reste l'affaire d'`equilibrage:check`.
  const verdictsFixture = [
    c05CoupleFin(DESEQUILIBRE),
    c10PlafondHorsLigne(DESEQUILIBRE),
    c12Arbres(DESEQUILIBRE),
  ]

  it('C05 et C10 sont bel et bien rouges sur la fixture', () => {
    expect(c05CoupleFin(DESEQUILIBRE).ok).toBe(false)
    expect(c10PlafondHorsLigne(DESEQUILIBRE).ok).toBe(false)
  })

  it('sans table de dérogations, ces rouges sont des régressions bloquantes', () => {
    const tri = trierDerogations(verdictsFixture, {})

    expect(tri.regressions.map((v) => v.id)).toEqual(expect.arrayContaining(['C05', 'C10']))
    expect(tri.bloquant).toBe(true)
  })

  it('documentés, les mêmes rouges cessent de bloquer', () => {
    const tri = trierDerogations(verdictsFixture, {
      C05: 'fixture : couple de fin volontairement hors de [20, 30].',
      C10: 'fixture : plafond hors-ligne volontairement hors de [8, 12].',
    })

    expect(tri.regressions.map((v) => v.id)).not.toContain('C05')
    expect(tri.regressions.map((v) => v.id)).not.toContain('C10')
    expect(tri.echecsDocumentes).toHaveLength(2)
  })
})

describe('constantes livrées — les mêmes contraintes, sans simulation', () => {
  it('C05, C10 et C12 sont vertes et ne portent aucune dérogation', () => {
    const verdicts = [c05CoupleFin(CONSTANTES), c10PlafondHorsLigne(CONSTANTES), c12Arbres(CONSTANTES)]
    // Table restreinte aux trois identifiants rejoués : les dérogations portant sur les contraintes
    // mesurées (qui, elles, exigent une simulation) seraient à tort « orphelines » ici.
    const ids = new Set(verdicts.map((v) => v.id))
    const table = Object.fromEntries(
      Object.entries(CONTRAINTES_NON_TENUES).filter(([cle]) => ids.has(cle)),
    )
    const tri = trierDerogations(verdicts, table)

    expect(verdicts.filter((v) => !v.ok)).toHaveLength(0)
    expect(tri.bloquant).toBe(false)
  })
})
