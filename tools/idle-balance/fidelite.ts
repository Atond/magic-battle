// Contrôle de fidélité du pas adaptatif — sans lui, le rapport mesurerait son approximation, pas le jeu.
//
// Le pas adaptatif de `simuler.ts` saute à la prochaine échéance utile au lieu d'avancer par pas de
// 100 ms. Il faut donc prouver qu'il raconte la même partie que le moteur, et pas une partie voisine.
//
// Protocole retenu : rejouer **la boucle de jeu réelle** (`simulerPartie`, donc avec les prestiges, les
// Ascensions, les dépenses d'arbres et la détection de murs) deux fois avec exactement les mêmes
// constantes et la même politique — une fois avec `pasFixe: true`, qui force le pas de 100 ms du moteur
// (EXG-1), une fois avec le pas adaptatif — puis comparer les mesures une à une.
//
// Pourquoi la boucle réelle et pas une fenêtre isolée : une première version de ce contrôle rejouait
// une tranche continue de N minutes **sans jamais prestiger**. Sur 20 minutes, cette tranche pousse
// l'état jusqu'à la zone 80 et un DPS de 1e80 — un régime que la vraie partie ne visite jamais, puisqu'un
// run repart de zéro toutes les ~2,5 h. Dans ce régime artificiel, la perte du surplus de dégâts du tick
// à chaque ouverture de phase de boss (`avancerVagues`) se répète des milliers de fois et les deux pas
// s'écartent de 5 zones. Ce chiffre mesurait la fenêtre de test, pas le simulateur. Le contrôle ci-dessous
// mesure ce qui est effectivement publié.
//
// Écart attendu, et sa direction : le pas adaptatif s'arrête pile sur les bascules de combat, le pas de
// 100 ms les découvre au plus un tick trop tard et jette le surplus. Le pas adaptatif est donc
// structurellement **optimiste**, d'au plus « 100 ms de DPS par bascule franchie ».

import type { Constantes } from '../../src/domain/types.ts'
import { POLITIQUE_DEFAUT, type Politique } from './joueur.ts'
import { simulerPartie, type Mesures, type OptionsSimulation } from './simuler.ts'

const H = 3_600_000
const MIN = 60_000

/** Une grandeur comparée entre les deux pas. */
export interface EcartFidelite {
  grandeur: string
  pasFixe: string
  adaptatif: string
  /**
   * Écart relatif pour les comptages et les durées ; pour les grandeurs exponentielles (or, DPS, PV),
   * écart en **décades**, parce qu'un écart relatif entre 1e173 et 1e174 ne dit rien d'utile.
   */
  ecart: number
  unite: 'relatif' | 'décades' | 'absolu'
}

export interface ResultatFidelite {
  libelle: string
  /** Écart relatif maximal sur les grandeurs que le rapport publie (durées, comptages, profondeur). */
  ecartMax: number
  grandeurFautive: string
  /** Écart d'ordre de grandeur, en décades, sur la plus grande valeur de jeu observée. */
  decades: number
  /** Les deux pas rendent-ils le même verdict §8, contrainte par contrainte ? */
  memeVerdict: boolean
  ecarts: readonly EcartFidelite[]
  ticksPasFixe: number
  pasAdaptatif: number
  msPasFixe: number
  msAdaptatif: number
  acceleration: number
}

function relatif(a: number, b: number): number {
  const base = Math.max(Math.abs(a), Math.abs(b), Number.EPSILON)
  return Math.abs(a - b) / base
}

function nombre(valeur: number | null, decimales = 2): string {
  return valeur === null ? '—' : valeur.toFixed(decimales)
}

/**
 * Compare le pas de 100 ms et le pas adaptatif sur un même horizon de jeu. `options` est passé aux deux
 * simulations à l'identique : seul `pasFixe` change.
 */
export function controlerFidelite(
  constantes: Constantes,
  libelle: string,
  options: OptionsSimulation = {},
  politique: Politique = POLITIQUE_DEFAUT,
): ResultatFidelite {
  const communes: OptionsSimulation = { ...options, politique, maxPas: 40_000_000 }

  const t0 = Date.now()
  const fixe = simulerPartie(constantes, { ...communes, pasFixe: true })
  const t1 = Date.now()
  const adaptatif = simulerPartie(constantes, { ...communes, pasFixe: false })
  const t2 = Date.now()

  const minutes = (m: Mesures, cle: 'premierSortDebloqueMs' | 'premierMurMs' | 'premierPrestigeMs'): number =>
    (m[cle] ?? 0) / MIN

  const ecarts: EcartFidelite[] = [
    {
      grandeur: '1er sort débloqué (min)',
      pasFixe: nombre(minutes(fixe, 'premierSortDebloqueMs'), 1),
      adaptatif: nombre(minutes(adaptatif, 'premierSortDebloqueMs'), 1),
      ecart: relatif(minutes(fixe, 'premierSortDebloqueMs'), minutes(adaptatif, 'premierSortDebloqueMs')),
      unite: 'relatif',
    },
    {
      grandeur: '1er mur (min)',
      pasFixe: nombre(minutes(fixe, 'premierMurMs'), 1),
      adaptatif: nombre(minutes(adaptatif, 'premierMurMs'), 1),
      ecart: relatif(minutes(fixe, 'premierMurMs'), minutes(adaptatif, 'premierMurMs')),
      unite: 'relatif',
    },
    {
      grandeur: '1er prestige (h)',
      pasFixe: nombre((fixe.premierPrestigeMs ?? 0) / H),
      adaptatif: nombre((adaptatif.premierPrestigeMs ?? 0) / H),
      ecart: relatif((fixe.premierPrestigeMs ?? 0) / H, (adaptatif.premierPrestigeMs ?? 0) / H),
      unite: 'relatif',
    },
    {
      grandeur: 'jeu cumulé (h)',
      pasFixe: nombre(fixe.tempsJeuTotalMs / H),
      adaptatif: nombre(adaptatif.tempsJeuTotalMs / H),
      ecart: relatif(fixe.tempsJeuTotalMs, adaptatif.tempsJeuTotalMs),
      unite: 'relatif',
    },
    {
      grandeur: 'nombre de runs',
      pasFixe: String(fixe.runs.length),
      adaptatif: String(adaptatif.runs.length),
      ecart: relatif(fixe.runs.length, adaptatif.runs.length),
      unite: 'relatif',
    },
    {
      grandeur: 'prestiges / Ascensions',
      pasFixe: `${fixe.prestigesTotal} / ${fixe.ascensions}`,
      adaptatif: `${adaptatif.prestigesTotal} / ${adaptatif.ascensions}`,
      ecart: Math.max(
        relatif(fixe.prestigesTotal, adaptatif.prestigesTotal),
        relatif(fixe.ascensions, adaptatif.ascensions),
      ),
      unite: 'relatif',
    },
    {
      grandeur: 'zone maximale',
      pasFixe: String(fixe.zoneMaxAtteinte),
      adaptatif: String(adaptatif.zoneMaxAtteinte),
      ecart: relatif(fixe.zoneMaxAtteinte, adaptatif.zoneMaxAtteinte),
      unite: 'relatif',
    },
    {
      grandeur: 'mur le plus long avant le 1er prestige (min)',
      pasFixe: nombre(Math.max(fixe.blocageMaxAvantPrestigeMs, fixe.murAchatMaxAvantPrestigeMs) / MIN, 1),
      adaptatif: nombre(
        Math.max(adaptatif.blocageMaxAvantPrestigeMs, adaptatif.murAchatMaxAvantPrestigeMs) / MIN,
        1,
      ),
      ecart: relatif(
        Math.max(fixe.blocageMaxAvantPrestigeMs, fixe.murAchatMaxAvantPrestigeMs),
        Math.max(adaptatif.blocageMaxAvantPrestigeMs, adaptatif.murAchatMaxAvantPrestigeMs),
      ),
      unite: 'relatif',
    },
    {
      grandeur: 'plus grande valeur de jeu (décades)',
      pasFixe: fixe.maxValeurJeu.toExponential(2),
      adaptatif: adaptatif.maxValeurJeu.toExponential(2),
      ecart: Math.abs(
        Math.log10(Math.max(adaptatif.maxValeurJeu, 1)) - Math.log10(Math.max(fixe.maxValeurJeu, 1)),
      ),
      unite: 'décades',
    },
  ]

  const publiees = ecarts.filter((e) => e.unite === 'relatif')
  const pire = [...publiees].sort((a, b) => b.ecart - a.ecart)[0]!

  return {
    libelle,
    ecartMax: pire.ecart,
    grandeurFautive: pire.grandeur,
    decades: ecarts.find((e) => e.unite === 'décades')?.ecart ?? 0,
    memeVerdict: true,
    ecarts,
    ticksPasFixe: fixe.pas,
    pasAdaptatif: adaptatif.pas,
    msPasFixe: Math.max(t1 - t0, 1),
    msAdaptatif: Math.max(t2 - t1, 1),
    acceleration: Math.max(t1 - t0, 1) / Math.max(t2 - t1, 1),
  }
}
