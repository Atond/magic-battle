---
paths: ["src/donnees/**", "tools/idle-balance/**"]
---

# Contenu & équilibrage (`src/donnees/`, `tools/idle-balance/`)

- Toute valeur numérique de `src/donnees/` (coûts, croissances, PV, multiplicateurs, `B`/`β`, `k`/`α`,
  `N_ASCENSIONS_REQUISES`, `PRESTIGES_PAR_ASCENSION`, `H`…) est une **sortie** du simulateur
  `tools/idle-balance`, adossée à un rapport archivé (ADR-10, ADR-15). **On ne modifie jamais une
  constante à la main.**
- Pour changer une valeur ou une forme de formule : relancer `/equilibrer` (ou
  `npm run equilibrage:search`), puis citer le rapport correspondant dans la PR/le commit.
- Interdit dans `src/` : les marqueurs `à valider`, `graine`, `TODO équilibrage` (ou équivalents) —
  ce sont des traces de spec, pas du code livrable.
- `npm run equilibrage:check` doit rester vert avant tout commit touchant `src/donnees/`.
- `npm run equilibrage:empreinte` aussi, et c'est lui qui rend la règle « on ne modifie jamais une
  constante à la main » **vérifiable** : il régénère les constantes depuis le vecteur archivé et les
  compare au fichier commité. `check` ne voit qu'une valeur qui **casse** une contrainte §8 ; une retouche
  manuelle qui garde 13/13 ne lui apparaît pas. Les deux sont complémentaires, aucun ne remplace l'autre.
- Conséquence pratique : pour changer une valeur, on relance la recherche — éditer `src/donnees/` à la
  main fait rougir l'empreinte, et c'est voulu.
- Contraintes dures que toute sortie du simulateur doit respecter (spec §8) : 1er prestige en 2-3 h,
  aucun mur > 90 min avant le 1er prestige, 20 ≤ prestiges_total ≤ 30, ≥ 40 h de jeu cumulé simulé,
  toute valeur normale < 1e300 (EXG-37).
- Les textes narratifs de `src/donnees/` suivent le guide de ton §7 : phrases courtes adressées au
  joueur (« tu »), jeux de mots ciblés magie/monstre, auto-dérision sur la lenteur idle — jamais de
  formules creuses « style IA » (ADR-5).

Réfs : `docs/specs/projet/spec.md` §8, ADR-10, ADR-15.

<!-- provenance: spec §8, ADR-10, ADR-15, integration-architect 2026-09-20 -->
