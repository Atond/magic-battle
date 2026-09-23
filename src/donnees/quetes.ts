// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Les libellés définitifs des quêtes (T-26) vivent en bas de ce fichier, à côté de ces nombres.

import { CONSTANTES } from './constantes.ts'
import type { TexteContenu } from './types-textes.ts'

/** EXG-54 — liste des quêtes (succès inclus, ADR-11). */
export const QUETES = CONSTANTES.quetes

/**
 * T-26 — libellés des quêtes. Jamais de seuil dans le texte : l'UI affiche l'objectif chiffré à côté,
 * depuis `QUETES`, pour que le texte ne mente pas si le simulateur change un seuil.
 */
export const TEXTES_QUETES: Readonly<Record<string, TexteContenu>> = {
  'quete-zone-2': {
    nom: 'Un pied dehors',
    description: 'Fais un pas de plus. Les navets comprendront. Ou pas.',
  },
  'quete-zone-4': {
    nom: 'Tourisme de combat',
    description: 'Va voir plus loin si les monstres y sont. Spoiler : ils y sont.',
  },
  'quete-zone-8': {
    nom: 'Grand voyageur',
    description: 'Ton sac est plein de bave de limace. C’est ça, les voyages.',
  },
  'quete-zone-16': {
    nom: 'Loin de chez toi',
    description: 'Tu ne reconnais plus rien. Les monstres ne te reconnaissent pas non plus. Pas encore.',
  },
  'quete-zone-32': {
    nom: 'Hors des sentiers battus',
    description: 'Ici, les sentiers, c’est toi qui les bats. Avec les monstres dessus.',
  },
  'quete-zone-64': {
    nom: 'Terre inconnue',
    description: 'Même ton ombre hésite à te suivre jusqu’ici. Elle a tort, c’est joli.',
  },
  'quete-tuer-100': {
    nom: 'Échauffement',
    description: 'Quelques monstres au tapis. Tu commences à peine à transpirer.',
  },
  'quete-tuer-1000': {
    nom: 'Nettoyeur',
    description: 'Les monstres se passent le mot. Ton nom circule, mal orthographié.',
  },
  'quete-tuer-10000': {
    nom: 'Fléau des monstres',
    description: 'Les monstres ont fait une réunion à ton sujet. Personne ne t’a invité.',
  },
  'quete-tuer-100000': {
    nom: 'Cauchemar certifié',
    description: 'Les petits monstres ne dorment plus la nuit. Les grands non plus.',
  },
  'quete-tuer-1000000': {
    nom: 'Préavis de grève',
    description: 'Les monstres menacent de faire grève. Ils viennent quand même, par conscience professionnelle.',
  },
  'quete-premier-prestige': {
    nom: 'Tout plaquer',
    description: 'Jette le run par la fenêtre, garde les Éclats. Bienvenue dans l’idle.',
  },
}
