// Filet sur les textes de contenu de la vague 3 (T-24 à T-27, guide de ton §7). Ce test ne juge pas le
// ton — la revue lecture seule le fait. Il attrape ce qu'une relecture laisse passer à coup sûr :
//  - un identifiant du moteur sans texte (l'UI afficherait l'id brut) ou un texte orphelin (renommage
//    d'id côté simulateur que personne n'a reporté côté contenu) ;
//  - un texte vide, trop long pour sa carte, un chiffre arabe (un seuil écrit en dur mentirait dès que le
//    simulateur le change : l'UI affiche les nombres depuis `CONSTANTES`, à côté du texte) ;
//  - l'apostrophe droite `'` (le contenu utilise la typographique `’`) ;
//  - un petit lexique « style IA » (§7, colonne « à éviter »).
//
// Faute qu'il ne verra pas : un texte plat, faux ou hors ton qui respecte toutes ces bornes. C'est pour
// ça que la revue reste le juge ; ce fichier n'est qu'un filet.

import { describe, expect, it } from 'vitest'

import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { TEXTES_AMELIORATIONS } from '../../src/donnees/ameliorations.ts'
import { TEXTES_NOEUDS } from '../../src/donnees/arbres.ts'
import { TEXTES_ECOLES } from '../../src/donnees/ecoles.ts'
import { TEXTES_EQUIPEMENT } from '../../src/donnees/equipement.ts'
import { FIN, TEXTES_FIN } from '../../src/donnees/fin.ts'
import { TEXTES_QUETES } from '../../src/donnees/quetes.ts'
import { TEXTES_SORTS } from '../../src/donnees/sorts.ts'
import type { TexteContenu } from '../../src/donnees/types-textes.ts'
import { TEXTES_REGIONS } from '../../src/donnees/zones.ts'

/** Borne d'un nom affiché (carte d'école, cellule de sort, badge du canvas). */
const LONGUEUR_MAX_NOM = 32
/** Borne d'une ligne de description / ambiance / narration : une ligne, pas un paragraphe. */
const LONGUEUR_MAX_LIGNE = 110

const trie = (cles: Iterable<string>): string[] => [...cles].sort()

describe('contenu — chaque identifiant du moteur a son texte, et réciproquement', () => {
  const cas: readonly [string, readonly string[], Readonly<Record<string, unknown>>][] = [
    ['écoles', Object.keys(CONSTANTES.ecoles), TEXTES_ECOLES],
    ['sorts', CONSTANTES.sorts.map((s) => s.id), TEXTES_SORTS],
    ['quêtes', CONSTANTES.quetes.map((q) => q.id), TEXTES_QUETES],
    ['nœuds d’arbre', CONSTANTES.noeuds.map((n) => n.id), TEXTES_NOEUDS],
    ['améliorations', CONSTANTES.ameliorations.map((a) => a.id), TEXTES_AMELIORATIONS],
    ['équipement', CONSTANTES.equipement.map((e) => e.id), TEXTES_EQUIPEMENT],
  ]

  it.each(cas)('%s : mêmes identifiants des deux côtés', (_nom, ids, textes) => {
    const sansTexte = ids.filter((id) => !Object.hasOwn(textes, id))
    const orphelins = Object.keys(textes).filter((cle) => !ids.includes(cle))
    expect(sansTexte, 'identifiants du moteur sans texte').toEqual([])
    expect(orphelins, 'textes sans identifiant du moteur').toEqual([])
    expect(trie(Object.keys(textes))).toEqual(trie(ids))
  })

  it('12 régions de zones', () => {
    expect(TEXTES_REGIONS).toHaveLength(12)
  })

  it('une ligne de narration par Ascension requise, ni plus ni moins', () => {
    expect(TEXTES_FIN.ascensions).toHaveLength(FIN.nAscensionsRequises)
  })
})

/** Un texte à vérifier : où il vit (pour le message d'échec), sa valeur, et s'il s'agit d'un nom. */
interface Texte {
  readonly ou: string
  readonly valeur: string
  readonly estNom: boolean
}

function depuisContenu(prefixe: string, table: Readonly<Record<string, TexteContenu>>): Texte[] {
  return Object.entries(table).flatMap(([id, t]) => [
    { ou: `${prefixe}.${id}.nom`, valeur: t.nom, estNom: true },
    { ou: `${prefixe}.${id}.description`, valeur: t.description, estNom: false },
  ])
}

function tousLesTextes(): Texte[] {
  const textes: Texte[] = [
    ...depuisContenu('TEXTES_ECOLES', TEXTES_ECOLES),
    ...depuisContenu('TEXTES_SORTS', TEXTES_SORTS),
    ...depuisContenu('TEXTES_QUETES', TEXTES_QUETES),
    ...depuisContenu('TEXTES_NOEUDS', TEXTES_NOEUDS),
    ...depuisContenu('TEXTES_AMELIORATIONS', TEXTES_AMELIORATIONS),
    ...depuisContenu('TEXTES_EQUIPEMENT', TEXTES_EQUIPEMENT),
    ...depuisContenu('TEXTES_FIN', { zoneFinale: TEXTES_FIN.zoneFinale, bossFinal: TEXTES_FIN.bossFinal }),
    { ou: 'TEXTES_FIN.intro', valeur: TEXTES_FIN.intro, estNom: false },
    ...TEXTES_FIN.ascensions.map((valeur, i) => ({ ou: `TEXTES_FIN.ascensions[${i}]`, valeur, estNom: false })),
    { ou: 'TEXTES_FIN.ecranFin.titre', valeur: TEXTES_FIN.ecranFin.titre, estNom: true },
    ...TEXTES_FIN.ecranFin.lignes.map((valeur, i) => ({ ou: `TEXTES_FIN.ecranFin.lignes[${i}]`, valeur, estNom: false })),
  ]
  TEXTES_REGIONS.forEach((r, i) => {
    const ou = `TEXTES_REGIONS[${i}]`
    textes.push(
      { ou: `${ou}.nom`, valeur: r.nom, estNom: true },
      { ou: `${ou}.ambiance`, valeur: r.ambiance, estNom: false },
      ...r.monstres.map((valeur, j) => ({ ou: `${ou}.monstres[${j}]`, valeur, estNom: true })),
      ...depuisContenu(ou, { boss: r.boss, gardien: r.gardien }),
    )
  })
  return textes
}

/**
 * §7 « à éviter » — formules grandiloquentes ou génériques. Mots entiers (bornes Unicode, pas `\b` qui
 * ne connaît pas les lettres accentuées), insensible à la casse.
 */
const LEXIQUE_INTERDIT: readonly RegExp[] = [
  'épique',
  'épiques',
  'légendaire',
  'légendaires',
  'ultime',
  'ultimes',
  'inoubliable',
  'inoubliables',
  'plongez',
  'plonge dans',
  'aventure',
  'aventures',
  'mystère',
  'mystères',
  'monde de',
  'préparez-vous',
  'prépare-toi',
  'embarquez',
  'au-delà de l’imagination',
  'destin',
].map((mot) => new RegExp(`(?<![\\p{L}])${mot}(?![\\p{L}])`, 'iu'))

describe('contenu — forme des textes', () => {
  const textes = tousLesTextes()

  it('aucune chaîne vide', () => {
    expect(textes.filter((t) => t.valeur.trim() === '').map((t) => t.ou)).toEqual([])
  })

  it(`nom ≤ ${LONGUEUR_MAX_NOM} caractères, toute autre ligne ≤ ${LONGUEUR_MAX_LIGNE}`, () => {
    const tropLongs = textes
      .filter((t) => [...t.valeur].length > (t.estNom ? LONGUEUR_MAX_NOM : LONGUEUR_MAX_LIGNE))
      .map((t) => `${t.ou} (${[...t.valeur].length}) : ${t.valeur}`)
    expect(tropLongs).toEqual([])
  })

  it('aucun chiffre arabe : les nombres viennent de CONSTANTES, affichés à côté', () => {
    expect(textes.filter((t) => /[0-9]/.test(t.valeur)).map((t) => `${t.ou} : ${t.valeur}`)).toEqual([])
  })

  it('apostrophe typographique seulement (’), jamais la droite', () => {
    expect(textes.filter((t) => t.valeur.includes("'")).map((t) => `${t.ou} : ${t.valeur}`)).toEqual([])
  })

  it('aucun mot du lexique « style IA » ni « !!! »', () => {
    const fautifs = textes
      .filter((t) => t.valeur.includes('!!!') || LEXIQUE_INTERDIT.some((re) => re.test(t.valeur)))
      .map((t) => `${t.ou} : ${t.valeur}`)
    expect(fautifs).toEqual([])
  })
})
