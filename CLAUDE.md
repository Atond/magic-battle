# idlev1 — jeu idle web : un magicien, des monstres, plusieurs jours de contenu

Jeu incrémental **100 % statique** (aucun serveur, aucun compte, sauvegarde locale), inspiré de
Magic Archery mais avec prestige + Ascension et ≥ 40 h de contenu. Cadrage complet et source de vérité :
`docs/specs/projet/spec.md` (v3 validée, 54 exigences, 4 vagues) — à lire à la demande, jamais résumé ici.

## Stack (épinglée, voir `docs/specs/projet/stack.md`)
Vite 8 · React 19.3 · TypeScript **~6.0.3** (pas 7 : typescript-eslint impose < 6.1) · oxlint (lint du gabarit Vite 8) ·
Tailwind 4 + `@tailwindcss/vite` · shadcn/ui (style `new-york`) · Zustand 5 (sélecteurs, `persist`) ·
Canvas 2D natif pour le combat · Vitest 5 · déploiement GitHub Pages (`base: '/magic-battle/'`). Pas de
break_infinity tant que le simulateur ne dépasse pas 1e300. Français partout : UI, code, commentaires.

## Invariants durs
1. **`src/domain/` est pur** : aucun import `react`/`zustand`/DOM/`localStorage`. Vérifié par `verify.sh`
   (grep), pas par la bonne volonté. Tests miroir dans `tests/domain/`, écrits avant la formule.
2. **Les valeurs de `src/donnees/` sont des sorties du simulateur** (`tools/idle-balance`, rapport archivé).
   On ne modifie jamais une constante à la main : `/equilibrer`. Interdit d'écrire « à valider » / « graine »
   dans `src/`.
3. **L'import de sauvegarde est la seule entrée non fiable** : validation par schéma, rejet de non-fini /
   négatif / hors bornes / `__proto__`, `sauvegarde.bak` avant écrasement, aucun blob rendu en HTML.
4. **Une seule source de vérité d'état** : le moteur ; React ne fait qu'afficher via sélecteurs Zustand.
   Jamais de re-render global au tick (100 ms).
5. **Hors périmètre, ne jamais proposer** : multijoueur, classements, monétisation, comptes/cloud, app native,
   i18n V1, PWA V1 (spec §3.2).
6. **Ton des textes** : familier, jeux de mots, drôle, jamais « style IA » (spec §7 guide de ton).

## Comment on travaille ici
- Vagues séquentielles (spec §16) ; chaque tâche a un test nommé comme critère de done.
- Porte de qualité avant de dire « fait » : `bash scripts/verify.sh` (imposé par un hook Stop).
- Revue lecture seule (`revue-lecture-seule`) à chaque fin de vague, avant livraison.
- Frontières (spec §10) — **Toujours** : lire, tester, éditer, commit sur branche. **Demander** : installer une
  dépendance, supprimer un fichier, changer le format de sauvegarde, pousser une branche, toucher
  `.github/workflows/`. **Jamais** : `reset --hard`, `push --force`, push sur `main`, secrets dans le dépôt.
- Modèles : Opus pour moteur/formules/simulateur/revue, Sonnet ailleurs (`CLAUDE_CODE_SUBAGENT_MODEL`). Fable
  uniquement sur justification écrite.

## Commandes
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` ·
`npm run equilibrage:check` (< 10 s, dans verify) · `npm run equilibrage:search` (recherche complète, manuel) ·
`bash scripts/verify.sh` (porte de qualité) · `/ship` · `/equilibrer`.

## Spec & mémoire
- Spec : `docs/specs/projet/spec.md` · interview : `interview.md` · challenges : `challenge-v*.md` ·
  stack : `stack.md` · intégrations : `integrations.md`. ADR : spec §15 (source unique, pas d'ADR.md).
- Mémoire : `.claude/memory/INDEX.md` (BLOCKERS → LEARNINGS, EVALS = chiffres du simulateur).

## Intégrations Claude
- Rules par chemin : `.claude/rules/domaine-pur.md`, `.claude/rules/donnees-simulateur.md`.
- Agents : `implementeur-domaine` (opus), `equilibrage` (opus, skill `atelier:idle-balance`),
  `revue-lecture-seule` (opus, lecture seule) ; `implementeur-ui` (sonnet, vague 2), `narrateur` (sonnet, vague 3).
- Points d'entrée : `/ship`, `/equilibrer` (posés dès que `build` et `equilibrage:search` existent).
- Skills projet à venir : `sauvegarde-migration`, `ajouter-ecole-sort`, `ajouter-zone-monstres`.
- Skills externes réutilisés : `atelier:idle-balance`, `vercel:shadcn`, `vercel:react-best-practices`.
- MCP : `context7` seul (docs Vite / Tailwind 4 / shadcn / Zustand).
