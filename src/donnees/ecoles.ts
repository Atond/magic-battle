// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Les textes des écoles (T-24) vivent en bas de ce fichier, à côté de ces nombres : ce fichier est le
// point de rendez-vous prévu par la spec entre contenu généré et contenu écrit.

import type { IdEcole } from '../domain/types.ts'
import { CONSTANTES } from './constantes.ts'
import type { TexteContenu } from './types-textes.ts'

/** §8 / EXG-6 à EXG-9 — paramètres numériques des six écoles, indexés par identifiant. */
export const ECOLES = CONSTANTES.ecoles

/** T-24 — nom affiché et tic de chaque école. Les identifiants du moteur ne changent pas. */
export const TEXTES_ECOLES: Readonly<Record<IdEcole, TexteContenu>> = {
  feu: {
    nom: 'École du Feu',
    description: 'Ne fait pas dans la demi-mesure. Ni dans le rangement : tout finit en cendres.',
  },
  glace: {
    nom: 'École de la Glace',
    description: 'Précise et glaciale. Ne dit jamais bonjour, ça risquerait de briser la glace.',
  },
  ecole3: {
    nom: 'École de la Foudre',
    description: 'Rapide, brillante, incapable d’attendre. Frappe deux fois au même endroit, par principe.',
  },
  ecole4: {
    nom: 'École de la Terre',
    description: 'Terre à terre et fière de l’être. Lente à démarrer, impossible à arrêter.',
  },
  ecole5: {
    nom: 'École de l’Ombre',
    description: 'Frappe dans le dos, s’excuse, recommence. Pas très fair-play, mais très polie.',
  },
  lumiere: {
    nom: 'École de la Lumière',
    description: 'Arrive après tout le monde et se trouve brillante. Le pire, c’est qu’elle a raison.',
  },
}
