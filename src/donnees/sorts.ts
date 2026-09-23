// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Les textes des sorts (T-24, noms et descriptions) vivent en bas de ce fichier, à côté de ces nombres.

import { CONSTANTES } from './constantes.ts'
import type { TexteContenu } from './types-textes.ts'

/** §4.3 / EXG-11 à EXG-13 — les six sorts actifs, un par école, touches 1 à 6. */
export const SORTS = CONSTANTES.sorts

/** T-24 — nom affiché et description de chaque sort actif, un par école. */
export const TEXTES_SORTS: Readonly<
  Record<'sort-feu' | 'sort-glace' | 'sort-3' | 'sort-4' | 'sort-5' | 'sort-lumiere', TexteContenu>
> = {
  'sort-feu': {
    nom: 'Grosse boule de feu',
    description: 'Pas de finesse, pas de calcul. Juste une boule, grosse, et en feu.',
  },
  'sort-glace': {
    nom: 'Douche froide',
    description: 'Gèle la cible et son moral. Rien de personnel, c’est l’ambiance de l’école.',
  },
  'sort-3': {
    nom: 'Coup de foudre',
    description: 'Frappe au premier regard. Le monstre, lui, n’avait rien demandé.',
  },
  'sort-4': {
    nom: 'Pierre qui roule',
    description: 'N’amasse pas mousse. Amasse surtout des monstres aplatis au passage.',
  },
  'sort-5': {
    nom: 'Coup en douce',
    description: 'Personne n’a rien vu. Surtout pas le monstre, c’est tout l’intérêt.',
  },
  'sort-lumiere': {
    nom: 'Plein phare',
    description: 'Aveugle la cible, puis tout l’écran. Pense à baisser la luminosité.',
  },
}
