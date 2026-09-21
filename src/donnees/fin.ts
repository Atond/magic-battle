// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` et de sa révision
// `tools/idle-balance/rapports/2026-09-21-revision-adr17-bossfinal.md`, via `src/donnees/constantes.ts`,
// généré par `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// La vague 3 ajoutera ici les textes de fin de partie (boss final, épilogue) à côté de ces nombres.

import { BOSS_FINAL, CONSTANTES } from './constantes.ts'

/** §8 — nombre d'Ascensions requises et numéro de la zone dédiée du boss final. */
export const FIN = CONSTANTES.fin

/** EXG-28 — constantes numériques de la zone dédiée du boss final (PV, timer). */
export const PARAMETRES_BOSS_FINAL = BOSS_FINAL
