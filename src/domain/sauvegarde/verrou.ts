// Politique de verrou multi-onglet — T-11, EXG-48 : « quand un deuxième onglet du jeu s'ouvre, détecter
// l'onglet déjà actif et placer les onglets secondaires en lecture seule avec un message visible ».
//
// Ce fichier contient **la politique, et rien que la politique** : qui a le droit d'écrire, à partir
// d'un état de verrou (propriétaire + dernier battement), d'un identifiant d'onglet, d'un horodatage
// courant et d'un délai d'expiration — tous des **paramètres**. Aucun canal de diffusion entre onglets,
// aucun accès au stockage, aucune lecture d'horloge : `src/domain/` n'a pas le droit d'y toucher
// (spec §9) et `src/state/` branche le transport en vague 2 (décision de découpage du plan de chantier).
//
// Pourquoi séparer ainsi : la partie difficile d'un verrou n'est pas le transport, c'est la règle de
// reprise. Un onglet peut disparaître sans rendre le verrou (onglet tué, machine en veille), donc le
// verrou doit expirer ; et l'horloge d'un poste peut reculer ou être absurde, donc l'expiration ne doit
// jamais pouvoir être provoquée. Cette règle se teste sans navigateur, à condition qu'elle soit pure.
//
// Doctrine de prudence, appliquée partout ci-dessous : **le doute profite au propriétaire en place**.
// Une horloge illisible, un délai absurde, un horodatage qui recule ⇒ aucune reprise. Le pire défaut
// d'un verrou de sauvegarde est qu'il en laisse passer deux, pas qu'il bloque un onglet de trop.
//
// Aucune valeur d'équilibrage ici, et aucune valeur de configuration : même le délai d'expiration est
// un paramètre d'appel (`src/state/` le dérive de sa cadence de battement, EXG-22).

/** EXG-48 — état persisté du verrou : qui écrit, et quand il l'a signalé pour la dernière fois. */
export interface EtatVerrou {
  /** Identifiant de l'onglet propriétaire, engendré par `src/state/` à l'ouverture de l'onglet. */
  readonly idProprietaire: string
  /** Horodatage (ms epoch) du dernier battement du propriétaire. */
  readonly dernierHeartbeatMs: number
}

/** Pourquoi un onglet a — ou n'a pas — le droit d'écrire. Destiné au bandeau de lecture seule (T-23). */
export type MotifVerrou =
  /** L'emplacement était libre et vient d'être pris. */
  | 'revendique'
  /** L'onglet était déjà propriétaire : son battement vient d'être rafraîchi. */
  | 'renouvele'
  /** L'onglet est propriétaire et son droit est confirmé (évaluation sans écriture). */
  | 'proprietaire'
  /** Le précédent propriétaire s'était tu au-delà du délai : le verrou a changé de main. */
  | 'repris'
  /** Un autre onglet détient le verrou et bat encore : celui-ci reste en lecture seule (EXG-48). */
  | 'occupe'
  /** L'emplacement est libre et personne ne l'a revendiqué (évaluation sans écriture). */
  | 'libre'
  /** Horodatage courant non exploitable (non fini) : aucune décision de reprise n'est prise. */
  | 'horodatageInvalide'
  /** Identifiant d'onglet vide ou non textuel : il n'obtient jamais le droit d'écrire. */
  | 'identifiantInvalide'

/**
 * Verdict d'une opération de verrou. `verrou` est l'état **à persister** : la même référence qu'en
 * entrée quand rien n'a changé (aucune écriture inutile à propager entre onglets), un nouvel objet
 * quand le verrou a changé de main ou de battement.
 */
export interface VerdictVerrou {
  readonly droitEcriture: boolean
  readonly motif: MotifVerrou
  readonly verrou: EtatVerrou | null
}

/** Un identifiant d'onglet exploitable : une chaîne non vide, et rien d'autre. */
function identifiantValide(idOnglet: string): boolean {
  return typeof idOnglet === 'string' && idOnglet.length > 0
}

/**
 * Un état de verrou exploitable. Un verrou dont le propriétaire est vide ou dont le battement n'est pas
 * un nombre fini ne désigne personne : il vaut un emplacement libre (sinon un verrou corrompu
 * condamnerait la partie à la lecture seule pour toujours).
 */
function verrouLisible(verrou: EtatVerrou | null): verrou is EtatVerrou {
  return (
    verrou !== null &&
    identifiantValide(verrou.idProprietaire) &&
    Number.isFinite(verrou.dernierHeartbeatMs)
  )
}

/**
 * EXG-48 — le propriétaire s'est-il tu au-delà du délai ? `false` dans tous les cas douteux :
 *  - verrou illisible (il n'y a alors personne à périmer, la revendication passe par un autre chemin) ;
 *  - horodatage courant non fini, ou **antérieur** au dernier battement (horloge reculée) ;
 *  - délai d'expiration non fini ou non strictement positif.
 * Aucune de ces situations ne doit permettre à un second onglet de prendre la main sur un premier qui
 * écrit encore.
 */
export function verrouExpire(
  verrou: EtatVerrou | null,
  maintenantMs: number,
  delaiExpirationMs: number,
): boolean {
  if (!verrouLisible(verrou)) return false
  if (!Number.isFinite(maintenantMs)) return false
  if (!Number.isFinite(delaiExpirationMs) || delaiExpirationMs <= 0) return false
  const age = maintenantMs - verrou.dernierHeartbeatMs
  if (!Number.isFinite(age) || age < 0) return false
  return age > delaiExpirationMs
}

/**
 * EXG-48 — qui a le droit d'écrire, **sans rien modifier**. C'est la fonction que l'UI interroge pour
 * afficher (ou retirer) le bandeau de lecture seule d'un onglet secondaire, et le pendant « lecture
 * seule » de la confirmation à deux étapes des autres modules : elle ne peut, par construction, rien
 * écraser.
 */
export function evaluerDroitEcriture(
  verrou: EtatVerrou | null,
  idOnglet: string,
  maintenantMs: number,
  delaiExpirationMs: number,
): VerdictVerrou {
  if (!identifiantValide(idOnglet)) {
    return { droitEcriture: false, motif: 'identifiantInvalide', verrou }
  }
  if (!verrouLisible(verrou)) {
    return { droitEcriture: false, motif: 'libre', verrou: null }
  }
  // Le propriétaire garde son droit sans dépendre de l'horloge : il écrit déjà, et une horloge cassée
  // ne doit pas le mettre lui-même en lecture seule.
  if (verrou.idProprietaire === idOnglet) {
    return { droitEcriture: true, motif: 'proprietaire', verrou }
  }
  if (!Number.isFinite(maintenantMs)) {
    return { droitEcriture: false, motif: 'horodatageInvalide', verrou }
  }
  if (verrouExpire(verrou, maintenantMs, delaiExpirationMs)) {
    // Périmé : la reprise est **possible**, mais c'est `revendiquer` qui l'effectue.
    return { droitEcriture: false, motif: 'libre', verrou }
  }
  return { droitEcriture: false, motif: 'occupe', verrou }
}

/**
 * EXG-48 — un onglet demande le droit d'écrire. Trois issues : il prend un emplacement libre
 * (`revendique`), il reprend un verrou périmé (`repris`), ou il reste en lecture seule (`occupe`).
 * Un onglet déjà propriétaire passe par `renouveler` : revendiquer ce qu'on détient déjà, c'est
 * renouveler son battement.
 */
export function revendiquer(
  verrou: EtatVerrou | null,
  idOnglet: string,
  maintenantMs: number,
  delaiExpirationMs: number,
): VerdictVerrou {
  if (!identifiantValide(idOnglet)) {
    return { droitEcriture: false, motif: 'identifiantInvalide', verrou }
  }
  if (!Number.isFinite(maintenantMs)) {
    // Sans horodatage exploitable, on n'écrit aucun battement : ce serait poser un `NaN` dans l'état
    // du verrou, donc un verrou qu'aucune expiration ne pourrait plus libérer.
    return { droitEcriture: false, motif: 'horodatageInvalide', verrou }
  }

  if (!verrouLisible(verrou)) {
    return {
      droitEcriture: true,
      motif: 'revendique',
      verrou: { idProprietaire: idOnglet, dernierHeartbeatMs: maintenantMs },
    }
  }
  if (verrou.idProprietaire === idOnglet) {
    return renouveler(verrou, idOnglet, maintenantMs, delaiExpirationMs)
  }
  if (verrouExpire(verrou, maintenantMs, delaiExpirationMs)) {
    return {
      droitEcriture: true,
      motif: 'repris',
      verrou: { idProprietaire: idOnglet, dernierHeartbeatMs: maintenantMs },
    }
  }
  return { droitEcriture: false, motif: 'occupe', verrou }
}

/**
 * EXG-48 — battement du propriétaire : il conserve son droit d'écriture et rafraîchit son horodatage.
 * Un onglet qui n'est pas propriétaire ne renouvelle rien (il recevrait sinon le verrou d'un autre).
 * Un horodatage non fini laisse le battement **précédent** en place : le propriétaire garde la main,
 * et l'état du verrou ne reçoit jamais de valeur non finie.
 */
export function renouveler(
  verrou: EtatVerrou | null,
  idOnglet: string,
  maintenantMs: number,
  delaiExpirationMs: number,
): VerdictVerrou {
  if (!identifiantValide(idOnglet)) {
    return { droitEcriture: false, motif: 'identifiantInvalide', verrou }
  }
  if (!verrouLisible(verrou)) {
    return revendiquer(verrou, idOnglet, maintenantMs, delaiExpirationMs)
  }
  if (verrou.idProprietaire !== idOnglet) {
    return { droitEcriture: false, motif: 'occupe', verrou }
  }
  if (!Number.isFinite(maintenantMs)) {
    return { droitEcriture: true, motif: 'proprietaire', verrou }
  }
  // Le battement n'est jamais reculé : une horloge remise à l'heure vers le passé ne doit pas rendre
  // le verrou périmable plus tôt qu'il ne l'était.
  const dernierHeartbeatMs = Math.max(verrou.dernierHeartbeatMs, maintenantMs)
  if (dernierHeartbeatMs === verrou.dernierHeartbeatMs) {
    return { droitEcriture: true, motif: 'renouvele', verrou }
  }
  return {
    droitEcriture: true,
    motif: 'renouvele',
    verrou: { idProprietaire: idOnglet, dernierHeartbeatMs },
  }
}

/**
 * EXG-48 — le propriétaire rend la main (fermeture d'onglet, EXG-23) : l'emplacement redevient libre et
 * le prochain onglet l'obtient immédiatement, sans attendre l'expiration. Un onglet qui n'est pas
 * propriétaire ne libère rien : le verrou d'un autre ne se relâche pas à distance.
 */
export function liberer(verrou: EtatVerrou | null, idOnglet: string): EtatVerrou | null {
  if (!verrouLisible(verrou)) return null
  if (!identifiantValide(idOnglet) || verrou.idProprietaire !== idOnglet) return verrou
  return null
}
