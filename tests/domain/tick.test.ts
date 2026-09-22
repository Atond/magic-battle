// Miroir de `src/domain/moteur.ts` — boucle de simulation (EXG-1, EXG-2, EXG-3, EXG-30).
// Aucune valeur d'équilibrage n'est écrite ici : tout vient de `src/donnees/constantes.ts`.

import { describe, expect, it } from 'vitest'

import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import { appliquerDelta, degatsParSeconde, etatInitial, tick } from '../../src/domain/moteur.ts'
import type { Constantes, EtatJeu, IdEcole } from '../../src/domain/types.ts'

const C = CONSTANTES
const HORODATAGE = 1_700_000_000_000

/** État de départ productif : quelques niveaux d'école, sinon le DPS vaut 0 et les tests ne prouvent rien. */
function etatProductif(niveaux: Partial<Record<IdEcole, number>> = { feu: 12, glace: 4 }): EtatJeu {
  const base = etatInitial(HORODATAGE)
  const ecoles = { ...base.ecoles }
  for (const [id, niveau] of Object.entries(niveaux) as [IdEcole, number][]) {
    ecoles[id] = { ...ecoles[id], niveau, debloquee: true, revelee: true }
  }
  return { ...base, ecoles }
}

/** Gèle récursivement : en mode strict (module ES), toute mutation de l'entrée lève alors une TypeError. */
function gelerProfond<T>(valeur: T): T {
  if (valeur !== null && typeof valeur === 'object') {
    for (const enfant of Object.values(valeur)) gelerProfond(enfant)
    Object.freeze(valeur)
  }
  return valeur
}

function ticksSuccessifs(etat: EtatJeu, nombre: number, constantes: Constantes = C): EtatJeu {
  let courant = etat
  for (let i = 0; i < nombre; i += 1) courant = tick(courant, constantes)
  return courant
}

describe('degatsParSeconde — chaîne de DPS §8', () => {
  it('somme les écoles débloquées lues dans l\'état, facteurs non implémentés neutres', () => {
    const etat = etatProductif({ feu: 3 })
    const attendu = 3 * C.ecoles.feu.productionBase
    expect(degatsParSeconde(etat, C)).toBeCloseTo(attendu, 12)
  })

  it('ignore une école non débloquée (EXG-7) et un état vierge produit 0', () => {
    const vierge = etatInitial(HORODATAGE)
    expect(degatsParSeconde(vierge, C)).toBe(0)

    const verrouillee: EtatJeu = {
      ...vierge,
      ecoles: { ...vierge.ecoles, glace: { niveau: 50, debloquee: false, revelee: true } },
    }
    expect(degatsParSeconde(verrouillee, C)).toBe(0)
  })

  it('applique le multiplicateur de palier à chaque seuil franchi (§8)', () => {
    const seuils = C.ecoles.feu.paliersSeuils
    const niveau = seuils[1] // deux seuils franchis (le 1er et le 2e)
    const attendu =
      niveau * C.ecoles.feu.productionBase * C.ecoles.feu.multiplicateurParPalier ** 2
    expect(degatsParSeconde(etatProductif({ feu: niveau }), C)).toBeCloseTo(attendu, 9)
  })
})

describe('tick — pas fixe de 100 ms (EXG-1)', () => {
  it('10 ticks de 100 ms et un appel de 1000 ms rendent le même état, champ pour champ', () => {
    // Ce que ce test verrouille : le **contrat** d'EXG-1 — « une frame de 1000 ms vaut dix pas de
    // 100 ms, quelle que soit la porte d'entrée ». Il ne compare pas deux calculs différents : sous le
    // seuil de rattrapage, `appliquerDelta` exécute littéralement la boucle de `tick` (`moteur.ts`).
    // L'égalité est donc exacte, et c'est `toEqual` qu'il faut écrire — pas un « écart < 1e-9 » qui
    // serait nul par construction et ne pourrait jamais monter. La comparaison des deux chemins
    // réellement distincts (itératif contre forme fermée) est dans la section EXG-3.
    const base = etatProductif()
    const parTicks = ticksSuccessifs(base, 10)
    const parDelta = appliquerDelta(base, 10 * PAS_TICK_MS, C)

    expect(parTicks.bourse.or).toBeGreaterThan(0)
    expect(parDelta).toEqual(parTicks)
    expect(parDelta.tempsJeuMs).toBe(base.tempsJeuMs + 10 * PAS_TICK_MS)
  })

  it('avance le temps de jeu d\'exactement un pas et ne mute pas son entrée', () => {
    const base = gelerProfond(etatProductif())
    const copie = structuredClone(base)
    const suivant = tick(base, C)

    expect(suivant.tempsJeuMs).toBe(base.tempsJeuMs + PAS_TICK_MS)
    expect(suivant.ticksEcoules).toBe(base.ticksEcoules + 1)
    expect(suivant).not.toBe(base)
    expect(base).toEqual(copie)
  })
})

describe('appliquerDelta — rattrapage des ticks manquants (EXG-2)', () => {
  // Même remarque qu'en EXG-1 : sous le seuil, les deux appels partagent la boucle. Ces tests fixent le
  // contrat de `appliquerDelta` (nombre de pas, reste conservé, entrée intacte), pas l'équivalence de
  // deux implémentations — celle-là se prouve en EXG-3, en ne faisant varier que `nTicksMax`.
  it('un delta de 5000 ms produit exactement l\'état de 50 ticks successifs', () => {
    const base = etatProductif()
    const parTicks = ticksSuccessifs(base, 50)
    const parDelta = appliquerDelta(base, 50 * PAS_TICK_MS, C)

    expect(parDelta).toEqual(parTicks)
    expect(parDelta.ticksEcoules).toBe(50)
    expect(parDelta.ticksRattrapes).toBe(50)
  })

  it('accumule le reste sous 100 ms sans jamais le perdre', () => {
    const base = etatProductif()
    const apres1 = appliquerDelta(base, 150, C)
    expect(apres1.ticksEcoules).toBe(1)
    expect(apres1.resteDeltaMs).toBe(50)

    const apres2 = appliquerDelta(apres1, 60, C)
    expect(apres2.ticksEcoules).toBe(2)
    expect(apres2.resteDeltaMs).toBe(10)

    // Conservation du temps injecté : 150 + 60 = temps simulé + reste en attente.
    expect(apres2.tempsJeuMs + apres2.resteDeltaMs).toBe(210)
  })

  it('ignore un delta négatif, nul ou non fini sans produire de NaN (robustesse EXG-49)', () => {
    const base = etatProductif()
    for (const dt of [0, -1000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const resultat = appliquerDelta(base, dt, C)
      expect(resultat.ticksEcoules).toBe(0)
      expect(Number.isFinite(resultat.bourse.or)).toBe(true)
      expect(resultat.bourse.or).toBe(base.bourse.or)
    }
  })

  it('ne mute pas l\'état d\'entrée, même sur un gros rattrapage', () => {
    const base = gelerProfond(etatProductif())
    const copie = structuredClone(base)
    appliquerDelta(base, 2 * 3_600_000, C)
    expect(base).toEqual(copie)
  })
})

describe('appliquerDelta — bascule en forme fermée au-delà du seuil N (EXG-3)', () => {
  /*
   * ── Comment lire cette section ────────────────────────────────────────────────────────────────
   * À Δt fixé, `appliquerDelta` a deux chemins et **une seule** variable qui décide lequel s'exécute :
   * `nTicksMax`. Au-dessus du seuil, `N` pas de production sont crédités en une multiplication (forme
   * fermée) ; en dessous, `tick()` est appelé `N` fois. Comparer les deux en ne faisant varier que
   * `nTicksMax` est donc le seul montage où l'équivalence dit quelque chose : avec le seuil réel, un
   * petit Δt fait tourner la même boucle des deux côtés et l'écart est nul par construction.
   *
   * ── D'où vient la tolérance de 1e-9 ───────────────────────────────────────────────────────────
   * Tant que le combat ne change pas de zone, les deux chemins calculent la même quantité
   * `N × dps × 0,1 s × taux_or(zone)` : l'un par `N` additions du même incrément, l'autre par une
   * multiplication. Le seul écart possible est l'arrondi de la sommation, majoré par `(N−1) × ε` avec
   * `ε = 2⁻⁵³ ≈ 1,11e-16` — soit 6,7e-13 au pire pour N = 6000 (mesuré : 5,6e-14). Le 1e-9 exigé par
   * la règle du domaine passe donc avec trois ordres de grandeur de marge, et il n'a rien d'arbitraire :
   * c'est le seuil de la règle, la borne d'erreur réelle est 1000 fois plus basse.
   *
   * Dès que la zone change, ce n'est plus un arrondi mais une divergence de modèle (des dizaines de
   * pourcents) : c'est l'objet du deuxième test, qui la nomme au lieu de la noyer dans un « < 1 % ».
   */

  /** Constantes identiques au catalogue, à `nTicksMax` près : la seule variable de la bascule. */
  function avecSeuil(nTicksMax: number): Constantes {
    return { ...C, tick: { ...C.tick, nTicksMax } }
  }

  // École de Feu au niveau 1 : le magicien produit, mais trop peu pour finir la zone 1 en 10 minutes.
  // L'hypothèse « la zone ne bouge pas » est vérifiée dans le test, jamais supposée.
  const ZONE_STABLE = etatProductif({ feu: 1 })

  it('à Δt égal, seul nTicksMax change : itératif et forme fermée à moins de 1e-9', () => {
    for (const nbTicks of [1, 10, 100, 1_000, 6_000]) {
      const dtMs = nbTicks * PAS_TICK_MS
      const itere = appliquerDelta(ZONE_STABLE, dtMs, avecSeuil(nbTicks))
      const fermee = appliquerDelta(ZONE_STABLE, dtMs, avecSeuil(nbTicks - 1))

      // Les deux chemins sont bien distincts : l'un a itéré N fois, l'autre pas une seule.
      expect(itere.ticksRattrapes, `N = ${nbTicks}`).toBe(nbTicks)
      expect(fermee.ticksRattrapes, `N = ${nbTicks}`).toBe(0)
      // Hypothèse de l'équivalence, rendue explicite : même zone ⇒ même taux de conversion or/dégâts.
      expect(itere.combat.zone, `N = ${nbTicks}`).toBe(ZONE_STABLE.combat.zone)

      expect(itere.bourse.or).toBeGreaterThan(0)
      const ecartRelatif = Math.abs(fermee.bourse.or - itere.bourse.or) / itere.bourse.or
      expect(ecartRelatif, `N = ${nbTicks}`).toBeLessThan(1e-9)
      expect(fermee.tempsJeuMs, `N = ${nbTicks}`).toBe(itere.tempsJeuMs)
      expect(fermee.ticksEcoules, `N = ${nbTicks}`).toBe(itere.ticksEcoules)
    }
  })

  it('quand la zone change, la forme fermée n\'approche plus l\'itératif — et reste conservatrice', () => {
    // Feu 12 : la zone 1 tombe en moins d'une minute, l'hypothèse du test précédent est violée.
    const base = etatProductif()
    const nbTicks = 600
    const itere = appliquerDelta(base, nbTicks * PAS_TICK_MS, avecSeuil(nbTicks))
    const fermee = appliquerDelta(base, nbTicks * PAS_TICK_MS, avecSeuil(nbTicks - 1))

    expect(itere.combat.zone).toBeGreaterThan(base.combat.zone)
    // L'écart n'est plus un arrondi : il se compte en dizaines de pourcents. C'est le prix assumé
    // d'EXG-3, et il penche toujours du même côté — la forme fermée crédite au taux de la zone de
    // départ, donc jamais plus que la simulation pas à pas.
    expect(fermee.bourse.or).toBeLessThan(itere.bourse.or)

    // Ce que la forme fermée promet exactement : une production **linéaire en Δt**, aveugle à la
    // progression du combat. Référence indépendante du catalogue : le même chemin fermé sur un pas.
    const unPas = appliquerDelta(base, PAS_TICK_MS, avecSeuil(0))
    const attendu = nbTicks * (unPas.bourse.or - base.bourse.or)
    expect(Math.abs(fermee.bourse.or - attendu) / attendu).toBeLessThan(1e-9)
  })

  it('un delta de 2 h n\'itère pas une seule fois', () => {
    const base = etatProductif()
    const deuxHeuresMs = 2 * 3_600_000
    const resultat = appliquerDelta(base, deuxHeuresMs, C)

    expect(resultat.ticksEcoules).toBe(deuxHeuresMs / PAS_TICK_MS)
    // `toBe(0)` et non « ≤ nTicksMax » : la seconde formulation resterait verte si la bascule se
    // mettait à itérer 599 fois avant de rendre la main.
    expect(resultat.ticksRattrapes).toBe(0)
    expect(resultat.bourse.or).toBeGreaterThan(0)
    expect(Number.isFinite(resultat.bourse.or)).toBe(true)
  })
})

describe('coût constant de la boucle (EXG-30)', () => {
  /*
   * Les deux premiers tests lisent `ticksRattrapes`, un compteur que `tick()` s'incrémente lui-même :
   * ils comptent les **appels** à `tick()`, pas le coût d'un appel. Ils documentent l'intention
   * (« une frame de 1 s vaut toujours dix pas, une absence de 1000 h aussi »), ils ne la prouvent pas —
   * une boucle sur l'historique ajoutée dans `tick()` les laisserait verts (LRN-002). La preuve est le
   * troisième test, chronométré de l'extérieur.
   */
  it('le nombre d\'itérations par frame ne dépend pas de l\'ancienneté de la session', () => {
    let etat = etatProductif()
    const iterationsParFrame: number[] = []

    // 2 h de session découpées en frames de 1 s, échantillonnées toutes les 10 minutes.
    for (let minute = 0; minute < 120; minute += 1) {
      for (let seconde = 0; seconde < 60; seconde += 1) {
        const avant = etat.ticksRattrapes
        etat = appliquerDelta(etat, 1_000, C)
        if (minute % 10 === 0 && seconde === 0) iterationsParFrame.push(etat.ticksRattrapes - avant)
      }
    }

    expect(iterationsParFrame).toHaveLength(12)
    expect(new Set(iterationsParFrame).size).toBe(1)
    expect(iterationsParFrame[0]).toBe(1_000 / PAS_TICK_MS)
  })

  it('un delta arbitrairement grand n\'augmente jamais le nombre d\'itérations', () => {
    const base = etatProductif()
    const iterations = [1, 10, 100, 1_000].map((heures) => {
      const resultat = appliquerDelta(base, heures * 3_600_000, C)
      return resultat.ticksRattrapes - base.ticksRattrapes
    })

    // Zéro, pas « au plus nTicksMax » : au-delà du seuil la bascule n'itère pas du tout.
    expect(iterations).toEqual([0, 0, 0, 0])
  })

  it(
    'sur une session simulée de 2 h, le temps d\'exécution par frame ne dérive pas (spec §12)',
    () => {
      // Pourquoi un chronomètre et pas un compteur : la propriété à tenir est « le coût d'une frame ne
      // dépend pas de l'ancienneté de la session ». Aucun compteur interne ne peut la prouver
      // (LRN-002) ; seule une mesure extérieure voit une boucle proportionnelle à l'historique.
      //
      // Sur la marge : la spec §12 demande « < 10 % d'écart entre début et fin de session ». Une frame
      // coûte ici ~0,02 ms ; à cette échelle, 10 % est très en dessous du bruit d'ordonnancement d'une
      // machine partagée. On garde donc un **budget** large — la fin ne coûte pas plus de 4× le début —
      // qui laisse passer le bruit (ratio mesuré : 0,6 à 1,0) sans rien laisser passer de la régression
      // visée : une boucle en `O(ticksEcoules)` rendrait les dernières frames des milliers de fois plus
      // chères que les premières. Le budget est l'assertion, pas une fragilité de CI à supprimer.
      const FRAMES_PAR_BLOC = 600 // 10 minutes de session, à une frame par seconde
      const FRAMES_TOTAL = 2 * 3_600 // 2 h
      const FACTEUR_MAX = 4

      function avancer(depart: EtatJeu, frames: number): EtatJeu {
        let etat = depart
        for (let f = 0; f < frames; f += 1) etat = appliquerDelta(etat, 1_000, C)
        return etat
      }

      // Échauffement : la toute première frame paie la compilation du moteur, pas son ancienneté.
      avancer(etatProductif(), FRAMES_PAR_BLOC)

      let etat = etatProductif()
      const departDebut = performance.now()
      etat = avancer(etat, FRAMES_PAR_BLOC)
      const dureeDebut = performance.now() - departDebut

      etat = avancer(etat, FRAMES_TOTAL - 2 * FRAMES_PAR_BLOC)

      const departFin = performance.now()
      etat = avancer(etat, FRAMES_PAR_BLOC)
      const dureeFin = performance.now() - departFin

      // La session a bien été jouée en entier : 2 h de frames de 1 s, soit 72 000 pas de 100 ms.
      expect(etat.ticksEcoules).toBe((FRAMES_TOTAL * 1_000) / PAS_TICK_MS)
      // `Math.max(…, 1)` : si le bloc de début tombait sous la résolution du chronomètre, le rapport
      // n'aurait aucun sens — on se rabat alors sur un plancher d'une milliseconde.
      expect(dureeFin).toBeLessThan(Math.max(dureeDebut, 1) * FACTEUR_MAX)
    },
    30_000,
  )
})
