// Quêtes (T-26, EXG-54 / EXG-10) : nom et description (contenu, `TEXTES_QUETES`), objectif chiffré lu
// dans `CONSTANTES.quetes` (jamais écrit dans le texte : si le simulateur change un seuil, l'écran suit),
// Renommée gagnée, et état accompli / pas encore. L'accomplissement est décidé par le moteur
// (`evaluerQuetes`, au tick) ; ce panneau ne fait que lire `queteAccomplie`.
//
// Le libellé de travail `libelle` de `CONSTANTES.quetes` n'est jamais affiché : `TEXTES_QUETES` le
// supplante (décision de la vague 3, `constantes.ts` n'est jamais retouché).

import { formater } from '../../domain/notation.ts'
import { queteAccomplie } from '../../domain/quetes/index.ts'
import type { ParametresQuete } from '../../domain/types.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_QUETES } from '../../donnees/quetes.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import type { StoreJeuApi } from '../../state/store.ts'

function objectif(quete: ParametresQuete): string {
  switch (quete.typeJalon) {
    case 'zoneAtteinte':
      return TEXTES_UI.quetes.objectifZone(formater(quete.seuil))
    case 'monstresTues':
      return TEXTES_UI.quetes.objectifMonstres(formater(quete.seuil))
    case 'premierPrestige':
      return TEXTES_UI.quetes.objectifPremierPrestige
  }
}

function CarteQuete({ store, quete }: { readonly store: StoreJeuApi; readonly quete: ParametresQuete }) {
  const accomplie = useStoreJeu(store, (s) => queteAccomplie(s.etat, quete.id))
  const texte = TEXTES_QUETES[quete.id]
  if (texte === undefined) return null

  return (
    <li
      data-testid={`quete-${quete.id}`}
      data-accomplie={accomplie}
      className="flex flex-col gap-1 rounded-md bg-[var(--couleur-charbon-900)] px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--couleur-charbon-texte)]">{texte.nom}</span>
        {/* Jamais la couleur seule (§7) : l'état est écrit en toutes lettres. Pas de pictogramme ✓/○ :
            axe-core ne sait pas mesurer le contraste d'un symbole seul (`incomplete` de `color-contrast`). */}
        <span
          className={`shrink-0 text-xs ${accomplie ? 'font-semibold text-[var(--couleur-charbon-texte)]' : 'text-[var(--couleur-charbon-texte-attenue)]'}`}
        >
          {accomplie ? TEXTES_UI.quetes.accomplie : TEXTES_UI.quetes.pasEncore}
        </span>
      </div>
      <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">{texte.description}</p>
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--couleur-charbon-texte)]">
        <span>{objectif(quete)}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {TEXTES_UI.quetes.recompense(formater(quete.renommeeGagnee))}
        </span>
      </div>
    </li>
  )
}

export function PanneauQuetes({ store }: { readonly store: StoreJeuApi }) {
  return (
    <section aria-label={TEXTES_UI.quetes.titre} className="flex flex-col gap-2 p-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
        {TEXTES_UI.quetes.titre}
        <span className="ml-1 normal-case text-[var(--couleur-charbon-texte-attenue)]">
          — {TEXTES_UI.quetes.sousTitre}
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {CONSTANTES.quetes.map((q) => (
          <CarteQuete key={q.id} store={store} quete={q} />
        ))}
      </ul>
    </section>
  )
}
