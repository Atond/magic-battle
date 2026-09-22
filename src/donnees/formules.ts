// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Ce fichier regroupe les paramètres numériques qui alimentent des formules transverses plutôt qu'un
// catalogue d'objets nommés (écoles, sorts, quêtes, …) : rattrapage de tick, plafond hors-ligne, or, et
// les deux arbres de progression (prestige/Éclats, Ascension). Pas de texte à y attendre en vague 3 :
// ce sont des formules, pas du contenu nommé.

import { CONSTANTES } from './constantes.ts'

/** EXG-3 — seuil de ticks rattrapés avant bascule en forme fermée. */
export const TICK = CONSTANTES.tick

/** EXG-4 / EXG-49 — plafond de production hors-ligne. */
export const HORS_LIGNE = CONSTANTES.horsLigne

/** §8 — or par dégât moyen, croissance par zone, dégâts de clic de base. */
export const OR = CONSTANTES.or

/** EXG-18 / EXG-38 / EXG-39 — gain d'Éclats au prestige, bonus passif, échelle de coût de l'arbre. */
export const PRESTIGE = CONSTANTES.prestige

/** EXG-40 — points d'Ascension, cadence des prestiges par Ascension, échelle de coût de l'arbre. */
export const ASCENSION = CONSTANTES.ascension
