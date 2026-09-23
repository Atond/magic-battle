// Écran de fin (EXG-28, T-27) : affiché quand le moteur a figé les statistiques de fin
// (`statistiquesDeFin`, `src/domain/fin/index.ts` — non nul seulement après la victoire sur le boss
// final). Texte de `TEXTES_FIN.ecranFin`, statistiques exigées par EXG-28 (durée totale, zone max,
// nombre d'Ascensions) plus le total de prestiges. Rien n'est recalculé ici : les valeurs sont celles
// figées par le moteur à l'instant de la victoire.
//
// Pas une modale : un écran à part entière (`<main>`), et un bouton pour retourner au HUD — la partie
// terminée continue de produire de l'or (EXG-44 ne ferme que prestige et Ascension).

import { useEffect, useRef } from 'react'

import { formater } from '../../domain/notation.ts'
import { statistiquesDeFin } from '../../domain/fin/index.ts'
import { TEXTES_FIN } from '../../donnees/fin.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import { formaterDuree } from '../../state/presentation.ts'
import type { EtatStoreJeu, StoreJeuApi } from '../../state/store.ts'

/** Vrai dès que le moteur a figé l'écran de fin. Sélecteur à primitive, utilisable par `Disposition`. */
export function selecteurFinAtteinte(s: EtatStoreJeu): boolean {
  return statistiquesDeFin(s.etat) !== null
}

function Statistique({ libelle, valeur, testId }: { readonly libelle: string; readonly valeur: string; readonly testId: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--couleur-charbon-bordure)] py-1.5">
      <dt className="text-sm text-[var(--couleur-charbon-texte-attenue)]">{libelle}</dt>
      <dd data-testid={testId} className="font-semibold tabular-nums text-[var(--couleur-charbon-texte)]">
        {valeur}
      </dd>
    </div>
  )
}

export function EcranFin({ store, onContinuer }: { readonly store: StoreJeuApi; readonly onContinuer: () => void }) {
  const duree = useStoreJeu(store, (s) => statistiquesDeFin(s.etat)?.dureeTotaleMs ?? 0)
  const zoneMax = useStoreJeu(store, (s) => statistiquesDeFin(s.etat)?.zoneMaxAtteinte ?? 0)
  const ascensions = useStoreJeu(store, (s) => statistiquesDeFin(s.etat)?.ascensions ?? 0)
  const prestiges = useStoreJeu(store, (s) => statistiquesDeFin(s.etat)?.prestigesTotal ?? 0)
  const titreRef = useRef<HTMLHeadingElement>(null)

  // Le focus suit le changement d'écran : un lecteur d'écran annonce le titre, le clavier part d'ici.
  useEffect(() => {
    titreRef.current?.focus()
  }, [])

  return (
    <main
      data-testid="ecran-fin"
      aria-labelledby="titre-ecran-fin"
      className="flex min-h-screen items-center justify-center bg-[var(--couleur-charbon-950)] p-4 text-[var(--couleur-charbon-texte)]"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-md bg-[var(--couleur-charbon-900)] p-5">
        <h1 id="titre-ecran-fin" ref={titreRef} tabIndex={-1} className="text-xl font-bold">
          {TEXTES_FIN.ecranFin.titre}
        </h1>
        {TEXTES_FIN.ecranFin.lignes.map((ligne) => (
          <p key={ligne} className="text-sm text-[var(--couleur-charbon-texte)]">
            {ligne}
          </p>
        ))}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
          {TEXTES_UI.fin.statistiques}
        </h2>
        <dl>
          <Statistique testId="fin-duree" libelle={TEXTES_UI.fin.duree} valeur={formaterDuree(duree)} />
          <Statistique testId="fin-zone-max" libelle={TEXTES_UI.fin.zoneMax} valeur={formater(zoneMax)} />
          <Statistique testId="fin-ascensions" libelle={TEXTES_UI.fin.ascensions} valeur={formater(ascensions)} />
          <Statistique testId="fin-prestiges" libelle={TEXTES_UI.fin.prestiges} valeur={formater(prestiges)} />
        </dl>
        <button
          type="button"
          onClick={onContinuer}
          className="min-h-11 rounded bg-[var(--couleur-charbon-800)] px-4 py-2 text-sm font-medium text-[var(--couleur-charbon-texte)] hover:bg-[var(--couleur-charbon-700)]"
        >
          {TEXTES_UI.fin.continuer}
        </button>
      </div>
    </main>
  )
}
