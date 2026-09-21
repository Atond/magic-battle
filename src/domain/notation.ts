// Notation des nombres (EXG-36, EXG-37, §8 « Notation »). Module pur, sans `Intl` : le rendu doit être
// identique en test, en navigateur et dans le simulateur, quelle que soit la version d'ICU embarquée.
//
// Règle §8 : entiers bruts sous 10⁶, notation abrégée K/M/B/T/Qa/Qi/Sx/Sp/Oc/No jusqu'à 10³³, notation
// scientifique au-delà. Format français : virgule décimale, 2 à 3 chiffres significatifs.

import {
  SEUIL_GRANDS_NOMBRES,
  SEUIL_NOTATION_ENTIERE,
  SEUIL_NOTATION_SCIENTIFIQUE,
} from './constantes-moteur.ts'

/** EXG-36 — suffixes par tranche de 10³, de 10⁰ à 10³⁰. L'indice est l'exposant divisé par 3. */
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'] as const

/** Rendus de secours : une valeur non finie ne doit jamais s'afficher « NaN M » (garde-fou EXG-36). */
const TEXTE_INDEFINI = '—'
const TEXTE_INFINI = '∞'

/** Nombre de chiffres décimaux qui garde 3 chiffres significatifs pour une mantisse de 1 à 999. */
function decimalesPourMantisse(mantisse: number): number {
  if (mantisse < 10) return 2
  if (mantisse < 100) return 1
  return 0
}

/** Virgule décimale française et suppression des zéros décimaux inutiles. */
function enFrancais(texte: string, garderZeros: boolean): string {
  const nettoye = garderZeros ? texte : texte.replace(/\.?0+$/, '')
  return (nettoye === '' ? '0' : nettoye).replace('.', ',')
}

/** §8 — sous 10⁶ : entier brut. Les valeurs fractionnaires sous 1000 gardent 2 décimales utiles. */
function formaterPetit(valeurAbsolue: number): string {
  if (Number.isInteger(valeurAbsolue) || valeurAbsolue >= 1_000) {
    return String(Math.trunc(valeurAbsolue))
  }
  return enFrancais(valeurAbsolue.toFixed(2), false)
}

/** §8 — notation abrégée : mantisse à 3 chiffres significatifs + suffixe de tranche. */
function formaterAbrege(valeurAbsolue: number): string {
  let indice = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(valeurAbsolue) / 3))
  // Le logarithme flottant peut se tromper d'un rang sur les puissances exactes de 10 : on recale.
  while (indice > 0 && valeurAbsolue / 1_000 ** indice < 1) indice -= 1
  while (indice < SUFFIXES.length - 1 && valeurAbsolue / 1_000 ** indice >= 1_000) indice += 1

  let mantisse = valeurAbsolue / 1_000 ** indice
  let texte = mantisse.toFixed(decimalesPourMantisse(mantisse))
  // 999,9…e6 arrondi à 3 chiffres donne « 1000 M » : on remonte d'un palier.
  if (Number.parseFloat(texte) >= 1_000 && indice < SUFFIXES.length - 1) {
    indice += 1
    mantisse = valeurAbsolue / 1_000 ** indice
    texte = mantisse.toFixed(decimalesPourMantisse(mantisse))
  }

  return `${enFrancais(texte, true)} ${SUFFIXES[indice]}`
}

/** §8 — au-delà de 10³³ : notation scientifique, mantisse à 2 décimales. */
function formaterScientifique(valeurAbsolue: number): string {
  let exposant = Math.floor(Math.log10(valeurAbsolue))
  let mantisse = valeurAbsolue / 10 ** exposant
  if (mantisse >= 10) {
    exposant += 1
    mantisse = valeurAbsolue / 10 ** exposant
  }
  const signeExposant = exposant < 0 ? '-' : '+'
  return `${enFrancais(mantisse.toFixed(2), true)}e${signeExposant}${Math.abs(exposant)}`
}

/**
 * EXG-36 — rend un nombre de jeu en texte français lisible.
 * Jamais de `NaN`/`Infinity` maquillé en valeur de jeu : les cas non finis ont un rendu dédié.
 */
export function formater(valeur: number): string {
  if (Number.isNaN(valeur)) return TEXTE_INDEFINI
  if (!Number.isFinite(valeur)) return valeur > 0 ? TEXTE_INFINI : `-${TEXTE_INFINI}`

  const signe = valeur < 0 ? '-' : ''
  const absolue = Math.abs(valeur)

  if (absolue < SEUIL_NOTATION_ENTIERE) return `${signe}${formaterPetit(absolue)}`
  if (absolue >= SEUIL_NOTATION_SCIENTIFIQUE) return `${signe}${formaterScientifique(absolue)}`
  return `${signe}${formaterAbrege(absolue)}`
}

/**
 * EXG-37 — signal de migration vers `break_infinity.js` : vrai si une valeur de jeu dépasse 1e300.
 * Consommé par le simulateur `tools/idle-balance` (T-14), qui en fait une alerte de rapport.
 * `NaN` n'est pas un dépassement : c'est un bug de formule, détecté ailleurs.
 */
export function depasseSeuilGrandsNombres(valeur: number): boolean {
  if (Number.isNaN(valeur)) return false
  return Math.abs(valeur) > SEUIL_GRANDS_NOMBRES
}
