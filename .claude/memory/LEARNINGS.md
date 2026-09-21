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
