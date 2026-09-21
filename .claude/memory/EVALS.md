# EVALS — ce qu'on mesure

> Comment on sait que ça marche. Mis à jour à chaque rapport `idle-balance` et à chaque vague.

## EVAL-001 — Rythme de progression (spec §8, contraintes dures) (2026-09-20)
- **Mesure :** rapport `tools/idle-balance/rapports/<date>.md` (`npm run equilibrage:search`), rejoué par
  `npm run equilibrage:check`.
- **Cibles :** 1er sort ~5 min · 1er mur ~1 h · 1er prestige 2-3 h · aucun mur > 90 min avant le 1er
  prestige · 20 ≤ prestiges_total ≤ 30 (3-5 Ascensions × 5-8) · runs 2 h → 24 h croissants · ≥ 40 h de jeu
  cumulé · toute valeur < 1e300.
- **Valeur actuelle (2026-09-21, rapport `tools/idle-balance/rapports/2026-09-21.md`) :** 11 contraintes
  sur 12 tenues. 1er sort 5,3 min · 1er mur 36,6 min (durée 6,1 min) · **1er prestige 2,77 h** · blocage max
  avant prestige 30,0 min · **24 prestiges = 4 Ascensions × 6** · rejeu du contenu vu ×2,30 moyen (×2,04
  médian) · **72,28 h de jeu cumulé** · zone max 118 · valeur maximale 5,22e173 (marge 126 décades sous
  1e300, migration `break_infinity.js` non requise) · `H` = 10 h · fidélité du pas adaptatif 8,88e-4 ·
  `equilibrage:check` 3,84 s.
- **Contrainte non tenue, documentée :** C07 « durée de run croissante » — mesuré 2,38 h → 2,88 h, pente
  ×0,9991 par run. Structurel et démontré : `D = patience × g/(g−1)` est un point fixe indépendant du
  numéro de run (18 designs alternatifs rejoués). Plancher 2 h et plafond 24 h tenus, aucun run ne perd
  plus de 10 % sur le précédent. Portée par `CONTRAINTES_NON_TENUES` dans `src/donnees/`, avec garde
  anti-péremption : un rouge non listé échoue, un vert encore listé échoue aussi.
- **Précision de mesure (répond à la question ouverte §14) :** le « mur » à surveiller est le **blocage de
  progression** (aucune zone gagnée), seuil 90 min. Le mur au sens littéral « aucun achat abordable » ne
  dépasse jamais 0,5 min avec une croissance de coût d'école à ×1,15 : ce n'est pas une métrique utile.
- **Fragilité connue :** la passe de sensibilité (36 variables) montre que la plupart n'ont qu'une seule
  valeur verte dans leur grille. L'équilibre est en crête — c'est la raison pour laquelle
  `equilibrage:check` reste dans la porte de qualité et dans le hook Stop.

## EVAL-002 — Budget de rendu canvas (EXG-52) (2026-09-20)
- **Mesure :** appels de dessin par frame ≤ `N_PROJECTILES_MAX = 200` (déterministe) ; ms/frame informatif.
- **Valeur actuelle :** non mesuré (vague 2).

## EVAL-003 — Porte de qualité (2026-09-20)
- **Mesure :** `bash scripts/verify.sh` vert (pureté domain/, aucune graine dans src/, typecheck, lint, test,
  equilibrage:check, build).
- **Valeur actuelle (2026-09-21, lot A vague 1) :** vert — pureté OK, aucune valeur d'amorçage dans src/,
  typecheck OK, lint OK, 43 tests / 4 fichiers, build OK ; `equilibrage:check` encore ignoré (script npm
  absent jusqu'à T-14).
