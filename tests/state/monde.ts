// Monde simulé pour les tests de persistance multi-onglet (T-23a). Un seul temps, un seul stockage et un
// seul réseau de canaux **partagés** ; chaque onglet a ses propres ports `page` et `planificateur`
// (spec T-18 N5) — exactement la situation de deux onglets d'un même navigateur.
//
// Pourquoi un double de plus que `doubles.ts` : les critères de T-23a sont **temporels** (« 0 écriture à
// 29,9 s, 1 à 31 s », « figé jusqu'à expiration − 1 ms »). Ici, `avancer(ms)` fait passer le temps et
// déclenche chaque intervalle à son échéance exacte, dans l'ordre chronologique, tous onglets confondus,
// en livrant les messages du canal entre deux rappels. Les frames (`requestAnimationFrame`) restent
// manuelles (`frame()`) : 20 h de frames à 16 ms seraient 4,5 millions de rappels pour ne rien prouver.
//
// Le stockage est un **espion** : il journalise chaque `ecrire`/`supprimer` avec l'horodatage simulé, ce
// qui permet de compter les écritures d'une clé précise à partir d'un instant (N7) sans que le code
// surveillé ait à s'attribuer lui-même un compteur (LRN-002).

import { etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import type { StoreJeuApi } from '../../src/state/store.ts'
import type { Canal, Horloge, PortPage, PortPlanificateur, Stockage } from '../../src/state/ports.ts'
import type { EtapeDemarrage } from '../../src/state/demarrage.ts'

export interface OperationStockage {
  /** Onglet dont le store a fait l'opération (`null` : préparation directe par le test). */
  readonly onglet: string | null
  readonly op: 'ecrire' | 'supprimer'
  readonly cle: string
  readonly valeur: string | null
  readonly instantMs: number
}

export interface StockageEspion extends Stockage {
  readonly journal: readonly OperationStockage[]
  /** Instantané brut (clé → valeur) : sert aux comparaisons « octet pour octet ». */
  instantane(): ReadonlyMap<string, string>
  /** Pose une valeur **sans** la journaliser : préparation d'un test, pas une écriture du code testé. */
  poser(cle: string, valeur: string | null): void
  /** Nombre d'`ecrire` sur `cle` depuis l'index `depuis` du journal, éventuellement pour un seul onglet. */
  compterEcritures(cle: string, depuis?: number, onglet?: string): number
  /** Vue attribuée à un onglet : même table, mais chaque opération est journalisée à son nom. */
  vue(onglet: string): Stockage
}

export function creerStockageEspion(horloge: Horloge): StockageEspion {
  const table = new Map<string, string>()
  const journal: OperationStockage[] = []
  const vue = (onglet: string | null): Stockage => ({
    lire: (cle) => table.get(cle) ?? null,
    ecrire: (cle, valeur) => {
      journal.push({ onglet, op: 'ecrire', cle, valeur, instantMs: horloge.maintenantMs() })
      table.set(cle, valeur)
    },
    supprimer: (cle) => {
      journal.push({ onglet, op: 'supprimer', cle, valeur: null, instantMs: horloge.maintenantMs() })
      table.delete(cle)
    },
  })
  return {
    ...vue(null),
    journal,
    vue,
    instantane: () => new Map(table),
    poser: (cle, valeur) => {
      if (valeur === null) table.delete(cle)
      else table.set(cle, valeur)
    },
    compterEcritures: (cle, depuis = 0, onglet) =>
      journal
        .slice(depuis)
        .filter((o) => o.op === 'ecrire' && o.cle === cle && (onglet === undefined || o.onglet === onglet)).length,
  }
}

interface Intervalle {
  readonly id: number
  readonly callback: () => void
  readonly delaiMs: number
  prochainMs: number
}

export interface PortPageSimule extends PortPage {
  cacher(): void
  montrer(): void
  pagehide(): void
  pageshow(): void
  avantDechargement(): void
}

export interface Onglet {
  readonly id: string
  readonly page: PortPageSimule
  readonly planificateur: PortPlanificateur & { readonly framesEnAttente: number }
  readonly canal: Canal
  readonly etapes: EtapeDemarrage[]
  store: StoreJeuApi
  /** Simule un onglet tué (crash, processus gelé) : plus aucun rappel, plus aucun message, sans `pagehide`. */
  tuer(): void
  /** Veille système : plus aucun rappel ni message, jusqu'à `reveiller()`. */
  endormir(): void
  /** Fin de veille : chaque intervalle en retard part **une** fois (comme `setInterval` réel), pas N. */
  reveiller(): void
}

export interface Monde {
  readonly horloge: Horloge
  readonly stockage: StockageEspion
  readonly T0: number
  maintenant(): number
  /** Ouvre un onglet et lance sa fabrique (démarrage **non** confirmé : il faut `avancer`). */
  ouvrir(id: string, etatInitialFn?: (horodatageMs: number) => EtatJeu): Onglet
  /** Fait passer `ms` de temps simulé en déclenchant chaque échéance à son instant exact. */
  avancer(ms: number): void
  /** Avance jusqu'à l'instant absolu `instantMs`. */
  avancerJusqua(instantMs: number): void
  /** Livre les messages de canal en attente (sans faire passer le temps). */
  livrer(): void
  /** Publie un message sur le canal depuis une source qui n'est aucun onglet (message forgé). */
  publierBrut(message: unknown): void
  /** Une frame d'affichage pour tous les onglets vivants, à l'instant courant. */
  frame(): void
}

export function creerMonde(T0 = 1_700_000_000_000): Monde {
  let maintenant = T0
  const horloge: Horloge = { maintenantMs: () => maintenant }
  const stockage = creerStockageEspion(horloge)

  let prochainId = 1
  const planificateurs: {
    vivant: () => boolean
    intervalles: Map<number, Intervalle>
    frames: Map<number, (t: number) => void>
  }[] = []

  const canaux: { ouvert: boolean; vivant: () => boolean; gestionnaires: Set<(m: unknown) => void> }[] = []
  const fileMessages: { source: (typeof canaux)[number]; message: unknown }[] = []
  const sourceBrute: (typeof canaux)[number] = { ouvert: true, vivant: () => true, gestionnaires: new Set() }

  function livrer(): void {
    // Un message peut en provoquer d'autres : on vide la file jusqu'au point fixe (borne de sûreté).
    for (let garde = 0; fileMessages.length > 0 && garde < 10_000; garde += 1) {
      const { source, message } = fileMessages.shift()!
      // Comme `BroadcastChannel` : jamais livré à l'instance qui publie, seulement aux autres.
      for (const canal of canaux) {
        if (canal === source || !canal.ouvert || !canal.vivant()) continue
        // Copie voulue : un gestionnaire peut se désabonner pendant la diffusion.
        // oxlint-disable-next-line unicorn/no-useless-spread
        for (const g of [...canal.gestionnaires]) g(structuredClone(message))
      }
    }
  }

  function prochaineEcheance(limiteMs: number): { intervalle: Intervalle } | null {
    let meilleur: Intervalle | null = null
    for (const p of planificateurs) {
      if (!p.vivant()) continue
      for (const i of p.intervalles.values()) {
        if (i.prochainMs <= limiteMs && (meilleur === null || i.prochainMs < meilleur.prochainMs)) meilleur = i
      }
    }
    return meilleur === null ? null : { intervalle: meilleur }
  }

  function avancerJusqua(cibleMs: number): void {
    livrer()
    for (;;) {
      const suivante = prochaineEcheance(cibleMs)
      if (suivante === null) break
      const { intervalle } = suivante
      maintenant = Math.max(maintenant, intervalle.prochainMs)
      intervalle.prochainMs += intervalle.delaiMs
      intervalle.callback()
      livrer()
    }
    maintenant = Math.max(maintenant, cibleMs)
    livrer()
  }

  function ouvrir(id: string, etatInitialFn: (horodatageMs: number) => EtatJeu = etatInitial): Onglet {
    let vivant = true
    const estVivant = () => vivant

    const intervalles = new Map<number, Intervalle>()
    const frames = new Map<number, (t: number) => void>()
    planificateurs.push({ vivant: estVivant, intervalles, frames })
    const planificateur: PortPlanificateur & { readonly framesEnAttente: number } = {
      get framesEnAttente() {
        return frames.size
      },
      planifierFrame: (callback) => {
        const idFrame = prochainId++
        frames.set(idFrame, callback)
        return idFrame
      },
      annulerFrame: (idFrame) => {
        frames.delete(idFrame)
      },
      planifierIntervalle: (callback, delaiMs) => {
        const idIntervalle = prochainId++
        intervalles.set(idIntervalle, { id: idIntervalle, callback, delaiMs, prochainMs: maintenant + delaiMs })
        return idIntervalle
      },
      annulerIntervalle: (idIntervalle) => {
        intervalles.delete(idIntervalle)
      },
    }

    const etatCanal = { ouvert: true, vivant: estVivant, gestionnaires: new Set<(m: unknown) => void>() }
    canaux.push(etatCanal)
    const canal: Canal = {
      publier: (message) => {
        if (!etatCanal.ouvert) throw new Error('canal fermé')
        if (vivant) fileMessages.push({ source: etatCanal, message: structuredClone(message) })
      },
      recevoir: (g) => {
        etatCanal.gestionnaires.add(g)
        return () => etatCanal.gestionnaires.delete(g)
      },
      fermer: () => {
        etatCanal.ouvert = false
        etatCanal.gestionnaires.clear()
      },
    }

    let visible = true
    const ecouteurs = {
      visibilite: new Set<() => void>(),
      pagehide: new Set<() => void>(),
      pageshow: new Set<() => void>(),
      avant: new Set<() => void>(),
    }
    const abonner = (ensemble: Set<() => void>) => (g: () => void) => {
      ensemble.add(g)
      return () => ensemble.delete(g)
    }
    const emettre = (ensemble: Set<() => void>) => {
      // Copie voulue : un gestionnaire peut se désabonner pendant l'émission.
      // oxlint-disable-next-line unicorn/no-useless-spread
      for (const g of [...ensemble]) g()
    }
    const page: PortPageSimule = {
      estVisible: () => visible,
      surVisibiliteChangee: abonner(ecouteurs.visibilite),
      surPageHide: abonner(ecouteurs.pagehide),
      surPageShow: abonner(ecouteurs.pageshow),
      surAvantDechargement: abonner(ecouteurs.avant),
      cacher: () => {
        visible = false
        emettre(ecouteurs.visibilite)
      },
      montrer: () => {
        visible = true
        emettre(ecouteurs.visibilite)
      },
      pagehide: () => emettre(ecouteurs.pagehide),
      pageshow: () => emettre(ecouteurs.pageshow),
      avantDechargement: () => emettre(ecouteurs.avant),
    }

    const etapes: EtapeDemarrage[] = []
    const onglet: Onglet = {
      id,
      page,
      planificateur,
      canal,
      etapes,
      store: undefined as unknown as StoreJeuApi,
      tuer: () => {
        vivant = false
      },
      endormir: () => {
        vivant = false
      },
      reveiller: () => {
        vivant = true
        for (const i of intervalles.values()) if (i.prochainMs < maintenant) i.prochainMs = maintenant
      },
    }
    onglet.store = creerStoreJeu({
      horloge,
      stockage: stockage.vue(id),
      canal,
      matchMedia: { correspond: () => false },
      idOnglet: id,
      portPage: page,
      portPlanificateur: planificateur,
      etatInitial: etatInitialFn,
      onEtapeDemarrage: (etape) => etapes.push(etape),
    })
    return onglet
  }

  return {
    horloge,
    stockage,
    T0,
    maintenant: () => maintenant,
    ouvrir,
    avancer: (ms) => avancerJusqua(maintenant + ms),
    avancerJusqua,
    livrer,
    publierBrut: (message) => {
      fileMessages.push({ source: sourceBrute, message: structuredClone(message) })
    },
    frame: () => {
      for (const p of planificateurs) {
        if (!p.vivant()) continue
        const enCours = [...p.frames.entries()]
        p.frames.clear()
        for (const [, callback] of enCours) callback(maintenant)
      }
      livrer()
    },
  }
}
