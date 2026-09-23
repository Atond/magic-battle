---
name: ajouter-ecole-sort
description: >
  Ajouter une nouvelle école de magie et son sort actif (ou compléter/renommer une école existante).
  Se déclenche sur « ajoute une école », « ajoute un sort », « nouvelle école de magie », « nouveau sort
  actif », ou toute tâche qui touche à la fois `src/donnees/ecoles.ts` et `src/donnees/sorts.ts` (spec §13,
  déclencheur prévu « Ajoute une école/un sort »). Attention : dans l'état actuel du code, les six écoles
  sont câblées en dur à plusieurs endroits (voir « Écart important » ci-dessous) — une 7ᵉ école est un
  changement structurel, pas un simple ajout de contenu.
---

# Ajouter une école / un sort

Provenance : `git show 3012505` (branchement UI T-24/T-25), `d42284e` (textes T-24, agent `narrateur`),
`b82381e` (garde-fous `tests/donnees/contenu.test.ts`) — premier ajout de contenu de la vague 3, lu à froid
pour ce skill (23/09/2026). Aucune de ces trois ne montre une **7ᵉ** école (les six existent déjà : feu,
glace, ecole3/Foudre, ecole4/Terre, ecole5/Ombre, lumière) : la checklist ci-dessous est reconstruite à
partir de tous les endroits où une école est référencée dans le code actuel, pas observée sur un vrai ajout.

## Écart important à vérifier avant de commencer

`IdEcole` (`src/domain/types.ts:21`) est une union fermée à 6 valeurs, et `ToucheSort` (même fichier, ligne
32) est bornée à `1 | 2 | 3 | 4 | 5 | 6` — la touche 6 est explicitement liée à la 1ʳᵉ Ascension
(EXG-13/EXG-41). `ORDRE_ECOLES` est **dupliqué**, pas partagé, entre
`src/components/hud/PanneauEcoles.tsx` (affichage) et `tools/idle-balance/parametres.ts` (simulateur) — les
deux listes doivent rester identiques à la main, rien ne le garantit automatiquement. Ajouter une 7ᵉ école
change donc trois couches (simulateur, domaine, UI) et le format de sauvegarde (`EtatJeu.ecoles` gagne une
clé) : c'est une **frontière « demander »** (spec §10, « changer le format de sauvegarde »), pas une tâche à
enchaîner seule. Si la demande est plutôt « réécrire/compléter le texte d'une école existante », sauter à
l'étape 3.

## Checklist ordonnée

1. **Chiffres et id côté simulateur** — `tools/idle-balance/graines.ts` (`ECOLES`, `SORTS` : coût de base,
   croissance, dégâts, cooldown) et `tools/idle-balance/parametres.ts` (`ORDRE_ECOLES`). Jamais de nombre
   écrit à la main dans `src/donnees/` : lancer `/equilibrer` pour régénérer `src/donnees/constantes.ts`
   (invariant 2 de `CLAUDE.md`, voir `.claude/skills/equilibrer/SKILL.md`).
2. **Domaine** (agent `implementeur-domaine`, `src/domain/`) — élargir `IdEcole` et, si le nouveau sort
   prend une touche encore libre, `ToucheSort` dans `src/domain/types.ts` ; test miroir dans
   `tests/domain/ecoles.test.ts` / `tests/domain/sorts.test.ts` **avant** la formule (règle `domaine-pur`).
3. **Textes** (agent `narrateur`, `src/donnees/`, jamais un nombre) —
   - `TEXTES_ECOLES` dans `src/donnees/ecoles.ts` : nom + description, élargir
     `Record<IdEcole, TexteContenu>`.
   - `TEXTES_SORTS` dans `src/donnees/sorts.ts` : élargir l'union de clés `'sort-feu' | 'sort-glace' | …`.
   - Si l'école gagne un nœud d'autocast d'Ascension : `TEXTES_NOEUDS` dans `src/donnees/arbres.ts`, motif
     `ascension-autocast-<id>` (voir les trois existants : feu, glace, lumière).
4. **Couleur** — `--couleur-ecole-<id>` dans `src/index.css` (bloc « Palette du jeu », près de la ligne
   149) en `oklch(...)`, distincte visuellement des cinq autres ; ajouter la paire correspondante dans
   `PAIRES` de `scripts/ratios-palette.ts` (texte/fond réellement utilisée dans `BarreSorts.tsx` /
   `CanvasCombat.tsx`), puis `npm run palette:ratios` (seuil 3:1, élément graphique).
5. **Ordre d'affichage** — mettre à jour `ORDRE_ECOLES` aux **deux** endroits (étape 1 côté simulateur,
   `src/components/hud/PanneauEcoles.tsx` côté UI) ; rien ne détecte aujourd'hui un désaccord entre les
   deux listes, à vérifier à l'œil.
6. **Branchement UI** (agent `implementeur-ui`) — `BarreSorts.tsx` lit `SORTS`/`TEXTES_SORTS` par touche,
   rien à coder en dur ; vérifier `data-testid="sort-<touche>"` et `aria-describedby` pour la nouvelle
   entrée.
7. **Garde-fous de contenu** — `tests/donnees/contenu.test.ts` rougit tant qu'un id du moteur n'a pas son
   texte (ou l'inverse), tant qu'un nom dépasse 32 caractères ou une description 110, tant qu'un texte
   contient un chiffre arabe, une apostrophe droite (`'` au lieu de `’`) ou un mot du lexique « style IA »
   §7. Ne pas contourner en raccourcissant artificiellement : réécrire.
8. **Sauvegarde** — une école de plus élargit `EtatJeu.ecoles: Record<IdEcole, EtatEcole>` : c'est un
   changement de format de sauvegarde (frontière « demander », spec §10). Skill `sauvegarde-migration`
   (prévu au 1er champ obligatoire ajouté à l'état, pas encore posé) ou migration à écrire à la main avec
   `implementeur-domaine` — demander avant d'enchaîner.
9. **Revue de ton** — `revue-lecture-seule` sur les nouveaux textes (spec §7), ce skill/`contenu.test.ts`
   ne juge jamais le ton, seulement la forme.

## Vérification

```
npx vitest run tests/domain/ecoles.test.ts tests/domain/sorts.test.ts tests/donnees/contenu.test.ts \
  tests/state/contenu.test.ts tests/ui/contenu-branche.test.tsx
npm run palette:ratios
bash scripts/verify.sh
```

`bash scripts/verify.sh` couvre en plus la pureté de `src/domain/`, l'absence de graine d'équilibrage dans
`src/`, et `equilibrage:check`/`equilibrage:empreinte` si une constante a bougé.
