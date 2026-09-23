// Réglage de performance du canvas (T-21, EXG-29/EXG-50, ADR-21). Clé `magic-battle:reglages`, **hors
// sauvegarde** (jamais touché par `src/domain/sauvegarde/`) : un joueur qui désactive les effets ne doit
// jamais voir ce choix voyager dans un export/import de partie.
//
// Règle dure : lecture en `try/catch`, et seul le champ `performance` (booléen) est jamais lu — l'objet
// entier n'est **jamais** étalé (`{ ...valeur }`) ni copié tel quel. Une entrée hostile (`__proto__`
// pollué, type inattendu, JSON tronqué) retombe silencieusement sur le défaut, sans jamais toucher
// `Object.prototype`.

import { NOM_REGLAGES, PREFIXE_STOCKAGE } from '../state/constantes.ts'
import type { PortMatchMedia, Stockage } from '../state/ports.ts'

export const CLE_REGLAGES = `${PREFIXE_STOCKAGE}${NOM_REGLAGES}`

function estBooleen(valeur: unknown): valeur is boolean {
  return typeof valeur === 'boolean'
}

/**
 * Lit le choix explicite du joueur, ou `null` si absent/illisible/invalide (le défaut suit alors
 * `prefers-reduced-motion`, EXG-50). N'accepte QUE `{ "performance": <booléen> }` — tout le reste
 * (chaîne, nombre, tableau, JSON invalide, champ manquant, `__proto__` polluant la place du champ)
 * retombe sur `null` plutôt que de lever ou de faire deviner un type à l'appelant.
 */
export function lireOptionPerformance(stockage: Stockage): boolean | null {
  try {
    const brut = stockage.lire(CLE_REGLAGES)
    if (brut === null) return null
    const valeur: unknown = JSON.parse(brut)
    if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return null
    // Lecture défensive d'un seul champ nommé — jamais `{ ...valeur }` : un `"__proto__"` dans le texte
    // source (`JSON.parse` le pose comme propriété PROPRE de `valeur`, jamais comme prototype réel,
    // mais on ne le lit quand même jamais par accident via un étalement) ne doit jamais être vu comme
    // portant un champ `performance` valide.
    if (!Object.prototype.hasOwnProperty.call(valeur, 'performance')) return null
    const champ = (valeur as Record<string, unknown>).performance
    return estBooleen(champ) ? champ : null
  } catch {
    // JSON invalide (tronqué, syntaxe cassée…) : réglage considéré absent.
    return null
  }
}

/** Persiste le choix explicite du joueur — un seul champ écrit, jamais l'objet lu réétalé. */
export function ecrireOptionPerformance(stockage: Stockage, performance: boolean): void {
  stockage.ecrire(CLE_REGLAGES, JSON.stringify({ performance }))
}

/**
 * Résout l'option effective : choix explicite persisté en priorité, sinon `prefers-reduced-motion`
 * (EXG-50) — jamais l'inverse. Un `matchMedia` défaillant ne bloque jamais la résolution (ADR-21).
 */
export function resoudrePerformance(stockage: Stockage, matchMedia: PortMatchMedia): boolean {
  const choisi = lireOptionPerformance(stockage)
  if (choisi !== null) return choisi
  try {
    return matchMedia.correspond('(prefers-reduced-motion: reduce)')
  } catch {
    return false
  }
}
