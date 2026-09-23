// Doubles de test en mémoire pour les ports de `src/state/ports.ts` (T-18). Jamais de `localStorage` ni
// de `BroadcastChannel` réels ici (ADR-20) : c'est tout l'intérêt de la fabrique injectable — la
// persistance réelle est branchée par T-23a sur ce même contrat.

import { DELAI_CONFIRMATION_VERROU_MS } from '../../src/state/constantes.ts'
import type { Canal, Horloge, PortMatchMedia, PortPage, PortPlanificateur, Stockage } from '../../src/state/ports.ts'

/** Horloge pilotable à la main : `maintenantMs()` renvoie la dernière valeur posée par `avancer`/`fixer`. */
export function creerHorlogeFactice(depart: number): Horloge & { avancer: (ms: number) => void; fixer: (ms: number) => void } {
  let maintenant = depart
  return {
    maintenantMs: () => maintenant,
    avancer: (ms: number) => {
      maintenant += ms
    },
    fixer: (ms: number) => {
      maintenant = ms
    },
  }
}

/** Stockage clé/valeur en mémoire (`Map`), jamais partagé entre deux appels de la fabrique sauf exprès. */
export function creerStockageFactice(): Stockage {
  const table = new Map<string, string>()
  return {
    lire: (cle: string) => table.get(cle) ?? null,
    ecrire: (cle: string, valeur: string) => {
      table.set(cle, valeur)
    },
    supprimer: (cle: string) => {
      table.delete(cle)
    },
  }
}

/** Canal en mémoire : sans effet inter-onglets réel, juste de quoi observer les publications en test. */
export function creerCanalFactice(): Canal & { messages: readonly unknown[] } {
  const gestionnaires = new Set<(message: unknown) => void>()
  const messages: unknown[] = []
  return {
    messages,
    publier: (message: unknown) => {
      messages.push(message)
      for (const gestionnaire of gestionnaires) gestionnaire(message)
    },
    recevoir: (gestionnaire: (message: unknown) => void) => {
      gestionnaires.add(gestionnaire)
      return () => gestionnaires.delete(gestionnaire)
    },
    fermer: () => gestionnaires.clear(),
  }
}

export function creerMatchMediaFactice(correspond = false): PortMatchMedia {
  return { correspond: () => correspond }
}

/** `portPage` factice : chaque `surX` garde son gestionnaire, `declencherX()` le rappelle à la demande. */
export function creerPortPageFactice(): PortPage & {
  declencherVisibiliteChangee: () => void
  declencherPageHide: () => void
  declencherPageShow: () => void
} {
  let visible = true
  const surVisibilite = new Set<() => void>()
  const surPageHide = new Set<() => void>()
  const surPageShow = new Set<() => void>()
  const surAvantDechargement = new Set<() => void>()
  return {
    estVisible: () => visible,
    surVisibiliteChangee: (g) => {
      surVisibilite.add(g)
      return () => surVisibilite.delete(g)
    },
    surPageHide: (g) => {
      surPageHide.add(g)
      return () => surPageHide.delete(g)
    },
    surPageShow: (g) => {
      surPageShow.add(g)
      return () => surPageShow.delete(g)
    },
    surAvantDechargement: (g) => {
      surAvantDechargement.add(g)
      return () => surAvantDechargement.delete(g)
    },
    declencherVisibiliteChangee: () => {
      visible = !visible
      for (const g of surVisibilite) g()
    },
    declencherPageHide: () => {
      for (const g of surPageHide) g()
    },
    declencherPageShow: () => {
      for (const g of surPageShow) g()
    },
  }
}

/**
 * `portPlanificateur` factice : les frames et intervalles ne se déclenchent **jamais tout seuls** — le
 * test appelle `declencherFrame()`/`declencherIntervalle(id)` explicitement. C'est ce qui rend les tests
 * de rattrapage (delta de 5 s, delta hors seuil…) déterministes et instantanés.
 */
export function creerPortPlanificateurFactice(): PortPlanificateur & {
  readonly framesEnAttente: number
  declencherFrame: () => void
  declencherIntervalle: (id: number) => void
  /** Déclenche une fois chaque intervalle actif planifié avec exactement `delaiMs`. */
  declencherIntervallesDe: (delaiMs: number) => void
  idsIntervalleActifs: () => readonly number[]
} {
  let prochainId = 1
  const frames = new Map<number, (horodatageMs: number) => void>()
  const intervalles = new Map<number, { callback: () => void; delaiMs: number }>()
  return {
    get framesEnAttente() {
      return frames.size
    },
    planifierFrame: (callback) => {
      const id = prochainId++
      frames.set(id, callback)
      return id
    },
    annulerFrame: (id) => {
      frames.delete(id)
    },
    planifierIntervalle: (callback, delaiMs) => {
      const id = prochainId++
      intervalles.set(id, { callback, delaiMs })
      return id
    },
    annulerIntervalle: (id) => {
      intervalles.delete(id)
    },
    declencherFrame: () => {
      // Une frame rAF n'est rappelée qu'une fois : on prend un instantané avant d'exécuter, sinon la
      // ré-inscription faite par `boucle()` pendant l'itération se retrouverait exécutée dans le même tour.
      const enCours = [...frames.entries()]
      frames.clear()
      for (const [, callback] of enCours) callback(0)
    },
    declencherIntervalle: (id) => {
      intervalles.get(id)?.callback()
    },
    declencherIntervallesDe: (delaiMs) => {
      const cibles = [...intervalles.values()].filter((i) => i.delaiMs === delaiMs)
      for (const intervalle of cibles) intervalle.callback()
    },
    idsIntervalleActifs: () => [...intervalles.keys()],
  }
}

/**
 * T-23a — le démarrage n'est plus synchrone : le verrou n'est tenu qu'après l'attente « écrire-puis-
 * relire » (`DELAI_CONFIRMATION_VERROU_MS`). Les tests qui ne portent pas sur le verrou la franchissent
 * avec cette seule ligne, sans horloge réelle.
 */
export function confirmerDemarrage(planificateur: { declencherIntervallesDe: (delaiMs: number) => void }): void {
  planificateur.declencherIntervallesDe(DELAI_CONFIRMATION_VERROU_MS)
}
