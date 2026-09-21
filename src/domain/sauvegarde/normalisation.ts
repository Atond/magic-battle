// Cohérence d'un état rechargé — T-10, complément de la validation par schéma.
//
// Le schéma dit « chaque champ est du bon type et dans ses bornes ». Il ne dit rien des relations
// **entre** champs, parce qu'une table de schéma ne sait pas les exprimer : un drapeau d'auto-cast qui
// ne correspond plus à aucun rang acheté (EXG-40), une école marquée débloquée à niveau 0 (EXG-7), une
// phase de boss sans chrono (EXG-16), une quête créditée deux fois (EXG-54) passent tous le schéma.
//
// Règle appliquée ici : **tout ce qui est dérivable est redérivé**, et rien n'est rejeté pour cause
// d'incohérence. Une sauvegarde incohérente est une sauvegarde à réparer — la rejeter ferait perdre au
// joueur une partie réelle pour une faute qui n'est pas la sienne. Les seules valeurs conservées telles
// quelles sont celles qu'aucune formule ne sait reconstruire : monnaies, niveaux, rangs, compteurs.
//
// Corollaire : cette fonction est **idempotente**, et un état neuf (`etatInitial`) en est un point fixe.
// Les deux propriétés sont testées : elles garantissent qu'elle ne dérive pas du moteur.

import { VERSION_SCHEMA, ZONE_DEPART } from '../constantes-moteur.ts'
import { synchroniserAutoCast } from '../prestige/arbre.ts'
import { etatSortLu } from '../sorts/index.ts'
import type { Boss, Constantes, EtatCombat, EtatEcole, EtatJeu, EtatSort, IdEcole, Monstre } from '../types.ts'
import { nbVagues, timerBossMs, vagueSaine } from '../zones/formules.ts'

/** Les PV courants d'une cible ne dépassent pas ses PV maximaux et ne descendent pas sous zéro. */
function cibleSaine(cible: Monstre | Boss | null): Monstre | Boss | null {
  if (cible === null) return null
  const pvCourants = Math.min(Math.max(cible.pvCourants, 0), cible.pvMax)
  return pvCourants === cible.pvCourants ? cible : { ...cible, pvCourants }
}

/**
 * EXG-16 / EXG-17 — remet la phase de combat d'aplomb :
 *  - en phase boss, la vague est celle du bout de la zone, le chrono est plein s'il manque, et la cible
 *    doit être un boss (sinon on la laisse au combat, qui l'engendre à la demande) ;
 *  - en phase de vagues, il n'y a pas de chrono et la cible n'est pas un boss.
 * Une cible remise à `null` n'est pas une perte : `avancerCombat` recrée la cible attendue par la phase.
 */
function normaliserCombat(combat: EtatCombat, constantes: Constantes): EtatCombat {
  const estBoss = combat.cible !== null && 'estBoss' in combat.cible

  if (combat.phase === 'boss') {
    const timer = combat.timerBossRestantMs
    return {
      ...combat,
      vague: nbVagues(constantes),
      phase: 'boss',
      cible: estBoss ? cibleSaine(combat.cible) : null,
      timerBossRestantMs: timer === null || timer <= 0 ? timerBossMs(constantes) : timer,
    }
  }

  return {
    ...combat,
    vague: vagueSaine(combat.vague, constantes),
    phase: 'vague',
    cible: estBoss ? null : cibleSaine(combat.cible),
    timerBossRestantMs: null,
  }
}

/**
 * EXG-7 / EXG-8 / EXG-41 — redérive les deux drapeaux d'école depuis le catalogue et la profondeur du
 * run, exactement comme le fait `reinitialiserRun` :
 *  - `revelee` = disponible au départ, OU révélée par un boss déjà tombé, OU ouverte par l'Ascension ;
 *  - `debloquee` = révélée ET (disponible au départ OU au moins un niveau payé).
 * Le **niveau** n'est jamais touché : une école dont le verrou se referme ne produit plus rien (EXG-7)
 * mais ne perd pas les niveaux payés — c'est la différence entre réparer et punir.
 */
function normaliserEcoles(
  etat: EtatJeu,
  zoneMax: number,
  constantes: Constantes,
): Readonly<Record<IdEcole, EtatEcole>> {
  const ecoles = { ...etat.ecoles }
  for (const [id, ecole] of Object.entries(etat.ecoles) as [IdEcole, EtatEcole][]) {
    const parametres = constantes.ecoles[id]
    if (parametres === undefined) continue

    const auDepart = parametres.zoneRevelation === null && !parametres.requiertAscension
    const parAscension = parametres.requiertAscension && etat.ascension.sixiemeEcoleDebloquee
    const parBoss =
      !parametres.requiertAscension &&
      parametres.zoneRevelation !== null &&
      zoneMax - 1 >= parametres.zoneRevelation

    const revelee = auDepart || parAscension || parBoss
    const debloquee = revelee && (auDepart || ecole.niveau >= 1)
    if (ecole.revelee === revelee && ecole.debloquee === debloquee) continue
    ecoles[id] = { ...ecole, revelee, debloquee }
  }
  return ecoles
}

/**
 * §5 / EXG-7 — `debloque` d'un sort est **dérivé** de son école (source unique, cf. `sorts/index.ts`) ;
 * l'auto-cast et le cooldown restant, eux, viennent de l'état persisté. `etatSortLu` est justement la
 * fonction qui applique cette règle : on la rejoue, plutôt que d'en écrire une seconde version.
 */
function normaliserSorts(etat: EtatJeu, constantes: Constantes): EtatJeu {
  const sorts: Record<string, EtatSort> = {}
  let modifie = false
  for (const [id, sort] of Object.entries(etat.sorts)) {
    const lu = etatSortLu(etat, id, constantes)
    sorts[id] = lu
    if (lu.debloque !== sort.debloque || lu.cooldownRestantMs !== sort.cooldownRestantMs) modifie = true
  }
  return modifie ? { ...etat, sorts } : etat
}

/** EXG-54 — une quête est créditée une seule fois : la liste ne porte jamais deux fois le même identifiant. */
function dedoublonner(ids: readonly string[]): readonly string[] {
  const vus = new Set<string>()
  const sortie: string[] = []
  for (const id of ids) {
    if (vus.has(id)) continue
    vus.add(id)
    sortie.push(id)
  }
  return sortie.length === ids.length ? ids : sortie
}

/**
 * Remet un état rechargé en cohérence. Appelée par l'import (après le schéma) et exposée pour que
 * `src/state/` puisse la rejouer après une reprise de session.
 */
export function normaliserEtat(etat: EtatJeu, constantes: Constantes): EtatJeu {
  // La zone maximale du run ne peut pas être derrière la zone où l'on combat (EXG-18) ; elle est lue
  // avant les écoles, parce que c'est elle qui décide des révélations acquises (EXG-8).
  const zoneMaxDuRun = Math.max(etat.prestige.zoneMaxDuRun, etat.combat.zone, ZONE_DEPART)

  const base: EtatJeu = {
    ...etat,
    version: VERSION_SCHEMA,
    bourse: {
      ...etat.bourse,
      // ADR-8 — seul l'arbre consomme les Éclats dépensables, et le prestige crédite les deux compteurs
      // du même montant : les dépensables ne peuvent donc pas dépasser les possédés.
      eclatsDepensables: Math.min(etat.bourse.eclatsDepensables, etat.bourse.eclatsPossedes),
    },
    ecoles: normaliserEcoles(etat, zoneMaxDuRun, constantes),
    combat: normaliserCombat(etat.combat, constantes),
    quetesAccomplies: dedoublonner(etat.quetesAccomplies),
    prestige: { ...etat.prestige, zoneMaxDuRun },
  }

  // EXG-40 — l'auto-cast se redérive des rangs d'arbre (la seule source de vérité), puis les sorts
  // reprennent leur `debloque` des écoles : dans cet ordre, pour qu'une entrée de sort créée par la
  // synchronisation reçoive elle aussi son déblocage dérivé.
  return normaliserSorts(synchroniserAutoCast(base, constantes), constantes)
}
