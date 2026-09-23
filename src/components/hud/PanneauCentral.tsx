// Colonne centrale (T-19/T-20/T-21) : canvas de combat (`src/canvas/CanvasCombat.tsx`, rendu procédural,
// EXG-29/30/32/33/50/52), zone de clic dédiée (EXG-11, sort de clic → `appliquerClic` du moteur) et barre
// de sorts actifs (T-20, EXG-11 à EXG-14, EXG-51). Aucune formule ici : le clic et les sorts appellent le
// store, qui appelle le moteur.

import { CanvasCombat } from '../../canvas/CanvasCombat.tsx'
import { BarreSorts } from './BarreSorts.tsx'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'

export function PanneauCentral({ store }: { readonly store: StoreJeuApi }) {
  const clic = useStoreJeu(store, (s) => s.actions.clic)

  return (
    <section aria-label={TEXTES_UI.combat.titre} className="flex flex-col gap-2 p-2">
      <CanvasCombat store={store} />
      <button
        type="button"
        data-testid="bouton-clic"
        onClick={() => clic()}
        aria-label={TEXTES_UI.combat.boutonClic}
        className="min-h-16 rounded-md bg-[var(--couleur-charbon-800)] px-4 py-3 text-sm font-semibold text-[var(--couleur-charbon-texte)] hover:bg-[var(--couleur-charbon-700)] active:bg-[var(--couleur-charbon-700)]"
      >
        {TEXTES_UI.combat.boutonClic}
      </button>
      <BarreSorts store={store} />
    </section>
  )
}
