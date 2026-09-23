// Colonne centrale — accès à la zone du boss final (EXG-28). L'encart n'existe que si le domaine dit la
// zone accessible (`zoneFinaleAccessible` : seuil d'Ascensions atteint, partie pas terminée) et qu'aucun
// combat final n'est déjà engagé — pendant le combat, le panneau central montre la zone et le canvas le
// boss (`src/state/contenu.ts`, `enCombatFinal`). Aucun seuil ni chrono calculé ici : tout vient de
// `apercuFin` (`src/domain/fin/index.ts`), l'entrée passe par `store.actions.entrerZoneFinale`.
//
// Placé au-dessus du combat, dans le panneau central, plutôt que dans la colonne Prestige : c'est le
// seul emplacement visible dans les deux dispositions sans changer d'onglet sur mobile.

import { apercuFin } from '../../domain/fin/index.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_FIN } from '../../donnees/fin.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import type { EtatStoreJeu, StoreJeuApi } from '../../state/store.ts'

/** Primitive : vrai seulement quand l'entrée est possible et pas déjà faite. */
export function selecteurEncartZoneFinale(s: EtatStoreJeu): boolean {
  const apercu = apercuFin(s.etat, CONSTANTES)
  return apercu.accessible && !apercu.engage
}

export function EncartZoneFinale({ store }: { readonly store: StoreJeuApi }) {
  const afficher = useStoreJeu(store, selecteurEncartZoneFinale)
  const secondes = useStoreJeu(store, (s) => Math.ceil(apercuFin(s.etat, CONSTANTES).timerMs / 1000))
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)
  const entrer = useStoreJeu(store, (s) => s.actions.entrerZoneFinale)
  if (!afficher) return null

  return (
    <section
      aria-label={TEXTES_UI.zoneFinale.titre}
      data-testid="encart-zone-finale"
      className="flex flex-col gap-1.5 rounded-md border border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-900)] px-3 py-2"
    >
      <h2 className="text-sm font-semibold text-[var(--couleur-charbon-texte)]">{TEXTES_FIN.zoneFinale.nom}</h2>
      <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.zoneFinale.ouverte}</p>
      <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_FIN.zoneFinale.description}</p>
      <p className="text-xs text-[var(--couleur-charbon-texte)]">
        <span className="text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.zoneFinale.boss} · </span>
        <span className="font-semibold">{TEXTES_FIN.bossFinal.nom}</span>
      </p>
      <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_FIN.bossFinal.description}</p>
      <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.zoneFinale.chrono(secondes)}</p>
      <button
        type="button"
        data-testid="bouton-entrer-zone-finale"
        disabled={lectureSeule}
        onClick={() => entrer()}
        className="min-h-11 rounded bg-[var(--couleur-charbon-800)] px-3 py-2 text-sm font-semibold text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {TEXTES_UI.zoneFinale.entrer}
      </button>
    </section>
  )
}
