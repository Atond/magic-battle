// Écran sauvegarde illisible (T-23b, EXG-27). Plein écran, pas une modale par-dessus le jeu : il n'y a
// rien d'autre à l'écran (l'onglet est propriétaire du verrou, mais `mode === 'illisible'` ne monte
// jamais `Disposition`, voir `App.tsx`). « Nouvelle partie » exige une confirmation à part (Modale) ;
// « Restaurer » n'est proposé que si `secoursRestaurable` (EXG-46) et agit en un clic — il ne fait que
// recharger une copie déjà connue, sans rien écraser d'autre.
//
// EXG-47 — `illisible.message` vient du domaine (`ErreurImport.message`) et peut, en théorie, refléter la
// forme d'une charge hostile (ex. chemin de champ). Il traverse ce composant comme une simple chaîne
// interpolée en JSX, jamais comme du balisage.

import { useRef, useState } from 'react'

import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import type { SauvegardeIllisible, StoreJeuApi } from '../../state/store.ts'
import { Modale } from './Modale.tsx'

export function EcranSauvegardeIllisible({
  store,
  illisible,
}: {
  readonly store: StoreJeuApi
  readonly illisible: SauvegardeIllisible
}) {
  const [confirmationOuverte, setConfirmationOuverte] = useState(false)
  const annulerRef = useRef<HTMLButtonElement>(null)
  const nouvellePartie = useStoreJeu(store, (s) => s.actions.nouvellePartie)
  const restaurerSecours = useStoreJeu(store, (s) => s.actions.restaurerSecours)

  return (
    <main
      role="alert"
      aria-labelledby="titre-ecran-illisible"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--couleur-charbon-950)] p-6 text-center text-[var(--couleur-charbon-texte)]"
    >
      <h1 id="titre-ecran-illisible" className="text-lg font-semibold">
        {TEXTES_UI.illisible.titre}
      </h1>
      <p className="max-w-md text-sm text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.illisible.message}</p>
      <details className="max-w-md text-xs text-[var(--couleur-charbon-texte-attenue)]">
        <summary className="cursor-pointer">{TEXTES_UI.illisible.detailLabel}</summary>
        <p className="mt-1 break-words">{illisible.message}</p>
      </details>
      <div className="flex flex-wrap justify-center gap-2">
        {illisible.secoursRestaurable && (
          <button
            type="button"
            onClick={() => restaurerSecours()}
            className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--couleur-charbon-700)]"
          >
            {TEXTES_UI.illisible.restaurer}
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmationOuverte(true)}
          className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--couleur-charbon-700)]"
        >
          {TEXTES_UI.illisible.nouvellePartie}
        </button>
      </div>
      <Modale
        id="titre-confirmation-nouvelle-partie"
        titre={TEXTES_UI.illisible.confirmationTitre}
        ouverte={confirmationOuverte}
        onFermer={() => setConfirmationOuverte(false)}
        annulerRef={annulerRef}
        cleEtape="illisible-nouvelle-partie"
      >
        <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.illisible.confirmationCorps}</p>
        <div className="flex justify-end gap-2">
          <button
            ref={annulerRef}
            type="button"
            onClick={() => setConfirmationOuverte(false)}
            className="min-h-6 min-w-20 rounded px-3 py-1.5 text-sm font-medium hover:bg-[var(--couleur-charbon-800)]"
          >
            {TEXTES_UI.commun.annuler}
          </button>
          <button
            type="button"
            onClick={() => {
              nouvellePartie()
              setConfirmationOuverte(false)
            }}
            className="min-h-6 min-w-20 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--couleur-charbon-700)]"
          >
            {TEXTES_UI.illisible.confirmer}
          </button>
        </div>
      </Modale>
    </main>
  )
}
