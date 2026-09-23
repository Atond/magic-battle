// Constantes **d'ingénierie** de la couche pont (préfixage, cadence du verrou) — à ne pas confondre avec
// les valeurs d'équilibrage de `src/donnees/constantes.ts` (sortie du simulateur, jamais ici).

/** ADR-21 — GitHub Pages partage l'origine entre dépôts : toute clé de stockage/canal est préfixée. */
export const PREFIXE_STOCKAGE = 'magic-battle:'

/** Emplacement des réglages de performance (EXG-29/EXG-50) — lu en `try/catch`, hors sauvegarde. */
export const NOM_REGLAGES = 'reglages'

/**
 * EXG-48 — cadence de battement du verrou multi-onglet (« ping ~500 ms au démarrage »). Amorçage T-18 :
 * la valeur numérique définitive et son couplage au délai d'expiration (> 60 s, ≥ 3× cette cadence)
 * appartiennent à T-23a, qui implémente le transport réel du verrou. T-18 ne pose ici que la référence
 * que son propre `demarrer()` utilise pour rester cohérent avec elle-même.
 */
export const INTERVALLE_BATTEMENT_VERROU_MS = 500

/** EXG-48 — délai d'expiration du verrou, dérivé de la cadence de battement ci-dessus (même remarque). */
export const DELAI_EXPIRATION_VERROU_MS = 65_000
