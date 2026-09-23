// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` et de sa révision
// `tools/idle-balance/rapports/2026-09-21-revision-adr17-bossfinal.md`, via `src/donnees/constantes.ts`,
// généré par `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Les textes de fin de partie (T-27 : intro, Ascensions, boss final, écran de fin) vivent en bas de ce fichier.

import { CONSTANTES } from './constantes.ts'
import type { TexteContenu } from './types-textes.ts'

/**
 * EXG-28 / EXG-44 — conditions de fin de partie et zone dédiée du boss final.
 *
 * Les cinq champs vivent désormais dans `fin` : `nAscensionsRequises`, `zoneBossFinal`,
 * `pvProfondeurEquivalente`, `pvMultiplicateur`, `timerBossFinalS`.
 *
 * `zoneBossFinal` est le **nom** de la zone dédiée, jamais une profondeur de progression : le boss final
 * ne vit pas sur l'échelle normale des zones, sinon le joueur le croiserait pendant un run ordinaire (la
 * profondeur maximale mesurée est 118). Ses PV ne s'en déduisent donc pas — ils valent
 * `pvBoss(pvProfondeurEquivalente) × pvMultiplicateur`, et son chrono est `timerBossFinalS`, distinct de
 * `zones.timerBossS`.
 */
export const FIN = CONSTANTES.fin

/** T-27 — intro, une ligne par Ascension, boss final et écran de fin. Jamais bloquant, jamais un nombre. */
export const TEXTES_FIN: {
  /** Une ligne, affichée au tout premier lancement, non bloquante. */
  readonly intro: string
  /** Une ligne par Ascension, dans l'ordre (1ʳᵉ, 2ᵉ, 3ᵉ, 4ᵉ) : exactement 4 entrées, palier de rupture de ton. */
  readonly ascensions: readonly string[]
  /** La zone dédiée du boss final (accessible après la 4ᵉ Ascension). */
  readonly zoneFinale: TexteContenu
  /** Le boss final ; `description` = son tic. */
  readonly bossFinal: TexteContenu
  /** Écran de fin : un titre court et un texte de 3 lignes au plus (tableau de lignes). */
  readonly ecranFin: { readonly titre: string; readonly lignes: readonly string[] }
} = {
  intro: 'Des monstres partout, un bâton dans la main. Tape d’abord, tu liras le grimoire plus tard.',
  ascensions: [
    'Tu t’élèves. Là-haut, il fait plus clair : une nouvelle école t’attendait avec une lampe.',
    'Encore toi. Tu connais le chemin, les monstres aussi, et ils ont changé les serrures.',
    'Au potager, les navets tremblent rien qu’à ton nom. Même le voisin est revenu voir ça.',
    'Tout là-haut, quelqu’un vient de poser son café et de soupirer. Il sait que tu arrives.',
  ],
  zoneFinale: {
    nom: 'Le Bureau du Patron',
    description: 'Une moquette, une plante verte, une machine à café. C’est d’ici que partaient les monstres.',
  },
  bossFinal: {
    nom: 'Le Patron des Monstres',
    description: 'T’envoie des monstres depuis le premier navet. Demande à parler à ton responsable.',
  },
  ecranFin: {
    titre: 'Fin de service',
    lignes: [
      'Le Patron des Monstres a rendu son badge. Il n’y a plus personne à taper.',
      'Ton or, lui, continue d’affluer. Personne ne l’a prévenu.',
      'Merci d’avoir tapé si longtemps. Va boire un verre d’eau, tu l’as mérité.',
    ],
  },
}
