# EVALS — ce qu'on mesure

> Comment on sait que ça marche. Mis à jour à chaque rapport `idle-balance` et à chaque vague.

## EVAL-001 — Rythme de progression (spec §8, contraintes dures) (2026-09-20)
- **Mesure :** rapport `tools/idle-balance/rapports/<date>.md` (`npm run equilibrage:search`), rejoué par
  `npm run equilibrage:check`.
- **Cibles :** 1er sort ~5 min · 1er mur ~1 h · 1er prestige 2-3 h · aucun mur > 90 min avant le 1er
  prestige · 20 ≤ prestiges_total ≤ 30 (3-5 Ascensions × 5-8) · runs 2 h → 24 h croissants · ≥ 40 h de jeu
  cumulé · toute valeur < 1e300.
- **Valeur actuelle :** aucun rapport (vague 1, T-14 non livrée).

## EVAL-002 — Budget de rendu canvas (EXG-52) (2026-09-20)
- **Mesure :** appels de dessin par frame ≤ `N_PROJECTILES_MAX = 200` (déterministe) ; ms/frame informatif.
- **Valeur actuelle :** non mesuré (vague 2).

## EVAL-003 — Porte de qualité (2026-09-20)
- **Mesure :** `bash scripts/verify.sh` vert (pureté domain/, aucune graine dans src/, typecheck, lint, test,
  equilibrage:check, build).
- **Valeur actuelle :** vert sur dépôt vide (étapes npm ignorées tant que package.json n'existe pas).
