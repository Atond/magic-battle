// Garde-fous d'arithmétique des couches de méta — un seul endroit où l'on décide ce qu'on fait d'un
// débordement du double ou d'un `NaN`.
//
// Pourquoi ici : les Éclats (EXG-18), les Points (§8) et les facteurs d'arbres (EXG-39, EXG-40) sont les
// grandeurs qui croissent le plus vite du jeu, et ce sont celles qui finissent dans la bourse puis dans
// la sauvegarde (T-10). Une seule règle, appliquée partout : **jamais** de valeur non finie en sortie de
// formule. Un dépassement mesuré en régime normal est le signal EXG-37 que le simulateur (T-14) doit
// lever — pas un `Infinity` qui contamine l'état en silence.

/**
 * Ramène un résultat de formule dans les nombres finis : un `NaN` vaut 0, un débordement sature au plus
 * grand double représentable. Ce n'est pas une valeur d'équilibrage, c'est la borne du type `number`.
 */
export function nombreFini(valeur: number): number {
  if (Number.isFinite(valeur)) return valeur
  return Number.isNaN(valeur) ? 0 : Number.MAX_VALUE
}

/** Somme de deux compteurs cumulés, saturée par `nombreFini` (jamais `Infinity`, jamais `NaN`). */
export function sommeBornee(a: number, b: number): number {
  return nombreFini(nombreFini(a) + nombreFini(b))
}
