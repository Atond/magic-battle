// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// La vague 3 (T-24/T-25 selon le nœud) ajoutera ici les textes des nœuds (noms, descriptions) à côté
// de ces nombres.

import { CONSTANTES } from './constantes.ts'

/** EXG-39 / EXG-40 — catalogue des nœuds des deux arbres (Éclats, remis à zéro ; Ascension, permanent). */
export const NOEUDS = CONSTANTES.noeuds
