// Interrupteur accessible du réglage performance (T-21, EXG-29/EXG-50). Persiste le choix explicite via
// le port `stockage` du store (clé `magic-battle:reglages`, hors sauvegarde) — aucun calcul ici, juste
// lecture/écriture d'un booléen.

import { useState } from 'react'

import { TEXTES_UI } from '../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../state/store.ts'
import { ecrireOptionPerformance, resoudrePerformance } from './reglages.ts'

export function InterrupteurPerformance({
  store,
  onChange,
}: {
  readonly store: StoreJeuApi
  readonly onChange: (performanceActivee: boolean) => void
}) {
  const [actif, setActif] = useState(() => resoudrePerformance(store.stockage, store.matchMedia))

  function basculer(): void {
    const nouveau = !actif
    setActif(nouveau)
    ecrireOptionPerformance(store.stockage, nouveau)
    onChange(nouveau)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={TEXTES_UI.combat.interrupteurPerformance}
      data-testid="interrupteur-performance"
      onClick={basculer}
      className="min-h-6 min-w-6 rounded-full border border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-800)] px-2 py-1 text-[10px] font-medium text-[var(--couleur-charbon-texte)] hover:bg-[var(--couleur-charbon-700)] aria-checked:bg-[var(--couleur-ecole-feu)] aria-checked:text-[var(--couleur-charbon-950)]"
    >
      {actif ? TEXTES_UI.combat.performanceActivee : TEXTES_UI.combat.performanceDesactivee}
    </button>
  )
}
