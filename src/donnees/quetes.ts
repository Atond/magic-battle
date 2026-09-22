// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// La vague 3 (T-26) ajoutera ici les libellés définitifs des quêtes à côté de ces nombres.

import { CONSTANTES } from './constantes.ts'

/** EXG-54 — liste des quêtes (succès inclus, ADR-11). */
export const QUETES = CONSTANTES.quetes
