---
paths: ["src/domain/**", "tests/domain/**"]
---

# Moteur pur (`src/domain/`)

- **Jamais** d'import `react`, `react-dom`, `zustand` dans `src/domain/`. Jamais d'accès à `window`,
  `document`, `localStorage`, `requestAnimationFrame`. La sauvegarde ici = sérialisation/validation pure
  (types, migrations, schéma) ; tout accès réel à `localStorage` vit dans `src/state/`.
- Toute formule (tick, coûts, dégâts, prestige, ascension, hors-ligne…) a d'abord un test dans
  `tests/domain/` en miroir du fichier `src/domain/` visé, **avant** d'être branchée à l'UI.
- **Aucune constante d'équilibrage écrite en dur** dans `src/domain/` (coûts, croissances, bonus, seuils).
  Toute valeur numérique vient de `src/donnees/` — voir `.claude/rules/donnees-simulateur.md`.
- Nommage en français (fichiers, identifiants métier), aligné sur `nylnatosport`.
- Fonctions pures : l'état est un paramètre d'entrée, la fonction retourne un **nouvel** état — jamais de
  mutation de l'état reçu, jamais d'effet de bord.
- Tests : tolérances chiffrées explicites, écart relatif **< 1e-9** (ex. équivalence 10 ticks de 100 ms vs
  1 appel de 1000 ms, EXG-1).
- Les fixtures de migration de sauvegarde sous `tests/migrations/` ne sont **jamais supprimées**, même
  quand une version de schéma devient obsolète.
- `tick()` et tout calcul appelé par frame est à **coût constant** : jamais de boucle proportionnelle à
  l'historique de jeu (EXG-30). Au-delà du seuil de rattrapage, bascule en forme fermée (EXG-3).

Réfs : `docs/specs/projet/spec.md` §9 « Conventions fortes », §12 « Qualité & vérification »,
EXG-1, EXG-3, EXG-30, EXG-26.

<!-- provenance: spec §9, §12, EXG-1/3/26/30, integration-architect 2026-09-20 -->
