// Ports navigateur réels pour `creerStoreJeu` (T-19). Horloge, planificateur et cycle de vie de page sont
// branchés sur les API du navigateur ; le stockage et le canal restent **en mémoire** ici — la
// persistance réelle (`localStorage`/`BroadcastChannel` préfixés `magic-battle:`, ADR-21) et le verrou
// multi-onglet fonctionnel sont T-23a. Ce fichier ne redéfinit aucune règle du domaine : il ne fait que
// brancher les ports typés de `src/state/ports.ts` sur le monde réel (ou sur un espace mémoire de
// substitution, en attendant T-23a).

import type { Canal, Horloge, PortMatchMedia, PortPage, PortPlanificateur, Stockage } from './ports.ts'

/** `Date.now()` : la seule source de temps admise hors des tests (§16 T-18, doubles réservés à `tests/`). */
export function creerHorlogeNavigateur(): Horloge {
  return { maintenantMs: () => Date.now() }
}

/**
 * Amorçage T-19 : stockage clé/valeur **en mémoire**, perdu au rechargement. T-23a le remplacera par
 * `localStorage` réel (préfixé `magic-battle:`, ADR-21) sans changer le contrat `Stockage`.
 */
export function creerStockageMemoire(): Stockage {
  const table = new Map<string, string>()
  return {
    lire: (cle) => table.get(cle) ?? null,
    ecrire: (cle, valeur) => {
      table.set(cle, valeur)
    },
    supprimer: (cle) => {
      table.delete(cle)
    },
  }
}

/**
 * Amorçage T-19 : canal sans transport (un seul onglet en mémoire n'a personne à qui parler). T-23a le
 * remplacera par un vrai `BroadcastChannel` (préfixé `magic-battle:`, ADR-21) sans changer le contrat
 * `Canal`.
 */
export function creerCanalMemoire(): Canal {
  return {
    publier: () => {},
    recevoir: () => () => {},
    fermer: () => {},
  }
}

/** EXG-29/EXG-50 — lecture réelle de `prefers-reduced-motion`, toujours en `try/catch` côté appelant. */
export function creerMatchMediaNavigateur(): PortMatchMedia {
  return {
    correspond: (requete) => window.matchMedia(requete).matches,
  }
}

/** Cycle de vie de page réel : visibilité, `pagehide`, `pageshow`, `beforeunload`. */
export function creerPortPageNavigateur(): PortPage {
  return {
    estVisible: () => document.visibilityState === 'visible',
    surVisibiliteChangee: (gestionnaire) => {
      document.addEventListener('visibilitychange', gestionnaire)
      return () => document.removeEventListener('visibilitychange', gestionnaire)
    },
    surPageHide: (gestionnaire) => {
      window.addEventListener('pagehide', gestionnaire)
      return () => window.removeEventListener('pagehide', gestionnaire)
    },
    surPageShow: (gestionnaire) => {
      window.addEventListener('pageshow', gestionnaire)
      return () => window.removeEventListener('pageshow', gestionnaire)
    },
    surAvantDechargement: (gestionnaire) => {
      window.addEventListener('beforeunload', gestionnaire)
      return () => window.removeEventListener('beforeunload', gestionnaire)
    },
  }
}

/** `requestAnimationFrame`/`setInterval` réels. */
export function creerPortPlanificateurNavigateur(): PortPlanificateur {
  return {
    planifierFrame: (callback) => window.requestAnimationFrame(callback),
    annulerFrame: (id) => window.cancelAnimationFrame(id),
    planifierIntervalle: (callback, delaiMs) => window.setInterval(callback, delaiMs),
    annulerIntervalle: (id) => window.clearInterval(id),
  }
}

/** Identifiant d'onglet stable pour la durée du chargement (EXG-48) : aléatoire, jamais persisté. */
export function creerIdOnglet(): string {
  return `onglet-${Math.random().toString(36).slice(2)}-${Date.now()}`
}
