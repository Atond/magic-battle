---
name: ship
description: Prépare la livraison de fin de vague — porte de qualité stricte, revue lecture seule, PR ouverte, merge laissé à l'utilisateur.
argument-hint: "[notes de vague optionnelles]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Agent
---

Point d'entrée « on livre » / fin de vague. Orchestration uniquement — le détail (frontières, qualité,
revue) est dans `CLAUDE.md` et `docs/specs/projet/spec.md` §10, §12.

## Étapes
1. `bash scripts/verify.sh --strict`. Si rouge : **stop**, rapporte l'étape en échec, ne continue pas.
2. Délègue à l'agent `revue-lecture-seule` (lecture seule, 5 volets). Si verdict « à reprendre » : **stop**,
   liste les constats bloquants, ne pousse rien. Attends une correction et relance depuis l'étape 1.
3. Si verdict « livrable » : **demande explicitement à l'utilisateur** l'autorisation de pousser la branche
   (frontière §10 « demander d'abord » — jamais d'autorité).
4. Une fois poussée, ouvre la PR (`gh pr create`) avec : ce qui est livré, les décisions ayant demandé un
   arbitrage, ce qui reste ouvert. Cite tout rapport `tools/idle-balance/rapports/` touché par cette vague.
5. Attends la CI et constate-la verte (c'est le seul run de `--strict` sur `npm ci` propre — un vert local
   ne le remplace pas).
6. Arrête-toi. Le merge sur `main` appartient à l'utilisateur — dis-le explicitement, ne le fais jamais.

## Livrable
PR ouverte, CI verte constatée, merge laissé à l'utilisateur avec un message clair l'invitant à merger.
Si arrêté à l'étape 1 ou 2 : rapport de ce qui bloque, rien poussé.
