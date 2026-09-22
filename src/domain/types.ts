// Types du moteur pur — objets métier de la spec §5 et contrat numérique de §8.
//
// Deux règles structurent ce fichier :
//  1. aucune valeur numérique ici (ni par défaut, ni en constante) : tout nombre d'équilibrage arrive
//     par le type `Constantes`, alimenté par le rapport du simulateur `tools/idle-balance` (T-14) puis
//     par `src/donnees/` (T-15) ;
//  2. aucun import `react`/`zustand`/DOM (invariant 1 de CLAUDE.md, spec §9 « Conventions fortes »).
//
// Les lots suivants de la vague 1 étendent ce fichier (T-3 écoles, T-4 sorts, T-5 zones, T-6 prestige,
// T-7 ascension, T-8 améliorations/équipement, T-9 quêtes, T-10 sauvegarde, T-13 fin de partie).

/* ═══════════════════════════════════════════════════════════════ identifiants (unions littérales) */

/**
 * §5 — identifiant d'école. La spec ne nomme que trois écoles : Feu (EXG-9, école de départ),
 * Glace (EXG-8, révélée par le boss de zone 2) et Lumière (EXG-41, 6e école débloquée à la
 * 1re Ascension). Les trois emplacements intermédiaires portent un identifiant de position stable ;
 * leur nom affiché est du contenu, écrit en vague 3 (T-24) dans `src/donnees/ecoles.ts` sans toucher
 * à ces identifiants.
 */
export type IdEcole = 'feu' | 'glace' | 'ecole3' | 'ecole4' | 'ecole5' | 'lumiere'

/** §4.2 / §4.5 — les quatre monnaies du jeu. `renommee` est réservée à l'équipement (EXG-10). */
export type IdMonnaie = 'or' | 'renommee' | 'eclats' | 'pointsAscension'

/** §4.5 — les deux arbres : celui des Éclats (remis à zéro à l'Ascension, EXG-39) et le permanent (EXG-40). */
export type IdArbre = 'eclats' | 'ascension'

/** §4.4 — phase de combat courante d'une zone : vagues normales, puis boss chronométré (EXG-16). */
export type PhaseCombat = 'vague' | 'boss'

/** §4.3 — une touche de sort actif, 1 à 6 ; la 6 ne répond qu'après la 1re Ascension (EXG-13, EXG-41). */
export type ToucheSort = 1 | 2 | 3 | 4 | 5 | 6

/** §4.2 / §4.6 — monnaie acceptée par un achat : or pour les améliorations (EXG-42), renommée pour l'équipement (EXG-43). */
export type MonnaieAchat = 'or' | 'renommee'

/** §4.2 — jalon qui accomplit une quête (EXG-54) : zone atteinte, monstres tués, ou 1er prestige. */
export type TypeJalonQuete = 'zoneAtteinte' | 'monstresTues' | 'premierPrestige'

/**
 * Motif d'un refus du moteur. Un refus ne modifie **jamais** l'état : l'appelant reçoit l'état d'entrée
 * tel quel et ce motif, à afficher par l'UI (T-19, T-20). Aucune exception n'est levée : le domaine
 * renvoie des valeurs, jamais des `throw` (le tick ne doit pas pouvoir casser sur une action refusée).
 */
export type MotifRefus =
  /** Identifiant absent du contenu (`Constantes`). */
  | 'inconnu'
  /** EXG-7 / EXG-14 / EXG-41 — brique pas encore débloquée (école, sort, 6e école). */
  | 'verrouille'
  /** Solde insuffisant dans la monnaie **attendue** par l'achat. */
  | 'monnaieInsuffisante'
  /** EXG-10 — monnaie proposée différente de celle exigée (l'or ne se substitue pas à la Renommée). */
  | 'mauvaiseMonnaie'
  /** Palier maximal de l'achat déjà atteint. */
  | 'paliersMaxAtteints'
  /** Quantité demandée non finie, nulle ou négative. */
  | 'quantiteInvalide'
  /** EXG-12 — sort encore en cooldown. */
  | 'enCooldown'

/* ═══════════════════════════════════════════════════════════════════════════ contenu (src/donnees) */
// Descripteurs de contenu : textes et relations. Les nombres associés vivent dans `Constantes`.

/**
 * §5 — une école de magie : générateur passif, débloque un sort actif. Textes écrits en T-24.
 * Ce descripteur ne porte que du **texte** : la zone de révélation (EXG-8) et le verrou d'Ascension
 * (EXG-41) sont des valeurs de progression, donc des sorties du simulateur — elles vivent dans
 * `ParametresEcole` (contrat `Constantes`), seule source de vérité lue par le moteur.
 */
export interface Ecole {
  readonly id: IdEcole
  readonly nom: string
  readonly description: string
  /** §5 « une École débloque un Sort ». */
  readonly idSort: string
}

/** §5 / §4.3 — un sort actif : dégâts instantanés puis cooldown (EXG-12), lié à une école. */
export interface Sort {
  readonly id: string
  readonly nom: string
  readonly description: string
  readonly idEcole: IdEcole
  readonly touche: ToucheSort
}

/** §5 / §4.4 — une zone : suite de vagues puis un boss. Les PV suivent la formule paramétrique de §8. */
export interface Zone {
  readonly numero: number
  readonly nom: string
  readonly ambiance: string
}

/** §5 — une vague de monstres au sein d'une zone : `PV(k) = PV_base_vague1 × croissance_vague^(k-1)` (EXG-15). */
export interface Vague {
  readonly zone: number
  readonly numero: number
  readonly pvMonstre: number
}

/**
 * §5 — un monstre en combat. Ses PV viennent de la vague, son or de
 * `Or = PV × or_par_dégât_moyen × mult_or_zone` (EXG-6). `nom` est du **contenu** : le moteur crée les
 * monstres avec un nom vide, `src/donnees/zones.ts` (T-25) les baptise par zone.
 */
export interface Monstre {
  readonly nom: string
  readonly pvMax: number
  readonly pvCourants: number
  readonly orAuMeurtre: number
}

/** §5 / EXG-16 — un boss : monstre chronométré ; l'échec renvoie à la vague précédente (EXG-17). */
export interface Boss extends Monstre {
  readonly zone: number
  /** Marqueur de type : distingue un boss d'un monstre de vague sans tester un champ facultatif. */
  readonly estBoss: true
  /** EXG-44 — vrai pour le boss final de la zone dédiée de fin de partie (EXG-28). */
  readonly estFinal: boolean
}
// EXG-16 — le temps restant du combat de boss est porté par `EtatCombat.timerBossRestantMs` seul :
// une seule source de vérité pour une seule valeur (le boss lui-même ne duplique pas son chrono).

/** §5 — une quête (succès fusionnés, §3.2) : accomplie une seule fois sur jalon, crédite de la Renommée (EXG-54). */
export interface Quete {
  readonly id: string
  readonly nom: string
  readonly description: string
  readonly typeJalon: TypeJalonQuete
  /** Valeur du jalon (numéro de zone, nombre de monstres) ; ignorée pour `premierPrestige`. */
  readonly seuil: number
}

/** §5 / EXG-42 — une amélioration achetée en or, multiplicateur de dégâts à paliers. */
export interface Amelioration {
  readonly id: string
  readonly nom: string
  readonly description: string
  readonly monnaie: MonnaieAchat
}

/** §5 / EXG-43 — un équipement acheté en Renommée exclusivement (EXG-10), multiplicateur de dégâts. */
export interface Equipement {
  readonly id: string
  readonly nom: string
  readonly description: string
}

/**
 * §8 / EXG-39 / EXG-40 — nature de l'effet d'un nœud d'arbre : ce que son rang modifie dans le moteur.
 * Cette union est le **contrat** entre le catalogue de nœuds (donnée) et le moteur : ajouter un nœud est
 * une écriture de contenu, ajouter un *type* d'effet est une modification de moteur.
 * EXG-39 couvre les quatre premiers (dégâts, or, zone de départ, cooldowns), EXG-40 les trois derniers
 * (auto-cast, synergies entre écoles, bonus de départ de run).
 */
export type TypeEffetNoeud =
  /** §8 — facteur de la chaîne de DPS (`mult_arbre_Éclats` / `mult_arbre_Ascension`). */
  | 'multDegats'
  /** EXG-6 — facteur appliqué à l'or gagné. */
  | 'multOr'
  /** EXG-19 / EXG-39 — décale la zone où reprend un run après réinitialisation. */
  | 'zoneDepart'
  /** EXG-12 — raccourcit les cooldowns de sorts (facteur < 1 par rang). */
  | 'reductionCooldown'
  /** EXG-40 — arme l'auto-cast du sort désigné par `idSortCible`. */
  | 'autoCast'
  /** EXG-40 — synergie entre écoles : le facteur croît avec le nombre d'écoles débloquées. */
  | 'synergieEcoles'
  /** EXG-40 — bonus de départ de run : or crédité à chaque réinitialisation. */
  | 'orDepart'

/** §5 / EXG-39 / EXG-40 — un nœud d'arbre. `rangsInfinis` marque le nœud répétable exigé par la spec §8. */
export interface NoeudArbre {
  readonly id: string
  readonly arbre: IdArbre
  readonly nom: string
  readonly description: string
  /** `null` = rangs infinis à coût croissant (au moins un par arbre, §8). */
  readonly rangMax: number | null
  /** Identifiants des nœuds requis avant achat ; vide pour une racine. */
  readonly prerequis: readonly string[]
}

/* ══════════════════════════════════════════════════════════════════════════ état de jeu (runtime) */

/** §5 — stats globales du magicien. Les dégâts effectifs se recalculent par la chaîne de §8, jamais stockés. */
export interface Magicien {
  readonly nom: string
  /** EXG-11 — nombre de clics du sort de clic depuis le début de la partie (statistique + quêtes). */
  readonly clicsCumules: number
  /** Dégâts cumulés infligés depuis le début de la partie (statistique, jamais une entrée de formule). */
  readonly degatsCumules: number
  /** EXG-54 — monstres tués à vie, jalon de quête. */
  readonly monstresTues: number
}

/** §4.2 — soldes de monnaies. `eclatsPossedes` alimente le bonus passif (EXG-38), `eclatsDepensables` l'arbre (EXG-39). */
export interface Bourse {
  readonly or: number
  readonly renommee: number
  /** EXG-38 — solde d'Éclats du cycle d'Ascension, base du bonus passif ; jamais réduit par l'arbre. */
  readonly eclatsPossedes: number
  /** EXG-39 — Éclats encore dépensables dans l'arbre d'Éclats. */
  readonly eclatsDepensables: number
  /** EXG-20 — Points d'Ascension disponibles pour l'arbre permanent. */
  readonly pointsAscension: number
}

/** §4.2 — état runtime d'une école : niveau acheté et visibilité (EXG-7, EXG-8). */
export interface EtatEcole {
  readonly niveau: number
  /** EXG-7 — une école non débloquée ne produit rien et ne compte pas dans le total de dégâts. */
  readonly debloquee: boolean
  /** EXG-8 — révélée (nom + coût visibles) mais pas encore achetée. */
  readonly revelee: boolean
}

/** §4.3 — état runtime d'un sort actif : cooldown restant en millisecondes (EXG-12). */
export interface EtatSort {
  readonly debloque: boolean
  readonly cooldownRestantMs: number
  /** EXG-40 — auto-cast acquis par un nœud de l'arbre d'Ascension. */
  readonly autoCast: boolean
}

/** §4.4 — progression de combat du run courant : zone, vague, phase, cible. */
export interface EtatCombat {
  readonly zone: number
  readonly vague: number
  readonly phase: PhaseCombat
  /** Monstre ou boss en cours ; `null` entre deux vagues (lot C, T-5). */
  readonly cible: Monstre | Boss | null
  /** EXG-16 — temps restant du combat de boss, en ms ; `null` hors phase boss. */
  readonly timerBossRestantMs: number | null
}

/** §4.5 — état du cycle de prestige courant (EXG-18, EXG-19, EXG-38, EXG-39). */
export interface EtatPrestige {
  /** Nombre de prestiges du cycle d'Ascension courant, base de la disponibilité de l'Ascension (EXG-20). */
  readonly prestigesDuCycle: number
  /** Nombre de prestiges à vie (contrainte dure 20 ≤ total ≤ 30, §8). */
  readonly prestigesTotal: number
  /** EXG-18 — zone maximale atteinte durant le run courant, entrée de `Éclats = floor(k × zone_max^α)`. */
  readonly zoneMaxDuRun: number
  /** Éclats cumulés à vie, entrée de `Points = floor(k_ascension × √Éclats_cumulés)` (§8). */
  readonly eclatsCumulesAVie: number
  /** EXG-39 — rang acheté par nœud de l'arbre d'Éclats ; remis à zéro à chaque Ascension (EXG-20). */
  readonly rangsArbreEclats: Readonly<Record<string, number>>
}

/** §4.5 — état d'Ascension (EXG-20, EXG-40, EXG-41, EXG-44). */
export interface EtatAscension {
  readonly ascensionsEffectuees: number
  /** EXG-40 — rang acheté par nœud de l'arbre permanent ; jamais réinitialisé. */
  readonly rangsArbreAscension: Readonly<Record<string, number>>
  /** EXG-41 — la 6e école (Lumière) est révélée par la 1re Ascension. */
  readonly sixiemeEcoleDebloquee: boolean
}

/**
 * EXG-28 — combat du boss final **en cours**, dans sa zone dédiée. Il vit à part d'`EtatCombat` et
 * c'est délibéré : la zone dédiée n'est pas sur l'échelle de progression (`ConstantesFin.zoneBossFinal`
 * est un nom), donc elle ne doit jamais traverser `combat.zone` — sinon elle gonflerait `zoneMaxDuRun`,
 * donc le gain d'Éclats d'EXG-18, et le chemin chaud du tick devrait la tester à chaque pas (EXG-30).
 * Ce qui est dérivable n'est pas stocké : les PV maximaux et la durée du chrono viennent des constantes.
 */
export interface EtatBossFinal {
  readonly pvCourants: number
  /** EXG-16 — temps restant du combat final, en ms ; part de `fin.timerBossFinalS`. */
  readonly timerRestantMs: number
}

/**
 * EXG-28 — statistiques de l'écran de fin, **figées** à la victoire. Elles ne se recalculent pas après
 * coup : le temps de jeu continue d'avancer une fois la partie terminée, une lecture tardive mentirait.
 * Les trois premières sont littéralement exigées par le critère d'acceptation d'EXG-28.
 */
export interface StatistiquesFin {
  /** Temps de jeu simulé au moment de la victoire (hors-ligne exclu, comme partout ailleurs). */
  readonly dureeTotaleMs: number
  /** Zone la plus profonde atteinte par la **progression** ; jamais la zone dédiée du boss final. */
  readonly zoneMaxAtteinte: number
  readonly ascensions: number
  readonly prestigesTotal: number
}

/** EXG-4 / EXG-53 — résumé d'une absence, à afficher en encart non bloquant. Les 3 valeurs exigées. */
export interface ResumeHorsLigne {
  /** Or crédité par la production passive des écoles pendant l'absence (EXG-5). */
  readonly orGagne: number
  /** Temps réellement crédité, après clamp sur `[0, H]` (EXG-49). */
  readonly tempsEcouleMs: number
  /** Vrai si l'absence dépassait le plafond `H` (EXG-4). */
  readonly plafondAtteint: boolean
}

/**
 * §5 — état de jeu complet : unique source de vérité (invariant 4 de CLAUDE.md). Immuable :
 * chaque fonction du moteur retourne un nouvel état, jamais une mutation de son entrée.
 */
export interface EtatJeu {
  /** EXG-25 — version du schéma de sauvegarde (T-10). */
  readonly version: number
  readonly magicien: Magicien
  readonly bourse: Bourse
  /** EXG-7 — état par école ; la chaîne de DPS somme ce dictionnaire, jamais une liste en dur. */
  readonly ecoles: Readonly<Record<IdEcole, EtatEcole>>
  /** §4.3 — état par sort actif, indexé par identifiant de sort (lot B, T-4). */
  readonly sorts: Readonly<Record<string, EtatSort>>
  readonly combat: EtatCombat
  /** EXG-42 — palier acheté par amélioration (or). */
  readonly paliersAmeliorations: Readonly<Record<string, number>>
  /** EXG-43 — palier acheté par équipement (renommée). */
  readonly paliersEquipement: Readonly<Record<string, number>>
  /** EXG-54 — identifiants des quêtes déjà accomplies, créditées une seule fois. */
  readonly quetesAccomplies: readonly string[]
  readonly prestige: EtatPrestige
  readonly ascension: EtatAscension
  /** EXG-28 / EXG-44 — partie terminée : plus aucun prestige ni Ascension possible. */
  readonly partieTerminee: boolean
  /**
   * EXG-28 — combat du boss final en cours. **Facultatif** : absent tant que la zone dédiée n'a pas été
   * ouverte, et absent de toutes les sauvegardes écrites avant T-13. C'est ce qui permet de relire un
   * ancien format sans migration ni perte : le champ n'est pas inventé au chargement, il reste absent.
   */
  readonly bossFinal?: EtatBossFinal
  /** EXG-28 — écran de fin figé à la victoire ; absent tant que le boss final n'est pas tombé. */
  readonly statistiquesFin?: StatistiquesFin

  // ── horloge (EXG-1 à 3, EXG-49) ────────────────────────────────────────────────────────────────
  /** Temps de jeu simulé, en ms : avance de `PAS_TICK_MS` par tick (EXG-1). Le hors-ligne ne l'incrémente pas. */
  readonly tempsJeuMs: number
  /** Nombre total de ticks simulés (itérés ou résolus en forme fermée). */
  readonly ticksEcoules: number
  /**
   * EXG-3 / EXG-30 — compteur d'itérations de la boucle de simulation : nombre de ticks réellement
   * **itérés**, cumulé. Chaque appel de `appliquerDelta` en ajoute au plus `constantes.tick.nTicksMax`
   * (au-delà, le moteur passe en forme fermée et n'itère pas du tout).
   *
   * Ce compteur **documente l'intention**, il ne prouve rien : c'est `tick()` qui se l'incrémente, donc
   * il compte les appels à `tick()` et non le coût d'un appel. Une boucle proportionnelle à l'historique
   * ajoutée dans `tick()` ne le ferait pas bouger d'un pas. La preuve du coût constant est le test de
   * durée sur une session de 2 h (`tests/domain/tick.test.ts`, spec §12, LRN-002).
   * Persisté : il fait partie du format de sauvegarde depuis la version 1 et de ses fixtures gelées.
   */
  readonly ticksRattrapes: number
  /**
   * EXG-30 — compteur d'itérations de la **résolution de combat**, cumulé (pendant de `ticksRattrapes`
   * pour les vagues). Chaque avancement de combat en ajoute un nombre borné, indépendant du DPS : les
   * vagues nettoyées d'un coup se résolvent en forme fermée (série géométrique), jamais monstre par
   * monstre.
   *
   * Même réserve que ci-dessus : le nombre ajouté par pas est une constante littérale du code de combat,
   * pas une observation du travail fait. Il dit ce que l'algorithme promet ; ce sont les tests sous
   * timeout de `tests/domain/zones.test.ts` qui vérifient qu'il le tient (LRN-002).
   * Persisté : il fait partie du format de sauvegarde depuis la version 1 et de ses fixtures gelées.
   */
  readonly iterationsCombat: number
  /** EXG-2 — reste de delta-time sous `PAS_TICK_MS`, conservé d'une frame à l'autre (jamais perdu). */
  readonly resteDeltaMs: number
  /** EXG-49 — horodatage (ms epoch) de la dernière sauvegarde, base du calcul hors-ligne. */
  readonly derniereSauvegardeMs: number
  /** Temps crédité hors-ligne, cumulé, en ms (statistique : n'entre pas dans la cible « ≥ 40 h » de §8). */
  readonly tempsHorsLigneMs: number
}

/* ════════════════════════════════════════════════════════════ résultats d'action (retours du moteur) */
// Toute action du joueur (achat, déclenchement de sort) renvoie le NOUVEL état plus un verdict : rien
// n'est jamais muté, et un refus est une valeur de retour, pas une exception.

/** EXG-8 / EXG-9 / EXG-42 / EXG-43 — verdict d'un achat (niveau d'école, palier d'amélioration/équipement). */
export interface ResultatAchat {
  /** Nouvel état ; **strictement égal** à l'état d'entrée en cas de refus (aucun effet de bord). */
  readonly etat: EtatJeu
  readonly accepte: boolean
  readonly motifRefus: MotifRefus | null
  /** Montant réellement débité (0 en cas de refus). */
  readonly coutPaye: number
  /** Nombre de niveaux/paliers réellement achetés (0 en cas de refus). */
  readonly quantite: number
}

/** EXG-11 / EXG-12 — verdict d'un déclenchement de sort actif ou du sort de clic. */
export interface ResultatDeclenchement {
  readonly etat: EtatJeu
  readonly declenche: boolean
  readonly motifRefus: MotifRefus | null
  /** Dégâts instantanés produits (0 si refusé) ; consommés par la résolution de combat. */
  readonly degats: number
}

/**
 * EXG-15 à 17 / EXG-30 — résultat d'un pas de combat : le nouveau combat plus ce qui vient de se passer.
 * L'appelant (le tick) en tire les conséquences hors combat : compteur de monstres tués, révélation
 * d'école par boss vaincu (EXG-8), jalons de quête (EXG-54).
 */
export interface AvancementCombat {
  readonly combat: EtatCombat
  /** Monstres (et boss) tombés pendant ce pas ; peut valoir plusieurs vagues d'un coup (forme fermée). */
  readonly monstresTues: number
  readonly vaguesNettoyees: number
  readonly bossVaincu: boolean
  /** EXG-17 — le chrono a expiré avant la mort du boss. */
  readonly bossEchoue: boolean
  /** EXG-8 — numéro de zone dont le boss vient de tomber ; `null` sinon. */
  readonly zoneVaincue: number | null
  /** EXG-30 — étapes de résolution consommées : indépendant du DPS et de la profondeur atteinte. */
  readonly iterations: number
}

/**
 * EXG-19 / EXG-21 — ce qu'une réinitialisation de run emporte. Sert la 1re étape de la confirmation à
 * deux étapes : le joueur voit le prix avant de payer, l'UI (T-23) n'a rien à recalculer.
 */
export interface PerteDeRun {
  /** Zone la plus profonde atteinte pendant le run (EXG-18). */
  readonly zoneAtteinte: number
  readonly or: number
  /** Somme des niveaux d'écoles achetés pendant le run (EXG-9). */
  readonly niveauxEcoles: number
}

/**
 * EXG-18 / EXG-21 — prévisualisation d'un prestige, **lecture seule** : aucune fonction produisant cette
 * valeur ne modifie l'état (c'est l'étape 1 de la confirmation à deux étapes).
 */
export interface ApercuPrestige {
  readonly disponible: boolean
  /** Motif d'indisponibilité, `null` si le prestige est possible. */
  readonly motifIndisponible: MotifRefus | null
  /** EXG-18 — `floor(k × zone_max^α)`, crédité sur les **deux** compteurs d'Éclats (ADR-8). */
  readonly eclatsGagnes: number
  readonly zoneMaxDuRun: number
  readonly perte: PerteDeRun
  /** EXG-19 / EXG-39 — zone où le run repart (décalée par les nœuds « zone de départ »). */
  readonly zoneReprise: number
  /** EXG-40 — or crédité au départ du nouveau run (bonus de départ de l'arbre d'Ascension). */
  readonly orDeDepart: number
}

/** EXG-20 / EXG-21 — prévisualisation d'une Ascension, **lecture seule** (même contrat qu'`ApercuPrestige`). */
export interface ApercuAscension {
  readonly disponible: boolean
  readonly motifIndisponible: MotifRefus | null
  /** §8 — `floor(k_ascension × √Éclats_cumulés_à_vie)`. */
  readonly pointsGagnes: number
  readonly prestigesDuCycle: number
  /** §8 — `prestigesParAscension` : seuil du cycle courant. */
  readonly prestigesRequis: number
  /** EXG-20 / ADR-14 — Éclats possédés qui partent (avec le bonus passif d'EXG-38). */
  readonly eclatsPossedesPerdus: number
  readonly eclatsDepensablesPerdus: number
  /** EXG-20 / ADR-14 — nombre de nœuds de l'arbre d'Éclats qui reviennent à rang 0. */
  readonly noeudsEclatsPerdus: number
  readonly perte: PerteDeRun
  /** EXG-41 — vrai si cette Ascension débloquerait la 6e école (donc la 1re seulement). */
  readonly debloqueSixiemeEcole: boolean
}

/**
 * EXG-19 / EXG-20 — verdict d'une réinitialisation irréversible (étape 2 de la confirmation). Même
 * discipline que `ResultatAchat` : un refus rend l'état d'entrée **par référence**, `gain` à 0.
 */
export interface ResultatReinitialisation {
  readonly etat: EtatJeu
  readonly accepte: boolean
  readonly motifRefus: MotifRefus | null
  /** Monnaie de méta créditée : Éclats au prestige (EXG-18), Points à l'Ascension (§8). */
  readonly gain: number
}

/**
 * EXG-28 — prévisualisation **en lecture seule** de la zone dédiée du boss final : où en est le joueur
 * du seuil d'Ascensions, et ce qui l'attend s'il entre. Même discipline que les deux autres aperçus
 * (EXG-21) : aucune fonction produisant cette valeur ne construit ni ne retourne d'état.
 */
export interface ApercuFin {
  readonly accessible: boolean
  readonly motifIndisponible: MotifRefus | null
  readonly ascensionsEffectuees: number
  /** §8 / EXG-28 — `nAscensionsRequises`, seuil d'ouverture de la zone dédiée. */
  readonly ascensionsRequises: number
  /** EXG-28 — `pvBoss(profondeur_équivalente) × mult_pv`, jamais `pvBoss(zoneBossFinal)`. */
  readonly pvBossFinal: number
  /** EXG-16 / EXG-28 — durée du chrono du combat final, en ms. */
  readonly timerMs: number
  /** Vrai si un combat final est déjà en cours (entrer une seconde fois ne le relancerait pas). */
  readonly engage: boolean
}

/** EXG-28 — verdict d'une entrée dans la zone dédiée ; un refus rend l'état d'entrée **par référence**. */
export interface ResultatEntreeFinale {
  readonly etat: EtatJeu
  readonly accepte: boolean
  readonly motifRefus: MotifRefus | null
}

/**
 * EXG-16 / EXG-28 / EXG-44 — résultat d'un pas de combat du boss final. Même forme d'esprit
 * qu'`AvancementCombat`, mais sur l'état complet : la victoire ne touche pas qu'au combat, elle termine
 * la partie et fige l'écran de fin.
 */
export interface AvancementBossFinal {
  readonly etat: EtatJeu
  /** Faux si aucun combat final n'était engagé : le pas n'a alors rien fait du tout. */
  readonly engage: boolean
  readonly bossVaincu: boolean
  /** EXG-16 — le chrono a expiré avant la mort du boss ; le combat se referme sans rien coûter. */
  readonly bossEchoue: boolean
  readonly pvRestants: number
  readonly timerRestantMs: number
  /** EXG-30 — étapes de résolution consommées : constant, indépendant du budget de dégâts. */
  readonly iterations: number
}

/** §4.7 — enveloppe persistée : état sérialisé + version de schéma (EXG-24, EXG-25, EXG-26). */
export interface Sauvegarde {
  /** EXG-25 — version du schéma, pour la chaîne de migrations (EXG-26). */
  readonly version: number
  /** Horodatage d'écriture (ms epoch), relu par le calcul hors-ligne (EXG-49). */
  readonly horodatageMs: number
  readonly etat: EtatJeu
}

/* ══════════════════════════════════════════════════ constantes d'équilibrage (sortie du simulateur) */
// Contrat des valeurs produites par `tools/idle-balance` (T-14) et injectées dans `src/donnees/` (T-15).
// Le moteur les reçoit **en paramètre** : aucune valeur d'équilibrage n'est écrite dans `src/domain/`.

/** EXG-1 à 3 — paramètres de la boucle de simulation. */
export interface ConstantesTick {
  /**
   * EXG-3 — seuil N de ticks à rattraper au-delà duquel le moteur bascule en forme fermée au lieu
   * d'itérer. Sortie du simulateur (proposition §4.1 : 600).
   */
  readonly nTicksMax: number
}

/** EXG-4 / EXG-49 — plafond de production hors-ligne. */
export interface ConstantesHorsLigne {
  /** `H` en heures, contraint à `[8, 12]` par §8 ; valeur exacte fixée par le rapport T-14. */
  readonly plafondHeures: number
}

/** EXG-9 / §8 — contrat numérique d'une école (générateur passif). */
export interface ParametresEcole {
  /** EXG-9 — `Coût(n) = coût_base × croissance^n`. */
  readonly coutBase: number
  readonly croissance: number
  /** Production passive d'un niveau, en dégâts par seconde (chaîne de DPS §8). */
  readonly productionBase: number
  /** §8 — seuils de niveau où le palier est franchi (interview : 10/25/50/100). */
  readonly paliersSeuils: readonly number[]
  /** §8 — multiplicateur appliqué à chaque seuil franchi (interview : ×2). */
  readonly multiplicateurParPalier: number
  /**
   * EXG-8 — numéro de zone dont le boss révèle cette école ; `null` = disponible dès le départ
   * (École du Feu, EXG-9). Le moteur lit cette valeur : aucun `if` sur un identifiant d'école.
   */
  readonly zoneRevelation: number | null
  /** EXG-41 — vrai pour la 6e école (Lumière) : hors du circuit avant la 1re Ascension. */
  readonly requiertAscension: boolean
}

/** EXG-11 à 14 — contrat numérique d'un sort actif (§4.3). */
export interface ParametresSort {
  readonly id: string
  /** §5 « une École débloque un Sort » : le sort suit le déblocage de son école (EXG-7). */
  readonly idEcole: IdEcole
  /** EXG-13 — touche 1 à 6 ; la 6 ne répond qu'après la 1re Ascension. */
  readonly touche: ToucheSort
  /** Dégâts instantanés du sort, avant la chaîne des multiplicateurs d'achats (§8). */
  readonly degatsBase: number
  /** EXG-12 — durée du cooldown en millisecondes. */
  readonly cooldownMs: number
}

/** EXG-10 / EXG-54 — contrat numérique d'une quête (les succès sont des quêtes, ADR-11). */
export interface ParametresQuete {
  readonly id: string
  /** Libellé de travail ; le texte définitif est du contenu (`Quete.nom`, T-26). */
  readonly libelle: string
  readonly typeJalon: TypeJalonQuete
  /** Valeur du jalon (numéro de zone, nombre de monstres) ; ignorée pour `premierPrestige`. */
  readonly seuil: number
  /** EXG-10 — Renommée créditée une seule fois, dépensable uniquement en équipement. */
  readonly renommeeGagnee: number
}

/** §8 — zones générées par une formule paramétrique sans borne : aucun nombre de zones fixé a priori. */
export interface ConstantesZones {
  /** PV du premier monstre de la zone 1 (EXG-15). */
  readonly pvBaseVague1Zone1: number
  /** EXG-15 — `PV(k) = PV_base_vague1 × croissance_vague^(k-1)`. */
  readonly croissanceVague: number
  /** Nombre de vagues normales avant le boss (EXG-16). */
  readonly nbVagues: number
  /** §8 — `PV_boss(z) = PV(nb_vagues) × mult_boss`. */
  readonly multBoss: number
  /** §8 — `PV_base_vague1(z+1) = PV_boss(z) × mult_zone_suivante`. */
  readonly multZoneSuivante: number
  /** EXG-16 — durée du combat de boss, en secondes. */
  readonly timerBossS: number
}

/** §8 — économie de l'or. */
export interface ConstantesOr {
  /** §8 — or moyen par point de dégât infligé ; utilisé par le tick et le hors-ligne. */
  readonly orParDegatMoyen: number
  /** §8 — `mult_or_zone(z) = croissanceOrParZone^(z-1)`, croissant (EXG-6). */
  readonly croissanceOrParZone: number
  /** §8 — dégâts du sort de clic hors bonus : `D_clic = base_clic × (1 + Σ bonus_améliorations)` (EXG-11). */
  readonly baseClic: number
}

/** EXG-18 / EXG-38 / EXG-39 — prestige : gain d'Éclats et bonus passif. */
export interface ConstantesPrestige {
  /** EXG-18 — `Éclats = floor(k × zone_max^α)`. */
  readonly k: number
  readonly alpha: number
  /** EXG-38 — `(1 + B × Éclats_possédés)^β` ; la forme elle-même est une sortie du simulateur (§8). */
  readonly bonusPassifB: number
  readonly bonusPassifBeta: number
  /** EXG-39 — coût du rang r d'un nœud de l'arbre d'Éclats : `coûtBase × croissance^r`. */
  readonly coutBaseNoeud: number
  readonly croissanceCoutNoeud: number
}

/**
 * EXG-39 / EXG-40 — contrat numérique d'un nœud d'arbre, commun aux deux arbres.
 *
 * Coût du rang `r` (0-indexé) : `coutBaseNoeud(arbre) × coutRelatif × croissanceCoutNoeud(arbre)^r`
 * (§8, même famille que EXG-9). Le couple `(coutBaseNoeud, croissanceCoutNoeud)` est porté par l'arbre
 * (`ConstantesPrestige`, `ConstantesAscension`) : une seule échelle de coût par arbre à chercher pour le
 * simulateur (T-14), et `coutRelatif` pèse chaque nœud dans cette échelle.
 */
export interface ParametresNoeudArbre {
  readonly id: string
  readonly arbre: IdArbre
  readonly effet: TypeEffetNoeud
  /**
   * Intensité d'**un** rang, interprétée selon `effet` :
   *  - `multDegats` / `multOr` : facteur par rang (> 1), composé en puissance du rang ;
   *  - `reductionCooldown` : facteur par rang (< 1), composé en puissance du rang ;
   *  - `zoneDepart` : nombre de zones ajoutées par rang ;
   *  - `orDepart` : or crédité par rang au départ d'un run ;
   *  - `synergieEcoles` : bonus par rang **et par école débloquée** (forme additive) ;
   *  - `autoCast` : ignoré (l'effet est binaire, rang ≥ 1).
   */
  readonly effetParRang: number
  /** `null` = rangs infinis à coût croissant (au moins un par arbre, §8). */
  readonly rangMax: number | null
  /** Poids du nœud dans l'échelle de coût de son arbre (voir la formule ci-dessus). */
  readonly coutRelatif: number
  /** Nœuds à posséder (rang ≥ 1) avant de pouvoir acheter celui-ci ; vide pour une racine. */
  readonly prerequis: readonly string[]
  /** EXG-40 — sort visé par un nœud `autoCast` ; `null` pour tout autre effet. */
  readonly idSortCible: string | null
}

/** EXG-20 / EXG-40 — ascension : gain de Points et arbre permanent. */
export interface ConstantesAscension {
  /** §8 — `Points = floor(k_ascension × √Éclats_cumulés_à_vie)`. */
  readonly kAscension: number
  /** §8 — nombre de prestiges requis avant une Ascension (fourchette 5-8, couple fixé par T-14). */
  readonly prestigesParAscension: number
  /** EXG-40 — coût du rang r d'un nœud de l'arbre d'Ascension : `coûtBase × croissance^r`. */
  readonly coutBaseNoeud: number
  readonly croissanceCoutNoeud: number
}

/** EXG-42 / EXG-43 — contrat numérique d'un achat à paliers (améliorations en or, équipement en renommée). */
export interface ParametresAchatMultiplicatif {
  readonly id: string
  /** EXG-42 / EXG-43 — coût du palier n+1 = `coût_base × croissance^n` (même famille que EXG-9). */
  readonly coutBase: number
  readonly croissance: number
  /** Facteur appliqué dans la chaîne de DPS §8 à chaque palier acheté. */
  readonly effetMult: number
  readonly monnaie: MonnaieAchat
  /** `null` = paliers illimités. */
  readonly paliersMax: number | null
}

/** EXG-28 / EXG-44 — conditions de fin de partie (lot D, T-13). */
export interface ConstantesFin {
  /** §8 — 3 à 5 Ascensions, sous la contrainte dure `20 ≤ N × prestigesParAscension ≤ 30`. */
  readonly nAscensionsRequises: number
  /**
   * EXG-28 — **nom** de la zone dédiée qui héberge le boss final, jamais une profondeur de progression.
   * Le boss final ne vit pas sur l'échelle normale des zones : s'il y vivait, le joueur le croiserait
   * pendant un run ordinaire. Ses PV ne s'en déduisent donc pas (voir les deux champs suivants).
   */
  readonly zoneBossFinal: number
  /** EXG-28 — profondeur **équivalente** dont les PV du boss final sont dérivés (`pvBoss(z)`). */
  readonly pvProfondeurEquivalente: number
  /** EXG-28 — facteur appliqué à `pvBoss(pvProfondeurEquivalente)` pour obtenir les PV du boss final. */
  readonly pvMultiplicateur: number
  /** EXG-16 / EXG-28 — durée du combat du boss final, en secondes ; distincte de `zones.timerBossS`. */
  readonly timerBossFinalS: number
}

/**
 * §8 — l'ensemble des valeurs d'équilibrage, passé en paramètre à chaque fonction du moteur.
 * Provenance : rapport `tools/idle-balance` (T-14), recopié dans `src/donnees/` (T-15). D'ici là, les
 * valeurs d'amorçage du simulateur vivent hors de `src/`, sous `tools/idle-balance/` — c'est de là que
 * les tests du moteur construisent cet objet.
 */
export interface Constantes {
  readonly tick: ConstantesTick
  readonly horsLigne: ConstantesHorsLigne
  readonly ecoles: Readonly<Record<IdEcole, ParametresEcole>>
  /** §4.3 — un descripteur par sort actif (6 touches, EXG-13). */
  readonly sorts: readonly ParametresSort[]
  readonly zones: ConstantesZones
  readonly or: ConstantesOr
  /** EXG-54 — liste des quêtes (succès inclus, ADR-11). */
  readonly quetes: readonly ParametresQuete[]
  readonly prestige: ConstantesPrestige
  readonly ascension: ConstantesAscension
  /**
   * EXG-39 / EXG-40 — catalogue des nœuds des **deux** arbres, chacun portant l'arbre auquel il
   * appartient. Une seule liste : le moteur filtre sur `arbre`, il ne connaît aucun nœud par son nom.
   */
  readonly noeuds: readonly ParametresNoeudArbre[]
  readonly ameliorations: readonly ParametresAchatMultiplicatif[]
  readonly equipement: readonly ParametresAchatMultiplicatif[]
  readonly fin: ConstantesFin
}
