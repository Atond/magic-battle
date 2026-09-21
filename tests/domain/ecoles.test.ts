// Miroir de `src/domain/ecoles/` — T-3, EXG-6 à EXG-9 (coûts, production, paliers, déblocage).
// Aucune valeur d'équilibrage n'est écrite ici : tout vient de `src/donnees/constantes.ts`.
// Les seuls nombres littéraux présents sont des quantités de test (rangs, quantités achetées) et des
// tolérances, jamais des valeurs de jeu.

import { describe, expect, it } from 'vitest'

import {
  acheterNiveaux,
  coutNiveaux,
  coutProchainNiveau,
  ecoleAccessible,
  multiplicateurPalier,
  niveauxAchetables,
  productionEcole,
  revelerEcolesDeZone,
} from '../../src/domain/ecoles/index.ts'
import { degatsParSeconde, etatInitial } from '../../src/domain/moteur.ts'
import type { Constantes, EtatJeu, IdEcole, ParametresEcole } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

const C = CONSTANTES
const HORODATAGE = 1_700_000_000_000
const FEU = C.ecoles.feu

/** Somme itérée des coûts, référence naïve de la forme fermée. Jamais utilisée dans `src/`. */
function sommeIteree(niveauDepart: number, nombre: number, p: ParametresEcole): number {
  let total = 0
  for (let i = 0; i < nombre; i += 1) total += coutProchainNiveau(niveauDepart + i, p)
  return total
}

function ecartRelatif(a: number, b: number): number {
  return Math.abs(a - b) / Math.abs(b)
}

/** État avec une bourse garnie : l'or est un paramètre de test, pas une valeur d'équilibrage. */
function etatAvecOr(or: number): EtatJeu {
  const base = etatInitial(HORODATAGE)
  return { ...base, bourse: { ...base.bourse, or } }
}

describe('coût des niveaux d\'école — EXG-9', () => {
  it('les 5 premiers coûts de l\'École du Feu suivent `coût_base × croissance^n` sans écart', () => {
    for (let niveau = 0; niveau < 5; niveau += 1) {
      expect(coutProchainNiveau(niveau, FEU)).toBe(FEU.coutBase * FEU.croissance ** niveau)
    }
  })

  it('le premier niveau coûte exactement `coût_base` (coût de déblocage d\'EXG-8)', () => {
    expect(coutProchainNiveau(0, FEU)).toBe(FEU.coutBase)
  })

  it('un niveau négatif ou non fini ne produit ni NaN ni coût négatif', () => {
    for (const niveau of [-3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const cout = coutProchainNiveau(niveau, FEU)
      expect(Number.isFinite(cout)).toBe(true)
      expect(cout).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('coût de k niveaux d\'un coup — forme fermée', () => {
  it('égale la somme itérée à moins de 1e-9 en écart relatif, pour toutes les écoles', () => {
    for (const id of Object.keys(C.ecoles) as IdEcole[]) {
      const p = C.ecoles[id]
      for (const [depart, k] of [[0, 1], [0, 5], [3, 12], [40, 7], [97, 25]] as const) {
        expect(ecartRelatif(coutNiveaux(depart, k, p), sommeIteree(depart, k, p))).toBeLessThan(1e-9)
      }
    }
  })

  it('gère une croissance de 1 (série dégénérée) comme k fois le coût de base', () => {
    const plate: ParametresEcole = { ...FEU, croissance: 1 }
    expect(coutNiveaux(0, 7, plate)).toBe(7 * plate.coutBase)
    expect(ecartRelatif(coutNiveaux(11, 9, plate), sommeIteree(11, 9, plate))).toBeLessThan(1e-9)
  })

  it('vaut 0 pour une quantité nulle, négative ou non finie', () => {
    for (const k of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(coutNiveaux(3, k, FEU)).toBe(0)
    }
  })
})

describe('niveaux achetables avec l\'or courant — forme fermée (logarithme)', () => {
  it('retourne le plus grand k tel que coût(k) ≤ or < coût(k+1)', () => {
    for (const or of [0, FEU.coutBase / 2, FEU.coutBase, 1_000, 1e6, 1e15]) {
      for (const niveau of [0, 9, 57]) {
        const k = niveauxAchetables(niveau, or, FEU)
        expect(Number.isInteger(k)).toBe(true)
        expect(coutNiveaux(niveau, k, FEU)).toBeLessThanOrEqual(or)
        expect(coutNiveaux(niveau, k + 1, FEU)).toBeGreaterThan(or)
      }
    }
  })

  it('retourne 0 quand l\'or ne paie même pas le niveau suivant', () => {
    expect(niveauxAchetables(0, FEU.coutBase - 1, FEU)).toBe(0)
    expect(niveauxAchetables(0, 0, FEU)).toBe(0)
    expect(niveauxAchetables(0, Number.NaN, FEU)).toBe(0)
  })

  it('gère une croissance de 1 et un or énorme sans boucler ni renvoyer Infinity', () => {
    const plate: ParametresEcole = { ...FEU, croissance: 1 }
    expect(niveauxAchetables(0, 10 * plate.coutBase, plate)).toBe(10)
    const enorme = niveauxAchetables(0, 1e250, FEU)
    expect(Number.isFinite(enorme)).toBe(true)
    expect(enorme).toBeGreaterThan(0)
  })
})

describe('EXG-30 — preuve non coopérative de la forme fermée des coûts', () => {
  // Même principe que pour les vagues : aucun compteur déclaratif ici. Avec une croissance de 1, l'or
  // demandé permet d'acheter 1e17 niveaux d'un coup. En forme fermée c'est une division ; niveau par
  // niveau ce sont 1e17 itérations — le timeout serré tranche entre « instantané » et « jamais ».
  const PLATE: ParametresEcole = { ...FEU, coutBase: 10, croissance: 1 }

  it(
    'compte 3e9 niveaux achetables en moins de 500 ms de temps réel (échec propre si une boucle apparaît)',
    () => {
      // Variante terminante du garde-fou, symétrique de celle des vagues : un décompte niveau par
      // niveau ferait 3e9 tours (~2 s) avant de rendre la main, la forme fermée répond en une division.
      // La borne de 500 ms n'est donc pas une mesure fine, c'est un interrupteur.
      const or = PLATE.coutBase * 3e9
      const debut = Date.now()
      const niveaux = niveauxAchetables(0, or, PLATE)
      const ecouleMs = Date.now() - debut

      expect(niveaux).toBe(3e9)
      expect(coutNiveaux(0, niveaux, PLATE)).toBe(or)
      expect(ecouleMs).toBeLessThan(500)
    },
    30_000,
  )

  it(
    'achète 1e17 niveaux en un appel, au prix exact de la somme, sans itérer',
    () => {
      // Garde-fou dur : 1e17 niveaux en un appel. Un décompte ne termine pas en temps humain, et comme
      // Vitest n'interrompt pas une boucle **synchrone**, le symptôme serait un run qui pend plutôt
      // qu'une assertion rouge. Le timeout ci-dessous est l'assertion : ne le retire pas pour
      // « débloquer » un run qui pend, c'est la régression qu'il vient de détecter.
      const or = 1e18
      const niveaux = niveauxAchetables(0, or, PLATE)
      expect(niveaux).toBe(1e17)
      expect(coutNiveaux(0, niveaux, PLATE)).toBe(or)

      const constantes = { ...C, ecoles: { ...C.ecoles, feu: PLATE } } as Constantes
      const achat = acheterNiveaux(etatAvecOr(or), 'feu', niveaux, constantes)
      expect(achat.accepte).toBe(true)
      expect(achat.etat.ecoles.feu.niveau).toBe(1e17)
      expect(achat.etat.bourse.or).toBe(0)
      expect(Number.isFinite(degatsParSeconde(achat.etat, constantes))).toBe(true)
    },
    1_000,
  )

  it(
    'inverse un budget de 1e250 sans décompter les niveaux',
    () => {
      const niveaux = niveauxAchetables(0, 1e250, FEU)
      expect(Number.isFinite(niveaux)).toBe(true)
      expect(Number.isNaN(coutNiveaux(0, niveaux, FEU))).toBe(false)
      expect(coutNiveaux(0, niveaux, FEU)).toBeLessThanOrEqual(1e250)
      expect(coutNiveaux(0, niveaux + 1, FEU)).toBeGreaterThan(1e250)
    },
    1_000,
  )
})

describe('production et paliers — §8', () => {
  it('multiplie par `multiplicateurParPalier` à chaque seuil franchi', () => {
    const seuils = FEU.paliersSeuils
    expect(multiplicateurPalier(0, FEU)).toBe(1)
    expect(multiplicateurPalier(seuils[0] - 1, FEU)).toBe(1)
    for (let rang = 0; rang < seuils.length; rang += 1) {
      const attendu = FEU.multiplicateurParPalier ** (rang + 1)
      expect(multiplicateurPalier(seuils[rang], FEU)).toBe(attendu)
    }
  })

  it('production = niveau × production_base × multiplicateur de palier', () => {
    const niveau = FEU.paliersSeuils[1]
    const attendu = niveau * FEU.productionBase * multiplicateurPalier(niveau, FEU)
    expect(productionEcole({ niveau, debloquee: true, revelee: true }, FEU)).toBeCloseTo(attendu, 9)
  })

  it('EXG-7 — une école révélée mais non débloquée ne produit rien', () => {
    expect(productionEcole({ niveau: 50, debloquee: false, revelee: true }, FEU)).toBe(0)
  })
})

describe('EXG-7 — une école verrouillée ne compte pas dans le total de dégâts', () => {
  it('50 niveaux de Glace non débloquée laissent le DPS inchangé', () => {
    const base = etatInitial(HORODATAGE)
    const avecFeu: EtatJeu = {
      ...base,
      ecoles: { ...base.ecoles, feu: { niveau: 4, debloquee: true, revelee: true } },
    }
    const dpsReference = degatsParSeconde(avecFeu, C)

    const avecGlaceVerrouillee: EtatJeu = {
      ...avecFeu,
      ecoles: { ...avecFeu.ecoles, glace: { niveau: 50, debloquee: false, revelee: true } },
    }
    expect(degatsParSeconde(avecGlaceVerrouillee, C)).toBe(dpsReference)
  })
})

describe('EXG-8 — révélation par boss puis achat en or', () => {
  const zoneRevelationGlace = C.ecoles.glace.zoneRevelation ?? 0

  it('la zone de révélation est une donnée du contrat, pas un identifiant en dur', () => {
    expect(zoneRevelationGlace).toBeGreaterThan(0)
    expect(C.ecoles.feu.zoneRevelation).toBeNull()
  })

  it('vaincre le boss de la zone de révélation rend l\'École de Glace visible mais pas débloquée', () => {
    const avant = etatInitial(HORODATAGE)
    expect(avant.ecoles.glace.revelee).toBe(false)

    const apres = revelerEcolesDeZone(avant, zoneRevelationGlace, C)
    expect(apres.ecoles.glace.revelee).toBe(true)
    expect(apres.ecoles.glace.debloquee).toBe(false)
    expect(apres.ecoles.glace.niveau).toBe(0)
    // Une école dont la zone de révélation est plus profonde reste masquée.
    expect(apres.ecoles.ecole5.revelee).toBe(false)
  })

  it('le 1er niveau reste verrouillé tant que l\'or est insuffisant, puis débloque l\'école', () => {
    const coutPremierNiveau = coutProchainNiveau(0, C.ecoles.glace)
    const revele = revelerEcolesDeZone(etatAvecOr(coutPremierNiveau - 1), zoneRevelationGlace, C)

    const refus = acheterNiveaux(revele, 'glace', 1, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('monnaieInsuffisante')
    expect(refus.etat).toBe(revele)

    const riche: EtatJeu = { ...revele, bourse: { ...revele.bourse, or: coutPremierNiveau } }
    const achat = acheterNiveaux(riche, 'glace', 1, C)
    expect(achat.accepte).toBe(true)
    expect(achat.coutPaye).toBe(coutPremierNiveau)
    expect(achat.etat.ecoles.glace).toEqual({ niveau: 1, debloquee: true, revelee: true })
    expect(achat.etat.bourse.or).toBe(0)
    expect(degatsParSeconde(achat.etat, C)).toBeGreaterThan(0)
  })

  it('une école non révélée refuse l\'achat même avec l\'or nécessaire', () => {
    const riche = etatAvecOr(1e12)
    const refus = acheterNiveaux(riche, 'ecole5', 1, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')
    expect(refus.etat).toBe(riche)
  })
})

describe('achat de plusieurs niveaux et refus', () => {
  it('achète k niveaux au prix de la forme fermée sans muter l\'état d\'entrée', () => {
    const cout = coutNiveaux(0, 6, FEU)
    const avant = Object.freeze(etatAvecOr(cout))
    const achat = acheterNiveaux(avant, 'feu', 6, C)

    expect(achat.accepte).toBe(true)
    expect(achat.quantite).toBe(6)
    expect(achat.etat.ecoles.feu.niveau).toBe(6)
    expect(achat.etat.bourse.or).toBeCloseTo(0, 9)
    expect(avant.ecoles.feu.niveau).toBe(0)
    expect(avant.bourse.or).toBe(cout)
  })

  it('refuse une quantité nulle, négative ou non finie sans toucher à l\'état', () => {
    const riche = etatAvecOr(1e12)
    for (const k of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const refus = acheterNiveaux(riche, 'feu', k, C)
      expect(refus.accepte).toBe(false)
      expect(refus.motifRefus).toBe('quantiteInvalide')
      expect(refus.etat).toBe(riche)
    }
  })

  it('refuse un identifiant d\'école inconnu', () => {
    const riche = etatAvecOr(1e12)
    const refus = acheterNiveaux(riche, 'inconnue' as IdEcole, 1, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('inconnu')
  })
})

describe('EXG-41 — l\'École de Lumière reste hors du circuit avant la 1re Ascension', () => {
  it('n\'est pas accessible même révélée, tant que la 6e école n\'est pas débloquée', () => {
    const base = etatAvecOr(1e12)
    const reveleeDeForce: EtatJeu = {
      ...base,
      ecoles: { ...base.ecoles, lumiere: { niveau: 0, debloquee: false, revelee: true } },
    }
    expect(C.ecoles.lumiere.requiertAscension).toBe(true)
    expect(ecoleAccessible(reveleeDeForce, 'lumiere', C)).toBe(false)

    const refus = acheterNiveaux(reveleeDeForce, 'lumiere', 1, C)
    expect(refus.accepte).toBe(false)
    expect(refus.motifRefus).toBe('verrouille')

    // Le drapeau d'Ascension est le seul interrupteur (câblé en T-7, pas ici).
    const apresAscension: EtatJeu = {
      ...reveleeDeForce,
      ascension: { ...reveleeDeForce.ascension, sixiemeEcoleDebloquee: true },
    }
    expect(ecoleAccessible(apresAscension, 'lumiere', C)).toBe(true)
  })

  it('aucun boss ne révèle Lumière, quelle que soit la zone vaincue', () => {
    const base = etatInitial(HORODATAGE)
    const zones = [1, 2, 4, 6, 8, 10, 50]
    const apres = zones.reduce<EtatJeu>((etat, zone) => revelerEcolesDeZone(etat, zone, C), base)
    expect(apres.ecoles.lumiere.revelee).toBe(false)
  })
})

describe('robustesse — constantes incomplètes', () => {
  it('ignore une école absente du contrat sans lever ni produire NaN', () => {
    const sansGlace = {
      ...C,
      ecoles: { ...C.ecoles, glace: undefined as unknown as ParametresEcole },
    } as Constantes
    const base = etatInitial(HORODATAGE)
    const etat: EtatJeu = {
      ...base,
      ecoles: { ...base.ecoles, glace: { niveau: 10, debloquee: true, revelee: true } },
    }
    expect(Number.isFinite(degatsParSeconde(etat, sansGlace))).toBe(true)
    expect(acheterNiveaux(etat, 'glace', 1, sansGlace).motifRefus).toBe('inconnu')
  })
})
