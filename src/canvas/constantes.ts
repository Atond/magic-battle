// Constante de rendu (T-21, EXG-52, §8) — propriété du canvas, pas une valeur d'équilibrage : elle ne
// change ni les dégâts ni le DPS, seulement combien de projectiles/impacts restent visibles à l'écran.
// Ne vient donc pas du simulateur `tools/idle-balance` et n'a rien à faire dans `src/donnees/`.

/** Nombre maximal de projectiles/impacts actifs simultanément à l'écran. Au-delà, les plus anciens sont
 *  supprimés en premier (dégradation silencieuse) — voir `tampon.ts`. */
export const N_PROJECTILES_MAX = 200

/** Durée de vie d'un projectile/impact à l'écran, en ms. Sans elle, un tampon rarement renouvelé (peu de
 *  clics/sorts, option performance réactivée puis désactivée…) garde éternellement les mêmes cercles
 *  figés à l'écran au lieu de s'effacer — voir `tampon.ts:purgerExpires`. */
export const DUREE_VIE_PROJECTILE_MS = 600
