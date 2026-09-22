# Preuve du rouge — références complètes

Sources : `.claude/memory/LEARNINGS.md` (LRN-002, LRN-003, LRN-004) et `.claude/memory/BLOCKERS.md`
(BLK-002, BLK-003, BLK-004). Lire ces entrées en entier avant de trancher un cas ambigu — ce fichier ne
fait qu'y ajouter les citations `fichier:ligne` réelles du dépôt.

## Nature différente, pas répétition (LRN-004 / BLK-004)

`scripts/verify.sh` documente lui-même pourquoi ses deux étapes d'équilibrage ne se recouvrent pas :

> · `equilibrage:check` rejoue les contraintes §8 — il attrape une valeur qui CASSE une contrainte ;
> · `equilibrage:empreinte` compare le fichier commité au vecteur archivé — il attrape une valeur
>   retouchée à la main qui garde 13/13, c'est-à-dire précisément celle que `check` laisse passer.

Preuve concrète dans BLK-004 : passer `fin.zoneBossFinal` de 1000 à 1001 dans `src/donnees/constantes.ts`
laissait `equilibrage:check` à 13/13. `equilibrage:empreinte` (`tools/idle-balance/empreinte.ts`,
testé par `tests/equilibrage/empreinte.test.ts`) le détecte parce qu'il ne rejoue aucune contrainte : il
compare champ par champ à la sortie du vecteur archivé.

## Le compteur auto-attribué (LRN-002 / BLK-002)

Origine : `iterationsCombat` était incrémenté d'une constante littérale (`iterations + 2`) au lieu de
compter un travail réel. Un test qui lisait ce compteur restait vert même si une boucle par monstre avait
été introduite ailleurs dans le tick — le compteur affirmait le coût, il ne le mesurait pas.

### Six instances du garde-fou « timeout serré sur entrée astronomique »

- `tests/domain/zones.test.ts:294-336` — EXG-30, nettoyage de vagues à PV plats. Deux paliers : 3e9 vagues
  en < 500 ms (« variante terminante », rougit proprement si une boucle par monstre apparaît), puis 1e12
  vagues en un seul pas sans itérer (« garde-fou dur », le timeout est l'assertion car Vitest ne peut pas
  interrompre une boucle synchrone qui pend).
- `tests/domain/fin.test.ts:356-361` — boss final, budget de dégâts absurde résolu en un pas,
  `victoire.iterations` doit valoir exactement 1.
- `tests/domain/prestige.test.ts:588-624` — arbre d'Éclats, nœud à coût plat (`croissanceCoutNoeud: 1`) :
  3e9 rangs en < 500 ms puis 1e12 rangs achetés en un appel.
- `tests/domain/ascension.test.ts:518-543` — même motif sur la formule de rangs d'Ascension, commentaire :
  « le timeout ci-dessous **est** l'assertion — ne le retire pas pour "débloquer" un run qui pend ».
- `tests/domain/ecoles.test.ts:116-160` — inversion de budget par logarithme, « 1e17 itérations — le
  timeout serré tranche entre "instantané" et "jamais" ».
- `tests/domain/tick.test.ts:262-290` — pas les mêmes ordres de grandeur (dérive du coût d'une frame sur
  2 h simulées), mais même principe explicité : « le budget est l'assertion, pas une fragilité de CI à
  supprimer », avec une marge large (facteur 4) parce qu'un ratio « < 10 % » serait en dessous du bruit
  d'ordonnancement d'une machine partagée.

### Bornes qui se couvrent l'une l'autre, et piège visité en dernier

`tests/domain/sauvegarde.test.ts:576-715` attaque `deserialiser` avec des charges qu'aucun texte JSON ne
peut produire — un graphe formé en mémoire.

- Nœuds partagés (121 objets, 10¹² chemins racine → feuille) : un parcours qui explore les *chemins* au
  lieu des *nœuds* ne rend jamais la main. Commentaire du test : « Le piège est placé pour que le test ne
  puisse pas passer par chance : la clé interdite est dans une branche sœur que le parcours en profondeur
  visite **en dernier**, après le graphe entier. »
- Cycle (`boucle.etat = boucle`) : fermé par `PROFONDEUR_MAX` et l'ensemble des nœuds vus.
- Charge plate au-delà du budget de nœuds (`NOEUDS_MAX`).

Ces trois gardes protègent des angles différents (partage, cycle, volume). Injecter la désactivation des
deux premiers en même temps aurait fait pendre le test sans dire lequel manquait — d'où la règle
« injecter individuellement, jamais en bloc ».

## Tolérance qui se calcule (LRN-003 / BLK-003)

BLK-003 : une contrainte §8 (C07, rapport pire cas d'un run au suivant) était pondérée au prorata de
l'écart dans la fonction objectif de `equilibrage:search`. Ratée à 88,6 % contre un seuil de 90 %, elle ne
coûtait que 0,031 à l'optimiseur — moins que ce qu'il gagnait ailleurs en la sacrifiant. Correction :
pénalité au poids entier dès qu'une contrainte de spec est rouge (un critère d'échec est binaire, pas un
objectif continu), plus une descente multi-départ qui relit les vecteurs archivés pour éviter de retomber
dans le même optimum local.

Sur l'autre versant — deux chemins identiques mathématiquement — `tests/equilibrage/empreinte.test.ts`
(bloc « comparaison profonde ») distingue explicitement le bruit flottant (`1.15 + 0.01` vs `1.16`, même
nombre, tolérance quasi nulle) d'une divergence réelle (`1.15` vs `1.151`, doit rester détectée). Une
tolérance posée sans cette distinction (« à 1 % près ») a un jour masqué un écart de modèle de 57 % — elle
doit toujours se justifier par la nature de ce qui est comparé, jamais par confort.

## Revue transversale (corollaire de LRN-004)

LRN-002 est née du combat (BLK-002) et n'a d'abord été appliquée qu'au combat et à la sauvegarde. Le tick
et l'équilibrage ont gardé leurs compteurs auto-attribués jusqu'à la revue de fin de vague 1, qui a
produit LRN-004. Quand un apprentissage de ce type est écrit, la dernière étape de la procédure est de
grep le motif qu'il corrige (`iterations`, compteurs incrémentés en dur, tolérances littérales) dans le
reste du dépôt — pas seulement là où il vient de faire mal.
