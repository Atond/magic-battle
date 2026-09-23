// Colonne centrale (T-19/T-20/T-21) : canvas de combat (`src/canvas/CanvasCombat.tsx`, rendu procédural,
// EXG-29/30/32/33/50/52), zone de clic dédiée (EXG-11, sort de clic → `appliquerClic` du moteur) et barre
// de sorts actifs (T-20, EXG-11 à EXG-14, EXG-51). Aucune formule ici : le clic et les sorts appellent le
// store, qui appelle le moteur.

import { CanvasCombat } from '../../canvas/CanvasCombat.tsx'
import { BarreSorts } from './BarreSorts.tsx'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import { enCombatFinal, indexRegion, regionParIndex } from '../../state/contenu.ts'
import { TEXTES_FIN } from '../../donnees/fin.ts'
import { EncartZoneFinale } from './EncartZoneFinale.tsx'

export function PanneauCentral({ store }: { readonly store: StoreJeuApi }) {
  const clic = useStoreJeu(store, (s) => s.actions.clic)
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)
  // Primitive : ne re-rend qu'au passage d'une région à l'autre, jamais au tick.
  const region = regionParIndex(useStoreJeu(store, (s) => indexRegion(s.etat.combat.zone)))
  // EXG-28 — pendant le combat final, l'en-tête nomme la zone dédiée, pas la région de progression.
  const combatFinal = useStoreJeu(store, (s) => enCombatFinal(s.etat))
  const lieu = combatFinal ? TEXTES_FIN.zoneFinale : { nom: region.nom, description: region.ambiance }

  return (
    <section aria-label={TEXTES_UI.combat.titre} className="flex flex-col gap-2 p-2">
      <div className="px-1">
        <p className="text-sm font-semibold text-[var(--couleur-charbon-texte)]" data-testid="nom-region">
          {lieu.nom}
        </p>
        <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">{lieu.description}</p>
      </div>
      <EncartZoneFinale store={store} />
      <CanvasCombat store={store} />
      <button
        type="button"
        data-testid="bouton-clic"
        disabled={lectureSeule}
        onClick={() => clic()}
        aria-label={TEXTES_UI.combat.boutonClic}
        className="min-h-16 rounded-md bg-[var(--couleur-charbon-800)] px-4 py-3 text-sm font-semibold text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] enabled:active:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {TEXTES_UI.combat.boutonClic}
      </button>
      <BarreSorts store={store} />
    </section>
  )
}
