// Colonne droite — équipement (T-19, EXG-43) : même mécanique que les améliorations, payée en Renommée
// exclusivement (EXG-10). Même patron que `PanneauAmeliorations.tsx`, guichet différent.

import { coutPalierEquipement } from '../../domain/equipement/index.ts'
import { formater } from '../../domain/notation.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'

function CarteEquipement({ store, id }: { readonly store: StoreJeuApi; readonly id: string }) {
  const palier = useStoreJeu(store, (s) => s.etat.paliersEquipement[id] ?? 0)
  const renommee = useStoreJeu(store, (s) => s.etat.bourse.renommee)
  const acheterEquipement = useStoreJeu(store, (s) => s.actions.acheterEquipement)

  const parametres = CONSTANTES.equipement.find((e) => e.id === id)
  if (parametres === undefined) return null

  const auMax = parametres.paliersMax !== null && palier >= parametres.paliersMax
  const cout = auMax ? null : coutPalierEquipement(palier, parametres)
  const peutAcheter = !auMax && cout !== null && cout <= renommee
  const nom = TEXTES_UI.equipement.noms[id as keyof typeof TEXTES_UI.equipement.noms] ?? id

  return (
    <li className="flex flex-col gap-1 rounded-md bg-[var(--couleur-charbon-900)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--couleur-charbon-texte)]">{nom}</span>
        <span className="text-xs text-[var(--couleur-charbon-texte-attenue)]">
          {TEXTES_UI.equipement.palier(palier)}
        </span>
      </div>
      <button
        type="button"
        className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!peutAcheter}
        onClick={() => acheterEquipement(id)}
      >
        {auMax ? TEXTES_UI.arbreEclats.rangMax : `${TEXTES_UI.equipement.acheter} · ${formater(cout ?? 0)}`}
      </button>
    </li>
  )
}

export function PanneauEquipement({ store }: { readonly store: StoreJeuApi }) {
  return (
    <section aria-label={TEXTES_UI.equipement.titre} className="flex flex-col gap-2 p-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
        {TEXTES_UI.equipement.titre}
        <span className="ml-1 normal-case text-[var(--couleur-charbon-texte-attenue)]">
          — {TEXTES_UI.equipement.sousTitre}
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {CONSTANTES.equipement.map((e) => (
          <CarteEquipement key={e.id} store={store} id={e.id} />
        ))}
      </ul>
    </section>
  )
}
