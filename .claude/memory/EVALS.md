# EVALS — ce qu'on mesure

> Comment on sait que ça marche. Mis à jour à chaque rapport `idle-balance` et à chaque vague.

## EVAL-001 — Rythme de progression (spec §8, contraintes dures) (2026-09-20)
- **Mesure :** rapport `tools/idle-balance/rapports/<date>.md` (`npm run equilibrage:search`), rejoué par
  `npm run equilibrage:check`.
- **Cibles :** 1er sort ~5 min · 1er mur ~1 h · 1er prestige 2-3 h · aucun mur > 90 min avant le 1er
  prestige · 20 ≤ prestiges_total ≤ 30 (3-5 Ascensions × 5-8) · runs 2 h → 24 h croissants · ≥ 40 h de jeu
  cumulé · toute valeur < 1e300.
- **Valeur actuelle (2026-09-21, rapports `2026-09-21.md` + `2026-09-21-revision-adr17-bossfinal.md`) :**
  **13 contraintes sur 13 tenues, zéro dérogation** (C07 à 91,0 % de pire rapport run/run, cible ≥ 90 %). 1er sort 5,3 min · 1er mur 36,6 min (durée 6,1 min) · **1er prestige 2,77 h** · blocage max
  avant prestige 30,0 min · **24 prestiges = 4 Ascensions × 6** · rejeu du contenu vu ×2,30 moyen (×2,04
  médian) · **72,28 h de jeu cumulé** · zone max 118 · valeur maximale 5,22e173 (marge 126 décades sous
  1e300, migration `break_infinity.js` non requise) · `H` = 10 h · fidélité du pas adaptatif 8,88e-4 ·
  `equilibrage:check` 3,84 s.
- **Arbitrage de produit tranché par l'utilisateur le 2026-09-21 — ne pas rejouer :** un vecteur
  alternatif donne **83,06 h** cumulées et la zone 142
  (contre 72,28 h et la zone 118) mais rate C07 à 88,9 %. Tenir C07 coûte 10,8 h de contenu (−13 %) et
  24 zones ; les deux dépassent largement la cible de 40 h. Retenu : le vecteur qui satisfait les 13
  contraintes — **choix confirmé** : une dérogation permanente érode le signal de la porte de qualité, et
  les 10,8 h s'achèteraient en laissant un run durer 11 % de moins que le précédent, soit exactement la
  sensation que C07 existe pour éviter. Levier de rallonge à privilégier le jour où la durée devra
  augmenter, sans une ligne de code : adoucir `g` (1,21 → 1,10 double presque la durée d'un run), puis
  monter le couple vers 5 × 6 = 30, puis étaler le contenu par zone.
- **Boss final (EXG-28), zone dédiée :** PV = `pvBoss(100) × 5` = 1,094e104, marge 196 décades sous 1e300,
  chrono 30 s. Battu à 1,87 h d'un dernier run de 2,58 h (72 % du run), en 25,0 s sur les 30 s imparties.
  Injouable au départ du run (il faudrait 3,2e100 s) : ce n'est pas une formalité.
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
