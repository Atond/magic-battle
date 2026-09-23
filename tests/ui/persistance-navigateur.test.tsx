// Persistance réelle en vrai navigateur (T-23a, ADR-20). Les règles sont prouvées en Node sur un monde
// simulé (`tests/state/persistance.test.ts`) ; ce fichier prouve le **transport** : le vrai
// `localStorage` et le vrai `BroadcastChannel`, branchés par `creerStockageLocal`/`creerCanalDiffusion`.
// Deux stores dans le même document suffisent : deux instances de `BroadcastChannel` du même nom se
// parlent dans un même document, jamais une instance avec elle-même.
//
// Horloge et planificateurs restent factices (rien ne part tout seul) : le relais observé ici ne peut
// venir **que** du message du canal, puisque le battement de B n'est jamais déclenché.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { INTERVALLE_AUTOSAVE_MS } from '../../src/domain/constantes-moteur.ts'
import { etatInitial } from '../../src/domain/moteur.ts'
import { exporterTexte, importerTexte } from '../../src/domain/sauvegarde/index.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { CanvasCombat } from '../../src/canvas/CanvasCombat.tsx'
import { NOM_CANAL_VERROU, PREFIXE_STOCKAGE } from '../../src/state/constantes.ts'
import { creerCanalDiffusion, creerStockageLocal } from '../../src/state/portsNavigateur.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import type { StoreJeuApi } from '../../src/state/store.ts'
import {
  confirmerDemarrage,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
} from '../state/doubles.ts'

const T0 = 1_700_000_000_000
const CLE_PRINCIPALE = `${PREFIXE_STOCKAGE}sauvegarde`
const CLE_SECOURS = `${PREFIXE_STOCKAGE}sauvegarde.bak`
const CLE_VERROU = `${PREFIXE_STOCKAGE}verrou`

function etatProductif(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return { ...base, ecoles: { ...base.ecoles, feu: { niveau: 10, debloquee: true, revelee: true } } }
}

function nettoyerEspace(): void {
  for (const cle of Object.keys(window.localStorage)) {
    if (cle.startsWith(PREFIXE_STOCKAGE)) window.localStorage.removeItem(cle)
  }
}

const ouverts: StoreJeuApi[] = []

function ouvrirOnglet(id: string, horloge: ReturnType<typeof creerHorlogeFactice>) {
  const planificateur = creerPortPlanificateurFactice()
  const page = creerPortPageFactice()
  const store = creerStoreJeu({
    horloge,
    stockage: creerStockageLocal(),
    canal: creerCanalDiffusion(NOM_CANAL_VERROU),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: id,
    portPage: page,
    portPlanificateur: planificateur,
    etatInitial: etatProductif,
  })
  ouverts.push(store)
  return { store, planificateur, page }
}

beforeEach(() => {
  nettoyerEspace()
})

afterEach(() => {
  for (const store of ouverts.splice(0)) store.arreter()
  nettoyerEspace()
})

describe('transport réel : localStorage + BroadcastChannel (EXG-22, EXG-48, ADR-21)', () => {
  it('le second onglet est figé ; la fermeture propre du premier le fait relayer par le vrai canal', async () => {
    const clesAvant = new Set(Object.keys(window.localStorage))
    const horloge = creerHorlogeFactice(T0)
    const a = ouvrirOnglet('onglet-A', horloge)
    confirmerDemarrage(a.planificateur)
    expect(a.store.getState().droitEcriture).toBe(true)
    expect(window.localStorage.getItem(CLE_PRINCIPALE)).not.toBeNull()

    const b = ouvrirOnglet('onglet-B', horloge)
    expect(b.store.getState().lectureSeule).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(CLE_VERROU)!).idProprietaire).toBe('onglet-A')

    horloge.avancer(3_000)
    a.planificateur.declencherFrame()
    const orFinalA = a.store.getState().etat.bourse.or
    expect(orFinalA).toBeGreaterThan(0)

    a.page.declencherPageHide()
    // A a sauvegardé dans le vrai `localStorage` et rendu le verrou.
    const texteFerme = window.localStorage.getItem(CLE_PRINCIPALE)!
    const relu = importerTexte(texteFerme, etatInitial(0), CONSTANTES)
    expect(relu.ok && relu.etat.bourse.or).toBe(orFinalA)

    // Le message « libération » traverse le vrai `BroadcastChannel` (asynchrone) : B revendique.
    await vi.waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(CLE_VERROU) ?? 'null')?.idProprietaire).toBe('onglet-B')
    })
    confirmerDemarrage(b.planificateur)

    const sb = b.store.getState()
    expect(sb.droitEcriture).toBe(true)
    expect(sb.lectureSeule).toBe(false)
    expect(sb.etat.bourse.or).toBe(orFinalA) // horloge figée : relu tel quel, crédit hors-ligne nul

    // ADR-21 — tout ce que le jeu a posé dans le vrai stockage est préfixé.
    const nouvelles = Object.keys(window.localStorage).filter((cle) => !clesAvant.has(cle))
    expect(nouvelles.length).toBeGreaterThanOrEqual(2)
    expect(nouvelles.filter((cle) => !cle.startsWith(PREFIXE_STOCKAGE))).toEqual([])
  })

  it('le port localStorage refuse une clé hors de l’espace magic-battle: (ADR-21)', () => {
    const stockage = creerStockageLocal()
    expect(() => stockage.ecrire('sauvegarde', 'x')).toThrow(/magic-battle:/)
    expect(window.localStorage.getItem('sauvegarde')).toBeNull()
    expect(() => creerCanalDiffusion('verrou')).toThrow(/magic-battle:/)
  })

  it('EXG-27 sur le vrai localStorage : principal tronqué, rien n’est réécrit après auto-sauvegarde et hidden', () => {
    const texte = exporterTexte(etatProductif(T0 - 3_600_000), T0 - 3_600_000)
    const tronque = texte.slice(0, Math.floor(texte.length / 2))
    window.localStorage.setItem(CLE_PRINCIPALE, tronque)
    window.localStorage.setItem(CLE_SECOURS, texte)

    const horloge = creerHorlogeFactice(T0)
    const a = ouvrirOnglet('onglet-A', horloge)
    confirmerDemarrage(a.planificateur)
    expect(a.store.getState().sauvegardeIllisible?.secoursRestaurable).toBe(true)

    horloge.avancer(31_000)
    a.planificateur.declencherIntervallesDe(INTERVALLE_AUTOSAVE_MS)
    a.page.declencherVisibiliteChangee() // hidden
    a.page.declencherPageHide()

    expect(window.localStorage.getItem(CLE_PRINCIPALE)).toBe(tronque)
    expect(window.localStorage.getItem(CLE_SECOURS)).toBe(texte)
  })
})

describe('canvas figé dans un onglet secondaire (EXG-48)', () => {
  async function attendreFrames(n: number): Promise<void> {
    for (let i = 0; i < n; i += 1) await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }

  it('le propriétaire dessine, le secondaire ne dessine jamais', async () => {
    const horloge = creerHorlogeFactice(T0)
    const a = ouvrirOnglet('onglet-A', horloge)
    confirmerDemarrage(a.planificateur)
    const b = ouvrirOnglet('onglet-B', horloge)
    expect(b.store.getState().lectureSeule).toBe(true)

    const rendu = render(
      <div style={{ width: 600, height: 400, display: 'flex' }}>
        <div data-testid="a" style={{ flex: 1, display: 'flex' }}>
          <CanvasCombat store={a.store} />
        </div>
        <div data-testid="b" style={{ flex: 1, display: 'flex' }}>
          <CanvasCombat store={b.store} />
        </div>
      </div>,
    )
    await attendreFrames(5)

    const canvasA = rendu.getByTestId('a').querySelector('canvas')!
    const canvasB = rendu.getByTestId('b').querySelector('canvas')!
    // `dernierFrameMs` n'est posé qu'après un `dessinerScene` : c'est la trace d'un dessin réel.
    expect(canvasA.dataset.dernierFrameMs).toBeDefined()
    expect(canvasB.dataset.dernierFrameMs).toBeUndefined()
    rendu.unmount()
  })
})
