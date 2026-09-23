// Miroir de `src/state/store.ts` pour la persistance réelle (T-23a) : démarrage « écrire-puis-relire »,
// comptage des écritures (N7), onglet caché (EXG-55/N1), verrou multi-onglet et relais (EXG-48/N3/N4),
// sauvegarde illisible (EXG-27) et `.bak` (EXG-46/N6), action `importer` sans UI (N10).
//
// Deux onglets = deux fabriques aux ports `page`/`planificateur` indépendants, un stockage et un réseau de
// canaux partagés (`monde.ts`). Le transport réel (`localStorage`/`BroadcastChannel`) est prouvé à part,
// en vrai navigateur : `tests/ui/persistance-navigateur.test.tsx`.
//
// Instrument pour « aucun `calculHorsLigne` » : un espion posé **sur le module du moteur** (`vi.mock`),
// jamais un compteur que le store s'attribuerait lui-même (LRN-002) — une faute qui appellerait
// `calculHorsLigne` sans passer par `onEtapeDemarrage` serait vue quand même.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/domain/moteur.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/domain/moteur.ts')>()
  return { ...original, calculHorsLigne: vi.fn(original.calculHorsLigne) }
})

import { PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import { calculHorsLigne, etatInitial } from '../../src/domain/moteur.ts'
import { exporterTexte, importerTexte } from '../../src/domain/sauvegarde/index.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import {
  DELAI_CONFIRMATION_VERROU_MS,
  DELAI_EXPIRATION_VERROU_MS,
  INTERVALLE_BATTEMENT_VERROU_MS,
  PREFIXE_STOCKAGE,
  RALENTISSEMENT_ARRIERE_PLAN_MS,
} from '../../src/state/constantes.ts'
import { ETAPES_DEMARRAGE } from '../../src/state/demarrage.ts'
import { creerMonde } from './monde.ts'
import type { Monde, Onglet } from './monde.ts'

const espionHorsLigne = vi.mocked(calculHorsLigne)

const CLE_PRINCIPALE = 'magic-battle:sauvegarde'
const CLE_SECOURS = 'magic-battle:sauvegarde.bak'
const CLE_VERROU = 'magic-battle:verrou'
const MS_PAR_HEURE = 3_600_000
const H_MS = CONSTANTES.horsLigne.plafondHeures * MS_PAR_HEURE
const SEUIL_RATTRAPAGE_MS = CONSTANTES.tick.nTicksMax * PAS_TICK_MS

/** Nouvelle partie productive : sans école montée, le DPS est nul et aucun crédit ne serait visible. */
function etatProductif(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return { ...base, ecoles: { ...base.ecoles, feu: { niveau: 10, debloquee: true, revelee: true } } }
}

/** Ouvre un onglet et franchit l'attente écrire-puis-relire. */
function ouvrirProprietaire(monde: Monde, id = 'A'): Onglet {
  const onglet = monde.ouvrir(id, etatProductif)
  monde.avancer(DELAI_CONFIRMATION_VERROU_MS)
  expect(onglet.store.getState().droitEcriture).toBe(true)
  // Le crédit du démarrage lui-même est hors sujet pour la suite : l'espion repart de zéro.
  espionHorsLigne.mockClear()
  return onglet
}

/** Joue `n` frames de 100 ms exactement : chaque frame produit un tick et remet le report à zéro. */
function jouer(monde: Monde, n: number, pasMs = PAS_TICK_MS): void {
  for (let i = 0; i < n; i += 1) {
    monde.avancer(pasMs)
    monde.frame()
  }
}

function lireVerrouStocke(monde: Monde): { idProprietaire: string; dernierHeartbeatMs: number } | null {
  const brut = monde.stockage.lire(CLE_VERROU)
  return brut === null ? null : (JSON.parse(brut) as { idProprietaire: string; dernierHeartbeatMs: number })
}

function ecartRelatif(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300)
}

beforeEach(() => {
  espionHorsLigne.mockClear()
})

/* ═══════════════════════════════════════════════════════════════════ constantes du verrou (N4) */

describe('délais du verrou chiffrés dans le code (EXG-48, N4)', () => {
  it('expiration fixe > 60 s, ≥ 3 × battement, > ralentissement d’arrière-plan ; confirmation ~500 ms', () => {
    expect(DELAI_EXPIRATION_VERROU_MS).toBe(90_000)
    expect(DELAI_EXPIRATION_VERROU_MS).toBeGreaterThan(60_000)
    expect(DELAI_EXPIRATION_VERROU_MS).toBeGreaterThanOrEqual(3 * INTERVALLE_BATTEMENT_VERROU_MS)
    expect(DELAI_EXPIRATION_VERROU_MS).toBeGreaterThan(RALENTISSEMENT_ARRIERE_PLAN_MS)
    expect(DELAI_CONFIRMATION_VERROU_MS).toBeGreaterThanOrEqual(250)
    expect(DELAI_CONFIRMATION_VERROU_MS).toBeLessThanOrEqual(1_000)
  })
})

/* ═══════════════════════════════════════════════════════════════════════ démarrage réel */

describe('démarrage réel — écrire-puis-relire, puis le contrat SequenceDemarrage', () => {
  it('rien n’est chargé ni écrit avant la relecture du verrou ; ensuite l’ordre du contrat est suivi', () => {
    const monde = creerMonde()
    const a = monde.ouvrir('A', etatProductif)

    // Revendiqué et écrit, mais pas encore confirmé.
    expect(lireVerrouStocke(monde)?.idProprietaire).toBe('A')
    expect(a.store.getState().pret).toBe(false)
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS - 1)
    expect(a.store.getState().pret).toBe(false)
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE)).toBe(0)
    expect(a.etapes).toEqual([])

    monde.avancer(1)
    expect(a.store.getState().pret).toBe(true)
    expect(a.etapes).toEqual([...ETAPES_DEMARRAGE])
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE)).toBe(1)
  })

  it('une revendication concurrente arrivée pendant l’attente l’emporte : l’onglet se range, n’écrit rien', () => {
    const monde = creerMonde()
    const a = monde.ouvrir('A', etatProductif)
    // L'écriture d'un autre processus atterrit après celle de A (dernier écrivain gagnant).
    monde.stockage.poser(CLE_VERROU, JSON.stringify({ idProprietaire: 'Z', dernierHeartbeatMs: monde.maintenant() }))
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS)

    const s = a.store.getState()
    expect(s.droitEcriture).toBe(false)
    expect(s.lectureSeule).toBe(true)
    expect(s.motifLectureSeule).toBe('ongletSecondaire')
    expect(espionHorsLigne).not.toHaveBeenCalled()
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE)).toBe(0)
  })

  it('le principal est le texte d’exporterTexte, relu par importerTexte, puis crédité hors-ligne', () => {
    const monde = creerMonde()
    const sauvegarde = { ...etatProductif(monde.T0 - MS_PAR_HEURE), bourse: { ...etatInitial(0).bourse, or: 1234 } }
    monde.stockage.poser(CLE_PRINCIPALE, exporterTexte(sauvegarde, monde.T0 - MS_PAR_HEURE))

    const a = ouvrirProprietaire(monde)
    const s = a.store.getState()
    expect(s.sauvegardeIllisible).toBeNull()
    expect(s.resumeHorsLigne?.tempsEcouleMs).toBe(MS_PAR_HEURE + DELAI_CONFIRMATION_VERROU_MS)
    expect(s.etat.bourse.or).toBeGreaterThan(1234)
  })
})

/* ═══════════════════════════════════════════════════════════════════ écritures (N7, EXG-22/23) */

describe('« écriture » = setItem sur magic-battle:sauvegarde, compté après le démarrage (N7)', () => {
  it('auto-sauvegarde : 0 écriture à 29,9 s, 1 à 31 s (EXG-22)', () => {
    const monde = creerMonde()
    ouvrirProprietaire(monde)
    const repere = monde.stockage.journal.length

    monde.avancer(29_900)
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repere)).toBe(0)
    monde.avancer(1_100)
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repere)).toBe(1)
  })

  it('hidden : 0 → 1 (EXG-23)', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    const repere = monde.stockage.journal.length
    a.page.cacher()
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repere)).toBe(1)
  })

  it('pagehide : 0 → 1 (EXG-23), puis verrou rendu', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    const repere = monde.stockage.journal.length
    a.page.pagehide()
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repere)).toBe(1)
    expect(monde.stockage.lire(CLE_VERROU)).toBeNull()
  })

  it('beforeunload : 0 → 1 (EXG-23)', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    const repere = monde.stockage.journal.length
    a.page.avantDechargement()
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repere)).toBe(1)
  })

  it('onglet secondaire : 0 écriture, sur aucune clé, en 5 min de jeu du premier', () => {
    const monde = creerMonde()
    ouvrirProprietaire(monde, 'A')
    const b = monde.ouvrir('B', etatProductif)
    for (let i = 0; i < 10; i += 1) jouer(monde, 300 / 10)
    monde.avancer(5 * 60_000)
    b.page.cacher()
    b.page.montrer()
    b.page.avantDechargement()

    expect(b.store.getState().lectureSeule).toBe(true)
    expect(monde.stockage.journal.filter((o) => o.onglet === 'B')).toEqual([])
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, 0, 'A')).toBeGreaterThan(1)
  })

  it('toute clé écrite ou effacée porte le préfixe magic-battle: (ADR-21), sur un parcours complet', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    monde.ouvrir('B', etatProductif)
    jouer(monde, 10)
    monde.avancer(31_000)
    a.page.cacher()
    monde.avancer(2 * MS_PAR_HEURE)
    a.page.montrer()
    expect(a.store.getState().actions.importer(exporterTexte(etatProductif(monde.maintenant()), monde.maintenant())).ok).toBe(true)
    expect(a.store.getState().actions.restaurerSecours().ok).toBe(true)
    expect(a.store.getState().actions.nouvellePartie().ok).toBe(true)
    a.page.avantDechargement()
    a.page.pagehide()
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS + INTERVALLE_BATTEMENT_VERROU_MS)

    const cles = new Set(monde.stockage.journal.map((o) => o.cle))
    expect(cles.size).toBeGreaterThanOrEqual(3)
    const horsEspace = [...cles].filter((cle) => !cle.startsWith(PREFIXE_STOCKAGE))
    expect(horsEspace).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════════ EXG-55 — onglet caché (N1) */

describe('EXG-55 — onglet caché ou veille : un seul crédit hors-ligne, plafonné à H', () => {
  it('caché 20 h puis visible : crédit = H, une fois ; aucune écriture pendant ; battement maintenu ; auto-sauvegarde reprise', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    jouer(monde, 20)
    const etatAuMasquage = a.store.getState().etat
    const tMasquage = monde.maintenant()

    a.page.cacher()
    const repere = monde.stockage.journal.length
    monde.avancer(20 * MS_PAR_HEURE)

    // Pendant l'absence : zéro écriture de sauvegarde, mais le verrou a continué de battre.
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repere)).toBe(0)
    expect(monde.stockage.compterEcritures(CLE_VERROU, repere)).toBeGreaterThan(0)
    expect(lireVerrouStocke(monde)?.dernierHeartbeatMs).toBeGreaterThan(monde.maintenant() - 2 * INTERVALLE_BATTEMENT_VERROU_MS)
    expect(espionHorsLigne).not.toHaveBeenCalled()

    const tRetour = monde.maintenant()
    a.page.montrer()

    const attendu = calculHorsLigne({ ...etatAuMasquage, derniereSauvegardeMs: tMasquage }, tRetour, CONSTANTES)
    espionHorsLigne.mockClear()
    const s = a.store.getState()
    expect(ecartRelatif(s.etat.bourse.or, attendu.etat.bourse.or)).toBeLessThan(1e-9)
    expect(s.etat.bourse.or).toBeGreaterThan(etatAuMasquage.bourse.or)
    expect(s.resumeHorsLigne?.tempsEcouleMs).toBe(H_MS)
    expect(s.resumeHorsLigne?.plafondAtteint).toBe(true)

    // Un seul crédit : ni les frames suivantes, ni un second aller-retour de visibilité n'en rajoutent.
    const orApresCredit = s.etat.bourse.or
    const horsLigneApresCredit = s.etat.tempsHorsLigneMs
    jouer(monde, 10)
    a.page.cacher()
    a.page.montrer()
    expect(espionHorsLigne).not.toHaveBeenCalled()
    expect(a.store.getState().etat.tempsHorsLigneMs).toBe(horsLigneApresCredit)
    expect(a.store.getState().etat.bourse.or).toBeGreaterThan(orApresCredit)

    // L'auto-sauvegarde est de nouveau armée : une écriture dans les 31 s.
    const repereRetour = monde.stockage.journal.length
    monde.avancer(31_000)
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repereRetour)).toBe(1)
  })

  it('veille système de 8 h sans visibilitychange : même traitement, un seul crédit de 8 h', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    jouer(monde, 20)
    a.endormir()
    monde.avancer(8 * MS_PAR_HEURE)
    a.reveiller()
    monde.frame()

    expect(espionHorsLigne).toHaveBeenCalledTimes(1)
    expect(a.store.getState().resumeHorsLigne?.tempsEcouleMs).toBe(8 * MS_PAR_HEURE)
    expect(a.store.getState().droitEcriture).toBe(true)
    jouer(monde, 10)
    expect(espionHorsLigne).toHaveBeenCalledTimes(1)
  })

  it('l’absence se mesure à l’horloge de la boucle, pas au démarrage : 1 h de jeu puis 70 s → crédit de 70 s', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    // 72 frames de 50 s (sous le seuil de 60 s) : 1 h de jeu en ligne, sans rattrapage.
    jouer(monde, 72, 50_000)
    expect(espionHorsLigne).not.toHaveBeenCalled()

    monde.avancer(70_000)
    monde.frame()
    expect(a.store.getState().resumeHorsLigne?.tempsEcouleMs).toBe(70_000)
  })

  it('retour sous le seuil (30 s caché) : jeu normal, 10 frames, aucun passage par calculHorsLigne', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    jouer(monde, 5)
    const ticksAvant = a.store.getState().etat.ticksEcoules
    const horsLigneAvant = a.store.getState().etat.tempsHorsLigneMs
    a.page.cacher()
    monde.avancer(SEUIL_RATTRAPAGE_MS / 2)
    a.page.montrer()
    jouer(monde, 10)

    expect(espionHorsLigne).not.toHaveBeenCalled()
    expect(a.store.getState().etat.tempsHorsLigneMs).toBe(horsLigneAvant)
    expect(a.store.getState().etat.ticksEcoules).toBe(ticksAvant + SEUIL_RATTRAPAGE_MS / 2 / PAS_TICK_MS + 10)
  })
})

/* ═══════════════════════════════════════════════════════════════ EXG-48 — verrou multi-onglet */

describe('EXG-48 — second onglet figé, relais, perte', () => {
  it('deux onglets : seul le premier écrit ; le second ne tick pas et ses actions sont sans effet', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    jouer(monde, 10)
    const b = monde.ouvrir('B', etatProductif)

    const sb = b.store.getState()
    expect(sb.pret).toBe(true)
    expect(sb.lectureSeule).toBe(true)
    expect(sb.motifLectureSeule).toBe('ongletSecondaire')
    expect(sb.droitEcriture).toBe(false)
    // Vue figée de la partie du propriétaire, relue du principal sans hors-ligne.
    const principal = importerTexte(monde.stockage.lire(CLE_PRINCIPALE)!, etatInitial(0), CONSTANTES)
    expect(sb.etat).toEqual(principal.etat)
    expect(espionHorsLigne).not.toHaveBeenCalled()

    const etatB = b.store.getState().etat
    jouer(monde, 50)
    b.store.getState().actions.clic()
    b.store.getState().actions.acheterEcole('feu')
    expect(b.store.getState().actions.importer(exporterTexte(etatProductif(0), 0))).toEqual({ ok: false, motif: 'sansDroit' })
    expect(b.store.getState().actions.nouvellePartie()).toEqual({ ok: false, motif: 'sansDroit' })

    expect(b.store.getState().etat).toBe(etatB)
    expect(b.planificateur.framesEnAttente).toBe(0)
    expect(monde.stockage.journal.filter((o) => o.onglet === 'B')).toEqual([])
    expect(a.store.getState().etat.ticksEcoules).toBeGreaterThan(etatB.ticksEcoules)
  })

  it('fermeture propre du premier : relais immédiat, relu depuis le stockage, hors-ligne appliqué, boucle propre', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    const b = monde.ouvrir('B', etatProductif)
    jouer(monde, 30)
    monde.avancer(2 * DELAI_EXPIRATION_VERROU_MS) // A bat toujours : B ne relaie pas
    expect(b.store.getState().lectureSeule).toBe(true)

    a.page.pagehide()
    const texteFerme = monde.stockage.lire(CLE_PRINCIPALE)!
    const tFermeture = monde.maintenant()
    espionHorsLigne.mockClear()
    monde.livrer()
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS)

    const sb = b.store.getState()
    expect(sb.droitEcriture).toBe(true)
    expect(sb.lectureSeule).toBe(false)
    expect(monde.maintenant() - tFermeture).toBe(DELAI_CONFIRMATION_VERROU_MS)
    const relu = importerTexte(texteFerme, etatProductif(0), CONSTANTES)
    if (!relu.ok) throw new Error('le principal écrit par A doit être lisible')
    const attendu = calculHorsLigne(relu.etat, monde.maintenant(), CONSTANTES)
    expect(sb.etat.bourse.or).toBe(attendu.etat.bourse.or)
    expect(espionHorsLigne).toHaveBeenCalledTimes(2) // le relais de B, puis le calcul attendu ci-dessus

    const ticks = sb.etat.ticksEcoules
    jouer(monde, 5)
    expect(b.store.getState().etat.ticksEcoules).toBe(ticks + 5)
  })

  it('disparition sans fermeture : figé jusqu’à expiration − 1 ms (même sur un message forgé), puis relais', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    const b = monde.ouvrir('B', etatProductif)
    jouer(monde, 10)
    monde.avancer(INTERVALLE_BATTEMENT_VERROU_MS)
    a.tuer()
    const dernierBattement = lireVerrouStocke(monde)!.dernierHeartbeatMs
    const expiration = dernierBattement + DELAI_EXPIRATION_VERROU_MS

    monde.avancerJusqua(expiration - 1)
    // Un message « libération » forgé pile au dernier instant : le canal n'est qu'un indice.
    monde.publierBrut({ type: 'liberation', idOnglet: 'A' })
    monde.livrer()
    expect(b.store.getState().lectureSeule).toBe(true)
    expect(monde.stockage.journal.filter((o) => o.onglet === 'B')).toEqual([])

    monde.avancer(INTERVALLE_BATTEMENT_VERROU_MS + DELAI_CONFIRMATION_VERROU_MS + 1)
    expect(b.store.getState().droitEcriture).toBe(true)
    expect(b.store.getState().lectureSeule).toBe(false)
    const premiereEcritureB = monde.stockage.journal.find((o) => o.onglet === 'B')!
    expect(premiereEcritureB.cle).toBe(CLE_VERROU)
    expect(premiereEcritureB.instantMs).toBeGreaterThan(expiration)
  })

  it('pageshow (bfcache) : démarrage complet rejoué depuis le stockage, jamais l’état en mémoire', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    jouer(monde, 20)
    a.page.pagehide()
    expect(a.store.getState().droitEcriture).toBe(true) // l'état exposé n'a pas bougé : c'est l'arrêt

    // Pendant que A dormait dans le bfcache, une autre session a écrit une partie différente.
    const autre = { ...etatProductif(monde.maintenant()), bourse: { ...etatInitial(0).bourse, or: 424_242 } }
    monde.stockage.poser(CLE_PRINCIPALE, exporterTexte(autre, monde.maintenant()))
    monde.avancer(10_000)
    a.etapes.length = 0
    a.page.pageshow()
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS)

    expect(a.etapes).toEqual([...ETAPES_DEMARRAGE])
    expect(a.store.getState().etat.bourse.or).toBeGreaterThan(424_242)
    expect(a.store.getState().etat.bourse.or).toBeLessThan(424_242 * 1.01)
  })

  it('le premier pageshow (chargement initial) ne rejoue rien', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    const avant = a.etapes.length
    a.page.pageshow()
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS)
    expect(a.etapes.length).toBe(avant)
  })

  it('principal tronqué au moment du relais : figé, aucun calculHorsLigne, EXG-27', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    const b = monde.ouvrir('B', etatProductif)
    jouer(monde, 10)
    a.page.pagehide()
    const texte = monde.stockage.lire(CLE_PRINCIPALE)!
    const tronque = texte.slice(0, Math.floor(texte.length / 2))
    monde.stockage.poser(CLE_PRINCIPALE, tronque)
    espionHorsLigne.mockClear()
    monde.livrer()
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS)

    const sb = b.store.getState()
    expect(sb.droitEcriture).toBe(true)
    expect(sb.sauvegardeIllisible).not.toBeNull()
    expect(espionHorsLigne).not.toHaveBeenCalled()
    const ticks = sb.etat.ticksEcoules
    jouer(monde, 10)
    b.store.getState().actions.clic()
    expect(b.store.getState().etat.ticksEcoules).toBe(ticks)
    expect(b.planificateur.framesEnAttente).toBe(0)
    expect(monde.stockage.lire(CLE_PRINCIPALE)).toBe(tronque)
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, 0, 'B')).toBe(0)
  })

  it('perte détectée au battement : gel immédiat, sans calculHorsLigne, plus aucune écriture', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    jouer(monde, 10)
    espionHorsLigne.mockClear()
    monde.stockage.poser(CLE_VERROU, JSON.stringify({ idProprietaire: 'Z', dernierHeartbeatMs: monde.maintenant() }))
    const repere = monde.stockage.journal.length
    monde.avancer(INTERVALLE_BATTEMENT_VERROU_MS)

    const s = a.store.getState()
    expect(s.lectureSeule).toBe(true)
    expect(s.motifLectureSeule).toBe('verrouPerdu')
    monde.avancer(60_000)
    a.page.cacher()
    a.page.pagehide()
    expect(espionHorsLigne).not.toHaveBeenCalled()
    expect(monde.stockage.journal.slice(repere).filter((o) => o.onglet === 'A')).toEqual([])
  })

  it('verrou relu avant chaque écriture : pris par un autre juste avant hidden → rien d’écrit, gel', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    jouer(monde, 10)
    monde.stockage.poser(CLE_VERROU, JSON.stringify({ idProprietaire: 'Z', dernierHeartbeatMs: monde.maintenant() }))
    const repere = monde.stockage.journal.length
    a.page.cacher()

    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repere)).toBe(0)
    expect(a.store.getState().motifLectureSeule).toBe('verrouPerdu')
  })

  it('réveil après une veille où un autre onglet a pris la main : gel sans crédit, l’autre continue', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde, 'A')
    const b = monde.ouvrir('B', etatProductif)
    jouer(monde, 10)
    a.endormir()
    monde.avancer(2 * MS_PAR_HEURE)
    expect(b.store.getState().droitEcriture).toBe(true) // relais par expiration pendant la veille de A
    monde.frame() // B rattrape ses 2 h sans frame (artefact du monde simulé), avant le réveil de A

    espionHorsLigne.mockClear()
    const repere = monde.stockage.journal.length
    a.reveiller()
    monde.frame()
    monde.avancer(60_000)

    expect(a.store.getState().motifLectureSeule).toBe('verrouPerdu')
    expect(espionHorsLigne).not.toHaveBeenCalled()
    expect(monde.stockage.journal.slice(repere).filter((o) => o.onglet === 'A')).toEqual([])
    expect(monde.stockage.compterEcritures(CLE_PRINCIPALE, repere, 'B')).toBeGreaterThan(0)
  })
})

/* ═══════════════════════════════════════════════════════════ EXG-27 / EXG-46 — principal illisible */

describe('EXG-27 / EXG-46 — principal illisible : rien n’est écrit avant confirmation', () => {
  function mondeAvecPrincipalTronque(options: { secours: 'valide' | 'absent' | 'corrompu' }) {
    const monde = creerMonde()
    const ancien = { ...etatProductif(monde.T0 - MS_PAR_HEURE), bourse: { ...etatInitial(0).bourse, or: 777 } }
    const texte = exporterTexte(ancien, monde.T0 - MS_PAR_HEURE)
    monde.stockage.poser(CLE_PRINCIPALE, texte.slice(0, Math.floor(texte.length * 0.6)))
    if (options.secours === 'valide') monde.stockage.poser(CLE_SECOURS, texte)
    if (options.secours === 'corrompu') monde.stockage.poser(CLE_SECOURS, 'pas du base64 !')
    const a = monde.ouvrir('A', etatProductif)
    monde.avancer(DELAI_CONFIRMATION_VERROU_MS)
    return { monde, a, texteSecours: texte }
  }

  it('principal tronqué : message ; stockage identique octet pour octet après 31 s, hidden et fermeture', () => {
    const { monde, a } = mondeAvecPrincipalTronque({ secours: 'valide' })
    const s = a.store.getState()
    expect(s.pret).toBe(true)
    expect(s.sauvegardeIllisible).not.toBeNull()
    expect(s.sauvegardeIllisible!.message.length).toBeGreaterThan(0)
    expect(s.sauvegardeIllisible!.secoursRestaurable).toBe(true)
    expect(espionHorsLigne).not.toHaveBeenCalled()

    const principal = monde.stockage.lire(CLE_PRINCIPALE)
    const secours = monde.stockage.lire(CLE_SECOURS)
    monde.avancer(31_000)
    monde.frame()
    a.store.getState().actions.clic()
    a.page.cacher()
    monde.avancer(31_000)
    a.page.montrer()
    a.page.avantDechargement()
    a.page.pagehide()

    expect(monde.stockage.lire(CLE_PRINCIPALE)).toBe(principal)
    expect(monde.stockage.lire(CLE_SECOURS)).toBe(secours)
    const ecrituresSauvegarde = monde.stockage.journal.filter(
      (o) => o.cle === CLE_PRINCIPALE || o.cle === CLE_SECOURS,
    )
    expect(ecrituresSauvegarde).toEqual([])
  })

  it('« restaurer » proposé seulement si restaurerSecours réussit (.bak absent ou corrompu → non)', () => {
    expect(mondeAvecPrincipalTronque({ secours: 'absent' }).a.store.getState().sauvegardeIllisible!.secoursRestaurable).toBe(false)
    expect(mondeAvecPrincipalTronque({ secours: 'corrompu' }).a.store.getState().sauvegardeIllisible!.secoursRestaurable).toBe(false)
  })

  it('nouvelle partie sur principal illisible : contenuCourant null, le .bak valide n’est jamais écrasé', () => {
    const { monde, a, texteSecours } = mondeAvecPrincipalTronque({ secours: 'valide' })
    expect(a.store.getState().actions.nouvellePartie()).toEqual({ ok: true })

    expect(monde.stockage.lire(CLE_SECOURS)).toBe(texteSecours)
    expect(monde.stockage.compterEcritures(CLE_SECOURS)).toBe(0)
    const principal = importerTexte(monde.stockage.lire(CLE_PRINCIPALE)!, etatInitial(0), CONSTANTES)
    expect(principal.ok).toBe(true)
    expect(a.store.getState().sauvegardeIllisible).toBeNull()
    const ticks = a.store.getState().etat.ticksEcoules
    jouer(monde, 3)
    expect(a.store.getState().etat.ticksEcoules).toBe(ticks + 3)
  })

  it('restaurer le .bak sur principal illisible : partie du .bak, .bak intact, aucun crédit hors-ligne', () => {
    const { monde, a, texteSecours } = mondeAvecPrincipalTronque({ secours: 'valide' })
    expect(a.store.getState().actions.restaurerSecours()).toEqual({ ok: true })

    const s = a.store.getState()
    expect(s.etat.bourse.or).toBe(777)
    expect(s.etat.derniereSauvegardeMs).toBe(monde.maintenant())
    expect(s.resumeHorsLigne).toBeNull()
    expect(espionHorsLigne).not.toHaveBeenCalled()
    expect(monde.stockage.lire(CLE_SECOURS)).toBe(texteSecours)
  })
})

/* ═════════════════════════════════════════════════════════════ EXG-46 — importer, sans UI (N10) */

describe('EXG-46 — action importer(texte), sans UI', () => {
  it('import confirmé → .bak = partie d’avant ; restaurer la recharge à l’identique ; aucun crédit hors-ligne', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    jouer(monde, 40)
    a.store.getState().actions.acheterEcole('feu')
    jouer(monde, 3)
    const avantImport = a.store.getState().etat

    // Sauvegarde importée vieille de 5 h : un crédit hors-ligne s'y verrait tout de suite.
    const importee = { ...etatProductif(monde.T0), bourse: { ...etatInitial(0).bourse, or: 999 } }
    const tImport = monde.maintenant()
    expect(a.store.getState().actions.importer(exporterTexte(importee, tImport - 5 * MS_PAR_HEURE))).toEqual({ ok: true })

    const apresImport = a.store.getState()
    expect(apresImport.etat.bourse.or).toBe(999)
    expect(apresImport.etat.derniereSauvegardeMs).toBe(tImport)
    expect(apresImport.resumeHorsLigne).toBeNull()
    expect(monde.stockage.lire(CLE_SECOURS)).not.toBeNull()
    // Le principal réécrit porte `maintenant` : rouvrir l'onglet ne créditerait pas les 5 h non plus.
    const principal = importerTexte(monde.stockage.lire(CLE_PRINCIPALE)!, etatInitial(0), CONSTANTES)
    expect(principal.ok && principal.etat.derniereSauvegardeMs).toBe(tImport)

    // Au moins une auto-sauvegarde entre l'import et la restauration : elle ne doit pas toucher au .bak.
    monde.avancer(31_000)
    const tRestauration = monde.maintenant()
    expect(a.store.getState().actions.restaurerSecours()).toEqual({ ok: true })
    const restaure = a.store.getState()
    expect({ ...restaure.etat, derniereSauvegardeMs: 0 }).toEqual({ ...avantImport, derniereSauvegardeMs: 0 })
    expect(restaure.etat.derniereSauvegardeMs).toBe(tRestauration)
    expect(restaure.resumeHorsLigne).toBeNull()
    expect(espionHorsLigne).not.toHaveBeenCalled()
  })

  it('import refusé : rien n’est écrit, l’état courant est la même référence', () => {
    const monde = creerMonde()
    const a = ouvrirProprietaire(monde)
    jouer(monde, 5)
    const avant = a.store.getState().etat
    const repere = monde.stockage.journal.length

    const resultat = a.store.getState().actions.importer('pas une sauvegarde')
    expect(resultat.ok).toBe(false)
    expect(resultat.ok === false && resultat.motif).toBe('refuse')
    expect(a.store.getState().etat).toBe(avant)
    expect(monde.stockage.journal.slice(repere)).toEqual([])
  })
})
