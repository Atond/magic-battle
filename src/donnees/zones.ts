// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` via `src/donnees/constantes.ts`, généré par
// `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// Les textes des régions de zones (T-25 : noms, ambiances, monstres, boss) vivent en bas de ce fichier.

import { CONSTANTES } from './constantes.ts'
import type { TexteContenu } from './types-textes.ts'

/** §8 / EXG-15, EXG-16 — courbe de PV des vagues et des boss, cadence des zones. */
export const ZONES = CONSTANTES.zones

/** T-25 — texte d’une région de dix zones : décor, monstres de vague, boss et gardien. */
export interface TexteRegion {
  readonly nom: string
  readonly ambiance: string
  /** Trois monstres de vague, tirés tour à tour. */
  readonly monstres: readonly [string, string, string]
  /** Boss des zones ordinaires de la région ; `description` = son tic, une ligne. */
  readonly boss: TexteContenu
  /** Boss de la dernière zone de la région (la 10ᵉ), plus coriace ; `description` = son tic. */
  readonly gardien: TexteContenu
}

/** Les 12 régions, dans l'ordre de progression, 10 zones chacune ; la dernière couvre tout ce qui dépasse. */
export const TEXTES_REGIONS: readonly TexteRegion[] = [
  {
    nom: 'Le Potager du Voisin',
    ambiance: 'Des navets hostiles, des limaces motivées. Le voisin, lui, a déménagé.',
    monstres: ['Navet grincheux', 'Limace de combat', 'Taupe syndiquée'],
    boss: {
      nom: 'Gérard l’Épouvantail',
      description: 'Fait peur aux corbeaux, pas à toi. Il le vit très mal.',
    },
    gardien: {
      nom: 'La Citrouille Mère',
      description: 'Énorme, orange et susceptible. Ne supporte pas qu’on parle de soupe devant elle.',
    },
  },
  {
    nom: 'La Cave de Tonton',
    ambiance: 'Humide, sombre, ça sent la vieille confiture. Personne n’est descendu depuis des lustres.',
    monstres: ['Rat sommelier', 'Araignée du plafond', 'Bocal animé'],
    boss: {
      nom: 'La Chaudière Capricieuse',
      description: 'S’allume quand elle veut. Jamais quand il fait froid.',
    },
    gardien: {
      nom: 'Le Tonneau Qui Fuit',
      description: 'Perd du vin à chaque coup. Pleure à chaque coup aussi.',
    },
  },
  {
    nom: 'Les Égouts de la Ville',
    ambiance: 'Tout ce que la ville jette finit ici. Toi compris, apparemment.',
    monstres: ['Rat en ciré', 'Chaussette errante', 'Gobelin plombier'],
    boss: {
      nom: 'Le Roi des Rats',
      description: 'Porte une couronne en capsule de bière. Exige qu’on s’incline, même dans l’eau.',
    },
    gardien: {
      nom: 'Le Crocodile Qui N’Existe Pas',
      description: 'Personne ne croit en lui. Il le prend très, très personnellement.',
    },
  },
  {
    nom: 'Le Pont à Péage',
    ambiance: 'Un pont, une rivière, et un troll qui a lu un livre sur l’entrepreneuriat.',
    monstres: ['Canard douanier', 'Troll stagiaire', 'Poisson à contresens'],
    boss: {
      nom: 'Grobert, péagiste du pont',
      description: 'Réclame un péage. Ne rend pas la monnaie.',
    },
    gardien: {
      nom: 'Grobert Père',
      description: 'A appris le métier à son fils. Fait payer l’aller et le retour, même si tu restes.',
    },
  },
  {
    nom: 'La Forêt Pas Si Enchantée',
    ambiance: 'Les arbres parlent. Surtout pour dire du mal des autres arbres.',
    monstres: ['Champignon farceur', 'Loup végétarien', 'Écureuil armé'],
    boss: {
      nom: 'Le Chêne Rancunier',
      description: 'Se souvient de chaque feuille qu’on lui a arrachée. Et de ta tête.',
    },
    gardien: {
      nom: 'La Sorcière du Coin',
      description: 'Te propose une pomme entre chaque sort. Tu refuses. Elle insiste.',
    },
  },
  {
    nom: 'Les Marais Mous',
    ambiance: 'Ça colle, ça gargouille, ça sent l’œuf. Tes bottes ne s’en remettront pas.',
    monstres: ['Grenouille dépressive', 'Moustique de compétition', 'Feu follet paumé'],
    boss: {
      nom: 'Le Crapaud-Roi',
      description: 'Attend un bisou depuis des siècles. Ce ne sera pas le tien.',
    },
    gardien: {
      nom: 'La Vase Qui Pense',
      description: 'Réfléchit longtemps avant chaque attaque. Oublie souvent pourquoi.',
    },
  },
  {
    nom: 'Les Montagnes Qui Grincent',
    ambiance: 'Ça grimpe, ça souffle, et l’écho répète tous tes jurons.',
    monstres: ['Chèvre de haute voltige', 'Gargouille enrhumée', 'Aigle radin'],
    boss: {
      nom: 'Le Yéti en Pantoufles',
      description: 'Frileux comme pas deux. Se bat avec une bouillotte sous le bras.',
    },
    gardien: {
      nom: 'Le Dragon Retraité',
      description: 'Ne crache plus de feu, seulement des souvenirs. Il en a beaucoup, et en détail.',
    },
  },
  {
    nom: 'Le Désert des Oublis',
    ambiance: 'Du sable à perte de vue. Il y en a déjà dans ton grimoire.',
    monstres: ['Scorpion taquin', 'Momie mal ficelée', 'Mirage insistant'],
    boss: {
      nom: 'Le Sphinx Pas Très Malin',
      description: 'Pose des devinettes. Ne connaît pas les réponses.',
    },
    gardien: {
      nom: 'Le Pharaon Enrhumé',
      description: 'Ses bandelettes lui servent de mouchoir. Évite de trop t’approcher.',
    },
  },
  {
    nom: 'La Bibliothèque Interdite',
    ambiance: 'Silence absolu. Les livres mordent, les bibliothécaires aussi.',
    monstres: ['Grimoire mordeur', 'Marque-page hanté', 'Rat de bibliothèque'],
    boss: {
      nom: 'La Bibliothécaire',
      description: 'Chuuut. Te punit pour chaque bruit, y compris ceux de ses propres coups.',
    },
    gardien: {
      nom: 'L’Encyclopédie Vivante',
      description: 'Sait tout, et tient à te le faire savoir. En plusieurs volumes.',
    },
  },
  {
    nom: 'Les Nuages Mal Rangés',
    ambiance: 'Ici, tout flotte. Sauf ta dignité.',
    monstres: ['Nuage boudeur', 'Mouton céleste', 'Grêlon teigneux'],
    boss: {
      nom: 'La Tempête en Pyjama',
      description: 'Se lève toujours du mauvais pied. Et souffle très fort pour le faire savoir.',
    },
    gardien: {
      nom: 'Le Contrôleur du Ciel',
      description: 'Te demande ton ticket pour voler. Tu n’en as pas. Il a tout son temps.',
    },
  },
  {
    nom: 'L’Envers du Décor',
    ambiance: 'Les murs sont en carton et les monstres lisent leur texte sur des pancartes.',
    monstres: ['Figurant maléfique', 'Décor mal cloué', 'Monstre de remplacement'],
    boss: {
      nom: 'Le Régisseur',
      description: 'Crie « Coupez ! » en plein combat. Personne ne coupe.',
    },
    gardien: {
      nom: 'La Doublure du Boss',
      description: 'Remplace le vrai boss, parti en pause. Tape quand même fort, pour la promotion.',
    },
  },
  {
    nom: 'Le Bout de la Carte',
    ambiance: 'La carte dit « ici, des monstres ». Pour une fois, elle ne ment pas.',
    monstres: ['Monstre de marge', 'Dragon griffonné', 'Rature vivante'],
    boss: {
      nom: 'Le Cartographe Perdu',
      description: 'A dessiné ce coin sans jamais y venir. Découvre ses erreurs en même temps que toi.',
    },
    gardien: {
      nom: 'La Rose des Vents Folle',
      description: 'Indique toutes les directions à la fois. Surtout la mauvaise.',
    },
  },
]
