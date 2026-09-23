// Registre global « une modale est ouverte » (T-22), séparé de `Modale.tsx` pour rester un module trivial
// à auditer : un compteur (plusieurs modales pourraient théoriquement se chevaucher dans le futur) plus un
// abonnement `useSyncExternalStore`, sans dépendre de Zustand ni de React Context.
//
// Sert à masquer (`display:none`, pas seulement `aria-hidden`) le reste de l'appli tant qu'une modale est
// ouverte (`Disposition.tsx`) : `[aria-modal="true"]` piège déjà le clavier (`Modale.tsx`) et coupe les
// raccourcis sorts (`BarreSorts.tsx`), mais du contenu de fond qui reste en flux normal, juste couvert
// visuellement par le voile de la modale, se retrouve aux mêmes coordonnées écran qu'elle sur certains
// états — de quoi tromper un outil d'audit géométrique (axe-core, `color-contrast`/`elmPartiallyObscuring`)
// qui ne résout pas toujours correctement l'empilement `position: fixed` + `z-index` contre du contenu
// de fond positionné normalement. Le rendre réellement absent du flux (`display:none`) lève l'ambiguïté,
// et est de toute façon la bonne pratique : un lecteur d'écran en mode « parcourir » ne doit pas pouvoir
// atteindre du contenu de fond derrière une modale, seulement le piège de focus (Tab) ne suffit pas à ça.
import { useSyncExternalStore } from 'react'

let compteur = 0
const abonnes = new Set<() => void>()

function notifier(): void {
  for (const fn of abonnes) fn()
}

/** À appeler à l'ouverture d'une modale ; retourne le nettoyage à appeler à la fermeture/démontage. */
export function signalerModaleOuverte(): () => void {
  compteur++
  notifier()
  return () => {
    compteur--
    notifier()
  }
}

function sAbonner(fn: () => void): () => void {
  abonnes.add(fn)
  return () => abonnes.delete(fn)
}

function lireInstantane(): boolean {
  return compteur > 0
}

/** `true` tant qu'au moins une `Modale` est ouverte n'importe où dans l'appli. */
export function useUneModaleEstOuverte(): boolean {
  return useSyncExternalStore(sAbonner, lireInstantane)
}
