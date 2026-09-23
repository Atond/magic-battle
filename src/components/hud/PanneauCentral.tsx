// Colonne centrale (T-19) : emplacements du canvas de combat (T-21) et de la barre de sorts (T-20).
// Volontairement minimal ici — aucune formule, aucun rendu de combat : juste la place réservée dans la
// disposition, pour que T-20/T-21 n'aient qu'à remplir ces deux blocs.

import { TEXTES_UI } from '../../donnees/textes-ui.ts'

export function PanneauCentral() {
  return (
    <section aria-label={TEXTES_UI.combat.titre} className="flex flex-col gap-2 p-2">
      <div
        data-testid="emplacement-canvas"
        className="flex min-h-48 flex-1 items-center justify-center rounded-md border border-dashed border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-900)] px-4 py-6 text-center text-sm text-[var(--couleur-charbon-texte-attenue)]"
      >
        {TEXTES_UI.combat.placeholder}
      </div>
      <div
        data-testid="emplacement-barre-sorts"
        className="flex min-h-12 items-center justify-center rounded-md border border-dashed border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-900)] px-4 py-2 text-center text-sm text-[var(--couleur-charbon-texte-attenue)]"
      >
        {TEXTES_UI.sorts.placeholder}
      </div>
    </section>
  )
}
