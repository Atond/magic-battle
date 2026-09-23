# Challenge de la spec v9 (spec-challenger, tour 2 et dernier, 2026-09-23)

Verdict : à retravailler, puis validable sans nouveau tour. Statut des trous v8 : fermés #2, 5, 7, 8, 10, 12,
14 ; partiellement fermés #1, 3, 4, 6, 9, 11 (encart : prouver le chevauchement des rectangles avant le clic,
à 375 et 1440 px), 13 (EXG-30 sans critère exécutable ; critère déterministe proposé : structures parcourues
par frame bornées à `N_PROJECTILES_MAX` après 2 h simulées), 15.

| # | Sév. | Trou | Proposition |
| --- | --- | --- | --- |
| N1 | bloquant | Pendant que l'onglet est caché, l'auto-sauvegarde met `derniereSauvegardeMs` à jour : au retour, écart < 60 s, crédit ≈ 0, et le test EXG-55 reste vert. | Sur `hidden` : sauvegarde, tick et auto-sauvegarde suspendus, battement maintenu. Écart = `maintenant − derniereSauvegardeMs`. Test : or = valeur attendue pour H (1e-9), `plafondAtteint`, auto-sauvegarde active. |
| N2 | bloquant | Écart > seuil sans `visibilitychange` (veille) : forme fermée sans plafond ou double crédit. | Tranché par l'utilisateur : hors-ligne plafonné. Tests : 10 frames après retour = jeu normal ; delta 8 h sans visibilité = crédit plafonné. |
| N3 | majeur | Perte du verrou non détectée, `pageshow` depuis bfcache avec état périmé, relais sur principal illisible. | Toute acquisition autre que le 1er démarrage rejoue le démarrage complet depuis le stockage (branche EXG-27 comprise) ; toute perte fige sans `calculHorsLigne`. Tests `pageshow` et relais sur principal tronqué. |
| N4 | majeur | Un seul test pour deux chemins de relais ; délai d'expiration sans chiffre. | Deux tests (fermeture propre = relais immédiat ; disparition = figé à `expiration − 1 ms`) ; délai chiffré dans le code, > 60 s. |
| N5 | majeur | Fabrique sans port page ni planificateur : deux onglets dans un même document reçoivent les mêmes événements. | Ports `page` (visibilité, `pagehide`, `pageshow`, `beforeunload`) et `planificateur` (intervalles, rAF). |
| N6 | majeur | « `.bak` valide jamais écrasé » contredit EXG-46 et `planifierEcrasement`. | Exception écrite dans EXG-46 : principal illisible ⇒ `contenuCourant: null`, aucune copie ; écran EXG-27 propose « restaurer » si `restaurerSecours` réussit. |
| N7 | majeur | « Écriture » non définie (battements, sauvegarde de démarrage) ; préfixe non vérifié ; `reglages` sans fixtures. | Compter les `setItem` sur `magic-battle:sauvegarde` après le démarrage ; toute clé écrite préfixée ; fixtures `reglages` hostiles vues rouges. |
| N8 | majeur | T-18 (Sonnet) et T-23a (Opus) portent tous deux le démarrage persistant ; T-22 audite des états créés par T-23. | T-18 = fabrique, ports, boucle, persistance factice en mémoire, démarrage en contrat typé ; T-23a l'implémente ; T-22 après T-23b. |
| N9 | mineur | Hook Stop non strict ; calcul §11 incohérent. | Aucun chemin de saut des tests navigateur ; `verify.sh` sans `--strict` échoue sans Chromium ; 13 × 150k + 18 × 60k ≈ 3,0 M tokens. |
| N10 | mineur | Seuils (> 60 s, ≥ 60 s, toute absence) incohérents, 60 s en dur ; « à l'identique » vs `derniereSauvegardeMs` ; crédit après import non défini ; double test « désactivé ». | Seuil unique `> nTicksMax × PAS_TICK_MS` ; comparaison hors `derniereSauvegardeMs` ; import sans crédit ; T-23a = actions sans effet, T-23b = `disabled` + bandeau. |

Non vérifié : `visibilitychange` sur veille système ; bridage exact des timers Chrome ; Chromium Playwright sous
WSL2 (`--with-deps` demande sudo) ; `vi.useFakeTimers` sur rAF en browser mode.
