// Miroir de `src/domain/sauvegarde/` — T-10 : sérialisation versionnée (EXG-25), export/import base64
// (EXG-24), validation par schéma de la **seule entrée non fiable du système** (EXG-45, spec §6),
// sauvegarde de secours (EXG-46), non-injection (EXG-47) et sauvegarde illisible (EXG-27).
//
// Aucune valeur d'équilibrage ici : le catalogue (sorts, nœuds, quêtes, améliorations, équipement) et
// les bornes qui en découlent viennent de `src/donnees/constantes.ts`. Les seules constantes littérales
// des tests sont des bornes de structure (version de schéma, zone 1) et des charges d'attaque.

import { describe, expect, it } from 'vitest'

import {
  base64VersTexte,
  decoderBase64,
  encoderBase64,
  texteVersBase64,
} from '../../src/domain/sauvegarde/base64.ts'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PAS_TICK_MS, VERSION_SCHEMA, ZONE_DEPART } from '../../src/domain/constantes-moteur.ts'
import { etatInitial, tick } from '../../src/domain/moteur.ts'
import { acheterNiveaux } from '../../src/domain/ecoles/index.ts'
import { acheterNoeudAscension } from '../../src/domain/ascension/index.ts'
import {
  NOM_PRINCIPAL,
  NOM_SECOURS,
  deserialiser,
  exporterTexte,
  importerTexte,
  normaliserEtat,
  planifierEcrasement,
  planifierImport,
  planifierRestauration,
  restaurerSecours,
  serialiser,
} from '../../src/domain/sauvegarde/index.ts'
import type { PlanEcrasement } from '../../src/domain/sauvegarde/index.ts'
import {
  CLES_INTERDITES,
  PROFONDEUR_MAX,
  LONGUEUR_MAX_IMPORT_CARACTERES,
  NOEUDS_MAX,
  construireSchemaEtat,
  dictionnaire,
  entier,
  liste,
  nombre,
  objet,
  valider,
} from '../../src/domain/sauvegarde/schema.ts'
import type { MotifRefusImport, Schema } from '../../src/domain/sauvegarde/schema.ts'
import { nbVagues, timerBossMs } from '../../src/domain/zones/formules.ts'
import type { Constantes, EtatJeu, Sauvegarde } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'

/* ═════════════════════════════════════════════ EXG-24 — encodage base64 portable (T-10) */

describe('base64 — codec portable sans dépendance au navigateur ni à Node', () => {
  // Vecteurs de la RFC 4648 §10 : la référence normative du codage, pas un choix de projet.
  const VECTEURS: readonly (readonly [string, string])[] = [
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ]

  it('reproduit les vecteurs de la RFC 4648', () => {
    for (const [clair, code] of VECTEURS) {
      expect(texteVersBase64(clair)).toBe(code)
      expect(base64VersTexte(code)).toBe(clair)
    }
  })

  it('fait un aller-retour octet pour octet sur du français accentué et hors BMP (EXG-24)', () => {
    // Le piège que ce test verrouille : `btoa` échoue dès le premier caractère hors Latin-1, et
    // `Buffer` n'existe pas côté client. Le codec doit passer les accents ET les paires de substitution.
    const clair = 'Écoles de Lumière — ça pique ! 🧙‍♂️🔥'
    const code = texteVersBase64(clair)
    expect(code).toMatch(/^[A-Za-z0-9+/]*={0,2}$/)
    expect(base64VersTexte(code)).toBe(clair)

    const octets = new TextEncoder().encode(clair)
    expect(Array.from(decoderBase64(code) ?? new Uint8Array())).toEqual(Array.from(octets))
    expect(encoderBase64(octets)).toBe(code)
  })

  it('tolère les espaces et retours à la ligne d’un copier-coller', () => {
    expect(base64VersTexte(' Zm9v\nYmFy \t')).toBe('foobar')
  })

  it('rejette un base64 invalide plutôt que de deviner (EXG-45)', () => {
    for (const invalide of ['Zm9v!', 'Zm9', '==', 'Z===', 'Zm=9', 'Zm9vYmFy=', 'Zg€=']) {
      expect(decoderBase64(invalide), invalide).toBeNull()
      expect(base64VersTexte(invalide), invalide).toBeNull()
    }
  })

  it('rejette un remplissage non canonique (bits de bourrage non nuls)', () => {
    expect(decoderBase64('Zh==')).toBeNull()
  })

  it('rejette des octets qui ne forment pas de l’UTF-8 valide', () => {
    const invalide = encoderBase64(new Uint8Array([0xff, 0xfe, 0xfd]))
    expect(decoderBase64(invalide)).not.toBeNull()
    expect(base64VersTexte(invalide)).toBeNull()
  })
})

/* ════════════════════════════════════════════════════════ sérialisation, import, sécurité */

const C: Constantes = CONSTANTES
const HORODATAGE = 1_700_000_000_000

const DOSSIER_FIXTURES = path.join(import.meta.dirname, '..', 'migrations', 'fixtures')

/** Lit une fixture **gelée** de `tests/migrations/fixtures/` (jamais supprimée, jamais modifiée). */
function fixture(nom: string): string {
  return readFileSync(path.join(DOSSIER_FIXTURES, nom), 'utf8')
}

function fixtureJson(nom: string): unknown {
  return JSON.parse(fixture(nom)) as unknown
}

/** Import d'un texte d'export (base64) ; raccourci de lecture des tests. */
function importer(texte: string, courant: EtatJeu) {
  return importerTexte(texte, courant, C)
}

/** Import d'une charge JSON **textuelle** : le chemin réel d'un import, base64 comprise. */
function importerJsonBrut(json: string, courant: EtatJeu) {
  return importerTexte(texteVersBase64(json), courant, C)
}

describe('sérialisation et version de schéma (EXG-25)', () => {
  it('inscrit la version courante dans l’enveloppe et dans l’état', () => {
    const sauvegarde = serialiser(etatInitial(HORODATAGE), HORODATAGE)
    expect(sauvegarde.version).toBe(VERSION_SCHEMA)
    expect(sauvegarde.etat.version).toBe(VERSION_SCHEMA)
    expect(sauvegarde.horodatageMs).toBe(HORODATAGE)
  })

  it('horodate la sauvegarde : `derniereSauvegardeMs` est la base du calcul hors-ligne (EXG-49)', () => {
    const vieux = { ...etatInitial(0), derniereSauvegardeMs: 0 }
    expect(serialiser(vieux, HORODATAGE).etat.derniereSauvegardeMs).toBe(HORODATAGE)
  })

  it('ne mute jamais l’état d’entrée', () => {
    const etat = etatInitial(HORODATAGE)
    const copie = structuredClone(etat)
    serialiser(etat, HORODATAGE + 1)
    expect(etat).toEqual(copie)
  })

  it('`deserialiser` est l’inverse de `serialiser` (aller-retour sans base64)', () => {
    const etat = serialiser(etatInitial(HORODATAGE), HORODATAGE).etat
    const resultat = deserialiser(serialiser(etat, HORODATAGE), etatInitial(0), C)
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.etat).toEqual(etat)
  })
})

describe('export / import base64 (EXG-24)', () => {
  /** État de jeu avancé : écoles montées, arbre entamé, quêtes accomplies, temps écoulé. */
  function etatAvance(): EtatJeu {
    let etat = etatInitial(HORODATAGE)
    etat = { ...etat, bourse: { ...etat.bourse, or: 1e6, pointsAscension: 50 } }
    etat = acheterNiveaux(etat, 'feu', 12, C).etat
    etat = acheterNoeudAscension(etat, 'ascension-autocast-feu', 1, C).etat
    for (let i = 0; i < 25; i += 1) etat = tick(etat, C)
    return serialiser(etat, HORODATAGE).etat
  }

  it('aller-retour export → import : l’état revient à l’identique', () => {
    const etat = etatAvance()
    const texte = exporterTexte(etat, HORODATAGE)
    const resultat = importer(texte, etatInitial(0))
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.etat).toEqual(etat)
  })

  it('l’export est du base64 pur, transportable dans un champ texte', () => {
    expect(exporterTexte(etatAvance(), HORODATAGE)).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
  })

  it('conserve un nom accentué et hors BMP (le codec n’est pas du Latin-1)', () => {
    const base = etatAvance()
    const etat: EtatJeu = { ...base, magicien: { ...base.magicien, nom: 'Gérard le Flamboyant 🔥' } }
    const resultat = importer(exporterTexte(etat, HORODATAGE), etatInitial(0))
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.etat.magicien.nom).toBe('Gérard le Flamboyant 🔥')
  })
})

/* ════════════════════════════════════ EXG-45 — tableau des rejets, une fixture par motif */

describe('EXG-45 / EXG-27 — rejets d’import, fixture par fixture', () => {
  const REJETS: readonly (readonly [string, MotifRefusImport])[] = [
    // valeurs non finies : les littéraux `NaN`/`Infinity` ne sont pas du JSON, ils meurent à l'analyse…
    ['rejet-non-fini-nan.json', 'jsonIllisible'],
    ['rejet-non-fini-infinity.json', 'jsonIllisible'],
    ['rejet-non-fini-infinity-negatif.json', 'jsonIllisible'],
    // …et leurs déguisements passent l'analyse mais pas le schéma.
    ['rejet-non-fini-infinity-chaine.json', 'typeIncorrect'],
    ['rejet-non-fini-null.json', 'typeIncorrect'],
    // signe et bornes déclarées
    ['rejet-negatif.json', 'valeurNegative'],
    ['rejet-hors-bornes-haut.json', 'horsBornes'],
    ['rejet-hors-bornes-bas.json', 'horsBornes'],
    ['rejet-hors-bornes-rang.json', 'horsBornes'],
    // clés polluantes, au premier niveau comme imbriquées, y compris en clé de dictionnaire
    ['rejet-cle-proto.json', 'clePolluante'],
    ['rejet-cle-proto-imbriquee.json', 'clePolluante'],
    ['rejet-cle-constructor.json', 'clePolluante'],
    ['rejet-cle-prototype.json', 'clePolluante'],
    // types
    ['rejet-type-chaine.json', 'typeIncorrect'],
    ['rejet-type-tableau.json', 'typeIncorrect'],
    ['rejet-type-null.json', 'typeIncorrect'],
    ['rejet-champ-manquant.json', 'champManquant'],
    ['rejet-valeur-inattendue.json', 'valeurInattendue'],
    // enveloppe, version, structure
    ['rejet-version-future.json', 'versionFuture'],
    ['rejet-json-tronque.json', 'jsonIllisible'],
    ['rejet-profondeur.json', 'profondeurExcessive'],
  ]

  it.each(REJETS)('%s → %s', (nom, motif) => {
    const courant = etatInitial(HORODATAGE)
    const resultat = importerJsonBrut(fixture(nom), courant)
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.erreur.motif).toBe(motif)
    // Motif exploitable par l'UI : un chemin et un message, jamais un booléen nu.
    expect(resultat.erreur.chemin.length).toBeGreaterThan(0)
    expect(resultat.erreur.message.length).toBeGreaterThan(0)
    // L'état courant ressort **par référence** : aucun effet de bord, même partiel.
    expect(resultat.etat).toBe(courant)
  })

  it('base64 illisible → `base64Invalide`, état courant intact (EXG-27)', () => {
    const courant = etatInitial(HORODATAGE)
    const resultat = importer(fixture('rejet-base64-invalide.txt'), courant)
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) {
      expect(resultat.erreur.motif).toBe('base64Invalide')
      expect(resultat.etat).toBe(courant)
    }
  })

  it('refuse une charge au-delà de la longueur maximale d’import', () => {
    const courant = etatInitial(HORODATAGE)
    const enorme = 'A'.repeat(LONGUEUR_MAX_IMPORT_CARACTERES + 4)
    const resultat = importer(enorme, courant)
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreur.motif).toBe('tropLong')
  })

  it('aucune fixture polluante ne touche au prototype d’`Object` (l’assertion qui compte)', () => {
    const polluantes = [
      'rejet-cle-proto.json',
      'rejet-cle-proto-imbriquee.json',
      'rejet-cle-constructor.json',
      'rejet-cle-prototype.json',
    ]
    for (const nom of polluantes) importerJsonBrut(fixture(nom), etatInitial(HORODATAGE))

    const temoin = {} as Record<string, unknown>
    expect(temoin.polluee).toBeUndefined()
    expect(Object.prototype).not.toHaveProperty('polluee')
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).constructor).toBe(Object)
  })

  it('les trois clés du prototype sont bien celles que la spec nomme (EXG-45)', () => {
    expect([...CLES_INTERDITES].sort()).toEqual(['__proto__', 'constructor', 'prototype'])
  })

  it('les valeurs non finies posées directement dans l’objet sont refusées (hors JSON)', () => {
    // `JSON.stringify` ne sait pas écrire `NaN`/`Infinity` : le seul moyen de les faire entrer est
    // l'appel direct de `deserialiser` — c'est aussi ce que ferait un `state/` bogué. On ferme la porte.
    const valide = fixtureJson('sauvegarde-v1-valide.json') as Sauvegarde
    for (const valeur of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const courant = etatInitial(HORODATAGE)
      const charge = {
        ...valide,
        etat: { ...valide.etat, bourse: { ...valide.etat.bourse, or: valeur } },
      }
      const resultat = deserialiser(charge, courant, C)
      expect(resultat.ok).toBe(false)
      if (!resultat.ok) {
        expect(resultat.erreur.motif).toBe('valeurNonFinie')
        expect(resultat.etat).toBe(courant)
      }
    }
  })

  it('les clés inconnues sont ignorées et non fusionnées (EXG-45)', () => {
    const valide = fixtureJson('sauvegarde-v1-valide.json') as Record<string, unknown>
    const etatBrut = valide.etat as Record<string, unknown>
    const charge = {
      ...valide,
      cheatMode: true,
      etat: {
        ...etatBrut,
        orInfini: 1e300,
        bourse: { ...(etatBrut.bourse as object), orSecret: 1e300 },
        sorts: { ...(etatBrut.sorts as object), 'sort-inexistant': { debloque: true, cooldownRestantMs: 0, autoCast: true } },
      },
    }
    const resultat = deserialiser(charge, etatInitial(HORODATAGE), C)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    const reconstruit = resultat.etat as unknown as Record<string, unknown>
    expect(reconstruit.orInfini).toBeUndefined()
    expect(reconstruit.cheatMode).toBeUndefined()
    expect((resultat.etat.bourse as unknown as Record<string, unknown>).orSecret).toBeUndefined()
    expect(resultat.etat.sorts['sort-inexistant']).toBeUndefined()
    // Le champ légitime voisin de la clé inconnue, lui, est bien passé.
    expect(resultat.etat.bourse.or).toBe(98765.25)
  })
})

/* ═════════════════════════════════════════════════════════════ EXG-47 — donnée, pas balisage */

describe('EXG-47 — un champ texte importé reste une donnée', () => {
  const CHARGE = '<img src=x onerror=alert(1)>'

  it('traverse l’import à l’identique, ni échappé ni interprété', () => {
    const resultat = importerJsonBrut(fixture('xss-champ-texte.json'), etatInitial(HORODATAGE))
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.etat.magicien.nom).toBe(CHARGE)
    // Ni `&lt;`, ni `%3C` : le domaine n'échappe pas (ce serait un double échappement côté UI).
    expect(resultat.etat.magicien.nom).not.toContain('&lt;')
    expect(typeof resultat.etat.magicien.nom).toBe('string')
  })

  it('survit à un aller-retour export → import octet pour octet', () => {
    const base = etatInitial(HORODATAGE)
    const etat: EtatJeu = { ...base, magicien: { ...base.magicien, nom: CHARGE } }
    const retour = importer(exporterTexte(etat, HORODATAGE), etatInitial(0))
    expect(retour.ok).toBe(true)
    if (retour.ok) expect(retour.etat.magicien.nom).toBe(CHARGE)
  })

  it('aucune sortie du domaine ne contient de balise construite autour de la charge', () => {
    const base = etatInitial(HORODATAGE)
    const etat: EtatJeu = { ...base, magicien: { ...base.magicien, nom: CHARGE } }
    const enveloppe = JSON.stringify(serialiser(etat, HORODATAGE))
    // La charge est présente **telle quelle** (donnée sérialisée), jamais enrobée de balisage.
    expect(enveloppe).toContain(CHARGE)
    expect(enveloppe).not.toMatch(/<(div|span|p|b|i)\b/)
  })
})

/* ════════════════════════════════════════════════════════════ EXG-46 — sauvegarde de secours */

describe('EXG-46 — sauvegarde de secours avant écrasement (politique pure)', () => {
  it('copie la sauvegarde courante vers l’emplacement de secours avant un import', () => {
    const courante = exporterTexte(etatInitial(HORODATAGE), HORODATAGE)
    const plan = planifierEcrasement(courante, 'import')
    expect(plan.motif).toBe('import')
    expect(plan.ecritures).toEqual([{ nom: NOM_SECOURS, contenu: courante }])
    expect(plan.secoursDisponible).toBe(true)
  })

  it('n’écrit rien quand il n’y a rien à sauver (première partie)', () => {
    const plan = planifierEcrasement(null, 'nouvellePartie')
    expect(plan.ecritures).toEqual([])
    expect(plan.secoursDisponible).toBe(false)
  })

  it('import réussi puis restauration recharge l’état d’avant import à l’identique', () => {
    const avant = serialiser(
      acheterNiveaux({ ...etatInitial(HORODATAGE), bourse: { ...etatInitial(HORODATAGE).bourse, or: 1e5 } }, 'feu', 8, C).etat,
      HORODATAGE,
    ).etat
    const texteAvant = exporterTexte(avant, HORODATAGE)

    // 1. avant d'importer, on met la sauvegarde courante à l'abri
    const plan = planifierEcrasement(texteAvant, 'import')
    const secours = plan.ecritures.find((ecriture) => ecriture.nom === NOM_SECOURS)?.contenu ?? null

    // 2. import d'une autre partie : l'état change
    const importe = importerJsonBrut(fixture('sauvegarde-v1-valide.json'), avant)
    expect(importe.ok).toBe(true)
    if (!importe.ok) return
    expect(importe.etat).not.toEqual(avant)

    // 3. restauration : on retrouve l'état d'avant, à l'identique
    const restaure = restaurerSecours(secours, importe.etat, C)
    expect(restaure.ok).toBe(true)
    if (restaure.ok) expect(restaure.etat).toEqual(avant)

    const planRetour = planifierRestauration(secours)
    expect(planRetour.ecritures).toEqual([{ nom: NOM_PRINCIPAL, contenu: secours }])
  })

  it('un secours absent ou corrompu se signale au lieu d’effacer l’état courant', () => {
    const courant = etatInitial(HORODATAGE)
    const vide = restaurerSecours(null, courant, C)
    expect(vide.ok).toBe(false)
    if (!vide.ok) {
      expect(vide.erreur.motif).toBe('secoursAbsent')
      expect(vide.etat).toBe(courant)
    }
    const casse = restaurerSecours('pas du base64 !!', courant, C)
    expect(casse.ok).toBe(false)
    if (!casse.ok) expect(casse.etat).toBe(courant)
    expect(planifierRestauration(null).ecritures).toEqual([])
  })
})

/* ═══════════════════════════════ EXG-46 — l'ordre de la mise à l'abri, rendu structurel (T-10) */

describe('EXG-46 — la mise à l’abri voyage avec le résultat d’import, pas dans une consigne', () => {
  // Le test voisin (`import réussi puis restauration`) met lui-même les étapes dans le bon ordre : il
  // prouve que *le test* sait faire, pas que le code l'impose. Ici, l'appelant est un `src/state/`
  // minimal qui ne sait rien faire d'autre qu'exécuter la séquence qu'on lui donne, du premier au
  // dernier élément. S'il peut encore perdre la sauvegarde précédente, c'est le plan qui est fautif.
  function executer(stockage: Map<string, string>, plan: PlanEcrasement): void {
    for (const ecriture of plan.ecritures) {
      if (ecriture.contenu === null) stockage.delete(ecriture.nom)
      else stockage.set(ecriture.nom, ecriture.contenu)
    }
  }

  /** Une partie déjà entamée, et son texte d'export : ce que l'import va écraser. */
  function partieEnCours(): { etat: EtatJeu; contenu: string } {
    const depart = etatInitial(HORODATAGE)
    const riche: EtatJeu = { ...depart, bourse: { ...depart.bourse, or: 1e5 } }
    const etat = serialiser(acheterNiveaux(riche, 'feu', 8, C).etat, HORODATAGE).etat
    return { etat, contenu: exporterTexte(etat, HORODATAGE) }
  }

  it('un import réussi rend une séquence qui écrit le secours avant la sauvegarde active', () => {
    const avant = partieEnCours()
    const resultat = importerTexte(
      texteVersBase64(fixture('sauvegarde-v1-valide.json')),
      avant.etat,
      C,
      { contenuCourant: avant.contenu },
    )
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return

    // L'ordre est porté par le tableau : il n'y a pas d'autre endroit où le lire, ni où le choisir.
    expect(resultat.plan.ecritures.map((ecriture) => ecriture.nom)).toEqual([NOM_SECOURS, NOM_PRINCIPAL])
    expect(resultat.plan.ecritures[0].contenu).toBe(avant.contenu)
    expect(resultat.plan.secoursDisponible).toBe(true)
    expect(resultat.plan.motif).toBe('import')
  })

  it('un appelant qui ne sait qu’exécuter le plan ne peut pas perdre la partie précédente', () => {
    const avant = partieEnCours()
    const stockage = new Map<string, string>([[NOM_PRINCIPAL, avant.contenu]])

    const importe = importerTexte(
      texteVersBase64(fixture('sauvegarde-v1-valide.json')),
      avant.etat,
      C,
      { contenuCourant: stockage.get(NOM_PRINCIPAL) ?? null },
    )
    expect(importe.ok).toBe(true)
    if (!importe.ok) return
    executer(stockage, importe.plan)

    // La partie précédente est à l'abri, la sauvegarde active a bien changé.
    expect(stockage.get(NOM_SECOURS)).toBe(avant.contenu)
    expect(stockage.get(NOM_PRINCIPAL)).not.toBe(avant.contenu)

    // …et le chemin retour la réinstalle, toujours sans que l'appelant ait à savoir dans quel ordre.
    const restaure = restaurerSecours(stockage.get(NOM_SECOURS) ?? null, importe.etat, C)
    expect(restaure.ok).toBe(true)
    if (!restaure.ok) return
    executer(stockage, restaure.plan)
    expect(restaure.etat).toEqual(avant.etat)
    expect(stockage.get(NOM_PRINCIPAL)).toBe(avant.contenu)
    expect(restaure.plan.motif).toBe('restauration')
  })

  it('première partie : rien à mettre à l’abri, le plan se réduit à la sauvegarde active', () => {
    const resultat = importerTexte(texteVersBase64(fixture('sauvegarde-v1-valide.json')), etatInitial(HORODATAGE), C)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.plan.ecritures.map((ecriture) => ecriture.nom)).toEqual([NOM_PRINCIPAL])
    expect(resultat.plan.secoursDisponible).toBe(false)
    // Le contenu planifié est exactement ce que produirait un export de l'état rechargé : relire le
    // stockage et le réécrire est idempotent, il n'y a pas deux formats d'écriture dans le jeu.
    expect(resultat.plan.ecritures[0].contenu).toBe(exporterTexte(resultat.etat, resultat.sauvegarde.horodatageMs))
  })

  it('`planifierImport` compose la mise à l’abri et l’écrasement, dans cet ordre', () => {
    const plan = planifierImport('ancienne', 'nouvelle')
    expect(plan.ecritures).toEqual([
      { nom: NOM_SECOURS, contenu: 'ancienne' },
      { nom: NOM_PRINCIPAL, contenu: 'nouvelle' },
    ])
    expect(planifierImport(null, 'nouvelle').ecritures).toEqual([{ nom: NOM_PRINCIPAL, contenu: 'nouvelle' }])
  })
})

/* ══════════════════════════════════════════════ cohérence après chargement (normalisation) */

describe('normalisation — une sauvegarde valide mais incohérente est réparée, pas rejetée', () => {
  it('répare les drapeaux dérivables de la fixture incohérente', () => {
    const courant = etatInitial(HORODATAGE)
    const resultat = importerJsonBrut(fixture('incoherent-v1.json'), courant)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    const etat = resultat.etat

    // zone maximale du run : ne peut pas être derrière la zone où l'on combat
    expect(etat.prestige.zoneMaxDuRun).toBe(5)
    // écoles : `debloquee`/`revelee` redérivés du catalogue et de la profondeur atteinte
    expect(etat.ecoles.feu.debloquee).toBe(true)
    expect(etat.ecoles.glace.debloquee).toBe(true)
    expect(etat.ecoles.glace.revelee).toBe(true)
    // école 5 marquée débloquée à niveau 0 et jamais révélée : le mensonge est corrigé
    expect(etat.ecoles.ecole5.debloquee).toBe(false)
    expect(etat.ecoles.ecole5.revelee).toBe(false)
    // 6e école sans Ascension : verrou EXG-41 rétabli, niveau conservé (aucune perte de progression)
    expect(etat.ecoles.lumiere.debloquee).toBe(false)
    expect(etat.ecoles.lumiere.revelee).toBe(false)
    expect(etat.ecoles.lumiere.niveau).toBe(3)
    // auto-cast : redérivé des rangs d'arbre (aucun nœud acheté ⇒ aucun auto-cast)
    expect(etat.sorts['sort-feu']?.autoCast).toBe(false)
    expect(etat.sorts['sort-feu']?.debloque).toBe(true)
    expect(etat.sorts['sort-lumiere']?.debloque).toBe(false)
    // Éclats dépensables ≤ Éclats possédés (ADR-8 : seul l'arbre consomme les dépensables)
    expect(etat.bourse.eclatsDepensables).toBe(58)
    // phase boss : chrono plein, vague au bout de la zone, cible régénérée par le combat
    expect(etat.combat.phase).toBe('boss')
    expect(etat.combat.vague).toBe(nbVagues(C))
    expect(etat.combat.timerBossRestantMs).toBe(timerBossMs(C))
    expect(etat.combat.cible).toBeNull()
    // quêtes accomplies : dédoublonnées (EXG-54 crédite une seule fois)
    expect(etat.quetesAccomplies).toEqual(['quete-zone-2', 'quete-tuer-100'])
  })

  it('un auto-cast acquis par l’arbre est rétabli au chargement (EXG-40)', () => {
    let etat = { ...etatInitial(HORODATAGE), bourse: { ...etatInitial(HORODATAGE).bourse, pointsAscension: 100 } }
    etat = acheterNoeudAscension(etat, 'ascension-autocast-feu', 1, C).etat
    // Sauvegarde sabotée : le rang est là, le drapeau a disparu.
    const sabote: EtatJeu = { ...etat, sorts: { 'sort-feu': { debloque: false, cooldownRestantMs: 0, autoCast: false } } }
    expect(normaliserEtat(sabote, C).sorts['sort-feu']?.autoCast).toBe(true)
  })

  it('est idempotente : normaliser deux fois ne change plus rien', () => {
    const resultat = importerJsonBrut(fixture('incoherent-v1.json'), etatInitial(HORODATAGE))
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(normaliserEtat(resultat.etat, C)).toEqual(resultat.etat)
  })

  it('la fixture v1 valide est un point fixe : elle revient telle quelle', () => {
    const attendu = (fixtureJson('sauvegarde-v1-valide.json') as Sauvegarde).etat
    const resultat = importerJsonBrut(fixture('sauvegarde-v1-valide.json'), etatInitial(HORODATAGE))
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.etat).toEqual(attendu)
  })

  it('un état neuf est déjà normalisé (aucune dérive entre le moteur et la sauvegarde)', () => {
    const neuf = etatInitial(HORODATAGE)
    expect(normaliserEtat(neuf, C)).toEqual(neuf)
  })
})

/* ════════════════════════════════════════════ tests durs : coût et profondeur (LRN-002) */

describe('tests durs — la validation est linéaire en taille et bornée en profondeur', () => {
  // Pourquoi un chronomètre ici et pas un compteur : la garantie à tenir est « la validation ne
  // dégénère pas », et un compteur que le code s'attribue lui-même ne la prouve pas (LRN-002). La
  // marge est volontairement énorme (10 s pour un travail attendu en dizaines de ms) : le budget est
  // l'assertion, pas une mesure fine de la machine de CI.
  const BUDGET_MS = 10_000

  it('un dictionnaire de rangs à 1e6 clés inconnues ne fait pas dégénérer la validation', () => {
    const valide = fixtureJson('sauvegarde-v1-valide.json') as Sauvegarde
    const rangs: Record<string, number> = {}
    for (let i = 0; i < 1_000_000; i += 1) rangs['inconnu-' + i] = 1
    rangs['eclats-degats-1'] = 2
    const charge = {
      ...valide,
      etat: { ...valide.etat, prestige: { ...valide.etat.prestige, rangsArbreEclats: rangs } },
    }

    const depart = performance.now()
    const resultat = deserialiser(charge, etatInitial(HORODATAGE), C)
    const duree = performance.now() - depart

    expect(resultat.ok).toBe(true)
    if (resultat.ok) {
      // Seules les clés du catalogue survivent : le million d'inconnues est ignoré, pas fusionné.
      expect(Object.keys(resultat.etat.prestige.rangsArbreEclats)).toEqual(['eclats-degats-1'])
    }
    expect(duree).toBeLessThan(BUDGET_MS)
  }, BUDGET_MS * 3)

  it('une imbrication absurde est refusée sans dérouler la pile', () => {
    let charge: unknown = { fond: true }
    for (let i = 0; i < 20_000; i += 1) charge = { n: charge }
    const depart = performance.now()
    const resultat = deserialiser({ version: 1, horodatageMs: HORODATAGE, etat: charge }, etatInitial(HORODATAGE), C)
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreur.motif).toBe('profondeurExcessive')
    expect(performance.now() - depart).toBeLessThan(BUDGET_MS)
  }, BUDGET_MS * 3)

  it('la borne de profondeur du validateur est explicite et testée au-delà', () => {
    let profond: Schema<unknown> = nombre(0, 1)
    let valeur: unknown = 0
    for (let i = 0; i < PROFONDEUR_MAX + 5; i += 1) {
      profond = liste(profond, 1) as Schema<unknown>
      valeur = [valeur]
    }
    const verdict = valider(valeur, profond, 'profond')
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.erreur.motif).toBe('profondeurExcessive')
  })

  it('le schéma réel de l’état tient largement sous la borne de profondeur', () => {
    // Si un jour T-13 imbrique plus profond que la borne, ce test tombe avant la production.
    const verdict = valider(etatInitial(HORODATAGE), construireSchemaEtat(C), 'etat')
    expect(verdict.ok).toBe(true)
  })

  it('le pas de tick borne `resteDeltaMs` : la borne du schéma suit la spec (EXG-2)', () => {
    const valide = fixtureJson('sauvegarde-v1-valide.json') as Sauvegarde
    const charge = { ...valide, etat: { ...valide.etat, resteDeltaMs: PAS_TICK_MS + 1 } }
    const resultat = deserialiser(charge, etatInitial(HORODATAGE), C)
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreur.motif).toBe('horsBornes')
  })

  it('la zone de départ est le plancher déclaré du schéma (EXG-19)', () => {
    const valide = fixtureJson('sauvegarde-v1-valide.json') as Sauvegarde
    const charge = { ...valide, etat: { ...valide.etat, combat: { ...valide.etat.combat, zone: ZONE_DEPART - 1 } } }
    expect(deserialiser(charge, etatInitial(HORODATAGE), C).ok).toBe(false)
  })

  /* ── la porte `deserialiser` : une charge qui n'est jamais passée par un texte ─────────────────── */
  // `importerTexte` borne la longueur du texte, deux fois. `deserialiser` ne voit aucun texte : c'est
  // pourtant l'entrée que la documentation recommande à `src/state/` pour relire le stockage local.
  // Les trois tests qui suivent attaquent donc `deserialiser` avec ce que `JSON.parse` ne sait pas
  // produire — un graphe. Le budget est l'assertion (LRN-002) : sans borne dans le parcours lui-même,
  // aucun de ces appels ne rend la main.

  it('un graphe qui partage ses nœuds ne fait pas exploser le balayage des clés', () => {
    // Douze étages de dix arêtes vers l'étage suivant : 121 objets en mémoire, une profondeur de 14
    // (sous PROFONDEUR_MAX, qui ne sert donc à rien ici) et 10¹² chemins racine → feuille. Un parcours
    // qui explore les *chemins* au lieu des *nœuds* ne rend jamais la main.
    //
    // Le piège est placé pour que le test ne puisse pas passer par chance : la clé interdite est dans
    // une branche sœur que le parcours en profondeur visite **en dernier**, après le graphe entier. Le
    // motif `clePolluante` ne peut donc être rendu que si le graphe a été traversé jusqu'au bout — en
    // temps fini. Le chronomètre est l'assertion (LRN-002).
    let noeud: Record<string, unknown> = { fond: true }
    for (let etage = 0; etage < 12; etage += 1) {
      const suivant: Record<string, unknown> = {}
      for (let arete = 0; arete < 10; arete += 1) suivant[`k${arete}`] = noeud
      noeud = suivant
    }
    const charge = {
      version: 1,
      horodatageMs: HORODATAGE,
      piege: JSON.parse('{"__proto__": {"pollue": true}}') as unknown,
      etat: noeud,
    }

    const depart = performance.now()
    const resultat = deserialiser(charge, etatInitial(HORODATAGE), C)
    const duree = performance.now() - depart

    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreur.motif).toBe('clePolluante')
    expect(duree).toBeLessThan(BUDGET_MS)
    expect(Object.prototype).not.toHaveProperty('pollue')
  }, BUDGET_MS * 3)

  it('un cycle rend la main au lieu de tourner indéfiniment', () => {
    // Un cycle fait croître la profondeur à chaque tour : c'est `PROFONDEUR_MAX` qui le referme, et
    // l'ensemble des nœuds vus qui évite d'y arriver par un détour coûteux. Ce que ce test assure,
    // c'est le fait acquis : l'appel rend la main.
    const boucle: Record<string, unknown> = { version: 1, horodatageMs: HORODATAGE }
    boucle.etat = boucle

    const depart = performance.now()
    const resultat = deserialiser(boucle, etatInitial(HORODATAGE), C)
    expect(resultat.ok).toBe(false)
    expect(performance.now() - depart).toBeLessThan(BUDGET_MS)
  }, BUDGET_MS * 3)

  it('le budget de nœuds refuse une charge démesurée passée en objet', () => {
    // Une charge plate, mais au-delà du budget : la borne existe et elle est atteignable sans texte.
    const enorme: Record<string, unknown> = { version: 1, horodatageMs: HORODATAGE }
    const etat: Record<string, unknown> = {}
    for (let i = 0; i < NOEUDS_MAX + 2; i += 1) etat[`n${i}`] = {}
    enorme.etat = etat

    const depart = performance.now()
    const resultat = deserialiser(enorme, etatInitial(HORODATAGE), C)
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreur.motif).toBe('tropLong')
    expect(performance.now() - depart).toBeLessThan(BUDGET_MS)
  }, BUDGET_MS * 3)
})

/* ══════════════════════════ EXG-45 — l'écriture de la valeur reconstruite, clé par clé */

describe('EXG-45 — aucune clé, même venue du catalogue, ne peut changer un prototype', () => {
  // `validerObjet` écrit sur des clés littérales du schéma : inoffensif. `validerDictionnaire`, lui,
  // écrit sur des clés venues du **catalogue** (`src/donnees/`). Le catalogue est généré et de
  // confiance, donc ce n'est pas une faille ouverte — mais la propriété revendiquée dans `schema.ts`
  // (« aucune clé hostile ne peut être posée ici, même si le balayage préalable était contourné ») doit
  // être vraie des deux côtés. Ce test appelle `valider` directement : le balayage EST contourné.

  it('une entrée de dictionnaire nommée `__proto__` devient une propriété inerte', () => {
    const schemaRang = objet<{ rang: number }>({ rang: entier(0, 9) })
    const schema = dictionnaire([
      ['__proto__', schemaRang],
      ['noeud-normal', schemaRang],
    ])
    // `JSON.parse` est le seul moyen d'écrire une propriété **propre** nommée `__proto__` : un littéral
    // d'objet `{ __proto__: … }` changerait le prototype au lieu de créer une clé.
    const charge = JSON.parse('{"__proto__": {"rang": 3}, "noeud-normal": {"rang": 1}}') as unknown

    const verdict = valider(charge, schema, 'test')
    expect(verdict.ok).toBe(true)
    if (!verdict.ok) return
    const reconstruit = verdict.valeur as Record<string, unknown>

    // L'assertion qui compte : l'objet reconstruit a gardé son prototype.
    expect(Object.getPrototypeOf(reconstruit)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(reconstruit, '__proto__')).toBe(true)
    expect((reconstruit['noeud-normal'] as { rang: number }).rang).toBe(1)
    // …et rien n'a fui vers le prototype global.
    expect(Object.prototype).not.toHaveProperty('rang')
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
  })
})

/* ═════════════════════════════ la borne d'import et son unité (elle dit ce qu'elle compte) */

describe('la borne d’import se compte en unités de code, et borne quand même les octets', () => {
  it('la comparaison porte sur `texte.length`, à l’unité près', () => {
    const courant = etatInitial(HORODATAGE)
    // Juste sous la borne : refusé, mais pour une autre raison que la longueur.
    const limite = importer('A'.repeat(LONGUEUR_MAX_IMPORT_CARACTERES), courant)
    expect(limite.ok).toBe(false)
    if (!limite.ok) expect(limite.erreur.motif).not.toBe('tropLong')
    // Un caractère de plus : refusé pour longueur, sans rien décoder.
    const trop = importer('A'.repeat(LONGUEUR_MAX_IMPORT_CARACTERES + 1), courant)
    expect(trop.ok).toBe(false)
    if (!trop.ok) expect(trop.erreur.motif).toBe('tropLong')
  })

  it('un JSON lourd en octets est refusé avant même d’être décodé', () => {
    // Pourquoi compter des unités de code ne laisse pas passer une charge lourde en octets : le texte
    // d'entrée est du base64, donc de l'ASCII, et il pèse 4/3 du JSON encodé en UTF-8. Un JSON de
    // 200 000 caractères non ASCII (3 octets chacun) donne un code base64 de ~800 000 caractères, très
    // au-delà de la borne — refusé au premier test, sans décodage. La borne en octets est donc tenue
    // par celle en caractères, à un facteur 4/3 près.
    const lourd = JSON.stringify({ version: 1, horodatageMs: HORODATAGE, nom: '€'.repeat(200_000) })
    expect(lourd.length).toBeLessThan(LONGUEUR_MAX_IMPORT_CARACTERES)
    expect(new TextEncoder().encode(lourd).length).toBeGreaterThan(LONGUEUR_MAX_IMPORT_CARACTERES)

    const resultat = importerJsonBrut(lourd, etatInitial(HORODATAGE))
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.erreur.motif).toBe('tropLong')
  })
})
