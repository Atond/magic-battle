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

## BLK-004 — une porte de qualité verte pour la mauvaise raison — Résolu (2026-09-22)
- **Contexte :** revue de fin de vague 1. `equilibrage:check` tournait à chaque fin de tour d'agent et
  affichait 13/13, ce qui donnait le sentiment que `src/donnees/` était sous contrôle.
- **Cause :** `check` rejoue les contraintes §8. Il n'attrape donc une constante retouchée à la main que
  si cette retouche **casse** une contrainte. Démontré et non supposé : passer `fin.zoneBossFinal` de
  1000 à 1001 laisse `check` à 13/13 et en sortie 0. L'invariant 2 de `CLAUDE.md` reposait sur la parole
  des agents dans un projet qui vérifie tout le reste par grep et par script. Même famille de trou pour
  le mécanisme anti-péremption des dérogations, exercé dans aucun des deux sens.
- **Résolution :** `npm run equilibrage:empreinte` — régénération en mémoire depuis le vecteur archivé et
  comparaison champ par champ, 0,2 s, huitième étape de `verify.sh` ; plus 20 tests Vitest sur les deux
  sens des dérogations et les clés orphelines. → [[LRN-004]]

## BLK-005 — Chromium de Playwright ne démarre pas sous WSL2 : bibliothèques système absentes — Résolu (2026-09-23)
- **Contexte :** T-18a. `npx playwright install chromium` télécharge le binaire, mais celui-ci meurt au
  lancement (`libnspr4.so: cannot open shared object file`, 32 bibliothèques manquantes au total). `verify.sh`
  est rouge sur `test (vitest)`, et c'est voulu : pas de chemin de saut pour les tests navigateur (§12 v10).
- **Cause :** les dépendances système de Chromium (`libnss3`, `libnspr4`, `libasound2t64`…) ne viennent pas
  avec npm ; `npx playwright install-deps chromium` les installe via apt et exige sudo, hors périmètre agent.
- **Résolution :** l'utilisateur a lancé `sudo npx playwright install-deps chromium` dans un terminal à
  part (`! sudo …` échoue dans Claude Code : pas de terminal pour saisir le mot de passe). `verify.sh` vert,
  test navigateur vu rouge sur une cible injectée à 40 px. En CI, même commande sur le runner. → [[LRN-007]]

## BLK-006 — un `.bak` refusé par le stockage n'empêche pas l'écrasement de la sauvegarde — Ouvert, à fermer avant T-28 (2026-09-23)
- **Contexte :** revue de fin de vague 3. `store.ts` (enveloppe de stockage, ~l. 297-302 et `executerPlan`
  ~l. 486-491) : si l'écriture de `magic-battle:sauvegarde.bak` échoue (quota presque plein — le `.bak` réclame
  une clé entière de plus), l'erreur est avalée et la sauvegarde principale est écrasée quand même. Invariant 3
  (« `.bak` avant écrasement ») non tenu. Pas une régression : le port avalait déjà l'erreur avant `78a5451`.
- **Pourquoi pas bloquant aujourd'hui :** aucun chemin joueur n'y mène — l'import n'a pas d'UI (T-28), et
  `nouvellePartie` n'est offert que sur l'écran « illisible », où il n'y a pas de contenu courant à sauvegarder.
- **À faire (T-28) :** test d'état où `ecrire('magic-battle:sauvegarde.bak')` lève → la principale reste intacte
  et le joueur est prévenu ; puis corriger `executerPlan`. Candidat skill `ecriture-bak-atomique`.
