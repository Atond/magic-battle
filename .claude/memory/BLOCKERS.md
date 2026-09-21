# BLOCKERS — murs rencontrés

> Dès qu'on bute, on l'écrit ici (Ouvert). Une fois franchi, on le passe à Résolu et on crée le
> `LRN-n` correspondant dans `LEARNINGS.md`. La même erreur ne se paie pas deux fois.

<!-- Modèle :
## BLK-001 — <symptôme> — [Ouvert | Résolu] (AAAA-MM-JJ)
- **Contexte :** où, quand, ce qu'on faisait.
- **Cause (si trouvée) :** …
- **Résolution → [[LRN-001]]**
-->

## BLK-001 — `verify.sh` rouge sur « graines d'équilibrage dans src/ » alors qu'aucune valeur n'y est en dur — Résolu (2026-09-21)
- **Contexte :** lot A de la vague 1 (T-1/T-2/T-12). `src/domain/types.ts` documentait la provenance des
  valeurs en citant le chemin du fichier d'amorçage du simulateur.
- **Cause :** le garde-fou (g) de `scripts/verify.sh` grep les mots interdits **littéralement, partout dans
  `src/`, commentaires compris**. Citer le nom du fichier suffit à déclencher l'échec. Le garde-fou n'a pas
  de faux négatif, mais il a ce faux positif par construction.
- **Résolution :** reformuler le commentaire, jamais toucher au grep (invariant 2, ADR-10 : la règle est
  volontairement bête pour rester fiable). → [[LRN-001]]

## BLK-002 — le test de coût constant (EXG-30) ne prouvait rien — Résolu (2026-09-21)
- **Contexte :** lot B de la vague 1 (T-5). Le combat nettoie les vagues en forme fermée (inversion par
  logarithme + somme géométrique), et un compteur `iterationsCombat` servait de preuve de coût constant.
- **Cause :** le compteur était incrémenté d'une valeur **constante écrite en dur** (`iterations + 2`) au
  début de la fonction. Il affirmait le coût au lieu de le mesurer : une boucle par monstre ajoutée plus
  tard, qui n'incrémenterait rien, aurait laissé le test vert pendant que le tick partait en O(monstres).
- **Résolution :** doubler l'intention (compteur) par une détection qui ne dépend pas de la coopération de
  l'auteur — un budget de dégâts astronomique sous timeout serré. → [[LRN-002]]

## BLK-003 — une contrainte §8 sacrifiée par la recherche qui la pondérait au prorata — Résolu (2026-09-21)
- **Contexte :** T-14. Après amendement d'ADR-17, une seconde passe de `equilibrage:search` a produit un
  jeu de constantes meilleur sur d'autres critères mais dont le pire rapport d'un run au suivant tombe à
  **88,6 %**, sous le seuil de 90 % — alors que le jeu de constantes précédent tenait ce seuil.
- **Cause :** C07 n'était pas dans la fonction objectif de la recherche. Une contrainte qu'on vérifie
  après coup mais qu'on n'optimise pas est une contrainte qu'une passe ultérieure peut sacrifier sans que
  rien ne l'en empêche — le vérificateur la voit partir, il ne la retient pas.
- **Cause réelle, plus fine que le diagnostic initial :** C07 **était** dans la fonction objectif,
  pondérée 2, mais au **prorata de l'écart** — ratée à 88,6 %, elle coûtait 0,031, moins que ce que la
  descente gagnait ailleurs. Et même une fois la barrière posée, repartir des seules valeurs d'amorçage
  converge à 88,9 % : c'est aussi un **optimum local**.
- **Résolution :** deux corrections dans `search.ts` — une pénalité au **poids entier** dès qu'une
  contrainte est rouge (une contrainte §8 est un critère d'échec, pas un objectif au prorata), et une
  descente **multi-départ** qui relit les vecteurs archivés, ce qui rend la recherche monotone d'une
  exécution à l'autre. Résultat : 13/13, C07 à 91,0 %, zéro dérogation. Le seuil de 90 % n'a pas
  bougé. → [[LRN-003]]
