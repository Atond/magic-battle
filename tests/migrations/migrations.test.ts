// Chaîne de migrations de format de sauvegarde — T-10, EXG-26 : « appliquer les migrations successives
// **sans perte de progression** avant de continuer ».
//
// Deux registres sont éprouvés ici :
//  1. le registre **réel** (`MIGRATIONS`), aujourd'hui vide : la version 1 est la version initiale du
//     format, la fixture v1 se charge donc sans aucune étape ;
//  2. un registre **fictif**, déclaré dans ce test et nulle part ailleurs (jamais dans `src/`), qui
//     prouve que le mécanisme enchaîne les étapes dans l'ordre, sans saut et sans perte. C'est lui qui
//     sera remplacé par les vraies migrations le jour où le format bougera — le test, non.
//
// Les fixtures de ce dossier sont **gelées** : voir `fixtures/README.md` (spec §9).

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { VERSION_SCHEMA } from '../../src/domain/constantes-moteur.ts'
import { etatInitial } from '../../src/domain/moteur.ts'
import { deserialiser, lireVersion, MIGRATIONS, migrer } from '../../src/domain/sauvegarde/index.ts'
import type { Migration } from '../../src/domain/sauvegarde/index.ts'
import type { Constantes, Sauvegarde } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

const C: Constantes = CONSTANTES
const HORODATAGE = 1_700_000_000_000

function fixture(nom: string): unknown {
  return JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', nom), 'utf8')) as unknown
}

/** Progression connue de la fixture v1 : c'est elle qui ne doit jamais se perdre (critère d'EXG-26). */
const PROGRESSION_V1 = {
  or: 98765.25,
  niveauFeu: 27,
  niveauGlace: 6,
  eclatsPossedes: 58,
  eclatsCumulesAVie: 58,
  rangDegats1: 2,
  prestigesTotal: 2,
} as const

describe('EXG-26 — registre réel', () => {
  it('la version 1 est la version initiale : aucune migration à appliquer', () => {
    expect(MIGRATIONS).toEqual([])
    expect(VERSION_SCHEMA).toBe(1)
  })

  it('la fixture v1 se charge et conserve or, niveaux et Éclats connus', () => {
    const resultat = deserialiser(fixture('sauvegarde-v1-valide.json'), etatInitial(HORODATAGE), C)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.migrationsAppliquees).toBe(0)
    expect(resultat.etat.bourse.or).toBe(PROGRESSION_V1.or)
    expect(resultat.etat.ecoles.feu.niveau).toBe(PROGRESSION_V1.niveauFeu)
    expect(resultat.etat.ecoles.glace.niveau).toBe(PROGRESSION_V1.niveauGlace)
    expect(resultat.etat.bourse.eclatsPossedes).toBe(PROGRESSION_V1.eclatsPossedes)
    expect(resultat.etat.prestige.eclatsCumulesAVie).toBe(PROGRESSION_V1.eclatsCumulesAVie)
    expect(resultat.etat.prestige.rangsArbreEclats['eclats-degats-1']).toBe(PROGRESSION_V1.rangDegats1)
    expect(resultat.etat.prestige.prestigesTotal).toBe(PROGRESSION_V1.prestigesTotal)
    // EXG-25 — la version inscrite dans l'état rechargé est celle du code qui le relit.
    expect(resultat.etat.version).toBe(VERSION_SCHEMA)
  })

  it('lit et contrôle le numéro de version de l’enveloppe (EXG-25)', () => {
    expect(lireVersion(fixture('sauvegarde-v1-valide.json'))).toEqual({ ok: true, valeur: 1 })
    expect(lireVersion(fixture('rejet-version-future.json')).ok).toBe(false)
    for (const invalide of [null, [], 'v1', 42, { horodatageMs: 0 }, { version: '1' }, { version: 1.5 }, { version: 0 }]) {
      expect(lireVersion(invalide).ok, JSON.stringify(invalide)).toBe(false)
    }
  })
})

/* ══════════════════════════════════════════════ registre fictif : le mécanisme, pas les données */

/** Enveloppe manipulée par les migrations fictives : la charge est encore non fiable à ce stade. */
type Charge = Record<string, unknown>

describe('EXG-26 — mécanisme de chaînage (registre fictif, déclaré dans le test)', () => {
  /**
   * Trois formats fictifs. Chaque étape ajoute sa trace dans `journal` et **conserve** tout ce qu'elle
   * a reçu : c'est la définition de « sans perte de progression ».
   */
  function etape(de: number, vers: number): Migration {
    return {
      de,
      vers,
      appliquer: (charge) => {
        const source = charge as Charge
        const journal = Array.isArray(source.journal) ? (source.journal as unknown[]) : []
        return { ...source, version: vers, journal: [...journal, `${de}→${vers}`] }
      },
    }
  }

  const REGISTRE: readonly Migration[] = [etape(1, 2), etape(2, 3)]
  const CHARGE_V1: Charge = { version: 1, horodatageMs: HORODATAGE, or: PROGRESSION_V1.or }

  it('applique les étapes dans l’ordre, de la version lue à la version cible', () => {
    const resultat = migrer(CHARGE_V1, 1, 3, REGISTRE)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.etapes).toBe(2)
    const migree = resultat.valeur as Charge
    expect(migree.journal).toEqual(['1→2', '2→3'])
    expect(migree.version).toBe(3)
  })

  it('ne perd rien en route : les champs connus traversent la chaîne', () => {
    const resultat = migrer(CHARGE_V1, 1, 3, REGISTRE)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    const migree = resultat.valeur as Charge
    expect(migree.or).toBe(PROGRESSION_V1.or)
    expect(migree.horodatageMs).toBe(HORODATAGE)
  })

  it('part de la bonne marche : une v2 ne rejoue pas la migration 1→2', () => {
    const resultat = migrer({ ...CHARGE_V1, version: 2 }, 2, 3, REGISTRE)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.etapes).toBe(1)
    expect((resultat.valeur as Charge).journal).toEqual(['2→3'])
  })

  it('ne touche à rien quand la version lue est déjà la cible', () => {
    const resultat = migrer(CHARGE_V1, 1, 1, REGISTRE)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.etapes).toBe(0)
    expect(resultat.valeur).toBe(CHARGE_V1)
  })

  it('refuse plutôt que de charger à moitié quand un maillon manque (EXG-26)', () => {
    const troue = migrer(CHARGE_V1, 1, 3, [etape(2, 3)])
    expect(troue.ok).toBe(false)
    if (!troue.ok) expect(troue.erreur.motif).toBe('migrationManquante')
  })

  it('refuse un registre ambigu (deux migrations pour la même version de départ)', () => {
    const ambigu = migrer(CHARGE_V1, 1, 2, [etape(1, 2), etape(1, 2)])
    expect(ambigu.ok).toBe(false)
    if (!ambigu.ok) expect(ambigu.erreur.motif).toBe('migrationManquante')
  })

  it('refuse un registre qui recule ou stagne (pas de chaîne infinie)', () => {
    for (const casse of [[etape(2, 2)], [etape(3, 2)]]) {
      const resultat = migrer(CHARGE_V1, 1, 3, casse)
      expect(resultat.ok).toBe(false)
    }
  })

  it('refuse une sauvegarde plus récente que le code qui la relit (EXG-25)', () => {
    const future = migrer({ ...CHARGE_V1, version: 9 }, 9, 3, REGISTRE)
    expect(future.ok).toBe(false)
    if (!future.ok) expect(future.erreur.motif).toBe('versionFuture')
  })

  it('une chaîne qui dépasse la cible sans l’atteindre est refusée', () => {
    const resultat = migrer(CHARGE_V1, 1, 2, [etape(1, 3)])
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreur.motif).toBe('migrationManquante')
  })

  it('valide le registre même quand aucune étape n’est nécessaire (un registre cassé est un bug de code)', () => {
    // `de === vers` ne progresse pas : le registre est refusé dès le premier import, même si la
    // sauvegarde lue est déjà à la version cible. Un registre incohérent se signale tout de suite.
    const stagnante: Migration = { de: 1, vers: 1, appliquer: (charge) => charge }
    const resultat = migrer(CHARGE_V1, 1, 1, [stagnante])
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreur.motif).toBe('migrationManquante')
  })

  it('les clés d’un ancien format non reprises par le schéma sont ignorées, pas fusionnées (EXG-45)', () => {
    // Le cas complet : une charge au format « précédent » (l'or vivait à la racine, hors de la bourse)
    // traverse l'import réel. Le champ hérité n'est pas lu, et l'état reconstruit ne le contient pas.
    const v1 = fixture('sauvegarde-v1-valide.json') as Sauvegarde
    const heritage = {
      version: 1,
      horodatageMs: v1.horodatageMs,
      orHeritage: v1.etat.bourse.or,
      etat: { ...v1.etat, bourse: { ...v1.etat.bourse, or: 0 } },
    }
    const resultat = deserialiser(heritage, etatInitial(HORODATAGE), C)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.etat.bourse.or).toBe(0)
    expect((resultat.etat as unknown as Record<string, unknown>).orHeritage).toBeUndefined()
    // …et c'est bien le rôle d'une vraie migration que de le récupérer : sans elle, la donnée est
    // perdue. C'est pourquoi EXG-26 exige une migration (et sa fixture gelée) à chaque changement.
  })
})
