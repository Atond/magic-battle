// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Les textes des nœuds des deux arbres (T-24/T-25, noms et descriptions) vivent en bas de ce fichier, à
// côté de ces nombres.

import { CONSTANTES } from './constantes.ts'
import type { TexteContenu } from './types-textes.ts'

/** EXG-39 / EXG-40 — catalogue des nœuds des deux arbres (Éclats, remis à zéro ; Ascension, permanent). */
export const NOEUDS = CONSTANTES.noeuds

/**
 * T-24/T-25 — textes des nœuds. Arbre d’Éclats (`eclats-*`) : remis à zéro à chaque Ascension.
 * Arbre d’Ascension (`ascension-*`) : permanent.
 */
export const TEXTES_NOEUDS: Readonly<Record<string, TexteContenu>> = {
  'eclats-degats-1': {
    nom: 'Coup d’éclat I',
    description: 'Tes coups brillent un peu. Les monstres, un peu moins.',
  },
  'eclats-degats-2': {
    nom: 'Coup d’éclat II',
    description: 'Un peu plus d’éclat, un peu moins de monstres.',
  },
  'eclats-degats-3': {
    nom: 'Coup d’éclat III',
    description: 'À ce stade, tu éblouis même les boss. Ils plissent les yeux en tombant.',
  },
  'eclats-degats-infini': {
    nom: 'Coup d’éclat sans fin',
    description: 'Se rachète encore et encore. Comme les monstres, en fait.',
  },
  'eclats-or-1': {
    nom: 'Fond de poche I',
    description: 'Les monstres lâchent un peu plus d’or. Ils ne l’emporteront pas avec eux.',
  },
  'eclats-or-2': {
    nom: 'Fond de poche II',
    description: 'Tu fouilles les poches plus à fond. Les monstres trouvent ça déplacé.',
  },
  'eclats-or-3': {
    nom: 'Fond de poche III',
    description: 'Même les monstres sans poches te laissent de l’or. Ne demande pas comment.',
  },
  'eclats-zone-depart': {
    nom: 'Raccourci par le potager',
    description: 'Chaque run repart un peu plus loin. Les navets, tu les connais par cœur.',
  },
  'eclats-cooldown-1': {
    nom: 'Doigts agiles I',
    description: 'Tes sorts reviennent plus vite. Tu as enfin arrêté de chercher la page.',
  },
  'eclats-cooldown-2': {
    nom: 'Doigts agiles II',
    description: 'Tu relances avant d’avoir fini de prononcer la formule. Personne ne s’en plaint.',
  },
  'ascension-autocast-feu': {
    nom: 'Feu automatique',
    description: 'La Grosse boule de feu part toute seule. Tu peux enfin finir ton café.',
  },
  'ascension-autocast-glace': {
    nom: 'Froid programmé',
    description: 'La Douche froide tombe sans que tu la demandes. Comme les vraies.',
  },
  'ascension-autocast-lumiere': {
    nom: 'Minuterie céleste',
    description: 'Le Plein phare s’allume tout seul. Et jamais au moment où tu cherches tes clés.',
  },
  'ascension-synergie-ecoles': {
    nom: 'Salle des profs',
    description: 'Tes écoles se parlent enfin. Elles se renforcent au lieu de se critiquer.',
  },
  'ascension-or-depart': {
    nom: 'Argent de poche',
    description: 'Chaque run démarre avec un peu d’or. Merci qui ? Merci toi d’avant.',
  },
  'ascension-zone-depart': {
    nom: 'Ascenseur de service',
    description: 'Tu démarres plus loin, direct. Les navets ne te voient même plus passer.',
  },
  'ascension-degats-infini': {
    nom: 'Toujours plus haut',
    description: 'Se rachète sans fin. Pas de plafond, juste un léger vertige.',
  },
  'ascension-cooldown': {
    nom: 'Second souffle',
    description: 'Tes sorts reviennent plus vite, pour de bon. La fatigue, c’est pour les monstres.',
  },
}
