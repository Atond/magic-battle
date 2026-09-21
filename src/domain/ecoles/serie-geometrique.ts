// Primitives de série géométrique — le socle arithmétique commun de tout le jeu (§8) :
//  - coût du niveau n+1 d'une école : `coût_base × croissance^n` (EXG-9) ;
//  - coût d'un palier d'amélioration / d'équipement : même famille (EXG-42, EXG-43) ;
//  - PV de la vague k d'une zone : `PV_base × croissance_vague^(k-1)` (EXG-15) ;
//  - PV cumulés d'un paquet de vagues, et nombre de vagues qu'un budget de dégâts nettoie (EXG-30).
//
// Trois exigences tenues ici :
//  1. aucune valeur d'équilibrage — premier terme et raison sont toujours des paramètres ;
//  2. aucune boucle proportionnelle au résultat : les sommes et les inversions sont en forme fermée
//     (puissance, logarithme), jamais en itérant les termes (EXG-30, budget de calcul §8) ;
//  3. aucune entrée non finie ne s'échappe en `NaN`/`Infinity` : une entrée absurde vaut 0 terme.
//
// Ce fichier est hébergé sous `ecoles/` parce que l'école (EXG-9) en est le premier usager ; il ne
// dépend d'aucune notion d'école et se lit comme une bibliothèque de calcul.

/**
 * Nombre de corrections d'arrondi autorisées autour du résultat logarithmique. Deux pas suffisent en
 * pratique (l'erreur d'un `log` flottant vaut moins d'un terme) ; la borne garantit un coût constant.
 */
const CORRECTIONS_MAX = 3

/** Entier de rang sain : une entrée non finie ou négative vaut 0 (jamais de `NaN` en sortie). */
export function rangSain(valeur: number): number {
  return Number.isFinite(valeur) && valeur > 0 ? Math.floor(valeur) : 0
}

/** Terme de rang `rang` (0-indexé) d'une série géométrique : `premier × raison^rang`. */
export function termeGeometrique(premier: number, raison: number, rang: number): number {
  return premier * raison ** rangSain(rang)
}

/**
 * Somme fermée de `nombre` termes consécutifs à partir de `premier` :
 * `premier × (raison^nombre − 1) / (raison − 1)`, et `premier × nombre` quand `raison = 1`.
 * Une quantité nulle, négative ou non finie vaut 0 (l'appelant traite ce cas comme « quantité invalide »).
 */
export function sommeGeometrique(premier: number, raison: number, nombre: number): number {
  const n = rangSain(nombre)
  if (n === 0 || !Number.isFinite(premier)) return 0
  if (raison === 1) return premier * n
  return (premier * (raison ** n - 1)) / (raison - 1)
}

/**
 * Inversion fermée de `sommeGeometrique` : plus grand `m` tel que la somme de `m` termes tienne dans
 * `budget`, obtenu par logarithme — `m = ⌊ log(1 + budget × (raison − 1) / premier) / log(raison) ⌋` —
 * puis corrigé d'au plus `CORRECTIONS_MAX` pas pour absorber l'arrondi flottant. Jamais de boucle sur
 * les termes : le coût ne dépend pas de `m` (EXG-30).
 * Cas dégénérés : `raison = 1` → division exacte ; `raison < 1` (série convergente) sous le budget →
 * `Number.MAX_SAFE_INTEGER`, car la somme infinie elle-même tient dans le budget.
 */
export function termesAchetables(premier: number, raison: number, budget: number): number {
  if (!Number.isFinite(premier) || premier <= 0) return 0
  if (!Number.isFinite(budget) || budget < premier) return 0
  if (raison === 1) return Math.floor(budget / premier)
  if (!Number.isFinite(raison) || raison <= 0) return 0

  const argument = 1 + (budget * (raison - 1)) / premier
  if (!(argument > 0)) return Number.MAX_SAFE_INTEGER

  const brut = Math.log(argument) / Math.log(raison)
  if (!Number.isFinite(brut)) return Number.MAX_SAFE_INTEGER

  let m = Math.max(Math.floor(brut), 0)
  for (let i = 0; i < CORRECTIONS_MAX && m > 0 && sommeGeometrique(premier, raison, m) > budget; i += 1) {
    m -= 1
  }
  for (let i = 0; i < CORRECTIONS_MAX && sommeGeometrique(premier, raison, m + 1) <= budget; i += 1) {
    m += 1
  }
  return m
}
