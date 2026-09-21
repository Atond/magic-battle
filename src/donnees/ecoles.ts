// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// La vague 3 (T-24) ajoutera ici les textes des écoles (noms, descriptions) à côté de ces nombres ;
// ce fichier est le point de rendez-vous prévu par la spec entre contenu généré et contenu écrit.

import { CONSTANTES } from './constantes.ts'

/** §8 / EXG-6 à EXG-9 — paramètres numériques des six écoles, indexés par identifiant. */
export const ECOLES = CONSTANTES.ecoles
