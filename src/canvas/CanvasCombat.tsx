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

import { formater } from '../domain/notation.ts'
import type { Boss, Monstre } from '../domain/types.ts'
import { SORTS } from '../donnees/sorts.ts'
import { TEXTES_UI } from '../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../state/store.ts'
import { useStoreJeu } from '../state/hooks.ts'
import { nomCibleCourante } from '../state/contenu.ts'
import { demanderEffets, extraireInstantane } from './deltas.ts'
import type { InstantaneCombat, SortParEcole } from './deltas.ts'
import { dessinerScene } from './dessin.ts'
import { InterrupteurPerformance } from './InterrupteurPerformance.tsx'
import { resoudrePerformance } from './reglages.ts'
import { ajouterProjectiles, purgerExpires } from './tampon.ts'
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
  // Vague 3 — nom de contenu (région, vague, boss/gardien/boss final), jamais le `nom` de l'état :
  // le moteur le laisse vide et une sauvegarde importée pourrait y mettre n'importe quoi.
  const nom = useStoreJeu(store, (s) => nomCibleCourante(s.etat))
  const boss = estBoss(cible)

  const [annonce, setAnnonce] = useState('')
  const precedentMonstresTuesRef = useRef(monstresTues)
  const precedentBossRef = useRef(boss)
  // Le monstre vaincu est celui qui était affiché **avant** ce rendu : au moment où `monstresTues`
  // augmente, la cible est déjà la suivante.
  const nomPrecedentRef = useRef(nom)

  useEffect(() => {
    if (monstresTues > precedentMonstresTuesRef.current) {
      setAnnonce(TEXTES_UI.combat.monstreVaincu(nomPrecedentRef.current))
    }
    precedentMonstresTuesRef.current = monstresTues
  }, [monstresTues])

  useEffect(() => {
    if (boss && !precedentBossRef.current) {
      setAnnonce(TEXTES_UI.combat.bossEnApproche(nom))
    }
    precedentBossRef.current = boss
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss])

  // Déclaré en dernier : les deux effets ci-dessus lisent encore le nom du rendu précédent.
  useEffect(() => {
    nomPrecedentRef.current = nom
  }, [nom])

  // Fond opaque derrière le texte (plutôt qu'une simple ombre portée) : le contenu réel derrière ce
  // miroir est un `<canvas>` dessiné, dont axe-core ne peut jamais garantir la couleur de fond au moment
  // de l'audit — un badge à fond plein rend le contraste effectivement mesurable (AA), pas seulement
  // visuellement plausible.
  const badge =
    'rounded bg-[var(--couleur-charbon-900)] px-1.5 py-0.5 text-[var(--couleur-charbon-texte)]'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 p-2 text-xs font-medium">
      {nom !== '' && (
        <span data-testid="nom-cible" className={badge}>
          {nom}
        </span>
      )}
      <span data-testid="pv-cible" className={badge}>
        {cible === null
          ? TEXTES_UI.combat.aucuneCible
          : TEXTES_UI.combat.pv(formater(Math.ceil(cible.pvCourants)), formater(cible.pvMax))}
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
  // Canvas 2D n'interprète jamais `var(--x)` : `ctx.fillStyle = 'var(--couleur-ecole-feu)'` est
  // silencieusement ignoré et le projectile hérite de la dernière couleur valide posée sur le contexte
  // (bug réel observé : les projectiles de feu prenaient la couleur du sort précédent). On résout donc
  // chaque jeton `var(--x)` en couleur réelle via `getComputedStyle`, en cache pour éviter de le refaire
  // à chaque frame — le cache est vidé au montage et à chaque changement de thème (`.dark` sur `<html>`).
  const couleursResoluesRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const canvas = canvasRef.current
    const conteneur = conteneurRef.current
    if (canvas === null || conteneur === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    function resoudreCouleur(brute: string): string {
      const correspondance = /^var\((--[\w-]+)\)$/.exec(brute)
      if (correspondance === null) return brute
      const cache = couleursResoluesRef.current
      const enCache = cache.get(brute)
      if (enCache !== undefined) return enCache
      const valeur = getComputedStyle(document.documentElement).getPropertyValue(correspondance[1]!).trim()
      const resolue = valeur !== '' ? valeur : brute
      cache.set(brute, resolue)
      return resolue
    }

    // Un changement de thème (`.dark` posé/retiré sur `<html>`) change les valeurs réelles derrière les
    // mêmes jetons : le cache doit être vidé, pas seulement rempli une fois au montage.
    const observateurTheme = new MutationObserver(() => couleursResoluesRef.current.clear())
    observateurTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

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
      const maintenantMs = performance.now()

      if (precedentRef.current !== null && !performanceRef.current) {
        const demandes = demanderEffets(precedentRef.current, instantane, SORTS_PAR_ECOLE, COULEUR_CLIC, COULEUR_IMPACT)
        if (demandes.length > 0) {
          const demandesResolues = demandes.map((demande) => ({ ...demande, couleur: resoudreCouleur(demande.couleur) }))
          const resultat = ajouterProjectiles(tamponRef.current, demandesResolues, prochainIdRef.current, maintenantMs)
          tamponRef.current = resultat.tampon
          prochainIdRef.current = resultat.prochainId
        } else {
          // Aucune nouvelle demande cette frame : purger quand même les expirés, sinon un tampon peu
          // renouvelé garde des cercles figés à l'écran jusqu'au prochain clic/sort.
          tamponRef.current = purgerExpires(tamponRef.current, maintenantMs)
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
      observateurTheme.disconnect()
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
