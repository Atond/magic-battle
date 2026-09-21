// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// La vague 3 (T-24) ajoutera ici les textes des sorts (noms, descriptions) à côté de ces nombres.

import { CONSTANTES } from './constantes.ts'

/** §4.3 / EXG-11 à EXG-13 — les six sorts actifs, un par école, touches 1 à 6. */
export const SORTS = CONSTANTES.sorts
