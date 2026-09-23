// Contrat typé de l'ordre de démarrage (T-18, spec §16 T-18, `SequenceDemarrage`).
//
// L'ordre est fixé par la spec et **jamais réordonné** : verrou → `importerTexte(principal)` sans
// exécuter son plan → `calculHorsLigne` (propriétaire du verrou seulement) → sauvegarde immédiate →
// démarrage de la boucle → démarrage de l'auto-sauvegarde et du battement.
//
// `creerStoreJeu` (`store.ts`) exécute cette séquence avec la persistance **factice en mémoire** des
// tests de `tests/state/` ; T-23a branchera les mêmes étapes sur `localStorage`/`BroadcastChannel` réels
// sans changer cet ordre. Le tableau ci-dessous est la version « donnée » du contrat : un test peut
// comparer la trace observée (via `onEtapeDemarrage`) à `ETAPES_DEMARRAGE` sans dupliquer la liste.

export const ETAPES_DEMARRAGE = [
  'verrou',
  'importerSauvegarde',
  'calculHorsLigne',
  'sauvegardeImmediate',
  'boucle',
  'autoSauvegardeEtBattement',
] as const

/** Une étape de la séquence de démarrage, dans l'ordre où `creerStoreJeu` les traverse. */
export type EtapeDemarrage = (typeof ETAPES_DEMARRAGE)[number]
