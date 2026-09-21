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
