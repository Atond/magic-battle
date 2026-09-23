// Colonne droite — arbre d'Éclats (T-19, EXG-39) : rangs payés en Éclats dépensables, prérequis entre
// nœuds. Coût et prérequis lus directement dans le domaine (`coutRangNoeud`, `prerequisRemplis`) ; l'achat
// passe par `store.actions.acheterNoeudEclats` → `acheterNoeudArbre`.

import { coutRangNoeud, noeudsDeLArbre, prerequisRemplis, rangNoeud } from '../../domain/prestige/arbre.ts'
import { formater } from '../../domain/notation.ts'
import type { ParametresNoeudArbre } from '../../domain/types.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'

const NOEUDS_ECLATS = noeudsDeLArbre('eclats', CONSTANTES)

function CarteNoeud({ store, noeud }: { readonly store: StoreJeuApi; readonly noeud: ParametresNoeudArbre }) {
  const rang = useStoreJeu(store, (s) => rangNoeud(s.etat, noeud))
  const eclatsDepensables = useStoreJeu(store, (s) => s.etat.bourse.eclatsDepensables)
  const debloque = useStoreJeu(store, (s) => prerequisRemplis(s.etat, noeud, CONSTANTES))
  const acheterNoeudEclats = useStoreJeu(store, (s) => s.actions.acheterNoeudEclats)

  const auMax = noeud.rangMax !== null && rang >= noeud.rangMax
  const cout = auMax ? null : coutRangNoeud(rang, noeud, CONSTANTES)
  const peutAcheter = debloque && !auMax && cout !== null && cout <= eclatsDepensables
  const nom = TEXTES_UI.arbreEclats.noms[noeud.id as keyof typeof TEXTES_UI.arbreEclats.noms] ?? noeud.id

  let libelleBouton: string
  if (auMax) libelleBouton = TEXTES_UI.arbreEclats.rangMax
  else if (!debloque) libelleBouton = TEXTES_UI.arbreEclats.verrouille
  else libelleBouton = `${TEXTES_UI.arbreEclats.acheter} · ${formater(cout ?? 0)}`

  return (
    <li className="flex flex-col gap-1 rounded-md bg-[var(--couleur-charbon-900)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--couleur-charbon-texte)]">{nom}</span>
        <span className="text-xs text-[var(--couleur-charbon-texte-attenue)]">
          {TEXTES_UI.arbreEclats.rang(rang)}
        </span>
      </div>
      <button
        type="button"
        className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!peutAcheter}
        onClick={() => acheterNoeudEclats(noeud.id)}
      >
        {libelleBouton}
      </button>
    </li>
  )
}

export function PanneauArbreEclats({ store }: { readonly store: StoreJeuApi }) {
  return (
    <section aria-label={TEXTES_UI.arbreEclats.titre} className="flex flex-col gap-2 p-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
        {TEXTES_UI.arbreEclats.titre}
        <span className="ml-1 normal-case text-[var(--couleur-charbon-texte-attenue)]">
          — {TEXTES_UI.arbreEclats.sousTitre}
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {NOEUDS_ECLATS.map((n) => (
          <CarteNoeud key={n.id} store={store} noeud={n} />
        ))}
      </ul>
    </section>
  )
}
