// Colonne droite — améliorations (T-19, EXG-42) : achats à paliers payés en or. Coût lu directement dans
// le domaine (`coutPalier`), jamais recalculé ici ; l'achat passe par `store.actions.acheterAmelioration`.

import { coutPalier } from '../../domain/ameliorations/index.ts'
import { formater } from '../../domain/notation.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'

function CarteAmelioration({ store, id }: { readonly store: StoreJeuApi; readonly id: string }) {
  const palier = useStoreJeu(store, (s) => s.etat.paliersAmeliorations[id] ?? 0)
  const or = useStoreJeu(store, (s) => s.etat.bourse.or)
  const acheterAmelioration = useStoreJeu(store, (s) => s.actions.acheterAmelioration)
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)

  const parametres = CONSTANTES.ameliorations.find((a) => a.id === id)
  if (parametres === undefined) return null

  const auMax = parametres.paliersMax !== null && palier >= parametres.paliersMax
  const cout = auMax ? null : coutPalier(palier, parametres)
  const peutAcheter = !auMax && cout !== null && cout <= or
  const nom = TEXTES_UI.ameliorations.noms[id as keyof typeof TEXTES_UI.ameliorations.noms] ?? id

  return (
    <li className="flex flex-col gap-1 rounded-md bg-[var(--couleur-charbon-900)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--couleur-charbon-texte)]">{nom}</span>
        <span className="text-xs text-[var(--couleur-charbon-texte-attenue)]">
          {TEXTES_UI.ameliorations.palier(palier)}
        </span>
      </div>
      <button
        type="button"
        className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!peutAcheter || lectureSeule}
        onClick={() => acheterAmelioration(id)}
      >
        {auMax ? TEXTES_UI.arbreEclats.rangMax : `${TEXTES_UI.ameliorations.acheter} · ${formater(cout ?? 0)}`}
      </button>
    </li>
  )
}

export function PanneauAmeliorations({ store }: { readonly store: StoreJeuApi }) {
  return (
    <section aria-label={TEXTES_UI.ameliorations.titre} className="flex flex-col gap-2 p-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
        {TEXTES_UI.ameliorations.titre}
        <span className="ml-1 normal-case text-[var(--couleur-charbon-texte-attenue)]">
          — {TEXTES_UI.ameliorations.sousTitre}
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {CONSTANTES.ameliorations.map((a) => (
          <CarteAmelioration key={a.id} store={store} id={a.id} />
        ))}
      </ul>
    </section>
  )
}
