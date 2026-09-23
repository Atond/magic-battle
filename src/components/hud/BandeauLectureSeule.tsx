// Bandeau lecture seule (T-23b, EXG-48). Visible dès que `store.lectureSeule` est vrai — onglet
// secondaire (un autre onglet joue) ou verrou perdu (cet onglet jouait, un autre a repris la main). Les
// actions sont déjà sans effet côté moteur (garde `jouer`, `src/state/store.ts`) ; ce bandeau et le
// `disabled` posé sur chaque bouton des panneaux (T-23b) en sont la traduction **visuelle**, distincte du
// « sans effet » déjà vrai depuis T-23a.
//
// Élément de flux normal (pas `fixed`/`absolute`) : jamais de rectangle susceptible de chevaucher une
// cible de jeu (spec T-23b « chevauchement des rectangles »).

import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import type { StoreJeuApi } from '../../state/store.ts'

export function BandeauLectureSeule({ store }: { readonly store: StoreJeuApi }) {
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)
  const motif = useStoreJeu(store, (s) => s.motifLectureSeule)

  if (!lectureSeule || motif === null) return null

  const texte = TEXTES_UI.lectureSeule[motif]

  return (
    <div
      role="status"
      data-testid="bandeau-lecture-seule"
      className="border-b border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm text-[var(--couleur-charbon-texte)]"
    >
      {texte}
    </div>
  )
}
