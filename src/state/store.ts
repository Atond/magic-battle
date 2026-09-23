// Store pont React↔moteur (T-18, ADR-19) et persistance réelle (T-23a). Zustand vanilla (`createStore`),
// tick hors React : le `setState` n'est appelé que lorsqu'un delta de frame produit vraiment un tick,
// jamais à chaque frame.
//
// Règle tenue ici : aucune formule de jeu, aucune règle de sauvegarde ou de verrou redéfinie. Tout
// calcul passe par `src/domain/moteur.ts` ; l'import, la mise à l'abri et la restauration par
// `src/domain/sauvegarde/index.ts` (plans exécutés **dans l'ordre du tableau**) ; qui a le droit d'écrire
// par `src/domain/sauvegarde/verrou.ts`. Ce fichier ne fait qu'orchestrer horloge, stockage, canal,
// page et planificateur autour d'eux.
//
// ── Cycle de vie d'un onglet (T-23a) ─────────────────────────────────────────────────────────────
//   confirmation ─┬─► actif ◄──────────────┐        (propriétaire, boucle + auto-sauvegarde + battement)
//                 ├─► illisible ──(action)─┘        (propriétaire, principal illisible : RIEN n'est écrit)
//                 └─► secondaire ──(libération / expiration)──► confirmation   (lecture seule, figé)
//   actif ──(perte du verrou détectée)──► secondaire   (gel immédiat, sans `calculHorsLigne`)
//   * ──(pagehide)──► arrete ──(pageshow)──► confirmation
// Toute entrée en `confirmation` est `demarrer()` : le démarrage complet, rejoué depuis le stockage —
// jamais depuis l'état en mémoire (EXG-48, N3). Le 1er démarrage n'a aucun chemin particulier.
//
// ── Le canal n'est qu'un indice ──────────────────────────────────────────────────────────────────
// Un message reçu ne décide jamais rien : il déclenche une **relecture du stockage**, et c'est le verrou
// relu, passé à la politique du domaine, qui tranche. Un message forgé (même origine, autre dépôt) ne
// peut donc ni donner ni retirer le droit d'écrire.

import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'

import { INTERVALLE_AUTOSAVE_MS } from '../domain/constantes-moteur.ts'
import { appliquerClic, appliquerDelta, calculHorsLigne, lancerSort } from '../domain/moteur.ts'
import {
  NOM_PRINCIPAL,
  NOM_SECOURS,
  exporterTexte,
  importerTexte,
  planifierImport,
  restaurerSecours,
} from '../domain/sauvegarde/index.ts'
import type { ErreurImport, MotifRefusImport, PlanEcrasement } from '../domain/sauvegarde/index.ts'
import { evaluerDroitEcriture, liberer, renouveler, revendiquer } from '../domain/sauvegarde/verrou.ts'
import type { EtatVerrou } from '../domain/sauvegarde/verrou.ts'
import { acheterNiveaux } from '../domain/ecoles/index.ts'
import { acheterAmelioration } from '../domain/ameliorations/index.ts'
import { acheterEquipement } from '../domain/equipement/index.ts'
import { acheterNoeudArbre } from '../domain/prestige/arbre.ts'
import { prestiger, sommeBornee } from '../domain/prestige/index.ts'
import { ascensionner } from '../domain/ascension/index.ts'
import type { EtatJeu, IdEcole, ResumeHorsLigne } from '../domain/types.ts'
import { CONSTANTES } from '../donnees/constantes.ts'
import {
  DELAI_CONFIRMATION_VERROU_MS,
  DELAI_EXPIRATION_VERROU_MS,
  INTERVALLE_BATTEMENT_VERROU_MS,
  NOM_VERROU,
  PREFIXE_STOCKAGE,
  seuilRattrapageMs,
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

/**
 * Issue d'une action de sauvegarde (`importer`, `restaurerSecours`, `nouvellePartie`). `sansDroit` :
 * l'onglet n'est pas propriétaire du verrou (ou vient de le perdre) — rien n'a été écrit. `refuse` : le
 * domaine a rejeté la charge — rien n'a été écrit non plus, l'état courant est intact.
 */
export type ResultatActionSauvegarde =
  | { readonly ok: true }
  | { readonly ok: false; readonly motif: 'sansDroit' }
  | { readonly ok: false; readonly motif: 'refuse'; readonly erreur: ErreurImport }

export interface ActionsStoreJeu {
  /** EXG-11 — clic du sort de clic. Sans effet si l'onglet ne joue pas (secondaire, illisible, EXG-48). */
  readonly clic: () => void
  /** EXG-12 — déclenche un sort actif par identifiant. Même garde que `clic`. */
  readonly lancerSort: (idSort: string) => void
  /** EXG-8 / EXG-9 — achète un niveau d'école (T-19). Refus silencieux : aucune formule ici, tout passe
   *  par `acheterNiveaux` (`src/domain/ecoles/index.ts`), l'UI n'affiche que le résultat. */
  readonly acheterEcole: (id: IdEcole) => void
  /** EXG-42 — achète un palier d'amélioration (or), même garde. */
  readonly acheterAmelioration: (id: string) => void
  /** EXG-43 — achète un palier d'équipement (Renommée), même garde. */
  readonly acheterEquipement: (id: string) => void
  /** EXG-39 — achète un rang de l'arbre d'Éclats, même garde. */
  readonly acheterNoeudEclats: (id: string) => void
  /**
   * EXG-19 / EXG-21 — étape 2 du prestige : applique `prestiger` (`src/domain/prestige/index.ts`). Même
   * garde que `clic` (aucun effet hors mode `actif`, donc pas en lecture seule).
   *
   * `gainFige` — le gain affiché à l'ouverture de l'étape de confirmation (spec T-23b : « gain affiché
   * au clic, pas recalculé pendant que la modale est ouverte »). Le domaine, lui, recalcule toujours le
   * gain au moment de `prestiger` à partir de l'état **courant** (il n'a aucune notion de modale ni de
   * gel d'affichage — ce n'est pas sa responsabilité). Si des ticks ont fait progresser `zoneMaxDuRun`
   * pendant que la modale était ouverte, le gain réel peut donc différer du gain figé affiché : cette
   * action corrige l'écart après coup (Éclats du cycle, Éclats à vie) pour que le joueur reçoive
   * exactement ce qui lui a été montré, sans toucher au domaine.
   */
  readonly prestige: (gainFige: number) => void
  /** EXG-20 / EXG-21 — étape 2 de l'Ascension : applique `ascensionner`, même garde et même correction
   *  d'écart que `prestige` (Points d'Ascension). */
  readonly ascensionner: (gainFige: number) => void
  /**
   * EXG-24 / EXG-46 — importe un texte d'export (sans UI : T-28 branchera le champ). Import confirmé ⇒
   * l'état courant part dans `.bak` (sauf principal illisible : aucune copie, EXG-46), puis le principal
   * est remplacé. `derniereSauvegardeMs = maintenant` : un import ne crédite **aucun** hors-ligne (N10).
   */
  readonly importer: (texte: string) => ResultatActionSauvegarde
  /** EXG-46 — la copie de secours redevient la partie active. Aucun crédit hors-ligne. */
  readonly restaurerSecours: () => ResultatActionSauvegarde
  /**
   * EXG-27 / EXG-46 — nouvelle partie confirmée. Principal lisible ⇒ mis à l'abri dans `.bak` ; principal
   * illisible ⇒ `contenuCourant: null`, aucune copie : un `.bak` valide n'est jamais écrasé.
   */
  readonly nouvellePartie: () => ResultatActionSauvegarde
}

/** EXG-48 — pourquoi l'onglet est en lecture seule (bandeau de T-23b). */
export type MotifLectureSeule =
  /** Un autre onglet détient le verrou et bat encore. */
  | 'ongletSecondaire'
  /** Cet onglet écrivait, et a constaté qu'un autre a pris la main (veille, onglet gelé…). */
  | 'verrouPerdu'

/** EXG-27 — le principal n'a pas pu être relu : écran d'erreur de T-23b, rien n'est écrit en attendant. */
export interface SauvegardeIllisible {
  readonly motif: MotifRefusImport
  /** Message du domaine, en français, sans la valeur brute (`ErreurImport.message`). Texte, jamais HTML. */
  readonly message: string
  /** EXG-46 — « restaurer » n'est proposé que si `restaurerSecours` réussit sur le `.bak` actuel. */
  readonly secoursRestaurable: boolean
}

export interface EtatStoreJeu {
  readonly etat: EtatJeu
  /** Vrai une fois un premier démarrage résolu (propriétaire, secondaire ou illisible). */
  readonly pret: boolean
  /** EXG-48 — cet onglet détient le verrou (actif ou illisible). */
  readonly droitEcriture: boolean
  /** EXG-48 — onglet figé : pas de tick, pas de canvas, actions sans effet. */
  readonly lectureSeule: boolean
  readonly motifLectureSeule: MotifLectureSeule | null
  /** EXG-27 — non nul tant que le joueur n'a pas choisi (nouvelle partie, restaurer, importer). */
  readonly sauvegardeIllisible: SauvegardeIllisible | null
  /** Dernier résumé hors-ligne connu (démarrage ou rattrapage de frame géant), pour l'encart EXG-53. */
  readonly resumeHorsLigne: ResumeHorsLigne | null
  /** EXG-29/EXG-50 — dernière lecture de `prefers-reduced-motion` via le port `matchMedia`. */
  readonly reduitMouvement: boolean
  /**
   * T-27 — la partie en cours vient de naître dans cet onglet (aucune sauvegarde au démarrage, ou
   * « nouvelle partie » confirmée) : l'encart d'intro s'affiche. Jamais persisté : au rechargement, la
   * sauvegarde existe déjà, l'intro ne revient pas.
   */
  readonly partieNeuve: boolean
  /**
   * La dernière écriture de la sauvegarde principale a échoué (quota plein, stockage refusé) : la
   * progression n'est plus sauvegardée. Repasse à `false` à la première écriture réussie.
   */
  readonly stockagePlein: boolean
  readonly actions: ActionsStoreJeu
}

export type StoreJeuApi = StoreApi<EtatStoreJeu> & {
  /** Arrête tout (boucle, minuteries, écouteurs, canal) et relâche le verrou si cet onglet le détenait. */
  readonly arreter: () => void
  /**
   * Ports bruts, exposés pour un usage strictement hors moteur (T-21, `src/canvas/reglages.ts` :
   * réglage `performance`, clé `magic-battle:reglages`, hors sauvegarde, ADR-21). Ne jamais s'en servir
   * pour de l'état de JEU — ça, c'est `actions` et les sélecteurs Zustand ; ceci ne fait que réutiliser
   * la même instance de port que `creerStoreJeu` (pas de second `localStorage`/`matchMedia` câblé en
   * parallèle).
   */
  readonly stockage: Stockage
  readonly matchMedia: PortMatchMedia
}

/* ═══════════════════════════════════════════════════════════════════════════ clés et messages */

function cleStockage(nomLogique: string): string {
  return `${PREFIXE_STOCKAGE}${nomLogique}`
}

const CLE_VERROU = cleStockage(NOM_VERROU)
const CLE_PRINCIPALE = cleStockage(NOM_PRINCIPAL)
const CLE_SECOURS = cleStockage(NOM_SECOURS)

/** Relit un verrou persisté : une valeur illisible ou incomplète vaut « absent », jamais une exception. */
function lireVerrou(brut: string | null): EtatVerrou | null {
  if (brut === null) return null
  try {
    const valeur: unknown = JSON.parse(brut)
    if (valeur === null || typeof valeur !== 'object') return null
    const idProprietaire = (valeur as { idProprietaire?: unknown }).idProprietaire
    const dernierHeartbeatMs = (valeur as { dernierHeartbeatMs?: unknown }).dernierHeartbeatMs
    if (typeof idProprietaire !== 'string' || typeof dernierHeartbeatMs !== 'number') return null
    // Reconstruit champ par champ : rien de l'objet lu n'est étalé ni conservé par référence.
    return { idProprietaire, dernierHeartbeatMs }
  } catch {
    return null
  }
}

/** Messages du canal : de simples indices (voir l'en-tête), jamais une décision. */
type MessageVerrou =
  | { readonly type: 'revendication'; readonly idOnglet: string }
  | { readonly type: 'liberation'; readonly idOnglet: string }

function lireMessage(message: unknown): MessageVerrou | null {
  if (message === null || typeof message !== 'object') return null
  const type = (message as { type?: unknown }).type
  const idOnglet = (message as { idOnglet?: unknown }).idOnglet
  if (typeof idOnglet !== 'string') return null
  if (type === 'revendication' || type === 'liberation') return { type, idOnglet }
  return null
}

type Mode = 'confirmation' | 'actif' | 'illisible' | 'secondaire' | 'arrete'

/* ══════════════════════════════════════════════════════════════════════════════ fabrique */

/**
 * Fabrique injectable du store pont (spec T-18). Deux ports dédiés (`portPage`, `portPlanificateur`)
 * plutôt qu'un branchement global sur `window` : deux appels à `creerStoreJeu` avec des doubles distincts
 * ne partagent aucun minuteur ni aucun écouteur, exactement ce qu'exige l'isolation multi-onglet.
 *
 * Le démarrage n'est **pas** synchrone : le verrou n'est tenu pour acquis qu'après la relecture de
 * `DELAI_CONFIRMATION_VERROU_MS` (écrire-puis-relire). `pret` reste faux jusque-là.
 */
export function creerStoreJeu(options: OptionsStoreJeu): StoreJeuApi {
  const {
    horloge,
    stockage: stockageBrut,
    canal,
    matchMedia,
    idOnglet,
    portPage,
    portPlanificateur,
    etatInitial: etatInitialFn,
    onEtapeDemarrage,
  } = options

  let mode: Mode = 'confirmation'
  let idFrame: number | null = null
  let idAutoSauvegarde: number | null = null
  let idBattement: number | null = null
  let idConfirmation: number | null = null
  let dernierHorodatageMs = horloge.maintenantMs()
  // Temps réel écoulé et pas encore soumis à `appliquerDelta` : distinct d'`etat.resteDeltaMs`, qui ne
  // se met à jour que dans l'état **persisté** (donc seulement quand `setState` a lieu). Sans cet
  // accumulateur, deux frames de 60 ms consécutives sans notification (aucune ne franchit 100 ms toute
  // seule) perdraient 60 ms à chaque fois au lieu de les cumuler jusqu'au tick suivant (EXG-2).
  let accumulNonTraiteMs = 0

  /**
   * Toute écriture passe par ici : une exception du port (quota dépassé, `QuotaExceededError`, stockage
   * désactivé) ne fait jamais tomber la boucle, et l'issue d'une écriture de la sauvegarde **principale**
   * pilote `stockagePlein`. Le verrou et les réglages n'y comptent pas : une petite écriture de verrou
   * réussie ne dit rien de la place qu'il reste pour la partie. Le `setState` n'a lieu qu'au changement.
   */
  const stockage: Stockage = {
    lire: (cle) => stockageBrut.lire(cle),
    supprimer: (cle) => {
      try {
        stockageBrut.supprimer(cle)
      } catch {
        // Rien à signaler : une suppression ratée ne perd aucune progression.
      }
    },
    ecrire: (cle, valeur) => {
      // ADR-21 — une clé hors de l'espace `magic-battle:` est une faute de programmation : elle doit
      // rester bruyante, pas être avalée comme un quota plein par le `catch` ci-dessous.
      if (!cle.startsWith(PREFIXE_STOCKAGE)) {
        throw new Error(`Clé de stockage hors de l'espace « ${PREFIXE_STOCKAGE} » : ${cle}`)
      }
      let reussie = true
      try {
        stockageBrut.ecrire(cle, valeur)
      } catch {
        reussie = false
      }
      if (cle !== CLE_PRINCIPALE) return
      // Pendant la construction du store (`demarrer()` n'a encore rien écrit) `store` existe déjà :
      // l'écriture principale n'a lieu qu'après la confirmation du verrou.
      if (store.getState().stockagePlein === reussie) store.setState({ stockagePlein: !reussie })
    },
  }

  let reduitMouvement = false
  try {
    reduitMouvement = matchMedia.correspond('(prefers-reduced-motion: reduce)')
  } catch {
    // ADR-21 — un port `matchMedia` défaillant ne doit jamais empêcher le démarrage.
  }

  const store: StoreApi<EtatStoreJeu> = createStore<EtatStoreJeu>((set, get) => {
    /** Applique une transition de jeu seulement si cet onglet joue (EXG-48 : actions sans effet sinon). */
    function jouer(transition: (etat: EtatJeu) => EtatJeu): void {
      if (mode !== 'actif') return
      set({ etat: transition(get().etat) })
    }
    return {
      etat: etatInitialFn(horloge.maintenantMs()),
      pret: false,
      droitEcriture: false,
      lectureSeule: false,
      motifLectureSeule: null,
      sauvegardeIllisible: null,
      resumeHorsLigne: null,
      reduitMouvement,
      partieNeuve: false,
      stockagePlein: false,
      actions: {
        clic: () => jouer((etat) => appliquerClic(etat, CONSTANTES)),
        lancerSort: (idSort) => jouer((etat) => lancerSort(etat, idSort, CONSTANTES).etat),
        acheterEcole: (id) => jouer((etat) => acheterNiveaux(etat, id, 1, CONSTANTES).etat),
        acheterAmelioration: (id) => jouer((etat) => acheterAmelioration(etat, id, CONSTANTES).etat),
        acheterEquipement: (id) => jouer((etat) => acheterEquipement(etat, id, CONSTANTES).etat),
        acheterNoeudEclats: (id) => jouer((etat) => acheterNoeudArbre(etat, id, 1, 'eclats', CONSTANTES).etat),
        prestige: (gainFige) =>
          jouer((etat) => {
            const resultat = prestiger(etat, CONSTANTES)
            if (!resultat.accepte) return etat
            const ecart = gainFige - resultat.gain
            if (ecart === 0) return resultat.etat
            return {
              ...resultat.etat,
              bourse: {
                ...resultat.etat.bourse,
                eclatsPossedes: Math.max(0, sommeBornee(resultat.etat.bourse.eclatsPossedes, ecart)),
                eclatsDepensables: Math.max(0, sommeBornee(resultat.etat.bourse.eclatsDepensables, ecart)),
              },
              prestige: {
                ...resultat.etat.prestige,
                eclatsCumulesAVie: Math.max(0, sommeBornee(resultat.etat.prestige.eclatsCumulesAVie, ecart)),
              },
            }
          }),
        ascensionner: (gainFige) =>
          jouer((etat) => {
            const resultat = ascensionner(etat, CONSTANTES)
            if (!resultat.accepte) return etat
            const ecart = gainFige - resultat.gain
            if (ecart === 0) return resultat.etat
            return {
              ...resultat.etat,
              bourse: {
                ...resultat.etat.bourse,
                pointsAscension: Math.max(0, sommeBornee(resultat.etat.bourse.pointsAscension, ecart)),
              },
            }
          }),
        importer: (texte) => importer(texte),
        restaurerSecours: () => restaurer(),
        nouvellePartie: () => nouvellePartie(),
      },
    }
  })

  function emettreEtape(etape: EtapeDemarrage): void {
    onEtapeDemarrage?.(etape)
  }

  /* ─────────────────────────────────────────────────────────────────────────── verrou (EXG-48) */

  function lireVerrouStocke(): EtatVerrou | null {
    return lireVerrou(stockage.lire(CLE_VERROU))
  }

  function ecrireVerrou(verrou: EtatVerrou | null): void {
    if (verrou === null) stockage.supprimer(CLE_VERROU)
    else stockage.ecrire(CLE_VERROU, JSON.stringify(verrou))
  }

  function publier(message: MessageVerrou): void {
    try {
      canal.publier(message)
    } catch {
      // Canal fermé ou indisponible : le verrou vit dans le stockage, le canal n'est qu'un accélérateur.
    }
  }

  /**
   * « Verrou relu avant chaque écriture » : cet onglet est-il, **d'après le stockage**, propriétaire ?
   * Un verrou absent ou illisible alors qu'on se croyait propriétaire est une perte, pas une invitation à
   * le reprendre en silence : un autre onglet a pu le prendre (expiration), écrire, puis le libérer.
   */
  function detientVerrou(maintenantMs: number): boolean {
    return evaluerDroitEcriture(lireVerrouStocke(), idOnglet, maintenantMs, DELAI_EXPIRATION_VERROU_MS).droitEcriture
  }

  /** Toute perte détectée fige l'onglet, **sans** `calculHorsLigne` et sans rien écrire (N3). */
  function perdreVerrou(): void {
    devenirSecondaire('verrouPerdu')
  }

  function battre(): void {
    const maintenant = horloge.maintenantMs()
    if (mode === 'secondaire') {
      tenterRelais(maintenant)
      return
    }
    if (mode !== 'actif' && mode !== 'illisible') return
    const lu = lireVerrouStocke()
    if (lu === null || lu.idProprietaire !== idOnglet) {
      perdreVerrou()
      return
    }
    const verdict = renouveler(lu, idOnglet, maintenant, DELAI_EXPIRATION_VERROU_MS)
    if (!verdict.droitEcriture) {
      perdreVerrou()
      return
    }
    // Référence inchangée ⇒ rien à propager (aucune écriture inutile, `renouveler`).
    if (verdict.verrou !== lu) ecrireVerrou(verdict.verrou)
  }

  /** Onglet secondaire : relaie dès que le verrou est libre (libéré, illisible) ou expiré. */
  function tenterRelais(maintenantMs: number): void {
    const verdict = evaluerDroitEcriture(lireVerrouStocke(), idOnglet, maintenantMs, DELAI_EXPIRATION_VERROU_MS)
    if (verdict.motif === 'libre') demarrer()
  }

  /* ──────────────────────────────────────────────────────────────────────────── minuteries */

  function arreterBoucle(): void {
    if (idFrame !== null) portPlanificateur.annulerFrame(idFrame)
    idFrame = null
  }

  function lancerBoucle(): void {
    if (idFrame !== null || mode !== 'actif' || !portPage.estVisible()) return
    idFrame = portPlanificateur.planifierFrame(boucle)
  }

  function armerAutoSauvegarde(): void {
    if (idAutoSauvegarde !== null || mode !== 'actif' || !portPage.estVisible()) return
    idAutoSauvegarde = portPlanificateur.planifierIntervalle(sauvegarderRoutine, INTERVALLE_AUTOSAVE_MS)
  }

  function desarmerAutoSauvegarde(): void {
    if (idAutoSauvegarde !== null) portPlanificateur.annulerIntervalle(idAutoSauvegarde)
    idAutoSauvegarde = null
  }

  function armerBattement(): void {
    if (idBattement !== null) return
    idBattement = portPlanificateur.planifierIntervalle(battre, INTERVALLE_BATTEMENT_VERROU_MS)
  }

  function desarmerBattement(): void {
    if (idBattement !== null) portPlanificateur.annulerIntervalle(idBattement)
    idBattement = null
  }

  function annulerConfirmation(): void {
    if (idConfirmation !== null) portPlanificateur.annulerIntervalle(idConfirmation)
    idConfirmation = null
  }

  /* ────────────────────────────────────────────────────────────────── écritures de sauvegarde */

  /** Exécute un plan du domaine **dans l'ordre du tableau** (EXG-46 : la mise à l'abri d'abord). */
  function executerPlan(plan: PlanEcrasement): void {
    for (const ecriture of plan.ecritures) {
      if (ecriture.contenu === null) stockage.supprimer(cleStockage(ecriture.nom))
      else stockage.ecrire(cleStockage(ecriture.nom), ecriture.contenu)
    }
  }

  /**
   * Sauvegarde courante (auto-sauvegarde EXG-22, `hidden`/`pagehide`/`beforeunload` EXG-23) : principal
   * seul, jamais `.bak` (EXG-46 ne met à l'abri qu'avant un import ou une nouvelle partie — copier à
   * chaque sauvegarde remplacerait l'état d'avant import par l'import lui-même au bout de 30 s).
   */
  function sauvegarderRoutine(): void {
    if (mode !== 'actif') return
    const maintenant = horloge.maintenantMs()
    if (!detientVerrou(maintenant)) {
      perdreVerrou()
      return
    }
    stockage.ecrire(CLE_PRINCIPALE, exporterTexte(store.getState().etat, maintenant))
  }

  /* ────────────────────────────────────────────────────────── boucle (hors React, EXG-1 à EXG-3) */

  function traiterDelta(deltaMs: number, maintenantMs: number): void {
    accumulNonTraiteMs += deltaMs
    const etatCourant = store.getState().etat

    // EXG-55 — au-delà du seuil `nTicksMax × PAS_TICK_MS` de temps non traité (onglet revenu de `hidden`,
    // veille système sans `visibilitychange`…), le rattrapage passe par `calculHorsLigne`, jamais par la
    // forme fermée d'`appliquerDelta`.
    if (accumulNonTraiteMs > seuilRattrapageMs(CONSTANTES)) {
      // Comparaison d'horloge dédiée (EXG-55) : l'absence commence au dernier instant traité par la
      // boucle, pas à la dernière écriture. `etat.derniereSauvegardeMs` en mémoire date du démarrage
      // (les sauvegardes n'y touchent pas) : s'y fier créditerait toute la session de jeu au premier
      // sommeil de 61 s. Le moteur calcule Δt = maintenant − derniereSauvegardeMs ; on lui dit donc où
      // l'absence commence, sans toucher à sa formule.
      const debutAbsenceMs = maintenantMs - accumulNonTraiteMs
      accumulNonTraiteMs = 0
      // N3 — un onglet qui a perdu la main pendant l'absence fige, il ne crédite rien.
      if (!detientVerrou(maintenantMs)) {
        perdreVerrou()
        return
      }
      const { etat, resume } = calculHorsLigne(
        { ...etatCourant, derniereSauvegardeMs: debutAbsenceMs },
        maintenantMs,
        CONSTANTES,
      )
      // « la référence de frame est remise à zéro » : de même pour `etat.resteDeltaMs`.
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
    idFrame = null
    if (mode !== 'actif' || !portPage.estVisible()) return
    const maintenant = horloge.maintenantMs()
    const deltaMs = maintenant - dernierHorodatageMs
    dernierHorodatageMs = maintenant
    if (deltaMs > 0) traiterDelta(deltaMs, maintenant)
    lancerBoucle()
  }

  /* ──────────────────────────────────────────────────────────────── transitions de cycle de vie */

  function devenirSecondaire(motif: MotifLectureSeule): void {
    arreterBoucle()
    desarmerAutoSauvegarde()
    annulerConfirmation()
    mode = 'secondaire'
    let etat = store.getState().etat
    if (motif === 'ongletSecondaire') {
      // Vue figée de la partie du propriétaire : relue du stockage, **sans** plan ni `calculHorsLigne`.
      // Un principal illisible n'a rien à montrer ici : l'écran EXG-27 appartient au propriétaire.
      const texte = stockage.lire(CLE_PRINCIPALE)
      const base = etatInitialFn(horloge.maintenantMs())
      etat = texte === null ? base : importerTexte(texte, base, CONSTANTES).etat
    }
    // En cas de perte, l'état en mémoire reste affiché tel quel, figé : il ne sera plus jamais écrit.
    store.setState({
      etat,
      pret: true,
      droitEcriture: false,
      lectureSeule: true,
      motifLectureSeule: motif,
      sauvegardeIllisible: null,
      resumeHorsLigne: null,
      partieNeuve: false,
    })
    armerBattement()
  }

  /**
   * Démarrage complet (contrat `SequenceDemarrage`, `demarrage.ts`). Rejoué à l'identique pour toute
   * acquisition : 1er démarrage, relais d'un secondaire, `pageshow`. Première moitié : le verrou.
   */
  function demarrer(): void {
    arreterBoucle()
    desarmerAutoSauvegarde()
    annulerConfirmation()
    const maintenant = horloge.maintenantMs()
    const lu = lireVerrouStocke()
    const verdict = revendiquer(lu, idOnglet, maintenant, DELAI_EXPIRATION_VERROU_MS)
    if (!verdict.droitEcriture) {
      emettreEtape('verrou')
      devenirSecondaire('ongletSecondaire')
      return
    }
    if (verdict.verrou !== lu) ecrireVerrou(verdict.verrou)
    mode = 'confirmation'
    publier({ type: 'revendication', idOnglet })
    idConfirmation = portPlanificateur.planifierIntervalle(confirmer, DELAI_CONFIRMATION_VERROU_MS)
  }

  /** Écrire-puis-relire : après le délai, seul le stockage relu dit qui a gagné. */
  function confirmer(): void {
    annulerConfirmation()
    if (mode !== 'confirmation') return
    const maintenant = horloge.maintenantMs()
    emettreEtape('verrou')
    if (!detientVerrou(maintenant)) {
      devenirSecondaire('ongletSecondaire')
      return
    }
    chargerDepuisStockage(maintenant)
  }

  /** Seconde moitié du démarrage, propriétaire confirmé : import → hors-ligne → sauvegarde → boucle. */
  function chargerDepuisStockage(maintenantMs: number): void {
    // 2. `importerTexte(principal)` — relecture du texte d'`exporterTexte`, **sans** exécuter son plan.
    const base = etatInitialFn(maintenantMs)
    const texte = stockage.lire(CLE_PRINCIPALE)
    const partieNeuve = texte === null
    let etat = base
    if (texte !== null) {
      const resultat = importerTexte(texte, base, CONSTANTES)
      if (!resultat.ok) {
        emettreEtape('importerSauvegarde')
        entrerIllisible(resultat.erreur, base)
        return
      }
      etat = resultat.etat
    }
    emettreEtape('importerSauvegarde')

    // 3. `calculHorsLigne` — propriétaire seulement (EXG-4/EXG-5).
    const credite = calculHorsLigne(etat, maintenantMs, CONSTANTES)
    emettreEtape('calculHorsLigne')

    // 4. sauvegarde immédiate — verrou relu juste avant, comme toute écriture.
    if (!detientVerrou(maintenantMs)) {
      perdreVerrou()
      return
    }
    stockage.ecrire(CLE_PRINCIPALE, exporterTexte(credite.etat, maintenantMs))
    emettreEtape('sauvegardeImmediate')

    mode = 'actif'
    accumulNonTraiteMs = 0
    store.setState({
      etat: credite.etat,
      pret: true,
      droitEcriture: true,
      lectureSeule: false,
      motifLectureSeule: null,
      sauvegardeIllisible: null,
      resumeHorsLigne: credite.resume,
      partieNeuve,
    })

    // 5. boucle — pilotée par `portPlanificateur`, jamais par un minuteur global.
    dernierHorodatageMs = horloge.maintenantMs()
    lancerBoucle()
    emettreEtape('boucle')

    // 6. auto-sauvegarde (EXG-22) + battement du verrou (EXG-48).
    armerAutoSauvegarde()
    armerBattement()
    emettreEtape('autoSauvegardeEtBattement')
  }

  /** EXG-27 — principal illisible : propriétaire, mais rien ne tourne et rien n'est écrit. */
  function entrerIllisible(erreur: ErreurImport, base: EtatJeu): void {
    const secoursRestaurable = restaurerSecours(stockage.lire(CLE_SECOURS), base, CONSTANTES).ok
    mode = 'illisible'
    store.setState({
      etat: base,
      pret: true,
      droitEcriture: true,
      lectureSeule: false,
      motifLectureSeule: null,
      sauvegardeIllisible: { motif: erreur.motif, message: erreur.message, secoursRestaurable },
      resumeHorsLigne: null,
      partieNeuve: false,
    })
    armerBattement()
  }

  /**
   * Après un import, une restauration ou une nouvelle partie confirmés : la partie reprend **maintenant**.
   * `derniereSauvegardeMs = maintenant` en mémoire comme dans le principal réécrit : aucun crédit
   * hors-ligne, ni tout de suite ni au prochain démarrage (N10).
   */
  function reprendreSur(etat: EtatJeu, maintenantMs: number, partieNeuve = false): void {
    const repris: EtatJeu = { ...etat, derniereSauvegardeMs: maintenantMs }
    stockage.ecrire(CLE_PRINCIPALE, exporterTexte(repris, maintenantMs))
    mode = 'actif'
    accumulNonTraiteMs = 0
    dernierHorodatageMs = maintenantMs
    store.setState({
      etat: repris,
      pret: true,
      droitEcriture: true,
      lectureSeule: false,
      motifLectureSeule: null,
      sauvegardeIllisible: null,
      resumeHorsLigne: null,
      partieNeuve,
    })
    lancerBoucle()
    armerAutoSauvegarde()
    armerBattement()
  }

  /** Garde commune des actions de sauvegarde : propriétaire (actif ou illisible), verrou relu. */
  function peutEcrireSauvegarde(maintenantMs: number): boolean {
    if (mode !== 'actif' && mode !== 'illisible') return false
    if (!detientVerrou(maintenantMs)) {
      perdreVerrou()
      return false
    }
    return true
  }

  /**
   * Ce que l'écrasement va détruire (`OptionsImport.contenuCourant`) : la partie **en cours**, telle
   * qu'une sauvegarde l'écrirait maintenant — pas le principal d'il y a jusqu'à 30 s. Principal illisible
   * ⇒ `null` : rien à mettre à l'abri, et surtout pas une donnée corrompue par-dessus un `.bak` valide.
   */
  function contenuCourant(maintenantMs: number): string | null {
    if (mode === 'illisible') return null
    return exporterTexte(store.getState().etat, maintenantMs)
  }

  function importer(texte: string): ResultatActionSauvegarde {
    const maintenant = horloge.maintenantMs()
    if (!peutEcrireSauvegarde(maintenant)) return { ok: false, motif: 'sansDroit' }
    const resultat = importerTexte(texte, store.getState().etat, CONSTANTES, {
      contenuCourant: contenuCourant(maintenant),
    })
    if (!resultat.ok) return { ok: false, motif: 'refuse', erreur: resultat.erreur }
    executerPlan(resultat.plan)
    reprendreSur(resultat.etat, maintenant)
    return { ok: true }
  }

  function restaurer(): ResultatActionSauvegarde {
    const maintenant = horloge.maintenantMs()
    if (!peutEcrireSauvegarde(maintenant)) return { ok: false, motif: 'sansDroit' }
    const resultat = restaurerSecours(stockage.lire(CLE_SECOURS), store.getState().etat, CONSTANTES)
    if (!resultat.ok) return { ok: false, motif: 'refuse', erreur: resultat.erreur }
    executerPlan(resultat.plan)
    reprendreSur(resultat.etat, maintenant)
    return { ok: true }
  }

  function nouvellePartie(): ResultatActionSauvegarde {
    const maintenant = horloge.maintenantMs()
    if (!peutEcrireSauvegarde(maintenant)) return { ok: false, motif: 'sansDroit' }
    const neuf = etatInitialFn(maintenant)
    executerPlan(planifierImport(contenuCourant(maintenant), exporterTexte(neuf, maintenant), 'nouvellePartie'))
    reprendreSur(neuf, maintenant, true)
    return { ok: true }
  }

  /* ─────────────────────────────────────────────────────────────── cycle de vie de la page */

  /** Rend le verrou s'il est à nous (EXG-48 : relais immédiat du secondaire, sans attendre l'expiration). */
  function relacherVerrou(): void {
    const lu = lireVerrouStocke()
    const restant = liberer(lu, idOnglet)
    if (restant === lu) return
    ecrireVerrou(restant)
    publier({ type: 'liberation', idOnglet })
  }

  function suspendre(): void {
    if (mode === 'arrete') return
    // EXG-23 — sauvegarde immédiate à la fermeture (verrou relu : rien si la main est perdue).
    if (mode === 'actif') sauvegarderRoutine()
    arreterBoucle()
    desarmerAutoSauvegarde()
    desarmerBattement()
    annulerConfirmation()
    if (mode === 'actif' || mode === 'illisible' || mode === 'confirmation') relacherVerrou()
    mode = 'arrete'
  }

  function surVisibilite(): void {
    if (!portPage.estVisible()) {
      // EXG-55 / N1 — `hidden` : une sauvegarde, puis tick et auto-sauvegarde suspendus ; seul le
      // battement continue. Rien d'autre n'écrira la sauvegarde avant le retour.
      if (mode === 'actif') sauvegarderRoutine()
      arreterBoucle()
      desarmerAutoSauvegarde()
      return
    }
    if (mode !== 'actif') return
    if (!detientVerrou(horloge.maintenantMs())) {
      perdreVerrou()
      return
    }
    armerAutoSauvegarde()
    // L'écart est traité tout de suite (hors-ligne si > seuil, ticks sinon), puis la boucle reprend.
    arreterBoucle()
    boucle()
  }

  let arretDefinitif = false
  const desabonnements: (() => void)[] = [
    portPage.surVisibiliteChangee(surVisibilite),
    portPage.surAvantDechargement(() => {
      if (mode === 'actif') sauvegarderRoutine()
    }),
    portPage.surPageHide(suspendre),
    // `pageshow` part aussi au premier chargement : seul un retour après `pagehide` (bfcache) rejoue.
    portPage.surPageShow(() => {
      if (mode === 'arrete' && !arretDefinitif) demarrer()
    }),
    canal.recevoir((brut) => {
      const message = lireMessage(brut)
      if (message === null || message.idOnglet === idOnglet) return
      const maintenant = horloge.maintenantMs()
      if (message.type === 'liberation' && mode === 'secondaire') tenterRelais(maintenant)
      else if (message.type === 'revendication' && (mode === 'actif' || mode === 'illisible')) {
        if (!detientVerrou(maintenant)) perdreVerrou()
      }
    }),
  ]

  function arreter(): void {
    suspendre()
    arretDefinitif = true
    for (const desabonner of desabonnements) desabonner()
    desabonnements.length = 0
    canal.fermer()
  }

  demarrer()

  return Object.assign(store, { arreter, stockage, matchMedia })
}

// Rappel du contrat traversé par `demarrer()`, pour que l'implémentation et sa documentation ne divergent
// jamais silencieusement (un test compare la trace observée à cette même constante).
export { ETAPES_DEMARRAGE }
export type { EtapeDemarrage }
