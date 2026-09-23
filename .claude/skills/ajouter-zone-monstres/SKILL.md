---
name: ajouter-zone-monstres
description: >
  Ajouter une région de contenu (nom, ambiance, trois monstres de vague, boss, gardien) pour couvrir plus
  de zones de progression. Se déclenche sur « ajoute une zone », « ajoute un boss », « nouvelle région »,
  « nouveau monstre », ou toute tâche touchant `TEXTES_REGIONS` (`src/donnees/zones.ts`) et
  `src/state/contenu.ts` (spec §13, déclencheur prévu « Ajoute une zone/un boss »).
---

# Ajouter une zone / un boss

Provenance : `git show 3012505` (branchement UI T-24/T-25), `d42284e` (textes T-25, agent `narrateur`),
`b82381e` (garde-fous `tests/donnees/contenu.test.ts`) — premier ajout de contenu de la vague 3.

## Ce qu'il faut savoir avant de commencer

Les zones **numériques** (PV, vagues, timers) sortent d'une **formule paramétrique sans borne**
(`ConstantesZones`, `src/domain/types.ts:591`, commentaire ligne 590 : « aucun nombre de zones fixé a
priori »). Il n'existe donc **aucune liste de zones à étendre** côté simulateur — « ajouter une zone » ne
touche jamais `tools/idle-balance/` ni `src/donnees/constantes.ts`. Ce qui a une fin, c'est le **contenu
écrit** : `TEXTES_REGIONS` (`src/donnees/zones.ts`) couvre 12 régions de 10 zones ; au-delà, la dernière
région se répète indéfiniment (`regionParIndex`/`indexRegion`, `src/state/contenu.ts`, bornent l'index).
« Ajoute une zone/un boss » = ajouter une 13ᵉ région (ou en corriger une existante), **jamais** un nombre.

`ZONES_PAR_REGION` (= 10) et tout le mapping zone → région → nom affiché vivent dans
`src/state/contenu.ts`, **pas** dans `src/donnees/` : c'est un choix d'affichage, pas une sortie du
simulateur (commentaire en tête du fichier). Ne pas le déplacer.

## Checklist ordonnée

1. **Texte de la région** (agent `narrateur`, jamais un nombre) — ajouter un `TexteRegion` **à la fin** de
   `TEXTES_REGIONS` dans `src/donnees/zones.ts` (l'ordre du tableau = ordre de progression, jamais
   réordonné) :
   ```ts
   {
     nom: '…',                                   // ≤ 32 caractères
     ambiance: '…',                               // ≤ 110 caractères, une ligne
     monstres: ['…', '…', '…'],                    // exactement 3, tirés tour à tour par vague
     boss: { nom: '…', description: '…' },         // boss des zones 1 à 9 de la région
     gardien: { nom: '…', description: '…' },      // boss de la 10ᵉ zone, plus coriace
   }
   ```
   `description` = le tic du boss/gardien, une ligne, pas un résumé de ses stats (les PV/vagues/timers
   viennent du simulateur, jamais du texte — invariant « aucun chiffre »).
2. **Compte de régions** — `tests/donnees/contenu.test.ts` contient `expect(TEXTES_REGIONS).toHaveLength(12)`
   codé en dur : mettre à jour ce nombre en même temps que l'ajout, sinon le test rougit pour la mauvaise
   raison (compte, pas contenu).
3. **Rien à toucher dans `src/state/contenu.ts`** sauf si la règle change elle-même (ex. nombre de zones
   par région, comportement au-delà de la dernière région) — l'ajout d'une région seule ne touche que les
   données, `indexRegion`/`regionParIndex`/`estZoneDeGardien` s'adaptent automatiquement à la nouvelle
   longueur du tableau.
4. **UI** (agent `implementeur-ui`) — rien à câbler en dur non plus : `BandeauHaut.tsx`, `PanneauCentral.tsx`
   et `CanvasCombat.tsx` lisent `nomCibleCourante`/`regionDeZone` via `src/state/contenu.ts`, une région de
   plus s'affiche sans changement de composant. Vérifier seulement si une tâche antérieure a câblé un cas
   spécial sur `TEXTES_REGIONS.length` par ailleurs (`grep -rn TEXTES_REGIONS src/components/`).
5. **Garde-fous de contenu** — `tests/donnees/contenu.test.ts` (bornes 32/110, aucun chiffre, apostrophe
   typographique `’` jamais `'`, lexique « style IA » §7 interdit) s'applique aussi aux champs
   `nom`/`ambiance`/`monstres`/`boss`/`gardien` de la nouvelle région : le test énumère tous les champs de
   `TEXTES_REGIONS`, rien à répéter manuellement pour qu'il les attrape.
6. **Zone dédiée hors régions** — le boss final (`TEXTES_FIN.zoneFinale`/`bossFinal`, `src/donnees/fin.ts`)
   vit hors de l'échelle normale des zones (`zoneBossFinal` = un nom, pas une profondeur, commentaire
   `src/donnees/fin.ts:9-18`) : ne pas le confondre avec une région, ne pas l'ajouter à `TEXTES_REGIONS`.
7. **Revue de ton** — `revue-lecture-seule` (spec §7) ; ce skill et `contenu.test.ts` ne jugent jamais le
   ton, seulement la forme (longueur, chiffres, apostrophes, lexique).

## Vérification

```
npx vitest run tests/donnees/contenu.test.ts tests/state/contenu.test.ts tests/ui/contenu-branche.test.tsx
bash scripts/verify.sh
```

`tests/state/contenu.test.ts` couvre le mapping zone → région (bornes, dernière région qui couvre tout ce
qui dépasse, zone de gardien = multiple de 10, boss final indépendant de la zone).
