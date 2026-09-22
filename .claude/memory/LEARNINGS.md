# LEARNINGS — apprentissages

> Chaque blocage résolu produit un apprentissage réutilisable. Relie-le au `BLK-n` d'origine.
> Ce qui se répète deux fois devient un skill (`.claude/skills/`).

<!-- Modèle :
## LRN-001 — <règle apprise en une phrase> (AAAA-MM-JJ)
- **Issu de :** [[BLK-001]]
- **Ce qu'on retient :** le principe généralisable, pas seulement le fix ponctuel.
-->

## LRN-001 — Un garde-fou par grep se contourne en changeant le texte, jamais le grep (2026-09-21)
- **Issu de :** [[BLK-001]]
- **Ce qu'on retient :** les invariants de `verify.sh` (pureté `src/domain/`, absence de valeurs d'amorçage
  dans `src/`) sont des greps littéraux : ils voient les commentaires, les noms de variables et les chaînes
  de caractères. Écrire dans `src/` « les valeurs d'amorçage vivent sous `tools/idle-balance/` (T-14) »
  plutôt que les mots surveillés, et « aucun accès au navigateur ni au stockage » plutôt que les
  identifiants DOM. Affaiblir le grep pour faire passer un cas légitime détruit sa valeur : il est censé
  n'avoir aucun faux négatif, le prix est quelques faux positifs qu'on corrige côté texte.

## LRN-002 — Un compteur que le code s'attribue lui-même n'est pas une mesure ; pour une forme fermée, le timeout est l'assertion (2026-09-21)
- **Issu de :** [[BLK-002]]
- **Ce qu'on retient :** quand une formule existe en version fermée (coûts cumulés, PV de zone, vagues
  nettoyées, Éclats), l'écart entre la forme fermée et une boucle naïve n'est pas de quelques pourcents :
  il est entre « quelques microsecondes » et « ne rend jamais la main ». C'est ce qu'il faut tester —
  un budget d'entrée astronomique (1e9 pour un échec propre et chronométré, 1e12+ pour le garde-fou dur)
  avec un timeout explicite et un commentaire disant que **le timeout est l'assertion**, pas une fragilité
  de CI à supprimer. Le compteur d'itérations reste utile pour documenter l'intention, jamais comme preuve.
  Corollaire de méthode : la seule façon de savoir qu'un garde-fou détecte quelque chose est d'y injecter
  la régression qu'il doit voir, de constater le rouge, puis de la retirer (`git diff` vide).

## LRN-003 — Un critère d'échec se pénalise au poids entier, pas au prorata de l'écart ; et une descente sans mémoire retrouve son optimum local (2026-09-21)
- **Issu de :** [[BLK-003]]
- **Ce qu'on retient :** dans une recherche de constantes, il y a deux natures de critères et les
  confondre coûte cher. Un **objectif** se mesure au prorata (plus près, mieux c'est). Un **critère
  d'échec** de spec est binaire : le rater doit coûter au moins le poids entier de la contrainte, sinon
  l'optimiseur le vend au premier gain trouvé ailleurs — et il le vendra, silencieusement, en laissant le
  vérificateur constater la perte sans jamais l'empêcher. Deuxième moitié de la leçon : une descente par
  coordonnées repartant toujours des mêmes valeurs d'amorçage retombe dans le même optimum local. Faire
  **archiver le vecteur retenu** et le relire comme point de départ supplémentaire rend la recherche
  monotone d'une exécution à l'autre — une passe ne peut plus rendre le jeu moins bon qu'il ne l'était.
- **Corollaire de méthode :** quand une contrainte régresse après une passe de recherche, la question
  n'est pas « quelle constante a bougé » mais « comment cette contrainte était-elle pesée ».

## LRN-004 — La question n'est pas « ce garde-fou est-il vert ? » mais « quelle faute ne verrait-il pas ? » (2026-09-22)
- **Issu de :** [[BLK-004]]
- **Ce qu'on retient :** un vérificateur vert rassure à proportion de ce qu'on croit qu'il couvre. Avant
  de s'y fier, écrire noir sur blanc la faute **la plus probable** qu'il laisserait passer — ici « une
  valeur retouchée à la main qui reste dans les clous », c'est-à-dire exactement la retouche qu'un agent
  pressé ferait. Si cette faute existe, il manque un second vérificateur, d'une **nature différente** :
  `check` mesure un comportement (les contraintes §8 tiennent-elles ?), `empreinte` compare à une origine
  (le fichier est-il la sortie du vecteur archivé ?). Deux vérificateurs de même nature ne se couvrent pas
  l'un l'autre, ils se répètent.
- **Corollaire :** une doctrine appliquée là où elle a fait mal n'est pas une doctrine. [[LRN-002]] était
  née du combat et avait été appliquée au combat et à la sauvegarde — pas au tick, pas à l'équilibrage,
  où les mêmes compteurs auto-attribués et les mêmes garde-fous jamais vus rougir ont survécu. Quand un
  apprentissage est écrit, passer explicitement en revue tous les endroits qui présentent le même motif.
