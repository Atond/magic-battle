// Constantes **structurelles** du moteur : celles que la spec fixe elle-même (EXG cité en regard),
// pas celles que le simulateur d'équilibrage doit chercher. Toute valeur d'équilibrage (seuils, coûts,
// croissances, `H`, `N`, `B`, `β`, `k`, `α`, `or_par_dégât_moyen`…) arrive par le paramètre `Constantes`
// (voir `types.ts`), jamais d'ici.

/** EXG-1 — « pas fixes de 100 ms » : le pas de simulation est une décision de spec, pas d'équilibrage. */
export const PAS_TICK_MS = 100

/** EXG-22 — « sauvegarder automatiquement l'état de jeu toutes les 30 s ». */
export const INTERVALLE_AUTOSAVE_MS = 30_000

/**
 * EXG-25 — version du schéma de sauvegarde inscrite dans chaque état. La chaîne de migrations et
 * l'incrémentation de ce numéro appartiennent à T-10 (`src/domain/sauvegarde/`).
 */
export const VERSION_SCHEMA = 1

/** EXG-19 — un run démarre (et redémarre au prestige) à la zone 1, vague 1. */
export const ZONE_DEPART = 1
export const VAGUE_DEPART = 1

/** Conversions d'unités (pas des valeurs de jeu). */
export const MS_PAR_SECONDE = 1_000
export const MS_PAR_HEURE = 3_600_000

/**
 * Facteur neutre des briques de la chaîne de DPS (§8) pas encore implémentées : un facteur absent vaut 1,
 * ce qui est une propriété du produit, pas une valeur d'équilibrage.
 */
export const FACTEUR_NEUTRE = 1

/** EXG-36 / §8 — « entiers sous 10⁶ » : borne de l'affichage brut avant la notation abrégée. */
export const SEUIL_NOTATION_ENTIERE = 1e6

/** EXG-36 / §8 — « abrégée K/M/B/T/Qa/Qi… jusqu'à 10³³, notation scientifique au-delà ». */
export const SEUIL_NOTATION_SCIENTIFIQUE = 1e33

/** EXG-37 — au-delà de 1e300 en régime normal, le simulateur signale la migration vers `break_infinity.js`. */
export const SEUIL_GRANDS_NOMBRES = 1e300
