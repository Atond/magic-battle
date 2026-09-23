// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Les textes des améliorations (T-27, noms et descriptions) vivent en bas de ce fichier, à côté de ces
// nombres.

import { CONSTANTES } from './constantes.ts'
import type { TexteContenu } from './types-textes.ts'

/** §4.6 / EXG-42 — achats multiplicatifs payés en or. */
export const AMELIORATIONS = CONSTANTES.ameliorations

/** T-27 — textes des améliorations payées en or (multiplicateurs de dégâts). */
export const TEXTES_AMELIORATIONS: Readonly<Record<'amelioration-1' | 'amelioration-2', TexteContenu>> = {
  'amelioration-1': {
    nom: 'Bâton vitaminé',
    description: 'Du bois, du vernis, un soupçon de magie. Ça ne paie pas de mine, mais ça tape.',
  },
  'amelioration-2': {
    nom: 'Grimoire annoté',
    description: 'Quelqu’un a souligné les bons passages. Tes sorts font plus mal, tu lis moins.',
  },
}
