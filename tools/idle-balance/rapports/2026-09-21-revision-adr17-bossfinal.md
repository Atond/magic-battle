# Révision du 2026-09-21 — ADR-17 (C07) et zone dédiée du boss final (EXG-28)

Complément au rapport principal `tools/idle-balance/rapports/2026-09-21.md`, qu'il ne remplace pas.
Le rapport principal est **régénéré** à chaque `npm run equilibrage:search` ; ce fichier-ci est le
journal durable de la révision. Toutes les valeurs ci-dessous sortent d'une exécution de
`tools/idle-balance/search.ts` ou de `check.ts`, aucune n'est saisie à la main (ADR-10).

## 1. Reclassement de C07 selon ADR-17

Le critère est passé de « durée de run **croissante** » (spec v4) à « **stable ou croissante à 10 %
près** — aucun run ne dure moins de 90 % du précédent, plancher 2 h, plafond 24 h » (spec v5, ADR-17).
`tools/idle-balance/contraintes.ts` implémente exactement cette formulation : tolérance `0,9` explicite,
et la mesure publiée est le **pire rapport d'un run au suivant**.

Alignement de vocabulaire fait en même temps (§8 v5, question ouverte §14 fermée) : le critère qui fait
échouer est le **blocage de progression** (intervalle sans aucune zone gagnée) à 90 min ; le mur au sens
littéral « aucun achat abordable » devient un **garde secondaire à 15 min**. C04 vérifie désormais les
deux seuils séparément et nomme les choses comme la spec.

**Verdict mesuré : C07 OK — pire rapport d'un run au suivant `91,0 %`** (cible ≥ 90 %), durées
`2,38 h → 2,88 h` sur 28 runs. `CONTRAINTES_NON_TENUES` est vide dans `src/donnees/constantes.ts`, et
`equilibrage:check` rend **13/13, zéro dérogation** en 3,8 s.

## 2. Le défaut de méthode que ce reclassement a révélé

Une exécution intermédiaire a livré un vecteur à `88,6 %`, donc **sous** le seuil de 90 % — alors qu'un
vecteur précédent le tenait. Deux causes, corrigées toutes les deux dans `search.ts` :

1. **Pas de barrière dans la fonction objectif.** C07 y pesait `|écart| × poids` : ratée à 88,6 %, elle
   ne coûtait que `0,015 × 2 = 0,031`, moins que ce que la descente gagnait ailleurs. Elle a donc
   sciemment échangé une contrainte dure contre un gain marginal. Correction : `PENALITE_ECHEC`, une
   pénalité de franchissement égale au poids entier de toute contrainte rouge. Les contraintes §8 sont
   des critères d'échec, pas des objectifs à optimiser au prorata.
2. **Descente locale et sans mémoire.** Même avec la barrière, repartir des seules valeurs d'amorçage
   converge vers un optimum local à `88,9 %`. Correction : `search.ts` relit les vecteurs archivés
   (`rapports/*.vecteur.json`) comme **points de départ supplémentaires**, descend depuis chacun et
   garde le meilleur ; il archive ensuite le vecteur retenu. La recherche devient **monotone d'une
   exécution à l'autre** : elle ne peut plus perdre de terrain.

Mesure de l'effet, sortie de l'exécution multi-départ (828 évaluations, 2 265 s) :

| point de départ | coût initial | coût final | contraintes ratées |
| --- | --- | --- | --- |
| valeurs d'amorçage (`graines.ts`) | 28,159 | 2,102 | C07 |
| vecteur archivé `2026-09-21-precedent` | 0,000 | **0,000** | **aucune** |

Provenance du second point de départ, pour être exact : `rapports/2026-09-21-precedent.vecteur.json` a
été recopié de la section « vecteur de paramètres retenu » du rapport produit par une exécution
antérieure de la même journée, complété par le triplet du boss final que `chercherBossFinal` avait
trouvé sur ce vecteur. C'est une **entrée** de recherche, comme `PARAMETRES_DEPART` ; les valeurs
livrées restent celles que l'exécution finale a mesurées. À partir de maintenant, `search.ts` écrit
lui-même `rapports/<date>.vecteur.json` à chaque exécution : ce recopiage manuel ne se reproduira pas.

## 3. Le prix de C07, en chiffres

Le vecteur qui rate C07 n'est pas mauvais partout — il est meilleur sur la quantité de contenu. Tenir
C07 coûte donc quelque chose, et voici quoi :

| mesure | vecteur retenu (C07 **OK**) | vecteur issu des amorces (C07 **raté**) | écart |
| --- | --- | --- | --- |
| pire rapport d'un run au suivant | **91,0 %** | 88,9 % | +2,1 points |
| 1er prestige | 2,77 h | 2,63 h | mieux centré dans 2-3 h |
| jeu cumulé | 72,28 h | **83,06 h** | **−10,8 h (−13 %)** |
| nombre de runs | 28 | 32 | −4 |
| zone maximale | 118 | 142 | −24 zones |
| rejeu du contenu vu | ×2,30 moy. / ×2,04 méd. | ×2,38 / ×2,10 | comparable |
| couple de fin | 4 × 6 = 24 | 4 × 6 = 24 | identique |

Lecture : tenir C07 coûte **13 % de contenu cumulé et 24 zones de profondeur**, et gagne 2,1 points de
régularité de rythme. Les deux jeux tiennent largement la cible §8 de ≥ 40 h (72 h et 83 h). Le vecteur
retenu est celui qui satisfait les **13** contraintes ; si l'arbitrage inverse est préféré, c'est une
décision de produit, pas une mesure — la relancer demande de remettre C07 en dérogation, ce que
`check.ts` refusera tant que la mesure sera verte (garde anti-péremption).

## 4. Zone dédiée du boss final (EXG-28)

`zoneBossFinal = 50` de la v4 était une **erreur de modélisation**, pas un réglage : sur l'échelle
normale des zones, le joueur traverse la zone 50 pendant son premier run (profondeur mesurée : 118).
EXG-28 dit « zone **dédiée** ». D'où le découplage livré :

| champ | valeur | nature |
| --- | --- | --- |
| `zoneDediee` | 1000 | **identifiant** de la zone dédiée, hors de portée de la progression mesurée (zone max 118) — un nom, pas une profondeur |
| `profondeurEquivalente` | 100 | **cherché** : profondeur dont la formule de zone du moteur donne les PV du boss |
| `multPv` | 5 | **cherché** : multiplicateur au-dessus de cette profondeur |
| `timerS` | 30 | **cherché** : chrono du combat (EXG-16 appliqué au boss final) |

PV résultants : `pvBoss(100) × 5 = 1,09e+104`. Aucune formule n'est réécrite : les PV passent par
`pvBoss` du moteur, seule la profondeur change. Marge sous 1e300 : **196 décades** (EXG-37).

**Combat mesuré** (la politique tente le boss dès qu'elle peut le gagner, donc le temps minimal) :

- DPS soutenu au **départ** du dernier run, juste après la 4e Ascension (le cycle d'Éclats vient d'être
  effacé, ADR-14) : `3,41e+3`. Il faudrait `3,2e+100 s` pour abattre le boss : **ce n'est pas une
  formalité**, la condition d'accès d'EXG-28 ne suffirait pas à en faire un combat.
- DPS soutenu au moment où le combat devient gagnable : `4,38e+102`, à la zone 101.
- **Durée du combat : 25,0 s sur un chrono de 30 s (83 % du temps imparti).**
- **Temps pour le battre : 1,87 h** après la 4e Ascension, sur un dernier run de 2,58 h — soit **72 % du
  run**, le point culminant.

La recherche du triplet a tourné dans le script (`chercherBossFinal`), une variable à la fois, sur la
trajectoire du dernier run relevée une seule fois : les PV et le chrono du boss n'influencent rien
d'autre dans la partie, ce sont des sorties pures.

## 5. Ce que T-13 doit lire dans `src/donnees/`

`src/donnees/constantes.ts` exporte trois choses :

1. `CONSTANTES` — l'objet `Constantes` complet du moteur, dont `fin.nAscensionsRequises = 4` et
   `fin.zoneBossFinal = 1000` (l'identifiant de la zone dédiée, cohérent avec `BOSS_FINAL.zoneDediee`).
2. `BOSS_FINAL` (type `ParametresBossFinal`) — `zoneDediee`, `profondeurEquivalente`, `multPv`,
   `timerS`. **À intégrer à `ConstantesFin` dans `src/domain/types.ts`** : ce lot n'avait pas le droit de
   toucher `src/domain/`, donc le contrat de données est livré à côté plutôt que deviné.
3. `CONTRAINTES_NON_TENUES` — vide aujourd'hui. `check.ts` échoue si une contrainte rouge n'y figure pas
   **et** si une contrainte verte y figure encore.

Ce que T-13 doit câbler, et que le moteur ne fait pas encore :
- rien ne met `partieTerminee` à vrai (EXG-44) ;
- l'accès à la zone dédiée n'est pas conditionné à `ascensions ≥ nAscensionsRequises` (EXG-28) ;
- `creerBoss` calcule les PV de **toute** zone par `pvBoss(zone)` ; pour la zone dédiée, les PV doivent
  venir de `pvBoss(profondeurEquivalente) × multPv`, et le chrono de `timerS` et non de `zones.timerBossS`.

## 6. Limite connue de la passe de sensibilité

`ameliorationCoutBase` est retenu à 100, valeur absente de sa grille de balayage `[25, 60, 150, 400]` :
la colonne « fourchette verte » est donc vide pour cette variable, non parce qu'aucune valeur ne marche
mais parce qu'aucun **candidat de la grille** ne préserve les contraintes. La valeur retenue vient de la
descente, pas du balayage ; elle est dans un creux étroit entre deux points de grille.

## 7. Correctif de forme (même jour, valeurs inchangées)

Les quatre nombres du boss final sont désormais émis **dans `CONSTANTES.fin`** et non plus dans un
export `BOSS_FINAL` posé à côté : le moteur reçoit ses valeurs d'équilibrage en un seul objet
`Constantes`, et les laisser dehors aurait obligé soit à les lui passer en deux morceaux, soit à
recomposer l'objet à la main dans `src/donnees/`. Forme livrée :
`fin: { nAscensionsRequises, zoneBossFinal, pvProfondeurEquivalente, pvMultiplicateur, timerBossFinalS }`.
`zoneDediee` est supprimé : il doublait `zoneBossFinal`, qui reste le **seul** identifiant de la zone
dédiée — un nom de zone, jamais une profondeur de progression. Aucune valeur n'a bougé, aucune recherche
n'a été relancée : la régénération est passée par `EQUILIBRAGE_REGENERER=1`, qui relit le vecteur archivé
et ne réécrit que le fichier généré (13/13, zéro dérogation).

## 8. Deux modes d'exécution du simulateur (à lire avant de relancer quoi que ce soit)

- `npm run equilibrage:search` — recherche complète, environ 35 min. À lancer quand une **valeur** doit
  changer, ou quand une contrainte de §8 a bougé.
- `EQUILIBRAGE_REGENERER=1 npx tsx tools/idle-balance/search.ts` — régénère `src/donnees/constantes.ts`
  à partir du dernier vecteur archivé (`rapports/*.vecteur.json`), sans relancer une seule simulation de
  recherche et **sans toucher au rapport**. C'est le chemin à prendre quand seule la **forme** du fichier
  généré change (champ déplacé, renommé, export retiré) : les valeurs sont identiques, donc relancer une
  descente brouillerait la provenance du vecteur sans rien apporter.

L'alias transitoire `BOSS_FINAL` a été retiré du générateur une fois `src/donnees/fin.ts` nettoyé ; le
type `ParametresBossFinal` avait déjà disparu avec le déplacement des champs dans `fin`. Plus aucune
référence à l'un ou à l'autre dans `src/`, `tests/` ou `tools/`.
