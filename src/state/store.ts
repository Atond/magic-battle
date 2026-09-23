// Store pont React↔moteur (T-18, ADR-19). Zustand vanilla (`createStore`), tick hors React : le
// `setState` n'est appelé que lorsqu'un delta de frame produit vraiment un tick, jamais à chaque frame.
//
// Règle tenue ici : aucune formule de jeu. Tout calcul passe par `src/domain/moteur.ts` — ce fichier ne
// fait qu'orchestrer horloge, stockage, canal et planificateur autour de lui (EXG-1 à EXG-3, EXG-55).

import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'

import { PAS_TICK_MS, INTERVALLE_AUTOSAVE_MS } from '../domain/constantes-moteur.ts'
import { appliquerClic, appliquerDelta, calculHorsLigne, lancerSort } from '../domain/moteur.ts'
import { NOM_PRINCIPAL, exporterTexte, importerTexte, planifierImport } from '../domain/sauvegarde/index.ts'
import { revendiquer, renouveler, liberer } from '../domain/sauvegarde/verrou.ts'
import type { EtatVerrou } from '../domain/sauvegarde/verrou.ts'
import type { PlanEcrasement } from '../domain/sauvegarde/index.ts'
import { acheterNiveaux } from '../domain/ecoles/index.ts'
import { acheterAmelioration } from '../domain/ameliorations/index.ts'
import { acheterEquipement } from '../domain/equipement/index.ts'
import { acheterNoeudArbre } from '../domain/prestige/arbre.ts'
import type { EtatJeu, IdEcole, ResumeHorsLigne } from '../domain/types.ts'
import { CONSTANTES } from '../donnees/constantes.ts'
import {
  DELAI_EXPIRATION_VERROU_MS,
  INTERVALLE_BATTEMENT_VERROU_MS,
  PREFIXE_STOCKAGE,
} from './constantes.ts'
import { ETAPES_DEMARRAGE } from './demarrage.ts'
import type { EtapeDemarrage } from './demarrage.ts'
import type { Canal, Horloge, PortMatchMedia, PortPage, PortPlanificateur, Stockage } from './ports.ts'

/* ═══════════════════════════════════════════════════════════════════════ contrat de la fabrique */

/** Voir la doc de chaque port dans `ports.ts`. Aucun champ n'a de valeur par défaut câblée en dur. */
export interface OptionsStoreJeu {
  readonly horloge: Horloge
  readonly stockage: Stockage
  readonly canal: Canal
  readonly matchMedia: PortMatchMedia
  readonly idOnglet: string
  readonly portPage: PortPage
  readonly portPlanificateur: PortPlanificateur
  /** `etatInitial` du moteur (`src/domain/moteur.ts`), injecté pour rester substituable en test. */
  readonly etatInitial: (horodatageMs: number) => EtatJeu
  /** Test seam : observe l'ordre de démarrage réellement traversé (voir `demarrage.ts`). Jamais utilisé en production. */
  readonly onEtapeDemarrage?: (etape: EtapeDemarrage) => void
}

export interface ActionsStoreJeu {
  /** EXG-11 — clic du sort de clic. Sans effet si l'onglet n'a pas le droit d'écriture (EXG-48). */
  readonly clic: () => void
  /** EXG-12 — déclenche un sort actif par identifiant. Même garde que `clic`. */
  readonly lancerSort: (idSort: string) => void
  /** EXG-8 / EXG-9 — achète un niveau d'école (T-19). Refus silencieux : aucune formule ici, tout passe
   *  par `acheterNiveaux` (`src/domain/ecoles/index.ts`), l'UI n'affiche que le résultat. */
  readonly acheterEcole: (id: IdEcole) => void
  /** EXG-42 — achète un palier d'amélioration (or), même garde `droitEcriture`. */
  readonly acheterAmelioration: (id: string) => void
  /** EXG-43 — achète un palier d'équipement (Renommée), même garde `droitEcriture`. */
  readonly acheterEquipement: (id: string) => void
  /** EXG-39 — achète un rang de l'arbre d'Éclats, même garde `droitEcriture`. */
  readonly acheterNoeudEclats: (id: string) => void
}

export interface EtatStoreJeu {
  readonly etat: EtatJeu
  /** Vrai une fois la séquence de démarrage terminée (boucle et minuteries armées). */
  readonly pret: boolean
  /** EXG-48 — droit d'écriture de cet onglet, tel qu'établi par la dernière évaluation du verrou. */
  readonly droitEcriture: boolean
  /** Dernier résumé hors-ligne connu (démarrage ou rattrapage de frame géant), pour l'encart EXG-53. */
  readonly resumeHorsLigne: ResumeHorsLigne | null
  /** EXG-29/EXG-50 — dernière lecture de `prefers-reduced-motion` via le port `matchMedia`. */
  readonly reduitMouvement: boolean
  readonly actions: ActionsStoreJeu
}

export type StoreJeuApi = StoreApi<EtatStoreJeu> & {
  /** Arrête boucle, auto-sauvegarde et battement, et relâche le verrou si cet onglet le détenait. */
  readonly arreter: () => void
}

/* ═══════════════════════════════════════════════════════════════════════════ clés de stockage */

function cleStockage(nomLogique: string): string {
  return `${PREFIXE_STOCKAGE}${nomLogique}`
}

const CLE_VERROU = cleStockage('verrou')
const CLE_PRINCIPALE = cleStockage(NOM_PRINCIPAL)

/** Relit un verrou persisté : une valeur illisible ou incomplète vaut « absent », jamais une exception. */
function lireVerrou(brut: string | null): EtatVerrou | null {
  if (brut === null) return null
  try {
    const valeur: unknown = JSON.parse(brut)
    if (
      valeur !== null &&
      typeof valeur === 'object' &&
      typeof (valeur as { idProprietaire?: unknown }).idProprietaire === 'string' &&
      Number.isFinite((valeur as { dernierHeartbeatMs?: unknown }).dernierHeartbeatMs)
    ) {
      return valeur as EtatVerrou
    }
  } catch {
    // JSON invalide : verrou considéré absent, comme un stockage jamais écrit.
  }
  return null
}

/* ══════════════════════════════════════════════════════════════════════════════ fabrique */

/**
 * Fabrique injectable du store pont (spec T-18). Deux ports dédiés (`portPage`, `portPlanificateur`)
 * plutôt qu'un branchement global sur `window` : deux appels à `creerStoreJeu` avec des doubles distincts
 * ne partagent aucun minuteur ni aucun écouteur, exactement ce qu'exige l'isolation multi-onglet.
 */
export function creerStoreJeu(options: OptionsStoreJeu): StoreJeuApi {
  const {
    horloge,
    stockage,
    canal,
    matchMedia,
    idOnglet,
    portPage,
    portPlanificateur,
    etatInitial: etatInitialFn,
    onEtapeDemarrage,
  } = options

  function emettreEtape(etape: EtapeDemarrage): void {
    onEtapeDemarrage?.(etape)
  }

  function executerPlan(plan: PlanEcrasement): void {
    for (const ecriture of plan.ecritures) {
      if (ecriture.contenu === null) stockage.supprimer(cleStockage(ecriture.nom))
      else stockage.ecrire(cleStockage(ecriture.nom), ecriture.contenu)
    }
  }

  function sauvegarder(etat: EtatJeu, maintenantMs: number): void {
    const contenuCourant = stockage.lire(CLE_PRINCIPALE)
    const nouveauTexte = exporterTexte(etat, maintenantMs)
    executerPlan(planifierImport(contenuCourant, nouveauTexte, 'nouvellePartie'))
  }

  const store: StoreApi<EtatStoreJeu> = createStore<EtatStoreJeu>((set, get) => ({
    etat: etatInitialFn(horloge.maintenantMs()),
    pret: false,
    droitEcriture: false,
    resumeHorsLigne: null,
    reduitMouvement: false,
    actions: {
      clic: () => {
        if (!get().droitEcriture) return
        set({ etat: appliquerClic(get().etat, CONSTANTES) })
      },
      lancerSort: (idSort: string) => {
        if (!get().droitEcriture) return
        const resultat = lancerSort(get().etat, idSort, CONSTANTES)
        set({ etat: resultat.etat })
      },
      acheterEcole: (id: IdEcole) => {
        if (!get().droitEcriture) return
        set({ etat: acheterNiveaux(get().etat, id, 1, CONSTANTES).etat })
      },
      acheterAmelioration: (id: string) => {
        if (!get().droitEcriture) return
        set({ etat: acheterAmelioration(get().etat, id, CONSTANTES).etat })
      },
      acheterEquipement: (id: string) => {
        if (!get().droitEcriture) return
        set({ etat: acheterEquipement(get().etat, id, CONSTANTES).etat })
      },
      acheterNoeudEclats: (id: string) => {
        if (!get().droitEcriture) return
        set({ etat: acheterNoeudArbre(get().etat, id, 1, 'eclats', CONSTANTES).etat })
      },
    },
  }))

  /* ─────────────────────────────────────────────────────────── boucle (hors React, EXG-1 à EXG-3) */

  let idFrame: number | null = null
  let idAutoSauvegarde: number | null = null
  let idBattement: number | null = null
  let dernierHorodatageMs = horloge.maintenantMs()
  // Temps réel écoulé et pas encore soumis à `appliquerDelta` : distinct d'`etat.resteDeltaMs`, qui ne
  // se met à jour que dans l'état **persisté** (donc seulement quand `setState` a lieu). Sans cet
  // accumulateur, deux frames de 60 ms consécutives sans notification (aucune ne franchit 100 ms toute
  // seule) perdraient 60 ms à chaque fois au lieu de les cumuler jusqu'au tick suivant (EXG-2).
  let accumulNonTraiteMs = 0

  const seuilRattrapageMs = (): number => {
    const seuil = CONSTANTES.tick.nTicksMax
    return Number.isFinite(seuil) && seuil > 0 ? seuil * PAS_TICK_MS : 0
  }

  function traiterDelta(deltaMs: number, maintenantMs: number): void {
    accumulNonTraiteMs += deltaMs
    const etatCourant = store.getState().etat

    // EXG-55 — au-delà du seuil `nTicksMax × PAS_TICK_MS` de temps non traité, le rattrapage passe par
    // `calculHorsLigne` (onglet resté caché, veille système…), jamais par la forme fermée interne
    // d'`appliquerDelta`.
    if (accumulNonTraiteMs > seuilRattrapageMs()) {
      const { etat, resume } = calculHorsLigne(etatCourant, maintenantMs, CONSTANTES)
      // « la référence de frame est remise à zéro » : le temps non traité n'a plus de sens après un saut
      // hors-ligne, il repart de zéro pour la frame suivante — de même pour `etat.resteDeltaMs`.
      accumulNonTraiteMs = 0
      store.setState({ etat: { ...etat, resteDeltaMs: 0 }, resumeHorsLigne: resume })
      return
    }

    const nouvelEtat = appliquerDelta(etatCourant, accumulNonTraiteMs, CONSTANTES)
    // Aucun tick produit (temps non traité toujours sous 100 ms) : aucune notification, et
    // `accumulNonTraiteMs` reste tel quel pour continuer à grossir à la prochaine frame.
    if (nouvelEtat.ticksEcoules === etatCourant.ticksEcoules) return
    accumulNonTraiteMs = 0
    store.setState({ etat: nouvelEtat })
  }

  function boucle(): void {
    const maintenant = horloge.maintenantMs()
    const deltaMs = maintenant - dernierHorodatageMs
    dernierHorodatageMs = maintenant
    if (deltaMs > 0) traiterDelta(deltaMs, maintenant)
    idFrame = portPlanificateur.planifierFrame(boucle)
  }

  /* ────────────────────────────────────────────────────────────────────── verrou (EXG-48, minimal) */

  function publierVerrou(verrou: EtatVerrou | null): void {
    if (verrou === null) {
      stockage.supprimer(CLE_VERROU)
    } else {
      stockage.ecrire(CLE_VERROU, JSON.stringify(verrou))
    }
    canal.publier({ type: 'verrou', idOnglet, verrou })
  }

  function battreVerrou(): void {
    const maintenant = horloge.maintenantMs()
    const verrouLu = lireVerrou(stockage.lire(CLE_VERROU))
    const verdict = renouveler(verrouLu, idOnglet, maintenant, DELAI_EXPIRATION_VERROU_MS)
    if (verdict.droitEcriture !== store.getState().droitEcriture) {
      store.setState({ droitEcriture: verdict.droitEcriture })
    }
    // Référence inchangée ⇒ `renouveler` n'a rien à propager (EXG-48, aucune écriture inutile).
    if (verdict.verrou !== verrouLu) publierVerrou(verdict.verrou)
  }

  /* ────────────────────────────────────────────────────────────────────────── séquence de démarrage */

  function demarrer(): void {
    const maintenant = horloge.maintenantMs()

    // 1. verrou — revendication (ou confirmation) du droit d'écriture de cet onglet.
    const verdictVerrou = revendiquer(lireVerrou(stockage.lire(CLE_VERROU)), idOnglet, maintenant, DELAI_EXPIRATION_VERROU_MS)
    if (verdictVerrou.verrou !== null) publierVerrou(verdictVerrou.verrou)
    const proprietaire = verdictVerrou.droitEcriture
    emettreEtape('verrou')

    // 2. `importerTexte(principal)` — relecture seule, **sans** exécuter son plan (rien n'est écrit ici).
    let etat = etatInitialFn(maintenant)
    const texteBrut = stockage.lire(CLE_PRINCIPALE)
    if (texteBrut !== null) {
      const resultat = importerTexte(texteBrut, etat, CONSTANTES)
      if (resultat.ok) etat = resultat.etat
      // Un refus laisse `etat` à la valeur de nouvelle partie posée ci-dessus : l'écran d'erreur EXG-27
      // et la restauration `.bak` appartiennent à T-23a (persistance réelle).
    }
    emettreEtape('importerSauvegarde')

    // 3. `calculHorsLigne` — propriétaire du verrou seulement (EXG-4/EXG-5).
    let resumeHorsLigne: ResumeHorsLigne | null = null
    if (proprietaire) {
      const resultat = calculHorsLigne(etat, maintenant, CONSTANTES)
      etat = resultat.etat
      resumeHorsLigne = resultat.resume
    }
    emettreEtape('calculHorsLigne')

    // 4. sauvegarde immédiate — seul le propriétaire écrit (EXG-46 : passe par la mise à l'abri).
    if (proprietaire) sauvegarder(etat, maintenant)
    emettreEtape('sauvegardeImmediate')

    let reduitMouvement = false
    try {
      reduitMouvement = matchMedia.correspond('(prefers-reduced-motion: reduce)')
    } catch {
      // ADR-21 — un port `matchMedia` défaillant ne doit jamais empêcher le démarrage.
    }

    store.setState({ etat, pret: true, droitEcriture: proprietaire, resumeHorsLigne, reduitMouvement })

    // 5. boucle — pilotée par `portPlanificateur`, jamais par un minuteur global.
    dernierHorodatageMs = horloge.maintenantMs()
    idFrame = portPlanificateur.planifierFrame(boucle)
    emettreEtape('boucle')

    // 6. auto-sauvegarde (EXG-22) + battement du verrou (EXG-48).
    idAutoSauvegarde = portPlanificateur.planifierIntervalle(() => {
      sauvegarder(store.getState().etat, horloge.maintenantMs())
    }, INTERVALLE_AUTOSAVE_MS)
    idBattement = portPlanificateur.planifierIntervalle(battreVerrou, INTERVALLE_BATTEMENT_VERROU_MS)
    emettreEtape('autoSauvegardeEtBattement')
  }

  function arreter(): void {
    if (idFrame !== null) portPlanificateur.annulerFrame(idFrame)
    if (idAutoSauvegarde !== null) portPlanificateur.annulerIntervalle(idAutoSauvegarde)
    if (idBattement !== null) portPlanificateur.annulerIntervalle(idBattement)
    idFrame = null
    idAutoSauvegarde = null
    idBattement = null
    if (store.getState().droitEcriture) {
      const restant = liberer(lireVerrou(stockage.lire(CLE_VERROU)), idOnglet)
      publierVerrou(restant)
    }
    canal.fermer()
  }

  // `portPage` : sur fermeture propre, on relâche immédiatement plutôt que d'attendre l'expiration
  // (EXG-23/EXG-48). La suspension du tick sur `hidden` (EXG-55) et le rejeu complet au retour
  // (`pageshow`) sont la persistance réelle de T-23a — non exercés par la persistance factice de T-18.
  portPage.surPageHide(() => arreter())

  demarrer()

  return Object.assign(store, { arreter })
}

// Rappel du contrat traversé par `demarrer()`, pour que l'implémentation et sa documentation ne divergent
// jamais silencieusement (un test compare la trace observée à cette même constante).
export { ETAPES_DEMARRAGE }
export type { EtapeDemarrage }
