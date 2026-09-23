// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Les textes de l’équipement (T-27, noms et descriptions) vivent en bas de ce fichier, à côté de ces
// nombres.

import { CONSTANTES } from './constantes.ts'
import type { TexteContenu } from './types-textes.ts'

/** §4.6 / EXG-43 — achats multiplicatifs payés en renommée. */
export const EQUIPEMENT = CONSTANTES.equipement

/** T-27 — textes de l’équipement payé en Renommée (multiplicateurs de dégâts). */
export const TEXTES_EQUIPEMENT: Readonly<Record<'equipement-1' | 'equipement-2', TexteContenu>> = {
  'equipement-1': {
    nom: 'Amulette de la célébrité',
    description: 'Brille quand on te reconnaît. Tes coups aussi, bizarrement.',
  },
  'equipement-2': {
    nom: 'Chevalière à ton nom',
    description: 'Les monstres savent enfin qui les tape. Ça ne les console pas, mais toi si.',
  },
}
