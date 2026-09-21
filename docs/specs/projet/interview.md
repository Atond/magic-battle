# Interview de cadrage — projet « idlev1 » (jeu idle web, magicien vs monstres)

Date : 2026-09-20 · Assistant : /atelier:assistant · Banque : interview-projet + module idle-game
Contexte détecté : projet neuf (dossier vide, pas de CLAUDE.md, pas de git).

## Énoncé initial (utilisateur)
> J'aimerais reproduire ce type de jeu, mais au lieu d'un archer sur une cible, j'imagine un magicien
> qui doit tuer des monstres. J'aimerais que le jeu soit aussi largement plus long : qu'il faille
> plusieurs jours pour le terminer. Avec des sorts actifs etc. C'est un tout nouveau projet de type
> Idle web.

Déjà couvert par l'énoncé :
- Type de produit : jeu idle / incrémental, web.
- Thème : magicien qui tue des monstres (remplace archer / cible du jeu de référence).
- Durée de contenu : plusieurs jours (largement plus long que la référence).
- Interaction active : sorts actifs (clic + automatisation).

## Thème 1 — Vision & succès
- Jeu de référence : **Magic Archery** — https://barribob.itch.io/magic-archery (archer sur une cible).
- Succès à 3 mois : public plus large, mais on reste sur un **jeu simple** ; **sauvegarde locale** (comme
  Cookie Clicker, Antimatter Dimensions) — pas de compte, pas de cloud.
- Pire échec : **équilibrage raté** (trop lent ou trop rapide) → simulation des courbes avant le code.
- Relation au temps : **durable, enrichi par vagues** → prévoir migrations de sauvegarde.

### Fiche de la référence (recherche web, 2026-09-20)
Magic Archery (Barribob, avril 2024, jam de 2 semaines puis remake Steam gratuit, 98 % positif).
- Boucle : un archer tire sur des cibles → gagne or et « clout » via des quêtes → achète des améliorations
  (entraînement, équipement) → tire plus vite / plus fort → flèches magiques (builds crit / mana, « swarm »).
- Un seul personnage, **pas de prestige**, une histoire de A à B, **fin définie**. Durée : ~1 h à quelques heures.
- HTML5, pixel-art, très bonne lisibilité UI, satisfaction du « tir de plus en plus rapide ».
- Retours joueurs : demande de prestige, option performance (couper les projectiles sur vieux PC),
  quelques soucis WebGL/Firefox.
Sources : Steam app 2905170, incrementaldb.com, commentaires itch.io.

## Thème 2 — Utilisateurs & parcours
Déjà couvert par le thème 1 : grand public, sauvegarde locale, jeu simple.
- Support : **ordinateur d'abord, mobile jouable** (layout desktop multi-panneaux qui se replie).
- Session type : **actif quelques minutes puis onglet en fond** ; retours toutes les heures / le lendemain.
- Sorts actifs : **les deux** — clic = sort de base (dégâts au clic) + 3-5 sorts boosts à cooldown.
- Hors-ligne : **oui, plafonné** (ordre 8-12 h), résumé au retour.
- Concurrence : sans objet (jeu statique, sauvegarde locale, pas de serveur).

## Thème 3 — Type de produit & périmètre
Déjà couvert : jeu idle/incrémental web, thème magicien vs monstres, contenu sur plusieurs jours.
- V1 : zones de monstres avec boss · arbre d'améliorations + équipement · quêtes/succès · prestige.
- Hors périmètre : multijoueur/classements · monétisation · app native/stores.
  (Narration longue **non** exclue explicitement → à trancher : ambiance légère par défaut `[défaut proposé]`.)
- Fin : **fin définie après plusieurs prestiges** (boss final, écran de fin).
- Dépasser la référence sur : durée (jours), profondeur des builds (écoles de magie + synergies),
  prestige/méta-progression. **Pas** sur le visuel (rendu simple accepté).

## Module domaine idle-game — Boucle & monnaies
- Monnaies : **Or** (lâché par les monstres, achète niveaux d'écoles et améliorations) +
  **Renommée** (gagnée par les quêtes, achète l'équipement) + **monnaie de prestige** (bonus permanents).
- Générateurs : **écoles de magie à niveaux** (feu, glace, foudre, arcane, nécromancie…) : DPS
  automatiques, coût croissant, chaque école débloque ses sorts actifs ; builds par synergies.
- Nombre en V1 : **5 à 6 écoles**.
- Déblocage : **boss de zone battu révèle l'école suivante + coût en or du premier niveau**.

## Module domaine idle-game — Courbes & progression
- Durée totale : **2 semaines ou plus** jusqu'à la fin. ⚠ Tension avec « jeu simple » + 5-6 écoles :
  demande une couche de méta en plus (tranché ci-dessous).
- Début : premier sort ~5 min, premier mur ~1 h, **premier prestige ~2-3 h**.
- Courbes de coût : **laissées au simulateur** (`idle-balance`), défaut de départ x1.12 + paliers `[défaut proposé]`.
- PV monstres : **laissés au simulateur**, défaut de départ : 10 vagues/zone, boss x10 chronométré, zone
  suivante x2-3 `[défaut proposé]`.

## Module domaine idle-game — Prestige, sauvegarde, technique
- Méta 2 semaines : **Ascension** (2e couche) après N prestiges — reset des Éclats contre des mécaniques
  nouvelles (automatisation des sorts, 6e école, synergies) ; boss final après quelques Ascensions.
- Prestige : **Éclats = f(zone max atteinte du run)**.
- Sauvegarde : **locale (localStorage) + export/import texte**, auto-save 30 s, format versionné + migrations.
- Rendu : **Canvas 2D pour la scène de combat** (projectiles, impacts), **DOM pour l'UI** ; option
  « performance » (couper les projectiles) requise comme dans la référence.
- Grands nombres : 2 semaines + Ascension → rester < 1e308 probable ; notation abrégée (K, M, B… puis
  scientifique) `[défaut proposé]` ; passer à break_infinity seulement si le simulateur dépasse 1e300.
- Tick : simulation 100 ms, rattrapage par delta-time, forme fermée pour le hors-ligne `[défaut proposé]`.

## Thème 4 — Données & modèle
`[défaut proposé]` (dérivé des réponses, à confirmer au récap) :
- Objets : Magicien (stats), École (niveau), Sort (actif, cooldown), Zone, Vague, Monstre, Boss, Quête,
  Amélioration, Équipement, Prestige/Ascension, Sauvegarde.
- Données de référence : **définies dans le code** (fichiers de données TypeScript/JSON), aucune API.
- Volume : quelques centaines d'entrées de contenu ; une sauvegarde de quelques Ko.
- Données sensibles : **aucune**. Hors-ligne : le jeu est statique, fonctionne sans réseau (PWA possible).

## Thème 5 — Sécurité & vie privée
Déjà couvert : pas de compte, pas de partage, pas de paiement, pas de secrets applicatifs.
Frontières agents : à demander (thème qualité).

## Thème 6 — UX / UI & accessibilité
- Style : **sombre, dense, fantasy sobre** ; panneaux compacts (écoles + combat + sorts visibles d'un coup).
- Composants : **Tailwind + shadcn/ui**.
- Langue : **français seul** en V1, clés i18n-ready.
- Accessibilité : **minimum solide** — contraste AA, sorts au clavier (touches 1-5), info dans le DOM,
  canvas décoratif.

## Thème 7 — Plateforme, stack & hébergement
- Stack : **Vite + React 19 + TypeScript**, Tailwind 4 + shadcn/ui, Vitest. Site statique, aucun serveur.
- Hébergement : **GitHub Pages**. ⚠ Contradiction avec « dépôt GitHub privé » (Pages sur privé = GitHub
  Pro) → tranché ci-dessous.
- Conventions : **nylnatosport** (nommage français, `domain/`, `verify.sh`, Vitest), sans Supabase.
- Git : **git local + dépôt GitHub**, `main` jamais poussée directement par les agents.

## Thème 9 — FinOps · Thème 10 — Qualité (1/2)
Déjà couvert : aucun LLM en production (jeu statique).
- Hébergement tranché : **dépôt GitHub public (MIT) + GitHub Pages** via GitHub Actions sur `main`.
- FinOps dev : **capacité d'abord** (Opus large ; Fable reste à justifier par écrit).
- Tests : **critique** — moteur (tick, dégâts, coûts, prestige, hors-ligne), formules, migrations de sauvegarde.
- Porte de qualité : **verify.sh + hook Stop bloquant** (lint, typecheck, tests, simulation d'équilibrage).
- Frontières agents `[défaut proposé]` : Toujours = lire, tester, éditer le code, commit sur branche ;
  Demander = installer une dépendance, supprimer un fichier, modifier le format de sauvegarde, push ;
  Jamais = `reset --hard`, `push --force`, push direct sur `main`, toucher aux secrets GitHub.

## Thème 10 (2/2) — Thème 11 — Risques · Thème 12 — Livraison
- Opérations répétées (skills candidats) : ajouter une école/un sort · ajouter une zone/monstres/boss ·
  passe d'équilibrage · migration de sauvegarde.
- Revue lecture seule : **oui, à chaque vague**.
- Risque n°1 : **équilibrage sur 2 semaines** (deux couches de méta) → simulateur dès la vague 1.
- Rythme : **plein temps** ; V0 = **boucle complète** (squelette de tout : zones, écoles, sorts, prestige,
  Ascension, sauvegarde) puis enrichissement par vagues.
- Ordre des vagues : laissé à l'assistant, par risque décroissant `[défaut proposé]`.
- Preview par vague : GitHub Pages sur `main` ; pas de preview par branche `[défaut proposé]`.

## Récapitulatif (soumis à validation)
1. **Type** : jeu idle/incrémental web statique, magicien vs monstres, inspiré de Magic Archery mais 2 semaines+.
2. **Utilisateurs** : grand public, desktop d'abord, mobile jouable, sessions courtes + fond + hors-ligne plafonné.
3. **V1** : zones/vagues/boss · 5-6 écoles de magie (générateurs) · clic + 3-5 sorts à cooldown · améliorations
   + équipement · quêtes → renommée · prestige (Éclats = f(zone max)) · Ascension · fin définie.
4. **Hors périmètre** : multijoueur, monétisation, app native. Narration : légère (défaut proposé).
5. **Données** : contenu défini dans le code, sauvegarde locale versionnée + export/import, aucune donnée sensible.
6. **Sécurité** : pas de compte ni serveur ; frontières agents proposées (jamais force-push / main / reset --hard).
7. **Stack** : Vite + React 19 + TS, Tailwind 4 + shadcn/ui, Canvas 2D combat + DOM UI, Vitest ; conventions nylnatosport.
8. **Hébergement** : dépôt GitHub public (MIT) + GitHub Pages via Actions.
9. **FinOps** : aucun LLM en prod ; agents « capacité d'abord » ; revue lecture seule à chaque vague.
10. **Qualité / vague 1** : tests moteur+formules+sauvegarde, verify.sh + hook Stop, simulateur d'équilibrage
    dès la vague 1 ; V0 = boucle complète en squelette.

## Validation
- Récapitulatif **validé** par l'utilisateur le 2026-09-20.
- Narration (tranché) : **très petite histoire qui ne bloque jamais le joueur** ; petits jeux de mots,
  humour, **ton familier**, surtout pas un style « IA » (pas de grandiloquence, pas de listes lisses).
  Textes courts : noms, descriptions d'écoles/sorts/zones/boss, une ligne d'intro, une ligne par Ascension, une fin.

Interview close. Prochaine étape : spec-writer → docs/specs/projet/spec.md.

## Complément après challenge de la spec v1 (2026-09-20)
Trous bloquants du spec-challenger, tranchés par l'utilisateur :
- **Éclats (prestige)** : **les deux** — chaque Éclat donne un bonus passif permanent (+X % dégâts global)
  ET les Éclats se dépensent dans un petit arbre permanent (8-12 améliorations à coût croissant : dégâts,
  or, départ en zone N, cooldowns). Double comptabilité assumée (Éclats possédés vs dépensés).
- **Ascension** : Points d'Ascension = f(Éclats cumulés) dépensés dans un **arbre permanent** (auto-cast des
  sorts, synergies entre écoles, bonus de départ) ; la **1re Ascension débloque la 6e école (Lumière)**.
- **Fin** : **3-5 Ascensions × 5-8 prestiges** (≈ 20-30 prestiges au total) ; boss final après la dernière
  Ascension ; la condition de fin est codée dans le moteur (pas seulement un texte).
- **Séquencement** : **les valeurs numériques sont une SORTIE du simulateur** (vague 1), aucun tableau figé
  avant le rapport idle-balance ; paliers ×2 (10/25/50/100) confirmés ; **améliorations (or) et
  équipement (renommée) = multiplicateurs de dégâts** (source de croissance exponentielle) ;
  **succès fusionnés aux quêtes** (pas de panneau succès séparé).

## Complément après challenge de la spec v2 (2026-09-20)
- **« 14 jours » = temps de jeu cumulé : ≥ 40 h de simulation continue** (le simulateur mesure des heures de
  jeu, pas un calendrier ; le hors-ligne existe toujours côté produit mais n'entre pas dans la mesure).
- **Runs** : zones **générées par formule sans limite** ; chaque run va strictement plus profond que le
  précédent ; rejouer le contenu déjà vu est 2-3× plus rapide, le contenu neuf allonge le run (plancher 2 h,
  plafond 24 h). **Les formes de formules** (exposants, nœuds répétables à rangs infinis) sont des sorties
  du simulateur, pas seulement les constantes.
- **Arbre d'Éclats à l'Ascension : remis à zéro** avec les Éclats ; la permanence vit dans l'arbre d'Ascension
  (corriger « permanent » dans la spec).
- Suite : **v3 courte** intégrant les 13 points du challenge v2, puis validation. Pas de 3e challenge.

## Validation finale
Spec v3 **validée** par l'utilisateur le 2026-09-20. Étape suivante : integration-architect → teambuild → plan vague 1.
