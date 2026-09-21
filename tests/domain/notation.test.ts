// Miroir de `src/domain/notation.ts` — notation des grands nombres (EXG-36, EXG-37).

import { describe, expect, it } from 'vitest'

import { SEUIL_GRANDS_NOMBRES } from '../../src/domain/constantes-moteur.ts'
import { depasseSeuilGrandsNombres, formater } from '../../src/domain/notation.ts'

describe('formater — cas de référence de la spec (EXG-36)', () => {
  it('1 234 567 devient « 1,23 M »', () => {
    expect(formater(1_234_567)).toBe('1,23 M')
  })

  it('10³⁴ passe en notation scientifique', () => {
    expect(formater(1e34)).toBe('1,00e+34')
  })
})

describe('formater — entiers bruts sous 10⁶', () => {
  it('rend les petits entiers tels quels, virgule française pour les décimales utiles', () => {
    expect(formater(0)).toBe('0')
    expect(formater(7)).toBe('7')
    expect(formater(999_999)).toBe('999999')
    // Le palier K n'est pas abrégé : sous 10⁶ la spec demande l'entier brut.
    expect(formater(1_234)).toBe('1234')
    expect(formater(1.5)).toBe('1,5')
    expect(formater(0.25)).toBe('0,25')
    expect(formater(12.3456)).toBe('12,35')
  })

  it('respecte le signe', () => {
    expect(formater(-42)).toBe('-42')
    expect(formater(-1_234_567)).toBe('-1,23 M')
    expect(formater(-0)).toBe('0')
  })
})

describe('formater — chaque palier de suffixe abrégé', () => {
  const paliers: readonly [number, string][] = [
    [1e6, 'M'],
    [1e9, 'B'],
    [1e12, 'T'],
    [1e15, 'Qa'],
    [1e18, 'Qi'],
    [1e21, 'Sx'],
    [1e24, 'Sp'],
    [1e27, 'Oc'],
    [1e30, 'No'],
  ]

  it.each(paliers)('%s utilise le suffixe %s', (valeur, suffixe) => {
    expect(formater(valeur)).toBe(`1,00 ${suffixe}`)
    expect(formater(valeur * 2.5)).toBe(`2,50 ${suffixe}`)
  })

  it('garde 2 à 3 chiffres significatifs selon l\'ordre de grandeur', () => {
    expect(formater(1_000_000)).toBe('1,00 M')
    expect(formater(12_345_678)).toBe('12,3 M')
    expect(formater(123_456_789)).toBe('123 M')
  })

  it('remonte d\'un palier quand l\'arrondi atteint 1000', () => {
    expect(formater(999_999_999)).toBe('1,00 B')
    expect(formater(999_999)).toBe('999999') // sous 10⁶ : pas d'arrondi vers « 1,00 M »
  })
})

describe('formater — bascule scientifique au-delà de 10³³', () => {
  it('abrège encore juste sous le seuil, bascule dès le seuil', () => {
    expect(formater(9.99e32)).toBe('999 No')
    expect(formater(1e33)).toBe('1,00e+33')
    expect(formater(1.5e100)).toBe('1,50e+100')
    expect(formater(-2e40)).toBe('-2,00e+40')
  })
})

describe('formater — cas limites non numériques', () => {
  it('ne produit jamais « NaN » suivi d\'un suffixe', () => {
    for (const valeur of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const rendu = formater(valeur)
      expect(rendu).not.toContain('NaN')
      expect(rendu).not.toMatch(/(M|B|T|Qa|Qi|Sx|Sp|Oc|No)$/)
      expect(rendu.length).toBeGreaterThan(0)
    }
    expect(formater(Number.NaN)).toBe('—')
    expect(formater(Number.POSITIVE_INFINITY)).toBe('∞')
    expect(formater(Number.NEGATIVE_INFINITY)).toBe('-∞')
  })
})

describe('depasseSeuilGrandsNombres — signal de migration (EXG-37)', () => {
  it('ne déclenche que strictement au-dessus de 1e300', () => {
    expect(depasseSeuilGrandsNombres(0)).toBe(false)
    expect(depasseSeuilGrandsNombres(1e299)).toBe(false)
    expect(depasseSeuilGrandsNombres(SEUIL_GRANDS_NOMBRES)).toBe(false)
    expect(depasseSeuilGrandsNombres(1.1e300)).toBe(true)
    expect(depasseSeuilGrandsNombres(-1.1e300)).toBe(true)
  })

  it('traite l\'infini comme un dépassement et NaN comme non concluant', () => {
    expect(depasseSeuilGrandsNombres(Number.POSITIVE_INFINITY)).toBe(true)
    expect(depasseSeuilGrandsNombres(Number.NaN)).toBe(false)
  })
})
