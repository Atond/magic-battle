// Narration courte (T-27, spec §7 « une ligne d'intro, une ligne par Ascension ») : même patron que
// l'encart hors-ligne (EXG-53) — `role="status"`, élément de flux normal (jamais `fixed`/`absolute`,
// donc jamais par-dessus une cible de jeu), fermable en un clic, aucune fermeture automatique, rien de
// bloquant.
//
// Deux déclencheurs :
//  - intro : `partieNeuve` du store (aucune sauvegarde au démarrage, ou nouvelle partie confirmée) ;
//  - Ascension n : le compteur `ascensionsEffectuees` du moteur augmente **pendant** la session. Au
//    montage, la valeur courante sert de référence : recharger la page après une Ascension ne rejoue pas
//    la ligne.

import { useEffect, useRef, useState } from 'react'

import { TEXTES_FIN } from '../../donnees/fin.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import type { StoreJeuApi } from '../../state/store.ts'

/** Ligne de la n-ième Ascension (1 → première ligne) ; au-delà des lignes écrites, rien. */
function ligneAscension(n: number): string | null {
  return TEXTES_FIN.ascensions[n - 1] ?? null
}

export function EncartNarration({ store }: { readonly store: StoreJeuApi }) {
  const partieNeuve = useStoreJeu(store, (s) => s.partieNeuve)
  const ascensions = useStoreJeu(store, (s) => s.etat.ascension.ascensionsEffectuees)
  const [ligne, setLigne] = useState<string | null>(partieNeuve ? TEXTES_FIN.intro : null)
  const ascensionsRef = useRef(ascensions)

  // Nouvelle partie confirmée en cours de session : l'intro revient.
  useEffect(() => {
    if (partieNeuve) setLigne(TEXTES_FIN.intro)
  }, [partieNeuve])

  useEffect(() => {
    if (ascensions > ascensionsRef.current) setLigne(ligneAscension(ascensions))
    ascensionsRef.current = ascensions
  }, [ascensions])

  if (ligne === null) return null

  return (
    <div
      role="status"
      data-testid="encart-narration"
      className="flex items-center justify-between gap-3 border-b border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-800)] px-3 py-2 text-sm text-[var(--couleur-charbon-texte)]"
    >
      <p>
        <span className="sr-only">{TEXTES_UI.narration.etiquette} — </span>
        <span className="italic">{ligne}</span>
      </p>
      <button
        type="button"
        onClick={() => setLigne(null)}
        className="min-h-6 min-w-6 shrink-0 rounded px-2 py-1 text-xs font-medium text-[var(--couleur-charbon-texte-attenue)] hover:bg-[var(--couleur-charbon-700)]"
      >
        {TEXTES_UI.commun.fermer}
      </button>
    </div>
  )
}
