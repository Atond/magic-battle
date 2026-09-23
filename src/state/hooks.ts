// Hook React léger sur un store créé par `creerStoreJeu` (T-18, ADR-19).
//
// `useStore` de `zustand/react` s'appuie sur `useSyncExternalStore` : un composant qui sélectionne une
// primitive (`useStoreJeu(store, s => s.etat.bourse.or)`) ne re-rend que lorsque **cette valeur précise**
// change (comparaison `Object.is` par défaut), jamais à chaque `setState` du store. C'est ce qui tient
// « aucun re-render global du HUD au tick 100 ms » — voir `tests/ui/panneaux-rendus.test.tsx`.

import { useStore } from 'zustand/react'
import type { EtatStoreJeu, StoreJeuApi } from './store.ts'

/** Sélecteur fin : toujours retourner une primitive (ou une référence stable), jamais l'état entier. */
export function useStoreJeu<T>(store: StoreJeuApi, selecteur: (etat: EtatStoreJeu) => T): T {
  return useStore(store, selecteur)
}
