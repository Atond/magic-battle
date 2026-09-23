// Bandeau de lecture seule (EXG-48), encart hors-ligne (EXG-4/53) et écran de sauvegarde illisible
// (EXG-27, EXG-46/47) — T-23b. Vrai navigateur (Vitest browser mode + Playwright, ADR-20).
//
// Ce que ce fichier prouve, précisément :
//  1. l'encart hors-ligne ne chevauche **aucune** cible de jeu, vérifié par rectangles **avant** le clic
//     réel qui le ferme, à 375 px et 1440 px (spec T-23b « recouvrement par clics réels ») ;
//  2. il ne s'affiche que si l'absence dépasse le seuil de rattrapage (EXG-55), jamais en dessous ;
//  3. le bandeau de lecture seule est visible sur l'onglet secondaire et les actions y sont désactivées
//     visuellement (EXG-48), sans chevaucher lui non plus une cible ;
//  4. l'écran EXG-27 affiche un message clair, ne propose « Restaurer » que si `secoursRestaurable`, et
//     n'écrase la sauvegarde qu'après confirmation de « Nouvelle partie ».

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import { etatInitial } from '../../src/domain/moteur.ts'
import { formater } from '../../src/domain/notation.ts'
import { exporterTexte, NOM_PRINCIPAL, NOM_SECOURS } from '../../src/domain/sauvegarde/index.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { EcranSauvegardeIllisible } from '../../src/components/hud/EcranSauvegardeIllisible.tsx'
import { PREFIXE_STOCKAGE } from '../../src/state/constantes.ts'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from '../state/doubles.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import type { StoreJeuApi } from '../../src/state/store.ts'

const T0 = 1_700_000_000_000
const CLE_PRINCIPALE = `${PREFIXE_STOCKAGE}${NOM_PRINCIPAL}`
const CLE_SECOURS = `${PREFIXE_STOCKAGE}${NOM_SECOURS}`
/** EXG-55 — même seuil que `store.ts`/`EncartHorsLigne.tsx` : `nTicksMax × PAS_TICK_MS`. */
const SEUIL_HORS_LIGNE_MS = CONSTANTES.tick.nTicksMax * PAS_TICK_MS

function ouvrirAvecSauvegardeAncienne(idOnglet: string, ecartMs: number) {
  const horloge = creerHorlogeFactice(T0)
  const stockage = creerStockageFactice()
  stockage.ecrire(CLE_PRINCIPALE, exporterTexte(etatInitial(T0 - ecartMs), T0 - ecartMs))
  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge,
    stockage,
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet,
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial,
  })
  confirmerDemarrage(planificateur)
  return store
}

/** Aucun overlap de rectangles (spec T-23b) : deux éléments visibles ne se chevauchent jamais en x/y. */
function seChevauchent(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** Stockage factice qui journalise chaque écriture (clé, valeur) — pour prouver, octet près, qu'une
 *  clé précise n'a JAMAIS été touchée plutôt que de le déduire de l'état applicatif. */
function creerStockageJournalise() {
  const table = new Map<string, string>()
  const ecritures: { readonly cle: string; readonly valeur: string }[] = []
  return {
    ecritures,
    stockage: {
      lire: (cle: string) => table.get(cle) ?? null,
      ecrire: (cle: string, valeur: string) => {
        table.set(cle, valeur)
        ecritures.push({ cle, valeur })
      },
      supprimer: (cle: string) => {
        table.delete(cle)
      },
    },
  }
}

/**
 * Une vraie sauvegarde principale illisible (JSON tronqué, pas une fixture qui contourne le vrai pipeline
 * `importerTexte`) + un `.bak` valide exporté par le moteur — exactement le scénario EXG-27/EXG-46 que
 * `store.ts` doit refuser de toucher tant que « Nouvelle partie » n'est pas confirmée.
 */
function ouvrirIllisibleAvecSecoursValide(idOnglet: string) {
  const { stockage, ecritures } = creerStockageJournalise()
  const texteSecoursValide = exporterTexte(etatInitial(T0 - 60_000), T0 - 60_000)
  const texteTronque = exporterTexte(etatInitial(T0), T0).slice(0, 20) // JSON coupé au milieu : illisible.
  stockage.ecrire(CLE_PRINCIPALE, texteTronque)
  stockage.ecrire(CLE_SECOURS, texteSecoursValide)

  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage,
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet,
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial,
  })
  confirmerDemarrage(planificateur)
  // Le démarrage écrit lui-même le verrou (EXG-48) — une écriture légitime, sans rapport avec les actions
  // du test. On ne commence à journaliser qu'une fois la séquence de démarrage terminée, pour que le
  // journal ne parle plus que de ce que l'écran « sauvegarde illisible » fait réellement.
  ecritures.length = 0
  return { store, stockage, ecritures, texteTronque, texteSecoursValide }
}

describe('encart hors-ligne — recouvrement (EXG-4/53)', () => {
  it.each([375, 1440])('à %dpx, ne chevauche aucune cible de jeu avant le clic de fermeture', async (largeur) => {
    await page.viewport(largeur, 900)
    const store = ouvrirAvecSauvegardeAncienne('onglet-hl', SEUIL_HORS_LIGNE_MS + 5 * 60_000)
    const { getByTestId, getAllByTestId, unmount } = render(<Disposition store={store} />)

    const encart = getByTestId('encart-hors-ligne')
    const rectEncart = encart.getBoundingClientRect()
    expect(rectEncart.width).toBeGreaterThan(0)

    // Cibles de jeu : **toutes** les commandes visibles hors de l'encart (clic, sorts, écoles,
    // améliorations, onglets…), pas un échantillon — EXG-53 parle des panneaux de jeu en général.
    const cibles = [...document.querySelectorAll<HTMLElement>('button, [role="tab"], [role="switch"]')].filter(
      (el) => !encart.contains(el) && el.getBoundingClientRect().width > 0,
    )
    expect(getAllByTestId('bouton-clic').some((el) => cibles.includes(el))).toBe(true)
    expect(cibles.length).toBeGreaterThan(0)
    for (const cible of cibles) {
      expect(seChevauchent(rectEncart, cible.getBoundingClientRect())).toBe(false)
    }

    // Clic réel de fermeture : la fermeture retire l'encart sans avoir intercepté de cible entre-temps.
    const fermer = encart.querySelector('button')!
    await userEvent.click(fermer)
    expect(() => getByTestId('encart-hors-ligne')).toThrow()

    unmount()
    store.arreter()
  })

  it('reste absent sous le seuil de rattrapage (EXG-55)', async () => {
    await page.viewport(1440, 900)
    const store = ouvrirAvecSauvegardeAncienne('onglet-hl-court', Math.floor(SEUIL_HORS_LIGNE_MS / 2))
    const { queryByTestId, unmount } = render(<Disposition store={store} />)

    expect(queryByTestId('encart-hors-ligne')).toBeNull()

    unmount()
    store.arreter()
  })

  it('affiche l’or gagné, la durée écoulée et si le plafond a été atteint, tous deux formatés (EXG-4)', async () => {
    await page.viewport(1440, 900)

    // Cas 1 — absence modeste, sous le plafond : « X min d'absence, Y or gagné. »
    const storeSansPlafond = ouvrirAvecSauvegardeAncienne('onglet-hl-exg4-sans-plafond', SEUIL_HORS_LIGNE_MS + 5 * 60_000)
    const rendu1 = render(<Disposition store={storeSansPlafond} />)
    try {
      const resume = storeSansPlafond.getState().resumeHorsLigne
      expect(resume).not.toBeNull()
      expect(resume!.plafondAtteint).toBe(false)

      const texte = rendu1.getByTestId('encart-hors-ligne').textContent!
      // Les trois valeurs EXG-4 sont bien présentes, formatées (jamais un flottant brut) :
      expect(texte).toContain(formater(resume!.orGagne)) // or gagné
      expect(texte).toMatch(/\d+ (min|h)/) // temps écoulé formaté (`formaterDuree`)
      expect(texte).not.toContain('Absence plafonnée') // plafond non atteint : pas le libellé de plafond
    } finally {
      rendu1.unmount()
      storeSansPlafond.arreter()
    }

    // Cas 2 — absence très longue, au-delà du plafond de rattrapage : « Absence plafonnée à … »
    const storeAvecPlafond = ouvrirAvecSauvegardeAncienne('onglet-hl-exg4-avec-plafond', SEUIL_HORS_LIGNE_MS * 1000)
    const rendu2 = render(<Disposition store={storeAvecPlafond} />)
    try {
      const resume = storeAvecPlafond.getState().resumeHorsLigne
      expect(resume).not.toBeNull()
      expect(resume!.plafondAtteint).toBe(true)

      const texte = rendu2.getByTestId('encart-hors-ligne').textContent!
      expect(texte).toContain(formater(resume!.orGagne))
      expect(texte).toMatch(/\d+ (min|h)/)
      expect(texte).toContain('Absence plafonnée') // le plafond atteint change bien le libellé affiché
    } finally {
      rendu2.unmount()
      storeAvecPlafond.arreter()
    }
  })
})

describe('bandeau de lecture seule (EXG-48)', () => {
  it('visible sur le second onglet, actions désactivées, sans chevaucher les cibles de jeu', async () => {
    await page.viewport(1440, 900)
    const horloge = creerHorlogeFactice(T0)
    const stockage = creerStockageFactice()
    const canal = creerCanalFactice()

    const planA = creerPortPlanificateurFactice()
    const storeA = creerStoreJeu({
      horloge,
      stockage,
      canal,
      matchMedia: creerMatchMediaFactice(),
      idOnglet: 'onglet-A',
      portPage: creerPortPageFactice(),
      portPlanificateur: planA,
      etatInitial,
    })
    confirmerDemarrage(planA)
    expect(storeA.getState().droitEcriture).toBe(true)

    const planB = creerPortPlanificateurFactice()
    const storeB = creerStoreJeu({
      horloge,
      stockage,
      canal,
      matchMedia: creerMatchMediaFactice(),
      idOnglet: 'onglet-B',
      portPage: creerPortPageFactice(),
      portPlanificateur: planB,
      etatInitial,
    })
    expect(storeB.getState().lectureSeule).toBe(true)

    const { getByTestId, getAllByTestId, unmount } = render(<Disposition store={storeB} />)

    const bandeau = getByTestId('bandeau-lecture-seule')
    const rectBandeau = bandeau.getBoundingClientRect()
    expect(rectBandeau.width).toBeGreaterThan(0)

    const boutonClic = getAllByTestId('bouton-clic').find((el) => el.getBoundingClientRect().width > 0)!
    expect(boutonClic).toBeDisabled()
    expect(seChevauchent(rectBandeau, boutonClic.getBoundingClientRect())).toBe(false)

    unmount()
    storeA.arreter()
    storeB.arreter()
  })
})

describe('écran de sauvegarde illisible (EXG-27)', () => {
  function creerStoreDeTest(): StoreJeuApi {
    const planificateur = creerPortPlanificateurFactice()
    const store = creerStoreJeu({
      horloge: creerHorlogeFactice(T0),
      stockage: creerStockageFactice(),
      canal: creerCanalFactice(),
      matchMedia: creerMatchMediaFactice(),
      idOnglet: 'onglet-illisible',
      portPage: creerPortPageFactice(),
      portPlanificateur: planificateur,
      etatInitial,
    })
    confirmerDemarrage(planificateur)
    return store
  }

  it('propose « Restaurer » seulement quand secoursRestaurable est vrai', () => {
    const storeAvecSecours: StoreJeuApi = creerStoreDeTest()
    const { getByRole, queryByRole, unmount } = render(
      <EcranSauvegardeIllisible
        store={storeAvecSecours}
        illisible={{ motif: 'jsonIllisible', message: 'JSON invalide à la position 12', secoursRestaurable: true }}
      />,
    )
    expect(getByRole('alert')).toBeTruthy()
    expect(queryByRole('button', { name: /restaurer/i })).not.toBeNull()
    unmount()
    storeAvecSecours.arreter()

    const storeSansSecours: StoreJeuApi = creerStoreDeTest()
    const rendu2 = render(
      <EcranSauvegardeIllisible
        store={storeSansSecours}
        illisible={{ motif: 'jsonIllisible', message: 'JSON invalide à la position 12', secoursRestaurable: false }}
      />,
    )
    expect(rendu2.queryByRole('button', { name: /restaurer/i })).toBeNull()
    rendu2.unmount()
    storeSansSecours.arreter()
  })

  it('« Annuler » à la confirmation : zéro écriture, principal et .bak identiques octet près', async () => {
    const { store, stockage, ecritures, texteTronque, texteSecoursValide } = ouvrirIllisibleAvecSecoursValide('onglet-illisible-annuler')
    expect(store.getState().sauvegardeIllisible).not.toBeNull()
    const illisible = store.getState().sauvegardeIllisible!
    expect(illisible.secoursRestaurable).toBe(true) // le `.bak` valide de la fixture est bien détecté.

    const { getByRole, unmount } = render(<EcranSauvegardeIllisible store={store} illisible={illisible} />)

    try {
      await userEvent.click(getByRole('button', { name: 'Nouvelle partie' }))
      const dialogue = getByRole('dialog', { name: 'Repartir de zéro ?' })
      const annuler = [...dialogue.querySelectorAll('button')].find((b) => b.textContent === 'Annuler')!
      expect(document.activeElement).toBe(annuler)

      await userEvent.click(annuler)
      expect(() => getByRole('dialog')).toThrow()

      // Ni le principal ni le `.bak` n'ont été touchés — la fixture reste identique octet près — et
      // aucune écriture, quelle que soit la clé, n'a eu lieu depuis la mise en place (EXG-27 : « rien
      // n'est écrit tant que ce n'est pas confirmé »).
      expect(ecritures.length).toBe(0)
      expect(stockage.lire(CLE_PRINCIPALE)).toBe(texteTronque)
      expect(stockage.lire(CLE_SECOURS)).toBe(texteSecoursValide)
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('« Confirmer » : le principal est réécrit, le `.bak` valide n’est jamais écrasé', async () => {
    const { store, stockage, ecritures, texteSecoursValide } = ouvrirIllisibleAvecSecoursValide('onglet-illisible-confirmer')
    const illisible = store.getState().sauvegardeIllisible!

    const { getByRole, unmount } = render(<EcranSauvegardeIllisible store={store} illisible={illisible} />)

    try {
      await userEvent.click(getByRole('button', { name: 'Nouvelle partie' }))
      const dialogue = getByRole('dialog', { name: 'Repartir de zéro ?' })
      const confirmer = [...dialogue.querySelectorAll('button')].find((b) => b.textContent === 'Confirmer la nouvelle partie')!
      await userEvent.click(confirmer)

      expect(() => getByRole('dialog')).toThrow()

      // Le principal a bien été écrit (la nouvelle partie prend sa place), mais AUCUNE écriture n'a visé
      // la clé `.bak` : un principal illisible n'a rien de fiable à y mettre à l'abri (EXG-46 « ne jamais
      // écraser un `.bak` valide avec une donnée corrompue »).
      expect(ecritures.some((e) => e.cle === CLE_PRINCIPALE)).toBe(true)
      expect(ecritures.some((e) => e.cle === CLE_SECOURS)).toBe(false)
      expect(stockage.lire(CLE_SECOURS)).toBe(texteSecoursValide)
      expect(stockage.lire(CLE_PRINCIPALE)).not.toBe(texteSecoursValide)
      expect(store.getState().sauvegardeIllisible).toBeNull()
      expect(store.getState().droitEcriture).toBe(true)
    } finally {
      unmount()
      store.arreter()
    }
  })
})
