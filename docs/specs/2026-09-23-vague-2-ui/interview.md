# Interview — vague 2 « UI & Canvas » (2026-09-23)

> Fonctionnalité sur projet existant. Source de vérité : `docs/specs/projet/spec.md` (v7). Cette interview
> ne couvre que ce que la spec laisse ouvert pour T-18 à T-23 ; le résultat part en **spec v8** (pas de
> spec séparée, pour ne pas dupliquer).

## Déjà couvert (non reposé)
- Périmètre, tâches, critères de done : spec §16 vague 2.
- Exigences : EXG-4, 11-14, 19-23, 27, 29-35, 46, 48, 50-53 (spec §4) ; guide de ton §7.
- Contrat de `src/state/` : écrit côté domaine, pas rassemblé en un seul endroit — `src/domain/sauvegarde/index.ts`
  (pipeline d'import, `PlanEcrasement`, `OptionsImport`, `NOM_PRINCIPAL`/`NOM_SECOURS`, EXG-47 = échappement à
  la charge de l'UI), `sauvegarde/verrou.ts` (transport + délai d'expiration dérivé de la cadence de battement,
  à brancher par `src/state/`), `normalisation.ts` (`normaliserEtat` à rejouer après reprise),
  `moteur.ts:45` (horodatage fourni par l'appelant), `fin/index.ts:155`.
- Agent `implementeur-ui` : prévu par `integrations.md` « avant T-18 », **pas encore créé**.

## Écarts constatés dans la spec (à corriger en v8, sans question)
- T-21 cite l'agent « implémenteur-canvas » : fusionné dans `implementeur-ui` (integrations.md).
- EXG-4 porte encore « `[à valider]` » sur H alors que H est une sortie du simulateur (§8).
- EXG-21 n'exige pas d'afficher le gain : ajouter « l'écran de confirmation affiche le gain d'Éclats, même nul ».
- Aucune dépendance de test UI installée (ni DOM simulé, ni Testing Library, ni axe-core, ni navigateur) :
  les critères de done de T-18, T-19, T-20, T-22, T-23 ne sont pas exécutables en l'état.

## Questions et réponses

### Salve 1 — décisions techniques
- **Store définitif (§14)** → Zustand en store vanilla (`createStore`), tick hors React, sélecteurs fins,
  canvas lisant `getState()` dans son rAF. Le test de comptage de renders de T-18 est la preuve. Consigné en
  **ADR-19**. Banc comparatif écarté : l'alternative (`useSyncExternalStore` maison) est ce que Zustand fait
  en dessous.
- **Outillage de test UI** → Vitest browser mode + Playwright (Chromium) + `@testing-library/react` +
  `axe-core`. Tous les tests UI en vrai navigateur. Conséquence acceptée : Chromium en CI, donc modification
  de `.github/workflows/` — à redemander au moment de la faire (§10 « Demander »). jsdom écarté : pas de mise
  en page, les critères 24/44 px ne prouveraient rien (LRN-004).
- **Branche** → PR `consolidation-post-vague-1` → `main` d'abord (merge par l'utilisateur), puis branche
  `vague-2-ui` depuis `main` à jour.

### Salve 2 — apparence
- **Disposition desktop** → 3 colonnes : écoles à gauche, combat au centre avec la barre de sorts dessous,
  améliorations / équipement / arbre d'Éclats / prestige à droite, monnaies + zone en bandeau haut.
  **Mobile (375 px)** : combat + barre de sorts fixes en haut, onglets Écoles / Améliorations / Prestige dessous.
- **Palette (§14)** → charbon neutre (thème shadcn neutral sombre) + un accent par école. La couleur ne porte
  jamais seule une information (icône + libellé). Jetons CSS dans `src/index.css`. Deux vérificateurs de nature
  différente (LRN-004) : un script de ratios sur les paires de jetons (dans `verify.sh`) et axe-core sur les
  écrans rendus.
- **Canvas** → rendu procédural géométrique (silhouettes, particules, traînées colorées par école). Aucun
  asset en V1 ; des sprites pourront remplacer sans toucher au moteur.

### Salve 3 — persistance des réglages
- **Option performance (EXG-29)** → clé `localStorage` séparée `reglages`, hors sauvegarde, gérée par
  `src/state/`, validée à la lecture (booléens seulement, valeur par défaut sinon). Format de sauvegarde
  inchangé, pas de migration, `sauvegarde-migration` reste différé. Les réglages ne voyagent pas avec
  l'export : préférence de machine, voulu.

## Récapitulatif (à confirmer)
1. Spec projet → v8 ; pas de spec séparée pour la vague 2.
2. ADR-19 : Zustand vanilla, tick hors React, sélecteurs fins, canvas via `getState()` en rAF.
3. Tests UI en Vitest browser + Playwright + Testing Library + axe-core ; CI à modifier (redemander).
4. PR consolidation → main, puis branche `vague-2-ui`.
5. HUD 3 colonnes desktop, combat + sorts fixes et onglets sur mobile.
6. Palette charbon + accents d'école, jamais la couleur seule ; script de ratios + axe.
7. Canvas procédural, aucun asset.
8. Réglages dans une clé `reglages` hors sauvegarde.
9. v8 corrige aussi : T-21 → `implementeur-ui`, `[à valider]` d'EXG-4, EXG-21 affiche le gain même nul.
10. Contrat `src/state/` = commentaires du domaine (sauvegarde, verrou, normalisation), pas réinventé.

## Complément après challenge de la v8 (`docs/specs/projet/challenge-v8.md`)
- **Onglet caché (#1)** → traité comme du hors-ligne : au retour visible avec un écart > 60 s, `calculHorsLigne`
  (plafond H, production passive, résumé), crédité une seule fois. Même résultat fermé ou caché.
- **Second onglet (#2)** → figé (pas de tick, pas de canvas, actions désactivées, bandeau) et relais automatique
  à la libération ou à l'expiration du verrou : relecture du stockage, `importerTexte`, `calculHorsLigne`,
  démarrage. Jamais l'état en mémoire, périmé.
- **T-23 (#15)** → scindée. T-23a en **Opus** (persistance, verrou, ordre de démarrage, EXG-27, hors-ligne,
  action `importer` sans interface). T-23b en Sonnet (confirmations, encart, bandeau). `implementeur-domaine`
  n'a pas le droit d'écrire dans `src/state/` : T-23a est confiée à `implementeur-ui` **avec le modèle Opus
  forcé**, plutôt que d'élargir le périmètre de l'agent du domaine.

## Complément après challenge de la v9 (`docs/specs/projet/challenge-v9.md`)
- **Écart sans changement de visibilité (N2)** → même traitement : tout delta de frame supérieur au seuil de
  rattrapage (`nTicksMax × pas du tick`, valeur du simulateur) part vers `calculHorsLigne` (plafond H, un seul
  crédit, un seul résumé), puis la boucle remet sa référence à zéro. Fermé, caché ou en veille : même résultat.

## Validation
- **2026-09-23** — spec v10 validée par l'utilisateur, sans modification (deux tours de challenge : v8, v9).
