# Challenge de la spec v2 — rapport spec-challenger (2026-09-20, lecture seule)

Verdict : v3 nécessaire (courte). Trous v1 #4-#15 confirmés fermés. #1/#2/#3 fermés en apparence seulement.
Décisions utilisateur : voir interview.md « Complément après challenge de la spec v2 ».

| # | Sévérité | Section | Trou | Proposition |
| --- | --- | --- | --- | --- |
| 1 | bloquant | §8 contraintes | run₁ 2-3 h × facteur 2-3 ⇒ série convergente ≈ 5 h, pas 40 h ; rien n'allonge les runs | TRANCHÉ : zones par formule sans borne ; chaque run plus profond ; « 2-3× » = rejouer le contenu déjà vu ; durée réelle d'un run croissante, plancher 2 h, plafond 24 h ; cible = ≥ 40 h de jeu cumulé |
| 2 | bloquant | §8 chaîne multiplicateurs, EXG-18/20/38-40 | Arbres bornés + bonus linéaire en Éclats = espace de recherche vide pour ×1e7-1e9 | TRANCHÉ : formes = sorties du simulateur : `Éclats = floor(k × zone_max^α)`, bonus passif `(1 + B×Éclats)^β` ou multiplicatif ; ≥ 1 nœud répétable à rangs infinis (coût croissant) par arbre |
| 3 | majeur | EXG-20 vs §3.1/§5 | Sort des nœuds de l'arbre d'Éclats à l'Ascension non défini ; « permanent » contradictoire | TRANCHÉ : nœuds d'Éclats remis à 0 à l'Ascension, nœuds d'Ascension intacts ; corriger « permanent » ; critère ajouté à EXG-20 et au done de T-7 |
| 4 | majeur | EXG-44, T-13/14/15 | Constantes de fin (N_ASCENSIONS_REQUISES, PRESTIGES_PAR_ASCENSION, H) sans producteur | Done T-14 les fixe ; T-15 les injecte ; T-13 les lit depuis `donnees/` (ordonner après T-15) |
| 5 | majeur | traçabilité UI | EXG-4 (résumé), 12 (cooldown affiché), 46 (restaurer .bak en 1 clic), 48 (bandeau onglet secondaire) sans tâche UI | Ajouter à T-23 (bouton .bak, bandeau lecture seule, résumé) et T-20 (cooldown) ; mettre à jour la table |
| 6 | majeur | §10 vs ADR-10 ; §10 vs T-17 | « documenter dans le tableau §8 » (supprimé) ; done T-17 exige un merge sur main interdit aux agents | « documenter dans le rapport idle-balance et src/donnees/ » ; done T-17 = workflow vert en CI sur la branche + déploiement constaté après merge par l'utilisateur |
| 7 | majeur | §12, T-16 | `npm run equilibrage` (recherche) dans verify.sh + hook Stop = minutes de CPU à chaque tâche | Scinder `equilibrage:check` (rejoue constantes archivées, < 10 s, dans verify.sh) et `equilibrage:search` (manuel, T-14) |
| 8 | majeur | §3.1, EXG-10, T-9 | Quêtes sans EXG de déclenchement | EXG-54 : jalon atteint ⇒ quête accomplie une seule fois + crédit Renommée ; test non-répétabilité, 3 types de jalons |
| 9 | mineur | §8 | 3-5 × 5-8 = 15-40, pas 20-30 | Contrainte dure 20 ≤ total ≤ 30 ; fourchettes secondaires ; le simulateur choisit un couple compatible |
| 10 | mineur | EXG-52, T-21 | `N_PROJECTILES_MAX` absent de §8 ; « 4 ms sur machine CI » instable | `N_PROJECTILES_MAX = 200` constante de rendu (T-21) ; critère déterministe = appels de dessin/frame ≤ plafond ; ms en info non bloquante |
| 11 | mineur | EXG-40, T-7 | Arbre d'Ascension sans borne de taille | 6-10 nœuds dont ≥ 1 répétable |
| 12 | mineur | §16 vague 2 | Revue lecture seule absente de la preuve de fin de vague 2 | Ajouter : pureté domain/, aucun blob de sauvegarde rendu en HTML (EXG-47) |
| 13 | mineur | §4.8, T-13 | Boss final sans définition mécanique | EXG-28 : zone dédiée accessible si `ascensions >= N_ASCENSIONS_REQUISES`, chronométré selon EXG-16 ; test « inaccessible avant » |
