// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// La vague 3 (T-25) ajoutera ici les textes de zones (noms, descriptions) à côté de ces nombres.

import { CONSTANTES } from './constantes.ts'

/** §8 / EXG-15, EXG-16 — courbe de PV des vagues et des boss, cadence des zones. */
export const ZONES = CONSTANTES.zones
