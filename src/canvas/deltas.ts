// Dérivation des effets de combat à partir des ÉCARTS de compteurs entre deux instantanés (T-21,
// EXG-52). `src/domain/moteur.ts` n'émet aucun événement « projectile » ni « sort lancé » : ce fichier
// ne fait QUE comparer deux lectures successives de l'état pour deviner ce qui s'est passé entre les
// deux — un clic de plus, un sort dont le cooldown vient d'être armé, un monstre de moins.
//
// Fonctions pures, sans DOM ni canvas : testables sans navigateur (`tests/ui/canvas-deltas.test.ts`).

import type { EtatJeu, IdEcole } from '../domain/types.ts'

/** Ce que le canvas retient d'une frame pour repérer ce qui a changé à la suivante. */
export interface InstantaneCombat {
  readonly clicsCumules: number
  readonly monstresTues: number
  /** Cooldown restant par sort, en ms : une hausse (0 → plein) signale un déclenchement tout juste eu. */
  readonly cooldownsSorts: Readonly<Record<string, number>>
}

export function extraireInstantane(etat: EtatJeu): InstantaneCombat {
  const cooldownsSorts: Record<string, number> = {}
  for (const id of Object.keys(etat.sorts)) {
    cooldownsSorts[id] = etat.sorts[id]!.cooldownRestantMs
  }
  return {
    clicsCumules: etat.magicien.clicsCumules,
    monstresTues: etat.magicien.monstresTues,
    cooldownsSorts,
  }
}

export type TypeEffet = 'projectile' | 'impact'

export interface DemandeEffet {
  readonly couleur: string
  readonly type: TypeEffet
}

export interface SortParEcole {
  readonly id: string
  readonly idEcole: IdEcole
}

/** Un delta négatif (Ascension qui repart de zéro, restauration d'une sauvegarde plus ancienne…) ne doit
 *  jamais produire de boucle négative : on l'ignore silencieusement plutôt que de planter. */
function deltaPositif(avant: number, apres: number): number {
  const delta = apres - avant
  return Number.isFinite(delta) && delta > 0 ? delta : 0
}

/**
 * Construit la liste des effets à ajouter au tampon (voir `tampon.ts` pour le plafond `N_PROJECTILES_MAX`
 * — cette fonction, elle, ne borne RIEN : un rattrapage hors-ligne peut légitimement produire des milliers
 * de deltas d'un coup sur une seule frame (EXG-52, « scénario forçant plus de 200 écarts »).
 */
export function demanderEffets(
  precedent: InstantaneCombat,
  courant: InstantaneCombat,
  sorts: readonly SortParEcole[],
  couleurClic: string,
  couleurImpact: string,
): DemandeEffet[] {
  const demandes: DemandeEffet[] = []

  const deltaClics = deltaPositif(precedent.clicsCumules, courant.clicsCumules)
  for (let i = 0; i < deltaClics; i += 1) {
    demandes.push({ couleur: couleurClic, type: 'projectile' })
  }

  for (const sort of sorts) {
    const avant = precedent.cooldownsSorts[sort.id] ?? 0
    const apres = courant.cooldownsSorts[sort.id] ?? 0
    if (apres > avant) {
      demandes.push({ couleur: `var(--couleur-ecole-${sort.idEcole})`, type: 'projectile' })
    }
  }

  const deltaMonstres = deltaPositif(precedent.monstresTues, courant.monstresTues)
  for (let i = 0; i < deltaMonstres; i += 1) {
    demandes.push({ couleur: couleurImpact, type: 'impact' })
  }

  return demandes
}
