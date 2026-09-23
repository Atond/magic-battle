// Colonne droite (desktop) / onglet Prestige (mobile) — arbre d'Ascension (EXG-40) : rangs payés en
// Points d'Ascension, permanents. Même patron que `PanneauArbreEclats.tsx` ; coût, rang et prérequis sont
// lus dans le domaine (`coutRangNoeud`, `rangNoeud`, `prerequisRemplis`), l'achat passe par
// `store.actions.acheterNoeudAscension` → `acheterNoeudAscension` (`src/domain/ascension/index.ts`).
//
// Le panneau n'apparaît qu'une fois l'arbre utile (au moins une Ascension faite, ou des Points à
// dépenser) : avant, huit nœuds impayables alourdiraient une colonne déjà longue, et la carte Ascension
// du panneau Prestige annonce déjà qu'elle « débloque l'arbre permanent ».
//
// Le solde de Points s'affiche ici, dans l'en-tête du panneau, pas dans le bandeau haut : il ne bouge
// qu'au moment d'une Ascension et ne se dépense que dans ce panneau — le bandeau (5 jauges, qui passe
// déjà sur deux lignes à 375 px) n'y gagnerait qu'une valeur figée la plupart du temps.

import { coutRangNoeud, noeudsDeLArbre, prerequisRemplis, rangNoeud } from '../../domain/prestige/arbre.ts'
import { formater } from '../../domain/notation.ts'
import type { ParametresNoeudArbre } from '../../domain/types.ts'
import { TEXTES_NOEUDS } from '../../donnees/arbres.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { EtatStoreJeu, StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'

const NOEUDS_ASCENSION = noeudsDeLArbre('ascension', CONSTANTES)

/** Le panneau est-il utile ? Primitive (booléen) : ne re-rend qu'au franchissement, jamais au tick. */
export function selecteurArbreAscensionVisible(s: EtatStoreJeu): boolean {
  return s.etat.ascension.ascensionsEffectuees > 0 || s.etat.bourse.pointsAscension > 0
}

/** Noms des prérequis, pour dire au joueur quoi acheter d'abord (le catalogue est figé : calcul unique). */
function nomsPrerequis(noeud: ParametresNoeudArbre): string {
  return noeud.prerequis.map((id) => TEXTES_NOEUDS[id]?.nom ?? id).join(', ')
}

function CarteNoeud({ store, noeud }: { readonly store: StoreJeuApi; readonly noeud: ParametresNoeudArbre }) {
  const rang = useStoreJeu(store, (s) => rangNoeud(s.etat, noeud))
  const points = useStoreJeu(store, (s) => s.etat.bourse.pointsAscension)
  const debloque = useStoreJeu(store, (s) => prerequisRemplis(s.etat, noeud, CONSTANTES))
  const acheter = useStoreJeu(store, (s) => s.actions.acheterNoeudAscension)
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)

  const auMax = noeud.rangMax !== null && rang >= noeud.rangMax
  const cout = auMax ? null : coutRangNoeud(rang, noeud, CONSTANTES)
  const peutAcheter = debloque && !auMax && cout !== null && cout <= points
  const texte = TEXTES_NOEUDS[noeud.id]

  let libelleBouton: string
  if (auMax) libelleBouton = TEXTES_UI.arbreAscension.rangMax
  else if (!debloque) libelleBouton = TEXTES_UI.arbreAscension.verrouille
  else libelleBouton = TEXTES_UI.arbreAscension.acheter(formater(cout ?? 0))

  return (
    <li
      className="flex flex-col gap-1 rounded-md bg-[var(--couleur-charbon-900)] px-3 py-2"
      data-testid={`noeud-${noeud.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--couleur-charbon-texte)]">{texte?.nom}</span>
        <span className="shrink-0 text-xs text-[var(--couleur-charbon-texte-attenue)]" data-testid="rang-noeud">
          {noeud.rangMax === null
            ? TEXTES_UI.arbreAscension.rangSansFin(rang)
            : TEXTES_UI.arbreAscension.rangSur(rang, noeud.rangMax)}
        </span>
      </div>
      {texte !== undefined && (
        <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">{texte.description}</p>
      )}
      {!debloque && (
        <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">
          {TEXTES_UI.arbreAscension.prerequis(nomsPrerequis(noeud))}
        </p>
      )}
      <button
        type="button"
        className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!peutAcheter || lectureSeule}
        onClick={() => acheter(noeud.id)}
      >
        {libelleBouton}
      </button>
    </li>
  )
}

function Solde({ store }: { readonly store: StoreJeuApi }) {
  const points = useStoreJeu(store, (s) => s.etat.bourse.pointsAscension)
  return (
    <p className="px-1 text-sm font-semibold text-[var(--couleur-charbon-texte)] tabular-nums" data-testid="solde-ascension">
      {TEXTES_UI.arbreAscension.solde(formater(points))}
    </p>
  )
}

export function PanneauArbreAscension({ store }: { readonly store: StoreJeuApi }) {
  const visible = useStoreJeu(store, selecteurArbreAscensionVisible)
  if (!visible) return null

  return (
    <section aria-label={TEXTES_UI.arbreAscension.titre} className="flex flex-col gap-2 p-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
        {TEXTES_UI.arbreAscension.titre}
        <span className="ml-1 normal-case text-[var(--couleur-charbon-texte-attenue)]">
          — {TEXTES_UI.arbreAscension.sousTitre}
        </span>
      </h2>
      <Solde store={store} />
      <ul className="flex flex-col gap-2">
        {NOEUDS_ASCENSION.map((n) => (
          <CarteNoeud key={n.id} store={store} noeud={n} />
        ))}
      </ul>
    </section>
  )
}
