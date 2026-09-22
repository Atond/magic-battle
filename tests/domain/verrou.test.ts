// Miroir de `src/domain/sauvegarde/verrou.ts` — T-11 : politique de verrou multi-onglet (EXG-48).
//
// Ce que ces tests couvrent, et ce qu'ils ne couvrent pas : la **politique** seule. Qui a le droit
// d'écrire, à partir d'un état de verrou, d'un identifiant d'onglet, d'un horodatage courant et d'un
// délai d'expiration — tous des paramètres. Le transport (canal de diffusion entre onglets, écriture
// de la clé de propriétaire, cadence du battement) est branché par `src/state/` en vague 2 : le
// domaine n'a le droit d'accéder ni au navigateur ni au stockage, et ne lit jamais l'horloge.
//
// Aucune valeur d'équilibrage : le délai d'expiration est un paramètre de chaque appel, et les
// horodatages des tests sont des repères arbitraires.

import { describe, expect, it } from 'vitest'

import {
  evaluerDroitEcriture,
  liberer,
  renouveler,
  revendiquer,
  verrouExpire,
} from '../../src/domain/sauvegarde/verrou.ts'
import type { EtatVerrou } from '../../src/domain/sauvegarde/verrou.ts'

const T0 = 1_700_000_000_000
/** Délai au-delà duquel un propriétaire silencieux est réputé parti. Paramètre, pas constante de jeu. */
const EXPIRATION_MS = 5_000
const ONGLET_A = 'onglet-a'
const ONGLET_B = 'onglet-b'

describe('EXG-48 — un seul onglet écrit', () => {
  it('le premier onglet obtient le verrou sur un emplacement libre', () => {
    const verdict = revendiquer(null, ONGLET_A, T0, EXPIRATION_MS)
    expect(verdict.droitEcriture).toBe(true)
    expect(verdict.motif).toBe('revendique')
    expect(verdict.verrou).toEqual({ idProprietaire: ONGLET_A, dernierHeartbeatMs: T0 })
  })

  it('le second onglet est refusé tant que le premier bat (deux onglets simulés)', () => {
    const premier = revendiquer(null, ONGLET_A, T0, EXPIRATION_MS)
    expect(premier.verrou).not.toBeNull()
    if (premier.verrou === null) return

    // Le second arrive 1 s plus tard : le battement du premier est encore frais.
    const second = revendiquer(premier.verrou, ONGLET_B, T0 + 1_000, EXPIRATION_MS)
    expect(second.droitEcriture).toBe(false)
    expect(second.motif).toBe('occupe')
    // Le verrou rendu est celui du propriétaire, inchangé : la revendication n'a rien écrasé.
    expect(second.verrou).toBe(premier.verrou)

    // Et un seul des deux a le droit d'écrire, au même instant.
    const droits = [ONGLET_A, ONGLET_B].filter(
      (id) => evaluerDroitEcriture(premier.verrou, id, T0 + 1_000, EXPIRATION_MS).droitEcriture,
    )
    expect(droits).toEqual([ONGLET_A])
  })

  it('un battement frais refuse la reprise, un battement périmé l’autorise', () => {
    const verrou: EtatVerrou = { idProprietaire: ONGLET_A, dernierHeartbeatMs: T0 }

    expect(verrouExpire(verrou, T0 + EXPIRATION_MS - 1, EXPIRATION_MS)).toBe(false)
    expect(revendiquer(verrou, ONGLET_B, T0 + EXPIRATION_MS - 1, EXPIRATION_MS).droitEcriture).toBe(false)

    expect(verrouExpire(verrou, T0 + EXPIRATION_MS + 1, EXPIRATION_MS)).toBe(true)
    const reprise = revendiquer(verrou, ONGLET_B, T0 + EXPIRATION_MS + 1, EXPIRATION_MS)
    expect(reprise.droitEcriture).toBe(true)
    expect(reprise.motif).toBe('repris')
    expect(reprise.verrou).toEqual({ idProprietaire: ONGLET_B, dernierHeartbeatMs: T0 + EXPIRATION_MS + 1 })
  })

  it('le propriétaire renouvelle sans perdre son droit, et sans changer de propriétaire', () => {
    let verrou: EtatVerrou = { idProprietaire: ONGLET_A, dernierHeartbeatMs: T0 }
    for (let i = 1; i <= 10; i += 1) {
      const verdict = renouveler(verrou, ONGLET_A, T0 + i * 1_000, EXPIRATION_MS)
      expect(verdict.droitEcriture).toBe(true)
      expect(verdict.motif).toBe('renouvele')
      expect(verdict.verrou).not.toBeNull()
      if (verdict.verrou === null) return
      verrou = verdict.verrou
      expect(verrou.idProprietaire).toBe(ONGLET_A)
      expect(verrou.dernierHeartbeatMs).toBe(T0 + i * 1_000)
      // Pendant tout ce temps, le second onglet reste en lecture seule.
      expect(evaluerDroitEcriture(verrou, ONGLET_B, T0 + i * 1_000, EXPIRATION_MS).droitEcriture).toBe(false)
    }
  })

  it('un onglet qui n’est pas propriétaire ne renouvelle pas le verrou d’un autre', () => {
    const verrou: EtatVerrou = { idProprietaire: ONGLET_A, dernierHeartbeatMs: T0 }
    const verdict = renouveler(verrou, ONGLET_B, T0 + 1_000, EXPIRATION_MS)
    expect(verdict.droitEcriture).toBe(false)
    expect(verdict.motif).toBe('occupe')
    expect(verdict.verrou).toBe(verrou)
  })

  it('le propriétaire qui revient après expiration se réapproprie son propre verrou', () => {
    const verrou: EtatVerrou = { idProprietaire: ONGLET_A, dernierHeartbeatMs: T0 }
    const verdict = renouveler(verrou, ONGLET_A, T0 + EXPIRATION_MS * 3, EXPIRATION_MS)
    expect(verdict.droitEcriture).toBe(true)
    expect(verdict.verrou?.idProprietaire).toBe(ONGLET_A)
    expect(verdict.verrou?.dernierHeartbeatMs).toBe(T0 + EXPIRATION_MS * 3)
  })

  it('libérer rend l’emplacement au suivant, mais seulement au propriétaire', () => {
    const verrou: EtatVerrou = { idProprietaire: ONGLET_A, dernierHeartbeatMs: T0 }
    expect(liberer(verrou, ONGLET_B)).toBe(verrou)
    expect(liberer(verrou, ONGLET_A)).toBeNull()
    expect(liberer(null, ONGLET_A)).toBeNull()
    expect(revendiquer(liberer(verrou, ONGLET_A), ONGLET_B, T0 + 1, EXPIRATION_MS).droitEcriture).toBe(true)
  })
})

describe('EXG-48 — horloges hostiles : aucune reprise abusive, aucun NaN', () => {
  const verrou: EtatVerrou = { idProprietaire: ONGLET_A, dernierHeartbeatMs: T0 }

  it('un horodatage qui recule ne périme pas le verrou', () => {
    expect(verrouExpire(verrou, T0 - 1_000_000, EXPIRATION_MS)).toBe(false)
    const verdict = revendiquer(verrou, ONGLET_B, T0 - 1_000_000, EXPIRATION_MS)
    expect(verdict.droitEcriture).toBe(false)
    expect(verdict.verrou).toBe(verrou)
  })

  it('un horodatage non fini est refusé et n’écrit aucun NaN', () => {
    for (const horodatage of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(verrouExpire(verrou, horodatage, EXPIRATION_MS)).toBe(false)

      const tiers = revendiquer(verrou, ONGLET_B, horodatage, EXPIRATION_MS)
      expect(tiers.droitEcriture).toBe(false)
      expect(tiers.motif).toBe('horodatageInvalide')
      expect(tiers.verrou).toBe(verrou)

      // Le propriétaire garde son droit (il écrit déjà), mais son battement n'est pas corrompu.
      const proprietaire = renouveler(verrou, ONGLET_A, horodatage, EXPIRATION_MS)
      expect(proprietaire.droitEcriture).toBe(true)
      expect(Number.isFinite(proprietaire.verrou?.dernierHeartbeatMs ?? Number.NaN)).toBe(true)
      expect(proprietaire.verrou?.dernierHeartbeatMs).toBe(T0)

      // Revendication d'un emplacement libre avec une horloge cassée : rien n'est écrit.
      const libre = revendiquer(null, ONGLET_B, horodatage, EXPIRATION_MS)
      expect(libre.droitEcriture).toBe(false)
      expect(libre.verrou).toBeNull()
    }
  })

  it('un délai d’expiration absurde ne périme jamais le verrou (prudence par défaut)', () => {
    for (const delai of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(verrouExpire(verrou, T0 + 1e12, delai)).toBe(false)
      expect(revendiquer(verrou, ONGLET_B, T0 + 1e12, delai).droitEcriture).toBe(false)
    }
  })

  it('un état de verrou corrompu est traité comme un emplacement libre, sans plantage', () => {
    const corrompus: readonly EtatVerrou[] = [
      { idProprietaire: '', dernierHeartbeatMs: T0 },
      { idProprietaire: ONGLET_A, dernierHeartbeatMs: Number.NaN },
    ]
    for (const casse of corrompus) {
      const verdict = revendiquer(casse, ONGLET_B, T0, EXPIRATION_MS)
      expect(verdict.droitEcriture).toBe(true)
      expect(verdict.verrou).toEqual({ idProprietaire: ONGLET_B, dernierHeartbeatMs: T0 })
    }
  })

  it('un identifiant d’onglet vide n’obtient jamais le droit d’écrire', () => {
    expect(revendiquer(null, '', T0, EXPIRATION_MS).droitEcriture).toBe(false)
    expect(evaluerDroitEcriture(null, '', T0, EXPIRATION_MS).motif).toBe('identifiantInvalide')
  })
})
