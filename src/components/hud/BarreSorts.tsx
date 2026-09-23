// Barre de sorts actifs (T-20, EXG-11 à EXG-14, EXG-51). Deux entrées vers le même moteur :
//  - clic/tape sur une cible de la barre → `store.actions.lancerSort(idSort)` ;
//  - touches 1-6 du clavier (EXG-13, EXG-34) → même action, câblées une seule fois par
//    `useRaccourcisSorts` (voir plus bas pourquoi ce n'est pas dans le composant visuel).
// Aucun calcul de jeu ici : disponibilité et cooldown viennent de `sortDisponible`/`etatSortLu`
// (`src/domain/sorts/index.ts`), le refus (verrouillé, cooldown) est entièrement décidé par
// `lancerSort` du moteur — la barre ne fait qu'afficher et relayer une touche.

import { useEffect } from 'react'

import { etatSortLu } from '../../domain/sorts/index.ts'
import type { ToucheSort } from '../../domain/types.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { SORTS } from '../../donnees/sorts.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'

/** Ordre d'affichage : la touche, du plus petit chiffre au plus grand (§4.3). */
const SORTS_PAR_TOUCHE = [...SORTS].sort((a, b) => a.touche - b.touche)

/** Nom de travail d'un sort : celui de l'école qui le porte (§5 « une École débloque un Sort »). */
function nomSort(idEcole: (typeof SORTS)[number]['idEcole']): string {
  return TEXTES_UI.ecoles.noms[idEcole]
}

function estDansChampDeSaisie(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false
  const tag = cible.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || cible.isContentEditable
}

/** EXG-23b (mécanisme posé ici) — une modale ouverte (`[aria-modal="true"]`) coupe les raccourcis. */
function uneModaleEstOuverte(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null
}

const TOUCHES_CHIFFRES = new Set(['1', '2', '3', '4', '5', '6'])

/**
 * EXG-13/EXG-34 — écoute les touches 1 à 6 pour toute la session. À appeler **une seule fois**, au
 * niveau de `Disposition` : `PanneauCentral` est monté deux fois en parallèle (desktop caché en CSS +
 * mobile visible, voir `Disposition.tsx`), un `useEffect` posé dans `BarreSorts` y serait donc doublé et
 * chaque frappe déclencherait deux lancers au lieu d'un.
 */
export function useRaccourcisSorts(store: StoreJeuApi): void {
  useEffect(() => {
    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return
      if (!TOUCHES_CHIFFRES.has(evenement.key)) return
      if (estDansChampDeSaisie(evenement.target)) return
      if (uneModaleEstOuverte()) return

      const touche = Number(evenement.key) as ToucheSort
      const sort = SORTS.find((s) => s.touche === touche)
      if (sort === undefined) return
      store.getState().actions.lancerSort(sort.id)
    }

    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [store])
}

function CarteSort({ store, idSort }: { readonly store: StoreJeuApi; readonly idSort: string }) {
  const debloque = useStoreJeu(store, (s) => etatSortLu(s.etat, idSort, CONSTANTES).debloque)
  // Sélecteur qui rend une primitive déjà arrondie (secondes entières) : le cooldown décroît de
  // `PAS_TICK_MS` (100 ms) à chaque tick, mais l'affichage n'a besoin de re-rendre qu'une fois par
  // seconde — `Math.ceil` change de valeur une fois sur dix, pas à chaque notification du store.
  const cooldownSecondes = useStoreJeu(store, (s) =>
    Math.ceil(etatSortLu(s.etat, idSort, CONSTANTES).cooldownRestantMs / 1000),
  )
  const lancerSort = useStoreJeu(store, (s) => s.actions.lancerSort)
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)

  const parametres = SORTS.find((s) => s.id === idSort)
  if (parametres === undefined) return null
  const { touche, idEcole } = parametres

  if (!debloque) {
    return (
      <li
        data-testid={`sort-${touche}`}
        aria-label={`${TEXTES_UI.sorts.verrouille} — ${TEXTES_UI.sorts.touche(touche)}`}
        className="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-900)] px-2 py-1 text-center opacity-70"
      >
        <span aria-hidden="true" className="text-base">
          🔒
        </span>
        <span className="text-[10px] leading-tight text-[var(--couleur-charbon-texte-attenue)]">
          {TEXTES_UI.sorts.verrouille}
        </span>
      </li>
    )
  }

  const enCooldown = cooldownSecondes > 0

  return (
    <li className="flex-1">
      <button
        type="button"
        data-testid={`sort-${touche}`}
        disabled={enCooldown || lectureSeule}
        onClick={() => lancerSort(idSort)}
        aria-label={`${nomSort(idEcole)} — ${TEXTES_UI.sorts.touche(touche)}${enCooldown ? ` — ${TEXTES_UI.sorts.enCooldown(cooldownSecondes)}` : ''}`}
        className="flex min-h-11 w-full min-w-11 flex-col items-center justify-center gap-0.5 rounded-md border-l-4 bg-[var(--couleur-charbon-900)] px-2 py-1 text-center enabled:hover:bg-[var(--couleur-charbon-800)] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderLeftColor: `var(--couleur-ecole-${idEcole})` }}
      >
        <span className="text-xs font-medium text-[var(--couleur-charbon-texte)]">{nomSort(idEcole)}</span>
        <span className="text-[10px] leading-tight text-[var(--couleur-charbon-texte-attenue)]">
          {enCooldown ? TEXTES_UI.sorts.enCooldown(cooldownSecondes) : TEXTES_UI.sorts.pret}
        </span>
      </button>
    </li>
  )
}

/** EXG-51 — cibles ≥ 44×44 px : `min-h-11`/`min-w-11` (2.75rem = 44px) sur chaque cellule. */
export function BarreSorts({ store }: { readonly store: StoreJeuApi }) {
  return (
    <ul aria-label={TEXTES_UI.sorts.titre} className="flex min-h-11 gap-1">
      {SORTS_PAR_TOUCHE.map((sort) => (
        <CarteSort key={sort.id} store={store} idSort={sort.id} />
      ))}
    </ul>
  )
}
