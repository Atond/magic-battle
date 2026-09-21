# Challenge de la spec v1 — rapport spec-challenger (2026-09-20, lecture seule)

Verdict : à retravailler. Trous bloquants 1-3 tranchés par l'utilisateur (voir interview.md, section
« Complément après challenge »). Trous 4-15 à intégrer directement dans la v2, marqués
`[complété par le challenger]`.

| # | Sévérité | Lentille | Section | Trou | Proposition |
| --- | --- | --- | --- | --- | --- |
| 1 | bloquant | équilibrage | §8, EXG-18, EXG-20 | Chaîne de multiplicateurs méta absente : gain d'Éclats/Points défini, jamais leur effet ; k_prestige=1 donne 2 Éclats à la zone 8 | TRANCHÉ : Éclats = bonus passif +X %/Éclat ET arbre permanent ; Ascension = arbre de Points + 6e école à la 1re |
| 2 | bloquant | équilibrage | §8 tableaux | Croissance inter-zone effective ×87,9 (1,15⁹×10×2,5) → boss z8 ≈ 1,4e16 PV ≈ 1,1e14 DPS en 130 s ; DPS linéaire en niveau donc log en or → blocage mathématique ; T-3/T-5 « done = tableau codé » figeraient des données fausses | TRANCHÉ : valeurs = sortie du simulateur ; retirer « tableau codé » des done de T-3/T-5 ; paliers ×2 confirmés ; améliorations/équipement = multiplicateurs |
| 3 | bloquant | testabilité | §2 fin, §14, EXG-28 | Promesse 2 semaines/fin définie repose sur 3 inconnues ; aucune tâche ne code la condition de fin ni le boss final | TRANCHÉ : 3-5 Ascensions × 5-8 prestiges ; ajouter une tâche domaine « condition de fin + boss final » en vague 1 |
| 4 | majeur | sécurité | EXG-24, EXG-27, T-7, T-21 | Import non défendu : Infinity/NaN/négatifs, clés __proto__/constructor, chaînes rendues en HTML ; pas de sauvegarde de secours ni de confirmation avant écrasement | 3 EXG : validation par schéma (rejet non fini/négatif/hors bornes, clés inconnues ignorées) ; `sauvegarde.bak` avant import/nouvelle partie, restaurable en 1 clic ; aucun champ de sauvegarde rendu en HTML brut |
| 5 | majeur | robustesse | §5 hors-ligne, EXG-22/23 | Multi-onglet : deux moteurs écrivent la même clé toutes les 30 s → écrasement | EXG : verrou d'onglet (BroadcastChannel ou clé owner + heartbeat), onglet secondaire en lecture seule avec message ; corriger §5 |
| 6 | majeur | robustesse/équilibrage | EXG-4, §8 | `or_par_dégât_moyen` et `mult_or_zone(z)` jamais définis ; Δt non protégé (horloge reculée → négatif/NaN) | Définir les constantes ; EXG : `Δt = clamp(now − last_save, 0, H)`, `last_save` persistée |
| 7 | majeur | testabilité | §16 vagues 2-4 | Pas de colonne « Done quand » ; T-8 circulaire ; T-1 « relu » non vérifiable | Colonne done partout, chaque done = test nommé ou commande ; T-8 done = rapport chiffré + `npm run equilibrage` échoue sur un jeu volontairement déséquilibré |
| 8 | majeur | testabilité | §12 vs §16 | EXG orphelines : EXG-5, EXG-23, EXG-36/37 (notation), EXG-10 (quêtes/Renommée) | Une tâche par EXG ; ajouter « notation » et « quêtes/Renommée » (domaine) en vague 1 |
| 9 | majeur | périmètre | §3.1, §5, §8 | Améliorations présentes dans le modèle/formule mais sans EXG, coût ni tâche ; succès disparus | TRANCHÉ : améliorations = multiplicateurs de dégâts (EXG + table de coûts + tâche vague 1) ; succès fusionnés aux quêtes (§3.2) |
| 10 | majeur | UX/a11y | §7, EXG-29, EXG-33 | `prefers-reduced-motion` absent (WCAG 2.2.2, 2.3.1) | Option « effets réduits » activée par défaut si reduce ; rattacher à §4.9 |
| 11 | majeur | UX/mobile | EXG-11 à 14, EXG-35 | Déclenchement tactile des sorts non spécifié ; 24 px insuffisant pour action répétée au pouce | EXG : barre de sorts tactile persistante, cibles ≥ 44 px pour les sorts, 24 px ailleurs |
| 12 | majeur | FinOps | §11 vs §16 | §11 impose Opus sur `domain/` mais T-4/T-7 en Sonnet ; pas d'estimation de coût ; pas de liste MCP | Aligner T-4/T-7 sur Opus ; 3 lignes de coût estimé ; liste MCP ≤ 5 |
| 13 | mineur | testabilité | EXG-1, 3, 30 | Critères non mécanisables (« arrondis près », « N mesurées », « revue de code ») | Tolérance chiffrée (écart relatif < 1e-9) ; compteur de ticks exposé ; EXG-30 → test de durée |
| 14 | mineur | perf/UX | §8, §7 | Pas de budget de frame ni plafond de projectiles ; résumé hors-ligne de facto modal | ≤ 4 ms/frame, ≤ N projectiles avec dégradation silencieuse ; résumé non bloquant (encart fermable) |
| 15 | mineur | fidélité interview | §10, §16, EXG-13 | « supprimer un fichier » absent de Demander ; workflow Pages seulement en vague 4 ; 6e sort/auto-cast et touche 6 non précisés | Ajouter la ligne §10 ; remonter T-20 en fin de vague 1 ; préciser touche 6 / auto-cast |

Points forts relevés : a11y canvas (EXG-32/33 → T-14) ; risque n°1 traité en premier (simulateur vague 1,
`npm run equilibrage` dans verify.sh) ; discipline de sauvegarde (version, migrations, fixtures).
