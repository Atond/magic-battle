// Canvas de combat (T-21, spec §16 T-21, EXG-29/30/32/33/50/52, ADR-19). Rendu procédural géométrique,
// aucun asset : la silhouette du monstre, sa barre de PV et les projectiles/impacts sont dessinés par
// `dessin.ts` à partir de simples formes (`dessin.ts` documente le pourquoi de la séparation
// rect/cercle). Aucune formule de jeu ici.
//
// ADR-19 tenu strictement : la boucle de dessin est un `requestAnimationFrame` propre à ce composant,
// qui lit `store.getState()` sans jamais passer par `useStoreJeu` — dessiner ne doit provoquer AUCUN
// re-render React. Les deux seules valeurs qui passent par un sélecteur Zustand sont pour le miroir DOM
// (EXG-32), un élément séparé, pas le canvas lui-même.
//
// `PanneauCentral` est monté deux fois dans le DOM (desktop caché en CSS + mobile visible, voir
// `Disposition.tsx`) : chaque instance de `CanvasCombat` a donc sa propre boucle, mais celle dont le
// `<canvas>` n'est pas visible (`offsetParent === null`, ancêtre `display:none`) ne dessine rien et
// réinitialise sa référence de delta plutôt que d'accumuler un rattrapage — un seul des deux dessine
// réellement à un instant donné.

import { useEffect, useRef, useState } from 'react'

import type { Boss, Monstre } from '../domain/types.ts'
import { SORTS } from '../donnees/sorts.ts'
import { TEXTES_UI } from '../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../state/store.ts'
import { useStoreJeu } from '../state/hooks.ts'
import { demanderEffets, extraireInstantane } from './deltas.ts'
import type { InstantaneCombat, SortParEcole } from './deltas.ts'
import { dessinerScene } from './dessin.ts'
import { InterrupteurPerformance } from './InterrupteurPerformance.tsx'
import { resoudrePerformance } from './reglages.ts'
import { ajouterProjectiles } from './tampon.ts'
import type { Projectile } from './tampon.ts'

const COULEUR_CLIC = 'var(--couleur-charbon-texte)'
const COULEUR_IMPACT = 'oklch(0.85 0.18 85)'

const SORTS_PAR_ECOLE: readonly SortParEcole[] = SORTS.map((sort) => ({ id: sort.id, idEcole: sort.idEcole }))

function estBoss(cible: Monstre | Boss | null): cible is Boss {
  return cible !== null && 'estBoss' in cible && cible.estBoss === true
}

/** Miroir DOM des PV/timer de boss (EXG-32) : une région `aria-live` séparée n'annonce QUE les
 *  changements significatifs (monstre vaincu, arrivée d'un boss) — jamais à la cadence du tick 100 ms. */
function MiroirCombat({ store }: { readonly store: StoreJeuApi }) {
  const cible = useStoreJeu(store, (s) => s.etat.combat.cible)
  const timerBossRestantMs = useStoreJeu(store, (s) => s.etat.combat.timerBossRestantMs)
  const monstresTues = useStoreJeu(store, (s) => s.etat.magicien.monstresTues)
  const boss = estBoss(cible)

  const [annonce, setAnnonce] = useState('')
  const precedentMonstresTuesRef = useRef(monstresTues)
  const precedentBossRef = useRef(boss)

  useEffect(() => {
    if (monstresTues > precedentMonstresTuesRef.current) {
      setAnnonce(TEXTES_UI.combat.monstreVaincu(cible?.nom ?? ''))
    }
    precedentMonstresTuesRef.current = monstresTues
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monstresTues])

  useEffect(() => {
    if (boss && !precedentBossRef.current) {
      setAnnonce(TEXTES_UI.combat.bossEnApproche(cible?.nom ?? ''))
    }
    precedentBossRef.current = boss
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss])

  // Fond opaque derrière le texte (plutôt qu'une simple ombre portée) : le contenu réel derrière ce
  // miroir est un `<canvas>` dessiné, dont axe-core ne peut jamais garantir la couleur de fond au moment
  // de l'audit — un badge à fond plein rend le contraste effectivement mesurable (AA), pas seulement
  // visuellement plausible.
  const badge =
    'rounded bg-[var(--couleur-charbon-900)] px-1.5 py-0.5 text-[var(--couleur-charbon-texte)]'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-2 text-xs font-medium">
      <span data-testid="pv-cible" className={badge}>
        {cible === null ? TEXTES_UI.combat.aucuneCible : TEXTES_UI.combat.pv(Math.ceil(cible.pvCourants), cible.pvMax)}
      </span>
      {boss && timerBossRestantMs !== null && (
        <span data-testid="timer-boss" className={badge}>
          {TEXTES_UI.combat.timerBoss(Math.ceil(timerBossRestantMs / 1000))}
        </span>
      )}
      <span aria-live="polite" className="sr-only" data-testid="annonce-combat">
        {annonce}
      </span>
    </div>
  )
}

export function CanvasCombat({ store }: { readonly store: StoreJeuApi }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const conteneurRef = useRef<HTMLDivElement | null>(null)
  const precedentRef = useRef<InstantaneCombat | null>(null)
  const tamponRef = useRef<readonly Projectile[]>([])
  const prochainIdRef = useRef(1)
  const performanceRef = useRef(resoudrePerformance(store.stockage, store.matchMedia))

  useEffect(() => {
    const canvas = canvasRef.current
    const conteneur = conteneurRef.current
    if (canvas === null || conteneur === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    let idFrame: number | null = null

    function redimensionner(): { largeur: number; hauteur: number } {
      const rect = conteneur!.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const largeur = Math.max(1, Math.round(rect.width))
      const hauteur = Math.max(1, Math.round(rect.height))
      const largeurPixels = Math.max(1, Math.round(largeur * dpr))
      const hauteurPixels = Math.max(1, Math.round(hauteur * dpr))
      if (canvas!.width !== largeurPixels || canvas!.height !== hauteurPixels) {
        canvas!.width = largeurPixels
        canvas!.height = hauteurPixels
        canvas!.style.width = `${largeur}px`
        canvas!.style.height = `${hauteur}px`
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { largeur, hauteur }
    }

    function estCanvasVisible(): boolean {
      // `display:none` (le panneau jumeau sur l'autre disposition, T-19) rend `offsetParent` nul ; un
      // onglet caché (EXG-55) n'a aucune raison de continuer à dessiner non plus.
      return document.visibilityState === 'visible' && canvas!.offsetParent !== null
    }

    function jeuFige(): boolean {
      // EXG-48 / EXG-27 (T-23a) — onglet secondaire ou sauvegarde illisible : le moteur ne tourne pas, le
      // canvas non plus (lecture directe hors React, comme le reste de cette boucle).
      const s = store.getState()
      return s.lectureSeule || s.sauvegardeIllisible !== null
    }

    function frame(): void {
      if (!estCanvasVisible() || jeuFige()) {
        // Aucune donnée ne se périme : on efface juste la référence pour ne pas produire une salve de
        // rattrapage géante au moment où ce panneau redevient visible.
        precedentRef.current = null
        idFrame = window.requestAnimationFrame(frame)
        return
      }

      const { largeur, hauteur } = redimensionner()
      const etat = store.getState().etat
      const instantane = extraireInstantane(etat)

      if (precedentRef.current !== null && !performanceRef.current) {
        const demandes = demanderEffets(precedentRef.current, instantane, SORTS_PAR_ECOLE, COULEUR_CLIC, COULEUR_IMPACT)
        if (demandes.length > 0) {
          const resultat = ajouterProjectiles(tamponRef.current, demandes, prochainIdRef.current)
          tamponRef.current = resultat.tampon
          prochainIdRef.current = resultat.prochainId
        }
      }
      precedentRef.current = instantane

      // Temps de frame mesuré, informatif seulement (spec T-21 : jamais une assertion bloquante).
      const t0 = performance.now()
      dessinerScene(ctx!, {
        largeur,
        hauteur,
        cible: etat.combat.cible,
        projectiles: tamponRef.current,
        performanceActivee: performanceRef.current,
      })
      canvas!.dataset.dernierFrameMs = (performance.now() - t0).toFixed(2)

      idFrame = window.requestAnimationFrame(frame)
    }

    idFrame = window.requestAnimationFrame(frame)
    return () => {
      if (idFrame !== null) window.cancelAnimationFrame(idFrame)
    }
  }, [store])

  return (
    <div
      ref={conteneurRef}
      data-testid="conteneur-canvas"
      className="relative flex min-h-48 flex-1 flex-col overflow-hidden rounded-md border border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-900)]"
    >
      <canvas ref={canvasRef} aria-hidden="true" data-testid="canvas-combat" className="absolute inset-0 h-full w-full" />
      <MiroirCombat store={store} />
      <div className="absolute top-2 right-2">
        <InterrupteurPerformance store={store} onChange={(v) => (performanceRef.current = v)} />
      </div>
    </div>
  )
}
