---
name: equilibrer
description: Relance l'équilibrage du simulateur idle-balance et régénère src/donnees/ à partir du rapport archivé.
argument-hint: "[variable ou contrainte à revoir, optionnel]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Agent
---

Point d'entrée « repasse l'équilibrage » / « recalcule les courbes » / changement de formule ou de
constante de `src/donnees/`. Délègue à l'agent `equilibrage` (Opus, `.claude/agents/equilibrage.md`,
skill `atelier:idle-balance`). Méthode détaillée : `.claude/rules/donnees-simulateur.md`,
`docs/specs/projet/spec.md` §8 (contraintes dures) et le rapport
`tools/idle-balance/rapports/2026-09-21-revision-adr17-bossfinal.md` (méthode de recherche multi-départ,
deux modes d'exécution).

## Étapes
1. Délègue à l'agent `equilibrage` : `npm run equilibrage:search` (descente par coordonnées, une variable
   à la fois, contraintes §8 en critères d'échec — pas de prorata ; relit les vecteurs archivés comme
   points de départ supplémentaires).
2. Contrôle de fidélité du pas adaptatif contre le pas de 100 ms, **sur la boucle de jeu réelle** (jamais
   une tranche continue sans prestige).
3. Archive un rapport daté sous `tools/idle-balance/rapports/`. Toute décision/comparaison durable va dans
   un fichier `*-revision-*.md` séparé (le rapport principal est régénéré à chaque exécution).
4. Régénère `src/donnees/`. Si seule la forme change (pas les valeurs) : `EQUILIBRAGE_REGENERER=1`, qui
   relit le vecteur archivé sans relancer la recherche complète.
5. Vérifie les trois garde-fous : `npm run equilibrage:check` 13/13 sous 10 s, `npm run equilibrage:empreinte`
   conforme au vecteur, fixture `tools/idle-balance/fixtures/desequilibre.ts` toujours rouge.
6. Cite le rapport (chemin + date) dans le commit, comme l'exige `.claude/rules/donnees-simulateur.md`.

## Garde-fou
Si une contrainte §8 ne peut pas être satisfaite : livre un rapport honnête avec les chiffres, ne l'ajuste
jamais pour faire passer son propre vérificateur, et ne déplace jamais un seuil de spec parce qu'une
exécution l'a raté — sinon la spec devient une fonction de la dernière exécution.

## Livrable
`tools/idle-balance/rapports/<date>.md` archivé, `src/donnees/` régénéré, `equilibrage:check` vert en
< 10 s confirmé, commit citant le rapport (pas encore poussé — `/ship` s'en charge).
