// Rendu procédural du combat (T-21, spec §7 « aucun asset ») : silhouette géométrique du monstre
// courant, barre de PV, projectiles/impacts colorés par école. Aucun calcul de jeu ici — `cible` et
// `projectiles` sont des lectures, jamais des formules.
//
// Séparation volontaire des primitives Canvas2D utilisées : le monstre et sa barre de PV ne dessinent
// QU'avec `fillRect` (rectangles), les projectiles/impacts QU'avec `arc`+`fill` (cercles). Un test peut
// donc espionner `ctx.arc` seul pour compter précisément les dessins de projectiles, sans jamais compter
// une tête de monstre par erreur (voir `tests/ui/canvas-combat.test.tsx`).

import type { Projectile } from './tampon.ts'

export interface CibleCombat {
  readonly nom: string
  readonly pvMax: number
  readonly pvCourants: number
}

export interface ParametresScene {
  readonly largeur: number
  readonly hauteur: number
  readonly cible: CibleCombat | null
  readonly projectiles: readonly Projectile[]
  /** EXG-29 — option performance activée : suspend tout dessin de projectile/impact (dégâts inchangés,
   *  le moteur n'a jamais connaissance de ce réglage). */
  readonly performanceActivee: boolean
}

const COULEUR_CORPS = 'oklch(0.45 0.05 30)'
const COULEUR_BARRE_FOND = 'oklch(0.3 0 0)'
const COULEUR_BARRE_PLEINE = 'oklch(0.65 0.21 29)'

function dessinerMonstre(ctx: CanvasRenderingContext2D, cible: CibleCombat, largeur: number, hauteur: number): void {
  const largeurCorps = largeur * 0.22
  const hauteurCorps = hauteur * 0.32
  const xCorps = largeur / 2 - largeurCorps / 2
  const yCorps = hauteur * 0.5
  ctx.fillStyle = COULEUR_CORPS
  ctx.fillRect(xCorps, yCorps, largeurCorps, hauteurCorps)

  const largeurTete = largeurCorps * 0.6
  ctx.fillRect(largeur / 2 - largeurTete / 2, yCorps - largeurTete, largeurTete, largeurTete)

  // Barre de PV : renfort visuel seulement — le texte (miroir DOM, EXG-32) porte l'information réelle,
  // la couleur ne la porte jamais seule (spec §7).
  const ratio = cible.pvMax > 0 ? Math.max(0, Math.min(1, cible.pvCourants / cible.pvMax)) : 0
  const largeurBarre = largeur * 0.4
  const xBarre = largeur / 2 - largeurBarre / 2
  const yBarre = yCorps - largeurTete - 14
  ctx.fillStyle = COULEUR_BARRE_FOND
  ctx.fillRect(xBarre, yBarre, largeurBarre, 6)
  ctx.fillStyle = COULEUR_BARRE_PLEINE
  ctx.fillRect(xBarre, yBarre, largeurBarre * ratio, 6)
}

/** Position déterministe (dérivée de l'id, jamais de `Math.random` — reproductibilité, cf. règle domaine
 *  même si ce fichier n'est pas `src/domain/`). */
function dessinerProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile, largeur: number, hauteur: number): void {
  const angle = (projectile.id % 360) * (Math.PI / 180)
  const rayonOrbite = Math.min(largeur, hauteur) * 0.32
  const x = largeur / 2 + Math.cos(angle) * rayonOrbite
  const y = hauteur * 0.55 + Math.sin(angle) * rayonOrbite * 0.45
  const rayon = projectile.type === 'impact' ? 5 : 3
  ctx.fillStyle = projectile.couleur
  ctx.beginPath()
  ctx.arc(x, y, rayon, 0, Math.PI * 2)
  ctx.fill()
}

/** Dessine une frame complète. Ne lit ni n'écrit jamais `src/domain/` ou le store : tout arrive en
 *  paramètre, rien n'est mémorisé ici (fonction pure côté effets de bord canvas seulement). */
export function dessinerScene(ctx: CanvasRenderingContext2D, params: ParametresScene): void {
  const { largeur, hauteur, cible, projectiles, performanceActivee } = params
  ctx.clearRect(0, 0, largeur, hauteur)

  if (cible !== null) dessinerMonstre(ctx, cible, largeur, hauteur)

  if (performanceActivee) return
  for (const projectile of projectiles) dessinerProjectile(ctx, projectile, largeur, hauteur)
}
