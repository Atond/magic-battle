// Coquille de modale accessible (T-23b, EXG-21) : réutilisée par les confirmations à deux étapes
// (prestige, Ascension, nouvelle partie sur l'écran EXG-27). Aucune règle de jeu ici, seulement
// l'affichage et le clavier.
//
// `[aria-modal="true"]` — le mécanisme qui coupe déjà les raccourcis 1-6 (`BarreSorts.tsx`,
// `uneModaleEstOuverte`) s'appuie sur cet attribut : poser une modale hors de ce composant la
// contournerait silencieusement.
//
// Portée hors de l'arbre du panneau qui l'ouvre (`createPortal` vers `document.body`) et signale son
// ouverture via `modaleOuverteGlobale.ts` : `Disposition.tsx` masque alors le reste de l'appli
// (`display:none`) tant qu'une modale est ouverte, voir ce module pour le pourquoi.

import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'

import { signalerModaleOuverte } from './modaleOuverteGlobale.ts'

const SELECTEUR_FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModaleProps {
  readonly id: string
  readonly titre: string
  readonly ouverte: boolean
  /** Échap ou clic sur le fond : toujours équivalent à « Annuler », jamais à une confirmation. */
  readonly onFermer: () => void
  /** Bouton « Annuler » du contenu : focus initial (spec T-23b) et reçu du piège de focus. */
  readonly annulerRef: RefObject<HTMLButtonElement | null>
  /** Change à chaque étape affichée : redonne le focus initial même quand le contenu change sans démonter. */
  readonly cleEtape: string
  readonly children: ReactNode
}

/** EXG-21 — dialogue à deux étapes (prestige, Ascension) et écran EXG-27 (nouvelle partie). */
export function Modale({ id, titre, ouverte, onFermer, annulerRef, cleEtape, children }: ModaleProps) {
  const conteneurRef = useRef<HTMLDivElement>(null)

  // Focus initial sur « Annuler » (spec T-23b), à l'ouverture et à chaque étape.
  useEffect(() => {
    if (!ouverte) return
    annulerRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte, cleEtape])

  // Échap annule ; Tab reste piégé dans la modale (accessibilité clavier complète, spec §7).
  useEffect(() => {
    if (!ouverte) return
    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.key === 'Escape') {
        evenement.preventDefault()
        onFermer()
        return
      }
      if (evenement.key !== 'Tab') return
      const conteneur = conteneurRef.current
      if (conteneur === null) return
      const focusables = [...conteneur.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)]
      if (focusables.length === 0) return
      const premier = focusables[0]
      const dernier = focusables[focusables.length - 1]
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault()
        dernier.focus()
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouverte, onFermer])

  // Signale au registre global tant que cette modale est ouverte (`Disposition.tsx` masque le reste).
  useEffect(() => {
    if (!ouverte) return
    return signalerModaleOuverte()
  }, [ouverte])

  if (!ouverte) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFermer()
      }}
    >
      <div
        ref={conteneurRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-[var(--couleur-charbon-900)] p-4 shadow-lg"
      >
        <h2 id={id} className="text-base font-semibold text-[var(--couleur-charbon-texte)]">
          {titre}
        </h2>
        {/* `key={cleEtape}` force un sous-arbre DOM neuf à chaque étape plutôt qu'une réutilisation en
            place (React réconcilie par type+position) : sans ça, un lecteur d'écran ne re-décrirait pas
            toujours le changement de contenu, et un outil d'audit qui interroge le DOM juste après une
            transition peut lire un nœud encore associé à l'ancienne étape le temps d'un battement.
            `Fragment` plutôt qu'un `<div>` : pas de nœud DOM supplémentaire (un wrapper en
            `display: contents` perturbe le calcul de recouvrement d'axe-core, cf. `aide-audit.ts`). */}
        <Fragment key={cleEtape}>{children}</Fragment>
      </div>
    </div>,
    document.body,
  )
}
