// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// La vague 3 (T-27) ajoutera ici les textes de l'équipement (noms, descriptions) à côté de ces
// nombres.

import { CONSTANTES } from './constantes.ts'

/** §4.6 / EXG-43 — achats multiplicatifs payés en renommée. */
export const EQUIPEMENT = CONSTANTES.equipement
