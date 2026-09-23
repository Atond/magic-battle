// Ports navigateur réels pour `creerStoreJeu` (T-19, T-23a). Horloge, planificateur, cycle de vie de page,
// `localStorage` et `BroadcastChannel` (préfixés `magic-battle:`, ADR-21). Ce fichier ne redéfinit aucune
// règle du domaine : il ne fait que brancher les ports typés de `src/state/ports.ts` sur le monde réel.
// Les variantes « mémoire » restent pour les usages sans persistance (aucune en production).

import { PREFIXE_STOCKAGE } from './constantes.ts'
import type { Canal, Horloge, PortMatchMedia, PortPage, PortPlanificateur, Stockage } from './ports.ts'

/** `Date.now()` : la seule source de temps admise hors des tests (§16 T-18, doubles réservés à `tests/`). */
export function creerHorlogeNavigateur(): Horloge {
  return { maintenantMs: () => Date.now() }
}

/** Stockage clé/valeur **en mémoire**, perdu au rechargement (aucune persistance). */
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

/** Canal sans transport (un seul onglet en mémoire n'a personne à qui parler). */
export function creerCanalMemoire(): Canal {
  return {
    publier: () => {},
    recevoir: () => () => {},
    fermer: () => {},
  }
}

/**
 * ADR-21 — une clé non préfixée est une faute de programmation, pas une donnée : elle écrirait dans
 * l'espace d'un autre dépôt servi par la même origine GitHub Pages. Refusée bruyamment, à l'écriture
 * comme à la lecture.
 */
function exigerPrefixe(cle: string): void {
  if (!cle.startsWith(PREFIXE_STOCKAGE)) {
    throw new Error(`Clé de stockage hors de l'espace « ${PREFIXE_STOCKAGE} » : ${cle}`)
  }
}

/**
 * EXG-22 / ADR-21 — `localStorage` réel. Chaque accès est en `try/catch` : navigation privée, quota
 * plein ou stockage désactivé ne doivent jamais faire tomber la boucle. Une lecture impossible vaut
 * « absent » ; une écriture impossible est perdue (la prochaine sauvegarde réessaiera).
 */
export function creerStockageLocal(): Stockage {
  return {
    lire: (cle) => {
      exigerPrefixe(cle)
      try {
        return window.localStorage.getItem(cle)
      } catch {
        return null
      }
    },
    ecrire: (cle, valeur) => {
      exigerPrefixe(cle)
      try {
        window.localStorage.setItem(cle, valeur)
      } catch {
        // Quota ou stockage indisponible : rien à faire de plus sans UI (hors périmètre T-23a).
      }
    },
    supprimer: (cle) => {
      exigerPrefixe(cle)
      try {
        window.localStorage.removeItem(cle)
      } catch {
        // idem
      }
    },
  }
}

/**
 * EXG-48 — transport réel du verrou : un `BroadcastChannel` nommé dans l'espace `magic-battle:`. Sans
 * `BroadcastChannel` (navigateur ancien), le canal est muet : le verrou reste correct, seul le relais
 * immédiat devient un relais au prochain battement (le stockage est la seule source de vérité).
 */
export function creerCanalDiffusion(nom: string): Canal {
  if (!nom.startsWith(PREFIXE_STOCKAGE)) {
    throw new Error(`Canal hors de l'espace « ${PREFIXE_STOCKAGE} » : ${nom}`)
  }
  if (typeof BroadcastChannel === 'undefined') return creerCanalMemoire()
  const canal = new BroadcastChannel(nom)
  return {
    publier: (message) => canal.postMessage(message),
    recevoir: (gestionnaire) => {
      const ecouteur = (evenement: MessageEvent): void => gestionnaire(evenement.data)
      canal.addEventListener('message', ecouteur)
      return () => canal.removeEventListener('message', ecouteur)
    },
    fermer: () => canal.close(),
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
