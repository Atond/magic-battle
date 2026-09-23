// Colonne des écoles (T-19, §7 « disposition ») : une carte par école, verrouillée (EXG-8 : ni nom ni
// coût avant révélation) ou achetable. Achat branché sur `store.actions.acheterEcole` → moteur
// (`acheterNiveaux`, `src/domain/ecoles/index.ts`) : aucun coût recalculé ici, `coutProchainNiveau` est
// lu directement dans le domaine.

import { coutProchainNiveau, ecoleAccessible } from '../../domain/ecoles/index.ts'
import { formater } from '../../domain/notation.ts'
import type { IdEcole } from '../../domain/types.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'

/** Ordre d'affichage des six écoles (§5) : identique à l'ordre de révélation (zones croissantes). */
const ORDRE_ECOLES: readonly IdEcole[] = ['feu', 'glace', 'ecole3', 'ecole4', 'ecole5', 'lumiere']

function CarteEcole({ store, id }: { readonly store: StoreJeuApi; readonly id: IdEcole }) {
  const niveau = useStoreJeu(store, (s) => s.etat.ecoles[id].niveau)
  const revelee = useStoreJeu(store, (s) => s.etat.ecoles[id].revelee)
  const accessible = useStoreJeu(store, (s) => ecoleAccessible(s.etat, id, CONSTANTES))
  const or = useStoreJeu(store, (s) => s.etat.bourse.or)
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)
  const acheterEcole = useStoreJeu(store, (s) => s.actions.acheterEcole)
  const accent = `var(--couleur-ecole-${id})`

  if (!revelee) {
    return (
      <li
        // Voir BarreSorts.tsx : pas d'`opacity-*` ici non plus (T-22, EXG-31), même raison.
        className="flex min-h-12 items-center gap-2 rounded-md border border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-900)] px-3 py-2"
        aria-label={TEXTES_UI.ecoles.verrouillee}
      >
        <span aria-hidden="true" className="text-base">
          🔒
        </span>
        <span className="text-sm text-[var(--couleur-charbon-texte-attenue)]">
          {TEXTES_UI.ecoles.verrouillee} — {TEXTES_UI.ecoles.verrouilleeDetail}
        </span>
      </li>
    )
  }

  const cout = coutProchainNiveau(niveau, CONSTANTES.ecoles[id])
  const peutAcheter = accessible && cout <= or

  return (
    <li
      className="flex flex-col gap-1 rounded-md border-l-4 bg-[var(--couleur-charbon-900)] px-3 py-2"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--couleur-charbon-texte)]">
          {TEXTES_UI.ecoles.noms[id]}
        </span>
        <span className="text-xs text-[var(--couleur-charbon-texte-attenue)]">
          {TEXTES_UI.ecoles.niveau(niveau)}
        </span>
      </div>
      <button
        type="button"
        className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!peutAcheter || lectureSeule}
        onClick={() => acheterEcole(id)}
      >
        {TEXTES_UI.ecoles.acheter} · {formater(cout)}
      </button>
    </li>
  )
}

export function PanneauEcoles({ store }: { readonly store: StoreJeuApi }) {
  return (
    <section aria-label={TEXTES_UI.ecoles.titre} className="flex flex-col gap-2 p-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
        {TEXTES_UI.ecoles.titre}
      </h2>
      <ul className="flex flex-col gap-2">
        {ORDRE_ECOLES.map((id) => (
          <CarteEcole key={id} store={store} id={id} />
        ))}
      </ul>
    </section>
  )
}
