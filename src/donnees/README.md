# `src/donnees/`

- `constantes.ts` est **généré** par `npm run equilibrage:search` (`tools/idle-balance/sortie.ts`) à
  partir du rapport archivé sous `tools/idle-balance/rapports/`. On ne le modifie jamais à la main ; une
  nouvelle exécution du simulateur le réécrit en entier.
- Les neuf autres fichiers (`ecoles.ts`, `zones.ts`, `sorts.ts`, `ameliorations.ts`, `equipement.ts`,
  `quetes.ts`, `arbres.ts`, `formules.ts`, `fin.ts`) sont des **vues écrites à la main** : elles
  réexportent des tranches nommées de `CONSTANTES` par domaine (T-15) et accueilleront les textes
  (noms, descriptions) écrits en vague 3 (T-24 à T-27) à côté des nombres.
