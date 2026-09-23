// Constantes **d'ingénierie** de la couche pont (préfixage, cadence du verrou) — à ne pas confondre avec
// les valeurs d'équilibrage de `src/donnees/constantes.ts` (sortie du simulateur, jamais ici).

/** ADR-21 — GitHub Pages partage l'origine entre dépôts : toute clé de stockage/canal est préfixée. */
export const PREFIXE_STOCKAGE = 'magic-battle:'

/** Emplacement des réglages de performance (EXG-29/EXG-50) — lu en `try/catch`, hors sauvegarde. */
export const NOM_REGLAGES = 'reglages'

/** EXG-48 — emplacement logique du verrou multi-onglet (préfixé comme les autres, ADR-21). */
export const NOM_VERROU = 'verrou'

/** EXG-48 / ADR-21 — nom du `BroadcastChannel` du verrou : même espace de noms que le stockage. */
export const NOM_CANAL_VERROU = `${PREFIXE_STOCKAGE}verrou`

/**
 * EXG-48 — « ping ~500 ms au démarrage, écrire-puis-relire » (spec T-23a). Un onglet qui obtient le
 * verrou l'écrit, l'annonce sur le canal, attend ce délai, puis **relit** le stockage avant de se croire
 * propriétaire. Relire tout de suite ne prouverait rien : le `localStorage` d'un onglet voit toujours sa
 * propre écriture ; c'est l'attente qui laisse à l'écriture concurrente d'un autre onglet (autre
 * processus) le temps d'arriver. Le dernier écrivain gagne, et les deux onglets le constatent en relisant.
 */
export const DELAI_CONFIRMATION_VERROU_MS = 500

/**
 * EXG-48 — cadence de battement du propriétaire (et de surveillance d'un onglet secondaire, qui relit le
 * verrou au même rythme pour relayer à l'expiration).
 */
export const INTERVALLE_BATTEMENT_VERROU_MS = 5_000

/**
 * Ralentissement d'arrière-plan connu : Chromium regroupe les minuteries d'un onglet caché depuis plus de
 * 5 min à un réveil par minute (« intensive throttling »). Un propriétaire caché peut donc battre avec
 * jusqu'à 60 s d'écart sans être mort.
 */
export const RALENTISSEMENT_ARRIERE_PLAN_MS = 60_000

/**
 * EXG-48 / N4 — délai d'expiration du verrou, **valeur numérique fixe** : 90 s. Contraintes tenues (et
 * vérifiées par `tests/state/persistance.test.ts`) : > 60 s, ≥ 3 × la cadence de battement (15 s), et
 * strictement au-dessus du ralentissement d'arrière-plan (60 s, marge 30 s) — un propriétaire caché mais
 * vivant ne perd jamais la main à cause du bridage de ses minuteries.
 */
export const DELAI_EXPIRATION_VERROU_MS = 90_000
