// FIXTURE VOLONTAIREMENT DÉSÉQUILIBRÉE — le test du test de `check.ts`.
//
// Doctrine LRN-002 : un vérificateur qu'on n'a jamais vu échouer ne vérifie rien. Ce jeu de constantes
// existe pour prouver le rouge, et il ne doit JAMAIS être supprimé ni « réparé ».
//
// Vérifier :   npx tsx tools/idle-balance/check.ts tools/idle-balance/fixtures/desequilibre.ts
// Attendu :    sortie 2, avec au minimum C03 (1er prestige), C04 (mur > 90 min), C05 (couple de fin
//              hors bornes), C06 (< 40 h de jeu cumulé) et C10 (H hors de [8, 12]) en ÉCHEC.
//
// Ce qui est cassé, et pourquoi c'est exactement ce qu'on veut détecter :
//  · `croissanceVague = 2,2` et `multZoneSuivante = 8` → `facteur_zone` d'environ 4,5e3 : c'est le mur
//    mathématique que la v1 de la spec avait produit sans le voir (ADR-10, `×87,9` composé) ;
//  · `orParDegatMoyen = 0,0002` et `croissanceOrParZone = 1,01` → l'or ne suit jamais les PV ;
//  · `ecoleCroissance = 1,6` → un niveau d'école double de prix tous les 1,5 achats ;
//  · `nAscensionsRequises × prestigesParAscension = 2 × 3 = 6`, hors de la borne dure [20, 30] de §8 ;
//  · `plafondHeures = 48`, hors de la fourchette [8, 12] de §8.
//
// Ce fichier vit sous `tools/`, jamais sous `src/` : ce ne sont pas des valeurs de jeu.

import type { Constantes } from '../../../src/domain/types.ts'
import { construireConstantes, PARAMETRES_DEPART } from '../parametres.ts'

export const CONSTANTES: Constantes = construireConstantes({
  ...PARAMETRES_DEPART,
  // Mur mathématique inter-zone.
  croissanceVague: 2.2,
  multBoss: 12,
  multZoneSuivante: 8,
  timerBossS: 10,
  // Économie de l'or étranglée.
  orParDegatMoyen: 0.0002,
  croissanceOrParZone: 1.01,
  // Coûts d'école explosifs.
  ecoleCroissance: 1.6,
  ecoleFacteurCout: 60,
  // Améliorations inutiles et hors de prix.
  ameliorationEffetMult: 1.02,
  ameliorationCoutBase: 100_000,
  // Couple de fin hors de la borne dure §8 (2 × 3 = 6, pas dans [20, 30]).
  nAscensionsRequises: 2,
  prestigesParAscension: 3,
  // Plafond hors-ligne hors de [8, 12].
  plafondHeures: 48,
})
