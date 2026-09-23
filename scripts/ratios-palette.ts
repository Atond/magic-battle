// `npm run palette:ratios` — T-22, spec §16 T-22, EXG-31/32, §7 (WCAG 2.2 AA).
//
// Lit les jetons `--couleur-*` déclarés dans `src/index.css` (bloc « Palette du jeu », T-19) et calcule
// le ratio de contraste WCAG de chaque paire texte/fond **réellement utilisée** dans `src/components/` et
// `src/canvas/` (liste ci-dessous, tenue à la main — un `grep` ne sait pas deviner quel jeton sert de
// texte et lequel sert de fond à un endroit donné du HUD, seule la lecture du composant le sait).
//
// Ce script attrape : un jeton retouché qui fait passer une paire sous le seuil (4,5:1 texte normal,
// 3:1 grand texte/élément graphique), ou une paire qui cite un jeton absent de `src/index.css`.
//
// Ce script N'ATTRAPE PAS : une classe Tailwind de couleur brute (`text-red-500`, `bg-white`…) posée
// directement dans un composant au lieu d'un jeton `--couleur-*` — un tel contraste échapperait
// entièrement à cette liste de paires. Mitigation la moins chère : un grep manuel (documenté dans le
// rapport de tâche, pas automatisé ici — `scripts/verify.sh` reste un ensemble d'étapes rapides et
// déterministes, pas un linter de classes Tailwind).
//
// Usage : `tsx scripts/ratios-palette.ts`. Sortie : 0 si toutes les paires passent leur seuil, 2 sinon.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CHEMIN_CSS = resolve(import.meta.dirname, '..', 'src', 'index.css')

// --- Lecture des jetons -----------------------------------------------------------------------------

function lireJetons(css: string): Map<string, string> {
  const jetons = new Map<string, string>()
  // `--couleur-xxx: oklch(...);` — uniquement les jetons du bloc « Palette du jeu », pas les jetons shadcn
  // (`--background`, `--primary`…) qui ne portent pas de rôle texte/fond documenté ici.
  const re = /--(couleur-[a-z0-9-]+):\s*(oklch\([^;]+\));/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    jetons.set(m[1], m[2])
  }
  return jetons
}

// --- oklch → sRGB → luminance relative → ratio de contraste (CSS Color 4 / WCAG) --------------------

function analyserOklch(valeur: string): [number, number, number] {
  // Formes gérées : `oklch(L C H)` et `oklch(L C H / A%)` (l'alpha est ignoré : les paires de la palette
  // n'utilisent jamais de fond semi-transparent, seul `--couleur-charbon-bordure` l'est et n'est jamais
  // une paire texte/fond).
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(valeur)
  if (m === null) throw new Error(`oklch illisible : ${valeur}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function oklchVersSrgbLineaire(L: number, C: number, Hdeg: number): [number, number, number] {
  const h = (Hdeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return [rLin, gLin, bLin]
}

/** Luminance relative WCAG à partir de composantes linéaires (déjà hors gamma — oklch en sort directement). */
function luminanceRelative([r, g, b]: readonly [number, number, number]): number {
  const clamp = (x: number) => Math.min(1, Math.max(0, x))
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b)
}

function ratioContraste(valeurA: string, valeurB: string): number {
  const lA = luminanceRelative(oklchVersSrgbLineaire(...analyserOklch(valeurA)))
  const lB = luminanceRelative(oklchVersSrgbLineaire(...analyserOklch(valeurB)))
  const [clair, sombre] = lA >= lB ? [lA, lB] : [lB, lA]
  return (clair + 0.05) / (sombre + 0.05)
}

// --- Paires réellement utilisées dans le HUD ---------------------------------------------------------

interface Paire {
  readonly texte: string
  readonly fond: string
  readonly seuil: 4.5 | 3
  readonly usage: string
}

const PAIRES: readonly Paire[] = [
  // Texte normal (< 18,66px gras / < 24px), seuil 4,5:1 — la quasi-totalité du HUD.
  { texte: 'couleur-charbon-texte', fond: 'couleur-charbon-950', seuil: 4.5, usage: 'Disposition.tsx, EcranSauvegardeIllisible.tsx (fond de page)' },
  { texte: 'couleur-charbon-texte', fond: 'couleur-charbon-900', seuil: 4.5, usage: 'BandeauHaut.tsx, PanneauEcoles.tsx, PanneauAmeliorations.tsx… (cartes)' },
  { texte: 'couleur-charbon-texte', fond: 'couleur-charbon-800', seuil: 4.5, usage: 'boutons pleins (Ecoles/Améliorations/Prestige/EcranSauvegardeIllisible)' },
  { texte: 'couleur-charbon-texte', fond: 'couleur-charbon-700', seuil: 4.5, usage: 'survol de boutons (hover:bg-…-700)' },
  { texte: 'couleur-charbon-texte-attenue', fond: 'couleur-charbon-950', seuil: 4.5, usage: 'EcranSauvegardeIllisible.tsx (texte atténué sur fond de page)' },
  { texte: 'couleur-charbon-texte-attenue', fond: 'couleur-charbon-900', seuil: 4.5, usage: 'PanneauEcoles.tsx, PanneauPrestige.tsx (sous-titres/descriptions sur carte)' },
  { texte: 'couleur-charbon-texte-attenue', fond: 'couleur-charbon-800', seuil: 4.5, usage: 'EncartHorsLigne.tsx, BandeauLectureSeule.tsx' },
  // `InterrupteurPerformance.tsx` : `text-[10px]` (normal, pas grand) sur `aria-checked:bg-[var(--couleur-ecole-feu)]`
  // — un jeton d'école sert ici de fond, pas d'accent. `couleur-charbon-texte` (blanc) n'y passait pas
  // 4,5:1 (3,41:1, trouvé par ce script) : le texte bascule en `couleur-charbon-950` (sombre) à l'état coché.
  { texte: 'couleur-charbon-950', fond: 'couleur-ecole-feu', seuil: 4.5, usage: "InterrupteurPerformance.tsx (fond+texte quand l'option est activée)" },
  // Éléments graphiques (traits, remplissages de projectile) — seuil 3:1, jamais du texte.
  { texte: 'couleur-ecole-feu', fond: 'couleur-charbon-900', seuil: 3, usage: 'BarreSorts.tsx (border-l-4), CanvasCombat.tsx/deltas.ts (projectiles, fond du canvas)' },
  { texte: 'couleur-ecole-glace', fond: 'couleur-charbon-900', seuil: 3, usage: 'BarreSorts.tsx, CanvasCombat.tsx/deltas.ts' },
  { texte: 'couleur-ecole-ecole3', fond: 'couleur-charbon-900', seuil: 3, usage: 'BarreSorts.tsx, CanvasCombat.tsx/deltas.ts' },
  { texte: 'couleur-ecole-ecole4', fond: 'couleur-charbon-900', seuil: 3, usage: 'BarreSorts.tsx, CanvasCombat.tsx/deltas.ts' },
  { texte: 'couleur-ecole-ecole5', fond: 'couleur-charbon-900', seuil: 3, usage: 'BarreSorts.tsx, CanvasCombat.tsx/deltas.ts' },
  { texte: 'couleur-ecole-lumiere', fond: 'couleur-charbon-900', seuil: 3, usage: 'BarreSorts.tsx, CanvasCombat.tsx/deltas.ts' },
]

// --- Exécution ----------------------------------------------------------------------------------------

function main(): number {
  const css = readFileSync(CHEMIN_CSS, 'utf8')
  const jetons = lireJetons(css)

  let echec = false
  const lignes: string[] = []

  for (const paire of PAIRES) {
    const valeurTexte = jetons.get(paire.texte)
    const valeurFond = jetons.get(paire.fond)
    if (valeurTexte === undefined || valeurFond === undefined) {
      const manquant = valeurTexte === undefined ? paire.texte : paire.fond
      lignes.push(`  ÉCHEC — --${manquant} : jeton absent de src/index.css (paire ${paire.texte} / ${paire.fond} — ${paire.usage})`)
      echec = true
      continue
    }
    const ratio = ratioContraste(valeurTexte, valeurFond)
    const ok = ratio >= paire.seuil
    const etat = ok ? 'OK   ' : 'ÉCHEC'
    lignes.push(
      `  ${etat} — ${paire.texte} / ${paire.fond} : ${ratio.toFixed(2)}:1 (seuil ${paire.seuil}:1) — ${paire.usage}`,
    )
    if (!ok) echec = true
  }

  console.log('=== ratios-palette.ts — paires texte/fond de la palette du jeu (T-22) ===')
  console.log(lignes.join('\n'))
  console.log()
  if (echec) {
    console.log('🛑 Au moins une paire est sous son seuil WCAG ou cite un jeton absent.')
    return 2
  }
  console.log('✅ Toutes les paires déclarées respectent leur seuil WCAG.')
  return 0
}

process.exit(main())
