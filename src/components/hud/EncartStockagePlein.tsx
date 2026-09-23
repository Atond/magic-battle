// Stockage plein (reste de la vague 2) : une écriture de la sauvegarde principale a échoué (quota
// dépassé, `QuotaExceededError`, stockage refusé) — la progression n'est plus sauvegardée. Message
// non bloquant, dans le flux (jamais par-dessus une cible de jeu), sans bouton de fermeture : il
// disparaît tout seul à la première écriture réussie (`stockagePlein` repasse à `false`, `store.ts`).
// `role="alert"` plutôt que `status` : c'est une perte de données en cours, pas une information.

import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import type { StoreJeuApi } from '../../state/store.ts'

export function EncartStockagePlein({ store }: { readonly store: StoreJeuApi }) {
  const plein = useStoreJeu(store, (s) => s.stockagePlein)
  if (!plein) return null
  return (
    <div
      role="alert"
      data-testid="encart-stockage-plein"
      className="border-b border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-800)] px-3 py-2 text-sm font-medium text-[var(--couleur-charbon-texte)]"
    >
      {TEXTES_UI.stockagePlein.message}
    </div>
  )
}
