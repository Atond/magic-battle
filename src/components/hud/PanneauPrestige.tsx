// Colonne droite — emplacement du bouton prestige (T-19). La confirmation à deux étapes (EXG-21) et le
// déclenchement réel (`prestiger`, `src/domain/prestige/index.ts`) sont T-23b : ce panneau ne pose que la
// place et le texte, un bouton désactivé qui n'appelle jamais le moteur.

import { TEXTES_UI } from '../../donnees/textes-ui.ts'

export function PanneauPrestige() {
  return (
    <section aria-label={TEXTES_UI.prestige.titre} className="flex flex-col gap-2 p-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
        {TEXTES_UI.prestige.titre}
      </h2>
      <div className="flex flex-col gap-1 rounded-md bg-[var(--couleur-charbon-900)] px-3 py-2">
        <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.prestige.description}</p>
        <button
          type="button"
          disabled
          className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {TEXTES_UI.prestige.bouton}
        </button>
      </div>
    </section>
  )
}
