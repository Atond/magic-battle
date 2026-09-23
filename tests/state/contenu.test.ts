// Correspondance zone → région / monstre / boss (`src/state/contenu.ts`, vague 3). Choix d'affichage,
// donc testé ici plutôt que dans `tests/domain/`.

import { describe, expect, it } from 'vitest'

import type { Boss, Monstre } from '../../src/domain/types.ts'
import { TEXTES_FIN } from '../../src/donnees/fin.ts'
import { TEXTES_REGIONS } from '../../src/donnees/zones.ts'
import { etatInitial } from '../../src/domain/moteur.ts'
import {
  ZONES_PAR_REGION,
  enCombatFinal,
  estZoneDeGardien,
  indexRegion,
  nomCible,
  nomCibleCourante,
  regionDeZone,
} from '../../src/state/contenu.ts'

const MONSTRE: Monstre = { nom: '', pvMax: 10, pvCourants: 10, orAuMeurtre: 1 }
const boss = (zone: number, estFinal = false): Boss => ({ ...MONSTRE, zone, estBoss: true, estFinal })

describe('régions — dix zones chacune, la dernière couvre tout ce qui dépasse', () => {
  it('zones 1 à 10 → région 0, 11 → région 1, 20 → région 1, 21 → région 2', () => {
    expect([1, 10, 11, 20, 21].map(indexRegion)).toEqual([0, 0, 1, 1, 2])
    expect(ZONES_PAR_REGION).toBe(10)
  })

  it('la dernière région couvre toutes les zones au-delà, sans borne', () => {
    const derniere = TEXTES_REGIONS.length - 1
    const premiereDeLaDerniere = derniere * ZONES_PAR_REGION + 1
    expect(indexRegion(premiereDeLaDerniere - 1)).toBe(derniere - 1)
    expect(indexRegion(premiereDeLaDerniere)).toBe(derniere)
    expect(indexRegion(1e6)).toBe(derniere)
    expect(regionDeZone(1e300)).toBe(TEXTES_REGIONS[derniere])
  })

  it('une zone invalide (0, négative, NaN, infinie) retombe sur la première région, jamais sur undefined', () => {
    for (const zone of [0, -3, Number.NaN, Number.NEGATIVE_INFINITY]) expect(regionDeZone(zone)).toBe(TEXTES_REGIONS[0])
    expect(regionDeZone(Number.POSITIVE_INFINITY)).toBe(TEXTES_REGIONS[0])
  })
})

describe('nom de la cible', () => {
  it('monstres de vague tirés tour à tour parmi les trois de la région', () => {
    const [a, b, c] = TEXTES_REGIONS[1]!.monstres
    expect([1, 2, 3, 4, 5].map((vague) => nomCible(MONSTRE, 12, vague))).toEqual([a, b, c, a, b])
  })

  it('boss ordinaire dans les zones 1 à 9 d’une région, gardien dans la 10ᵉ', () => {
    const region = TEXTES_REGIONS[0]!
    expect(nomCible(boss(9), 9, 1)).toBe(region.boss.nom)
    expect(nomCible(boss(10), 10, 1)).toBe(region.gardien.nom)
    expect(nomCible(boss(20), 20, 1)).toBe(TEXTES_REGIONS[1]!.gardien.nom)
    expect([10, 20, 30].every(estZoneDeGardien)).toBe(true)
    expect([1, 9, 11, 19].some(estZoneDeGardien)).toBe(false)
  })

  it('boss final : le nom de TEXTES_FIN, quelle que soit la zone', () => {
    expect(nomCible(boss(10, true), 10, 1)).toBe(TEXTES_FIN.bossFinal.nom)
  })

  it('le nom porté par l’état (sauvegarde, entrée non fiable) n’est jamais repris', () => {
    const hostile: Monstre = { ...MONSTRE, nom: '<img src=x onerror=alert(1)>' }
    expect(nomCible(hostile, 1, 1)).toBe(TEXTES_REGIONS[0]!.monstres[0])
  })

  it('aucune cible : chaîne vide', () => {
    expect(nomCible(null, 1, 1)).toBe('')
  })
})

describe('EXG-28 — combat final : il vit dans `EtatJeu.bossFinal`, pas dans `combat.cible`', () => {
  it('dès que `bossFinal` existe, la cible affichée est le boss final, même si `combat.cible` est un monstre', () => {
    const base = etatInitial(0)
    expect(enCombatFinal(base)).toBe(false)
    expect(nomCibleCourante(base)).not.toBe(TEXTES_FIN.bossFinal.nom)

    const enCombat = { ...base, bossFinal: { pvCourants: 1, timerRestantMs: 1 } }
    expect(enCombatFinal(enCombat)).toBe(true)
    expect(nomCibleCourante(enCombat)).toBe(TEXTES_FIN.bossFinal.nom)
  })
})
