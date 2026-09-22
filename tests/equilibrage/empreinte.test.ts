// Miroir de `tools/idle-balance/empreinte.ts` — « le fichier commité est-il encore la sortie du
// vecteur archivé ? » (invariant 2 de CLAUDE.md, ADR-10).
//
// Pourquoi (revue de fin de vague 1) : `equilibrage:check` rejoue §8 sur `src/donnees/constantes.ts`,
// donc il n'attrape une retouche manuelle que si elle **casse** une contrainte. Une valeur changée à
// la main qui garde 13/13 passait inaperçue. La comparaison au vecteur archivé, elle, ne dépend
// d'aucun seuil : soit le fichier est la sortie du vecteur, soit il ne l'est pas.
//
// Contrat de vitesse : aucune simulation. `constantesAttendues()` ne fait qu'appliquer
// `construireConstantes` au vecteur archivé — quelques millisecondes.

import { describe, expect, it } from 'vitest'

import { comparerValeurs, constantesAttendues } from '../../tools/idle-balance/empreinte.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

describe('comparaison au vecteur archivé — le fichier livré', () => {
  it('`src/donnees/constantes.ts` est exactement la sortie du dernier vecteur archivé', () => {
    const { constantes } = constantesAttendues()

    expect(comparerValeurs(constantes, CONSTANTES)).toEqual([])
  })

  it('une seule valeur retouchée à la main est repérée, et nommée par son chemin', () => {
    const { constantes } = constantesAttendues()
    const retouche = structuredClone(constantes) as typeof constantes & {
      horsLigne: { plafondHeures: number }
    }
    retouche.horsLigne.plafondHeures = constantes.horsLigne.plafondHeures + 1

    const ecarts = comparerValeurs(constantes, retouche)

    expect(ecarts).toHaveLength(1)
    expect(ecarts[0]?.chemin).toBe('CONSTANTES.horsLigne.plafondHeures')
    expect(ecarts[0]?.nature).toBe('valeur')
  })
})

describe('comparaison profonde — ce qu’elle attrape et ce qu’elle laisse passer', () => {
  it('le bruit flottant de l’écriture n’est pas une divergence', () => {
    // `1.15 + 0.01` vaut `1.1600000000000001` en mémoire et s'écrit `1.16` dans le fichier : c'est le
    // même nombre, pas une retouche. Sans cette normalisation la commande crierait au loup à chaque
    // exécution, et on apprendrait à l'ignorer.
    expect(comparerValeurs({ croissance: 1.15 + 0.01 }, { croissance: 1.16 })).toEqual([])
  })

  it('une différence réelle, même minuscule, reste une divergence', () => {
    expect(comparerValeurs({ croissance: 1.15 }, { croissance: 1.151 })).toHaveLength(1)
  })

  it('un champ disparu est signalé comme manquant', () => {
    const ecarts = comparerValeurs({ fin: { zoneBossFinal: 1000, timerBossFinalS: 30 } }, { fin: { zoneBossFinal: 1000 } })

    expect(ecarts).toEqual([
      { chemin: 'CONSTANTES.fin.timerBossFinalS', nature: 'manquant', attendu: '30', livre: '(absent)' },
    ])
  })

  it('un champ ajouté à la main est signalé comme en trop', () => {
    const ecarts = comparerValeurs({ fin: {} }, { fin: { bonusSecret: 2 } })

    expect(ecarts.map((e) => [e.chemin, e.nature])).toEqual([['CONSTANTES.fin.bonusSecret', 'en-trop']])
  })

  it('un tableau de paliers modifié est repéré élément par élément', () => {
    const ecarts = comparerValeurs({ paliers: [10, 25, 50, 100] }, { paliers: [10, 25, 40, 100] })

    expect(ecarts.map((e) => e.chemin)).toEqual(['CONSTANTES.paliers[2]'])
  })

  it('un tableau raccourci est repéré par sa longueur', () => {
    const ecarts = comparerValeurs({ paliers: [10, 25, 50] }, { paliers: [10, 25] })

    expect(ecarts.map((e) => e.nature)).toEqual(['longueur', 'manquant'])
  })

  it('un changement de type est nommé comme tel', () => {
    expect(comparerValeurs({ zoneRevelation: 2 }, { zoneRevelation: null })[0]?.nature).toBe('valeur')
    expect(comparerValeurs({ paliers: [1] }, { paliers: 1 })[0]?.nature).toBe('type')
  })
})
