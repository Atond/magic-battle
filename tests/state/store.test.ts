// Miroir de `src/state/store.ts` — fabrique `creerStoreJeu`, boucle hors React (T-18, ADR-19).
// Persistance **factice en mémoire** uniquement (`tests/state/doubles.ts`) : ni `localStorage` ni
// `BroadcastChannel` réels — c'est T-23a qui les branche sur ce même contrat.

import { describe, expect, it } from 'vitest'

import { PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import { appliquerDelta, etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import { ETAPES_DEMARRAGE } from '../../src/state/demarrage.ts'
import type { EtapeDemarrage } from '../../src/state/demarrage.ts'
import type { OptionsStoreJeu } from '../../src/state/store.ts'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from './doubles.ts'

const T0 = 1_700_000_000_000

/** État de nouvelle partie, mais productif : sans école montée, `or` ne bougerait jamais (DPS = 0). */
function etatInitialProductif(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return { ...base, ecoles: { ...base.ecoles, feu: { niveau: 10, debloquee: true, revelee: true } } }
}

/** Assemble un environnement factice complet et la fabrique prête à l'emploi, sans la démarrer soi-même. */
function creerEnvironnement(options: { etatInitialFn?: (horodatageMs: number) => EtatJeu } = {}) {
  const horloge = creerHorlogeFactice(T0)
  const stockage = creerStockageFactice()
  const canal = creerCanalFactice()
  const matchMedia = creerMatchMediaFactice()
  const portPage = creerPortPageFactice()
  const portPlanificateur = creerPortPlanificateurFactice()
  const etapes: EtapeDemarrage[] = []

  const opts: OptionsStoreJeu = {
    horloge,
    stockage,
    canal,
    matchMedia,
    idOnglet: 'onglet-test',
    portPage,
    portPlanificateur,
    etatInitial: options.etatInitialFn ?? etatInitialProductif,
    onEtapeDemarrage: (etape) => etapes.push(etape),
  }

  return { horloge, stockage, canal, matchMedia, portPage, portPlanificateur, etapes, opts }
}

/** Crée le store et franchit l'attente « écrire-puis-relire » du verrou (T-23a). */
function creerEtConfirmer(env: ReturnType<typeof creerEnvironnement>) {
  const store = creerStoreJeu(env.opts)
  confirmerDemarrage(env.portPlanificateur)
  return store
}

describe('creerStoreJeu — ordre de démarrage (contrat SequenceDemarrage)', () => {
  it('traverse verrou → import → hors-ligne → sauvegarde → boucle → auto-sauvegarde, dans cet ordre exact', () => {
    const env = creerEnvironnement()
    const store = creerEtConfirmer(env)

    expect(env.etapes).toEqual([...ETAPES_DEMARRAGE])
    expect(store.getState().pret).toBe(true)
    expect(store.getState().droitEcriture).toBe(true)

    store.arreter()
  })

  it('la sauvegarde immédiate écrit bien sous la clé préfixée magic-battle:sauvegarde (ADR-21)', () => {
    const env = creerEnvironnement()
    const store = creerEtConfirmer(env)

    expect(env.stockage.lire('magic-battle:sauvegarde')).not.toBeNull()

    store.arreter()
  })
})

describe('creerStoreJeu — boucle hors React (EXG-1 à EXG-3, EXG-55)', () => {
  it('un delta de 5 s ne produit qu\'une seule notification et vaut 50 ticks (EXG-2)', () => {
    const env = creerEnvironnement()
    const store = creerEtConfirmer(env)
    const etatApresDemarrage = store.getState().etat

    let notifications = 0
    const desabonner = store.subscribe(() => {
      notifications += 1
    })

    env.horloge.avancer(5_000)
    env.portPlanificateur.declencherFrame()

    expect(notifications).toBe(1)
    const attendu = appliquerDelta(etatApresDemarrage, 5_000, CONSTANTES)
    expect(store.getState().etat).toEqual(attendu)
    expect(store.getState().etat.ticksEcoules).toBe(etatApresDemarrage.ticksEcoules + 50)

    desabonner()
    store.arreter()
  })

  it('aucun setState si le delta ne produit aucun tick (sous 100 ms)', () => {
    const env = creerEnvironnement()
    const store = creerEtConfirmer(env)

    let notifications = 0
    const desabonner = store.subscribe(() => {
      notifications += 1
    })

    env.horloge.avancer(PAS_TICK_MS - 1)
    env.portPlanificateur.declencherFrame()

    expect(notifications).toBe(0)

    desabonner()
    store.arreter()
  })

  it('un report sous 100 ms n\'est pas perdu : deux frames de 60 ms produisent un tick au total (EXG-2)', () => {
    const env = creerEnvironnement()
    const store = creerEtConfirmer(env)
    const etatApresDemarrage = store.getState().etat

    env.horloge.avancer(60)
    env.portPlanificateur.declencherFrame() // 60 ms : aucun tick, report conservé côté horloge de frame
    expect(store.getState().etat.ticksEcoules).toBe(etatApresDemarrage.ticksEcoules)

    env.horloge.avancer(60) // cumul réel 120 ms depuis le dernier traitement : un tick doit sortir
    env.portPlanificateur.declencherFrame()
    expect(store.getState().etat.ticksEcoules).toBe(etatApresDemarrage.ticksEcoules + 1)

    store.arreter()
  })

  it('un delta au-dessus du seuil nTicksMax × PAS_TICK_MS part vers calculHorsLigne, pas la forme fermée d\'appliquerDelta (EXG-55)', () => {
    const env = creerEnvironnement()
    const store = creerEtConfirmer(env)
    const etatApresDemarrage = store.getState().etat
    const seuilMs = CONSTANTES.tick.nTicksMax * PAS_TICK_MS

    env.horloge.avancer(seuilMs + 10_000)
    env.portPlanificateur.declencherFrame()

    const apres = store.getState().etat
    // Signature de `calculHorsLigne` : `ticksEcoules` ne bouge jamais, `tempsHorsLigneMs` si.
    // La forme fermée d'`appliquerDelta` (branche EXG-3) ferait l'inverse : `ticksEcoules` grimperait
    // de `nTicksMax` et `tempsHorsLigneMs` resterait à 0. Une faute qui appellerait `appliquerDelta` à la
    // place de `calculHorsLigne` ferait donc échouer ces deux assertions, pas une seule.
    expect(apres.ticksEcoules).toBe(etatApresDemarrage.ticksEcoules)
    expect(apres.tempsHorsLigneMs).toBeGreaterThan(0)
    expect(apres.resteDeltaMs).toBe(0)
    expect(store.getState().resumeHorsLigne).not.toBeNull()

    store.arreter()
  })
})

describe('creerStoreJeu — isolation multi-onglet (ports dédiés, spec T-18 N5)', () => {
  it('deux fabriques avec des ports portPage/portPlanificateur distincts reçoivent des événements indépendants', () => {
    const envA = creerEnvironnement()
    const envB = creerEnvironnement()
    const storeA = creerEtConfirmer(envA)
    const storeB = creerEtConfirmer(envB)

    const ticksInitiauxA = storeA.getState().etat.ticksEcoules
    const ticksInitiauxB = storeB.getState().etat.ticksEcoules

    // Seule l'horloge et le planificateur de A avancent : B ne doit voir passer aucun événement.
    envA.horloge.avancer(1_000)
    envA.portPlanificateur.declencherFrame()

    expect(storeA.getState().etat.ticksEcoules).toBeGreaterThan(ticksInitiauxA)
    expect(storeB.getState().etat.ticksEcoules).toBe(ticksInitiauxB)
    // Le `pagehide` d'un onglet n'arrête pas la boucle de l'autre (ports distincts, pas un `window` partagé).
    envA.portPage.declencherPageHide()
    expect(envA.portPlanificateur.idsIntervalleActifs().length).toBe(0)
    expect(envB.portPlanificateur.idsIntervalleActifs().length).toBeGreaterThan(0)

    storeB.arreter()
  })
})
