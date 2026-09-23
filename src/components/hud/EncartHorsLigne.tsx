// Encart hors-ligne (T-23b, EXG-4/EXG-53). `role="status"`, pas de `Dialog` modal : un élément de flux
// normal (jamais `fixed`/`absolute`), pour qu'il ne puisse **jamais** chevaucher une cible de jeu (spec
// T-23b « chevauchement des rectangles », EXG-53 « n'intercepte aucune interaction de jeu »). Fermable en
// un clic, sans fermeture automatique — le joueur choisit quand il a fini de lire.
//
// EXG-55 — le store recalcule `resumeHorsLigne` à **chaque** démarrage, même pour quelques millisecondes
// d'écart (rouvrir l'onglet dans la même seconde). Le seuil d'affichage n'est pas une règle de jeu : c'est
// la même comparaison que `store.ts` (`nTicksMax × PAS_TICK_MS`), répétée ici côté affichage pour décider
// *si* l'encart apparaît — jamais pour recalculer `orGagne`/`tempsEcouleMs`, qui viennent tels quels du
// moteur (`calculHorsLigne`).

import { useEffect, useState } from 'react'

import { formater } from '../../domain/notation.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { seuilRattrapageMs } from '../../state/constantes.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import type { StoreJeuApi } from '../../state/store.ts'

/** Présentation seulement (pas une formule de jeu) : minutes sous l'heure, heures + minutes au-delà. */
function formaterDuree(ms: number): string {
  const minutesTotales = Math.round(ms / 60_000)
  if (minutesTotales < 60) return `${Math.max(minutesTotales, 1)} min`
  const heures = Math.floor(minutesTotales / 60)
  const minutes = minutesTotales % 60
  return minutes === 0 ? `${heures} h` : `${heures} h ${minutes} min`
}

export function EncartHorsLigne({ store }: { readonly store: StoreJeuApi }) {
  const resume = useStoreJeu(store, (s) => s.resumeHorsLigne)
  const [ferme, setFerme] = useState(false)

  // Un nouveau résumé (nouvelle référence, posée par le store à chaque `calculHorsLigne`) rouvre l'encart.
  useEffect(() => {
    setFerme(false)
  }, [resume])

  if (resume === null || ferme) return null
  if (resume.tempsEcouleMs <= seuilRattrapageMs(CONSTANTES)) return null

  const or = formater(resume.orGagne)
  const duree = formaterDuree(resume.tempsEcouleMs)

  return (
    <div
      role="status"
      data-testid="encart-hors-ligne"
      className="flex items-center justify-between gap-3 border-b border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-800)] px-3 py-2 text-sm text-[var(--couleur-charbon-texte)]"
    >
      <p>{resume.plafondAtteint ? TEXTES_UI.horsLigne.plafond(or, duree) : TEXTES_UI.horsLigne.resume(or, duree)}</p>
      <button
        type="button"
        onClick={() => setFerme(true)}
        aria-label={TEXTES_UI.commun.fermer}
        className="min-h-6 min-w-6 rounded px-2 py-1 text-xs font-medium text-[var(--couleur-charbon-texte-attenue)] hover:bg-[var(--couleur-charbon-700)]"
      >
        {TEXTES_UI.commun.fermer}
      </button>
    </div>
  )
}
