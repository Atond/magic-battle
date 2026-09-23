// Correspondance moteur → contenu écrit (vague 3, T-24 à T-27). Présentation seulement : aucune règle de
// jeu ici. Le moteur numérote des zones sans fin et crée ses monstres avec un nom vide
// (`src/domain/types.ts`, `Monstre`) ; ce module décide sous quel nom et dans quelle région l'écran les
// montre.
//
// Le découpage « 10 zones par région » est un choix d'affichage, pas une sortie du simulateur : il vit
// donc ici, jamais dans `src/donnees/` (dont les nombres sont tous générés, invariant 2 de CLAUDE.md).

import type { Boss, EtatJeu, Monstre } from '../domain/types.ts'
import { TEXTES_FIN } from '../donnees/fin.ts'
import { TEXTES_REGIONS } from '../donnees/zones.ts'
import type { TexteRegion } from '../donnees/zones.ts'

/** Nombre de zones par région de contenu ; la dernière région couvre tout ce qui dépasse. */
export const ZONES_PAR_REGION = 10

/** Rang (0, 1, …) de la région qui porte `zone` ; une zone non valide retombe sur la première. */
export function indexRegion(zone: number): number {
  if (!Number.isFinite(zone) || zone < 1) return 0
  const brut = Math.floor((Math.floor(zone) - 1) / ZONES_PAR_REGION)
  return Math.min(brut, TEXTES_REGIONS.length - 1)
}

/** Texte d'une région par rang ; un rang hors bornes est ramené dans `[0, longueur − 1]`. */
export function regionParIndex(index: number): TexteRegion {
  const borne = Number.isFinite(index) ? Math.min(Math.max(Math.floor(index), 0), TEXTES_REGIONS.length - 1) : 0
  return TEXTES_REGIONS[borne]!
}

export function regionDeZone(zone: number): TexteRegion {
  return regionParIndex(indexRegion(zone))
}

/**
 * La 10ᵉ zone de chaque région (10, 20, …) est gardée par le gardien plutôt que par le boss ordinaire.
 * Au-delà de la dernière région, le même rythme continue (le gardien de la dernière région revient
 * toutes les dix zones).
 */
export function estZoneDeGardien(zone: number): boolean {
  return Number.isFinite(zone) && zone >= 1 && Math.floor(zone) % ZONES_PAR_REGION === 0
}

function estBoss(cible: Monstre | Boss): cible is Boss {
  return 'estBoss' in cible && cible.estBoss === true
}

/**
 * Nom affiché de la cible courante : boss final, gardien (10ᵉ zone de la région), boss ordinaire, ou
 * monstre de vague tiré tour à tour parmi les trois de la région (vague 1 → premier, 2 → deuxième, …).
 * Le `nom` porté par l'état n'est jamais lu : il vient d'une sauvegarde (entrée non fiable) et le moteur
 * le laisse vide.
 */
export function nomCible(cible: Monstre | Boss | null, zone: number, vague: number): string {
  if (cible === null) return ''
  if (estBoss(cible)) {
    if (cible.estFinal) return TEXTES_FIN.bossFinal.nom
    const region = regionDeZone(cible.zone)
    return estZoneDeGardien(cible.zone) ? region.gardien.nom : region.boss.nom
  }
  const { monstres } = regionDeZone(zone)
  const rang = Number.isFinite(vague) && vague >= 1 ? Math.floor(vague) - 1 : 0
  return monstres[rang % monstres.length]!
}

/**
 * EXG-28 — le combat du boss final vit hors d'`EtatCombat` (`EtatJeu.bossFinal`, voir l'en-tête de
 * `src/domain/fin/index.ts`) : `combat.cible` garde le monstre de la progression ordinaire pendant ce
 * temps. L'écran montre le boss final dès que ce champ existe, quelle que soit la cible de progression.
 */
export function enCombatFinal(etat: EtatJeu): boolean {
  return etat.bossFinal !== undefined
}

/** Sélecteur prêt à l'emploi (rend une primitive, `src/state/hooks.ts`). */
export function nomCibleCourante(etat: EtatJeu): string {
  if (enCombatFinal(etat)) return TEXTES_FIN.bossFinal.nom
  return nomCible(etat.combat.cible, etat.combat.zone, etat.combat.vague)
}
