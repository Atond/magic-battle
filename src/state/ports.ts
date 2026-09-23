// Ports injectables du pont React↔moteur (T-18, ADR-19). `creerStoreJeu` ne dépend d'aucune API globale
// câblée en dur : chaque accès au monde extérieur passe par un de ces ports, pour que T-23a puisse
// brancher `localStorage`/`BroadcastChannel`/`matchMedia` réels et que T-18 puisse le prouver avec des
// doubles en mémoire (aucun test de `tests/state/` ne touche au navigateur).
//
// Deux ports « `portX` » distincts dans `PortPage` et `PortPlanificateur`, plutôt qu'un branchement
// global sur `window`, parce que deux onglets d'un même document de test doivent recevoir des
// événements **indépendants** (spec T-18, N5) : un seul abonnement global à `window.setInterval`
// partagé par deux fabriques ne permettrait pas de distinguer laquelle reçoit quoi.

/** Horloge injectée : `src/state/` ne lit jamais `Date.now()` lui-même, pour rester testable. */
export interface Horloge {
  maintenantMs(): number
}

/**
 * Stockage clé/valeur (forme de `localStorage`, sans l'être) : c'est ce que T-23a branchera sur le
 * vrai `localStorage` (préfixé `magic-battle:`, ADR-21). Les tests de T-18 utilisent un double en
 * mémoire (`Map<string, string>`), jamais `localStorage` réel (ADR-20).
 */
export interface Stockage {
  lire(cle: string): string | null
  ecrire(cle: string, valeur: string): void
  supprimer(cle: string): void
}

/**
 * Canal de diffusion entre onglets (forme de `BroadcastChannel`) : transport du verrou multi-onglet
 * (EXG-48). T-18 ne l'utilise pas pour de vrai (pas de verrou multi-onglet fonctionnel ici) mais le
 * type est déjà celui que T-23a branchera.
 */
export interface Canal {
  publier(message: unknown): void
  /** Retourne une fonction de désabonnement. */
  recevoir(gestionnaire: (message: unknown) => void): () => void
  fermer(): void
}

/** `matchMedia` (EXG-29/EXG-50, `prefers-reduced-motion`) : lu en `try/catch` côté appelant réel (T-23a). */
export interface PortMatchMedia {
  correspond(requete: string): boolean
}

/**
 * Cycle de vie de l'onglet : visibilité, `pagehide`, `pageshow`, `beforeunload`. Chaque `surX` retourne
 * une fonction de désabonnement. Un port par fabrique (et non un écouteur `window` partagé) est ce qui
 * permet à deux onglets simulés dans le même test de recevoir des événements indépendants (spec T-18, N5).
 */
export interface PortPage {
  estVisible(): boolean
  surVisibiliteChangee(gestionnaire: () => void): () => void
  surPageHide(gestionnaire: () => void): () => void
  surPageShow(gestionnaire: () => void): () => void
  surAvantDechargement(gestionnaire: () => void): () => void
}

/**
 * Source de temps de la boucle de jeu et des minuteries (intervalles, `requestAnimationFrame`).
 * Volontairement à base d'identifiants (comme les API natives qu'il imite) : un double de test peut
 * garder les callbacks en main et les déclencher à la demande, sans horloge réelle ni `setTimeout`.
 */
export interface PortPlanificateur {
  /** Une frame d'affichage (type `requestAnimationFrame`) : rappelée une fois, à re-planifier soi-même. */
  planifierFrame(callback: (horodatageMs: number) => void): number
  annulerFrame(id: number): void
  /** Intervalle répété toutes les `delaiMs` (type `setInterval`). */
  planifierIntervalle(callback: () => void, delaiMs: number): number
  annulerIntervalle(id: number): void
}
