// Colonne droite — prestige et Ascension (T-23b, EXG-19/20/21/44). Confirmation à deux étapes : la 1re
// montre ce que le run perd (`apercuPrestige`/`apercuAscension`, lecture seule, `src/domain/`), la 2e le
// gain — même quand il vaut 0 (EXG-21). L'étape 2 lit l'aperçu **en direct** (sélecteur Zustand, pas une
// valeur figée à l'ouverture) : ce qui est affiché au moment du clic « Confirmer » est ce que
// `store.actions.prestige`/`ascensionner` va créditer, puisque le clic et l'appel au moteur sont le même
// geste synchrone (aucune formule recalculée ici, tout vient de `src/domain/prestige`/`ascension`).

import { useRef, useState } from 'react'

import { apercuAscension } from '../../domain/ascension/index.ts'
import { formater } from '../../domain/notation.ts'
import { apercuPrestige } from '../../domain/prestige/index.ts'
import { CONSTANTES } from '../../donnees/constantes.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { Modale } from './Modale.tsx'

type Etape = 'aperçu' | 'confirmation'

function BoutonDeclenchement({
  testId,
  libelle,
  libelleIndisponible,
  disponible,
  desactive,
  onClick,
}: {
  readonly testId: string
  readonly libelle: string
  readonly libelleIndisponible: string
  readonly disponible: boolean
  readonly desactive: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={desactive}
      onClick={onClick}
      className="min-h-6 min-w-24 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {disponible ? libelle : libelleIndisponible}
    </button>
  )
}

function ModalePrestige({
  store,
  ouverte,
  onFermer,
}: {
  readonly store: StoreJeuApi
  readonly ouverte: boolean
  readonly onFermer: () => void
}) {
  const [etape, setEtape] = useState<Etape>('aperçu')
  // EXG-21 / T-23b — « gain affiché au clic, pas recalculé pendant que la modale est ouverte » : figé au
  // passage à l'étape de confirmation, jamais relu en direct ensuite. `null` tant que l'étape 1 est
  // affichée (aucun gain figé à montrer). `store.actions.prestige` reçoit ce même nombre : le domaine
  // recalcule toujours le gain à partir de l'état courant (ce n'est pas sa responsabilité de geler quoi
  // que ce soit), donc c'est cette couche qui corrige l'écart pour créditer exactement ce qui a été
  // montré (voir `src/state/store.ts`).
  const [gainFige, setGainFige] = useState<number | null>(null)
  const annulerRef = useRef<HTMLButtonElement>(null)
  // Sélecteurs fins : chacun retourne une primitive (jamais l'objet `ApercuPrestige` entier), condition
  // documentée par `src/state/hooks.ts` — `useSyncExternalStore` compare par `Object.is` et boucle à
  // l'infini si le sélecteur renvoie un nouvel objet à chaque appel.
  const disponible = useStoreJeu(store, (s) => apercuPrestige(s.etat, CONSTANTES).disponible)
  const zoneMaxDuRun = useStoreJeu(store, (s) => apercuPrestige(s.etat, CONSTANTES).zoneMaxDuRun)
  const perteOr = useStoreJeu(store, (s) => apercuPrestige(s.etat, CONSTANTES).perte.or)
  const perteNiveaux = useStoreJeu(store, (s) => apercuPrestige(s.etat, CONSTANTES).perte.niveauxEcoles)
  const eclatsGagnesEnDirect = useStoreJeu(store, (s) => apercuPrestige(s.etat, CONSTANTES).eclatsGagnes)
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)
  const prestige = useStoreJeu(store, (s) => s.actions.prestige)

  function fermer(): void {
    setEtape('aperçu')
    setGainFige(null)
    onFermer()
  }

  function continuer(): void {
    setGainFige(eclatsGagnesEnDirect)
    setEtape('confirmation')
  }

  const desactive = !disponible || lectureSeule

  return (
    <Modale
      id="titre-modale-prestige"
      titre={etape === 'aperçu' ? TEXTES_UI.prestige.etape1Titre : TEXTES_UI.prestige.etape2Titre}
      ouverte={ouverte}
      onFermer={fermer}
      annulerRef={annulerRef}
      cleEtape={etape}
    >
      {etape === 'aperçu' ? (
        <>
          <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">
            {TEXTES_UI.prestige.etape1Intro(zoneMaxDuRun)}
          </p>
          <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">
            {TEXTES_UI.prestige.etape1Perte(formater(perteOr), perteNiveaux)}
          </p>
          <div className="flex justify-end gap-2">
            <button
              ref={annulerRef}
              type="button"
              onClick={fermer}
              className="min-h-6 min-w-20 rounded px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] hover:bg-[var(--couleur-charbon-800)]"
            >
              {TEXTES_UI.commun.annuler}
            </button>
            <button
              type="button"
              disabled={desactive}
              onClick={continuer}
              className="min-h-6 min-w-20 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {TEXTES_UI.prestige.etape1Continuer}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-[var(--couleur-charbon-texte)]" data-testid="prestige-gain">
            {(gainFige ?? 0) > 1
              ? TEXTES_UI.prestige.etape2GainPluriel(formater(gainFige ?? 0))
              : TEXTES_UI.prestige.etape2Gain(formater(gainFige ?? 0))}
          </p>
          <div className="flex justify-end gap-2">
            <button
              ref={annulerRef}
              type="button"
              onClick={fermer}
              className="min-h-6 min-w-20 rounded px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] hover:bg-[var(--couleur-charbon-800)]"
            >
              {TEXTES_UI.commun.annuler}
            </button>
            <button
              type="button"
              disabled={desactive}
              onClick={() => {
                prestige(gainFige ?? 0)
                fermer()
              }}
              className="min-h-6 min-w-20 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {TEXTES_UI.prestige.confirmer}
            </button>
          </div>
        </>
      )}
    </Modale>
  )
}

function ModaleAscension({
  store,
  ouverte,
  onFermer,
}: {
  readonly store: StoreJeuApi
  readonly ouverte: boolean
  readonly onFermer: () => void
}) {
  const [etape, setEtape] = useState<Etape>('aperçu')
  // Même gel qu'en prestige (voir `ModalePrestige`) : figé au passage à l'étape de confirmation.
  const [gainFige, setGainFige] = useState<number | null>(null)
  const annulerRef = useRef<HTMLButtonElement>(null)
  // Mêmes contraintes que `ModalePrestige` : sélecteurs fins, jamais l'objet `ApercuAscension` entier.
  const disponible = useStoreJeu(store, (s) => apercuAscension(s.etat, CONSTANTES).disponible)
  const perteOr = useStoreJeu(store, (s) => apercuAscension(s.etat, CONSTANTES).perte.or)
  const perteNiveaux = useStoreJeu(store, (s) => apercuAscension(s.etat, CONSTANTES).perte.niveauxEcoles)
  const pointsGagnesEnDirect = useStoreJeu(store, (s) => apercuAscension(s.etat, CONSTANTES).pointsGagnes)
  const debloqueSixiemeEcole = useStoreJeu(store, (s) => apercuAscension(s.etat, CONSTANTES).debloqueSixiemeEcole)
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)
  const ascensionner = useStoreJeu(store, (s) => s.actions.ascensionner)

  function fermer(): void {
    setEtape('aperçu')
    setGainFige(null)
    onFermer()
  }

  function continuer(): void {
    setGainFige(pointsGagnesEnDirect)
    setEtape('confirmation')
  }

  const desactive = !disponible || lectureSeule

  return (
    <Modale
      id="titre-modale-ascension"
      titre={etape === 'aperçu' ? TEXTES_UI.ascension.etape1Titre : TEXTES_UI.ascension.etape2Titre}
      ouverte={ouverte}
      onFermer={fermer}
      annulerRef={annulerRef}
      cleEtape={etape}
    >
      {etape === 'aperçu' ? (
        <>
          <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.ascension.etape1Intro}</p>
          <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">
            {TEXTES_UI.ascension.etape1Perte(formater(perteOr), perteNiveaux)}
          </p>
          <div className="flex justify-end gap-2">
            <button
              ref={annulerRef}
              type="button"
              onClick={fermer}
              className="min-h-6 min-w-20 rounded px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] hover:bg-[var(--couleur-charbon-800)]"
            >
              {TEXTES_UI.commun.annuler}
            </button>
            <button
              type="button"
              disabled={desactive}
              onClick={continuer}
              className="min-h-6 min-w-20 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {TEXTES_UI.ascension.etape1Continuer}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-[var(--couleur-charbon-texte)]" data-testid="ascension-gain">
            {(gainFige ?? 0) > 1
              ? TEXTES_UI.ascension.etape2GainPluriel(formater(gainFige ?? 0))
              : TEXTES_UI.ascension.etape2Gain(formater(gainFige ?? 0))}
          </p>
          {debloqueSixiemeEcole && (
            <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.ascension.etape2Ecole}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              ref={annulerRef}
              type="button"
              onClick={fermer}
              className="min-h-6 min-w-20 rounded px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] hover:bg-[var(--couleur-charbon-800)]"
            >
              {TEXTES_UI.commun.annuler}
            </button>
            <button
              type="button"
              disabled={desactive}
              onClick={() => {
                ascensionner(gainFige ?? 0)
                fermer()
              }}
              className="min-h-6 min-w-20 rounded bg-[var(--couleur-charbon-800)] px-3 py-1.5 text-sm font-medium text-[var(--couleur-charbon-texte)] enabled:hover:bg-[var(--couleur-charbon-700)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {TEXTES_UI.ascension.confirmer}
            </button>
          </div>
        </>
      )}
    </Modale>
  )
}

export function PanneauPrestige({ store }: { readonly store: StoreJeuApi }) {
  const [modaleOuverte, setModaleOuverte] = useState<'prestige' | 'ascension' | null>(null)

  const prestigeDisponible = useStoreJeu(store, (s) => apercuPrestige(s.etat, CONSTANTES).disponible)
  const partieTerminee = useStoreJeu(store, (s) => s.etat.partieTerminee)
  const lectureSeule = useStoreJeu(store, (s) => s.lectureSeule)
  const ascensionDisponible = useStoreJeu(store, (s) => apercuAscension(s.etat, CONSTANTES).disponible)
  const prestigesDuCycle = useStoreJeu(store, (s) => s.etat.prestige.prestigesDuCycle)
  const prestigesRequis = CONSTANTES.ascension.prestigesParAscension

  return (
    <section aria-label={TEXTES_UI.prestige.titre} className="flex flex-col gap-2 p-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-[var(--couleur-charbon-texte-attenue)]">
        {TEXTES_UI.prestige.titre}
      </h2>
      <div className="flex flex-col gap-1 rounded-md bg-[var(--couleur-charbon-900)] px-3 py-2">
        <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.prestige.description}</p>
        <BoutonDeclenchement
          testId="bouton-declencher-prestige"
          libelle={TEXTES_UI.prestige.bouton}
          libelleIndisponible={TEXTES_UI.prestige.boutonVerrouille}
          disponible={prestigeDisponible}
          desactive={partieTerminee || lectureSeule}
          onClick={() => setModaleOuverte('prestige')}
        />
      </div>
      <div className="flex flex-col gap-1 rounded-md bg-[var(--couleur-charbon-900)] px-3 py-2">
        <p className="text-sm text-[var(--couleur-charbon-texte-attenue)]">{TEXTES_UI.ascension.description}</p>
        {!ascensionDisponible && !partieTerminee && (
          <p className="text-xs text-[var(--couleur-charbon-texte-attenue)]">
            {TEXTES_UI.ascension.progression(prestigesDuCycle, prestigesRequis)}
          </p>
        )}
        <BoutonDeclenchement
          testId="bouton-declencher-ascension"
          libelle={TEXTES_UI.ascension.bouton}
          libelleIndisponible={partieTerminee ? TEXTES_UI.ascension.boutonPartieTerminee : TEXTES_UI.ascension.boutonVerrouille}
          disponible={ascensionDisponible}
          desactive={!ascensionDisponible || partieTerminee || lectureSeule}
          onClick={() => setModaleOuverte('ascension')}
        />
      </div>
      <ModalePrestige store={store} ouverte={modaleOuverte === 'prestige'} onFermer={() => setModaleOuverte(null)} />
      <ModaleAscension store={store} ouverte={modaleOuverte === 'ascension'} onFermer={() => setModaleOuverte(null)} />
    </section>
  )
}
