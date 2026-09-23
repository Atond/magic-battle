# Spec — idlev1 (jeu idle web, magicien vs monstres)

> Source de vérité du projet, destinée à des agents LLM autant qu'à des humains. Version 10 — 2026-09-23, **validée par l'utilisateur le 2026-09-23** —
> corps **validé par l'utilisateur le 2026-09-20** (v3) après deux tours de challenge (`challenge-v1.md`,
> `challenge-v2.md`) ; v4 ajoute ADR-16, v5 ajoute ADR-17 et ferme la dernière question ouverte de §14.
> Les deux sont issus de la mesure en vague 1 et validés par l'utilisateur le 2026-09-21. La v6 corrige
> une erreur d'attribution de tâche relevée par la revue de fin de vague 1 (EXG-22/23), sans toucher aux
> exigences elles-mêmes ; la v7 ajoute ADR-18 (nommage des fichiers engendrés par un outil tiers) ; la v8
> tranche les décisions techniques et d'apparence laissées ouvertes pour la vague 2 (store, outillage de
> test UI, palette, disposition, réglages) et corrige trois écarts relevés sans nouvelle question ; la v9
> ferme les 15 trous du challenge de la v8 (deux bloquants tranchés par l'utilisateur, treize majeurs
> intégrés) et scinde T-23 ; la v10 ferme les 10 trous du challenge de la v9 (un bloquant tranché par
> l'utilisateur, huit majeurs et mineurs intégrés), réordonne la vague 2 (T-22 après T-23b) et corrige les
> calculs de §11/§12.
> Issue de `docs/specs/projet/interview.md` et de `docs/specs/projet/challenge-v2.md`. Toute modification =
> nouvelle version datée.
> Règles d'écriture : phrases courtes ; une exigence = un identifiant ; tout ce qui est testable est écrit
> pour être testé ; les décisions disent pourquoi et ce qui a été écarté ; pas d'adjectif sans mesure.

## Changements depuis v9 (2026-09-23)
Base : `docs/specs/projet/challenge-v9.md` (10 trous, statut des 15 trous v8 : fermés #2, 5, 7, 8, 10, 12, 14 ;
partiellement fermés #1, 3, 4, 6, 9, 11, 13, 15) et `docs/specs/2026-09-23-vague-2-ui/interview.md`
§« Complément après challenge de la v9 ». Un bloquant tranché par l'utilisateur : **EXG-55** étendue (N2 —
tout delta de frame supérieur au seuil de rattrapage part vers `calculHorsLigne`, onglet caché ou non, pas de
nouvelle EXG). Huit trous majeurs/mineurs intégrés, marqués `[complété par le challenger v9]` : suspension du
tick/sauvegarde sur `hidden` (N1, EXG-55/T-23a) ; rejeu complet du démarrage à toute acquisition de verrou
hors 1er démarrage, gel sans `calculHorsLigne` sur perte (N3, EXG-48/T-23a) ; deux tests de relais + délai
d'expiration chiffré (N4, T-23a) ; ports `page`/`planificateur` dans la fabrique (N5, T-18) ; exception
`.bak` sur principal illisible (N6, EXG-46) ; définition de « écriture », préfixe vérifié, fixtures
`reglages` hostiles (N7, §12/T-23a) ; T-18 = fabrique + contrat typé, T-23a = implémentation, T-22 déplacée
après T-23b (N8, §16) ; seuil unique `nTicksMax × PAS_TICK_MS` partout (N10, EXG-55/§8). Restes des trous v8
fermés : #11 (assertion de chevauchement des rectangles avant clic, T-23b) ; #13 (critère déterministe pour
EXG-30). Corrections sans renumérotage : §11 (13 × 150k + 18 × 60k ≈ 3,0 M tokens), §12 (aucun chemin de
saut des tests navigateur). Détail complet dans les deux fichiers sources, non recopié ici.

## Changements depuis v8 (2026-09-23)
Base : `docs/specs/projet/challenge-v8.md` (15 trous) et `docs/specs/2026-09-23-vague-2-ui/interview.md`
§« Complément après challenge de la v8 ». Deux bloquants tranchés par l'utilisateur : **EXG-55** ajoutée
(onglet caché > 60 s traité comme hors-ligne, #1) ; **EXG-48** précisée (onglet secondaire figé + relais
automatique par relecture du stockage, #2). **T-23** scindée en **T-23a** (persistance, verrou, ordre de
démarrage — Opus forcé) et **T-23b** (confirmations, encart, bandeau — Sonnet), agent `implementeur-ui`
créé en tête de vague 2 (#15). Treize trous majeurs intégrés dans les exigences et tâches concernées,
marqués `[complété par le challenger v8]`. Détail complet dans les deux fichiers sources, non recopié ici.

## Changements depuis v7 (2026-09-23)
Base : `docs/specs/2026-09-23-vague-2-ui/interview.md`, décisions validées le 2026-09-23 pour la vague 2.
Trois ADR ajoutés (§15) : **ADR-19** (store Zustand vanilla, tick hors React), **ADR-20** (outillage de
test UI en navigateur : Vitest browser mode + Playwright Chromium + Testing Library + axe-core), **ADR-21**
(réglages d'affichage dans une clé `localStorage` séparée, hors sauvegarde). §14 passe les lignes Palette et
Store à résolu. §7 précise la disposition desktop/mobile et le rendu canvas procédural sans asset. §16
ajoute **T-18a** (outillage de test UI) et complète les critères de done de T-18, T-22, T-23 ; §12 ajoute la
vérification des tests UI navigateur. Corrections sans renumérotage : T-21 (agent `implémenteur-canvas` →
`implementeur-ui`), EXG-4 (retire `[à valider]` sur H, qui est une sortie du simulateur), EXG-21 (la
confirmation affiche le gain même nul). Détail complet dans l'interview, non recopié ici.

## Changements depuis v6 (2026-09-22)
**ADR-18** (§15) tranche une contradiction relevée par la revue de fin de vague 1 : les fichiers engendrés
par un outil tiers gardent leur nom amont, malgré la règle « français partout ». Aucune exigence modifiée.

## Changements depuis v5 (2026-09-22)
Correction d'attribution relevée par la **revue de fin de vague 1**. T-10 (§16) revendiquait EXG-22
(auto-sauvegarde toutes les 30 s), et §12 rangeait EXG-22/23 dans la ligne `tests/domain/sauvegarde.test.ts`
— alors qu'aucun test ne peut les prouver depuis `src/domain/`, qui n'a par construction aucun accès au
stockage ni à l'horloge. Le moteur n'en porte que la constante d'intervalle. Les deux exigences passent
donc explicitement à **T-23** (vague 2), où le stockage est réellement branché. Aucun code concerné,
aucune exigence modifiée : c'est la table qui laissait croire à une couverture inexistante.

## Changements depuis v4 (2026-09-21)
Deux ajouts, tous deux issus du rapport `tools/idle-balance/rapports/2026-09-21.md` (T-14) :
- **ADR-17** (§15) : la durée réelle d'un run est exigée **stable ou croissante à 10 % près** et non plus croissante — la
  croissance s'est révélée mathématiquement incompatible avec le reste du design, démonstration à l'appui.
  §8 est amendé en conséquence (une puce).
- **Question ouverte §14 fermée** : le seuil de mur qui fait échouer `verify.sh` porte sur le **blocage de
  progression** (aucune zone gagnée), à 90 min ; le mur au sens « aucun achat abordable » ne dépasse jamais
  0,5 min et ne mesure rien. §14 passe la ligne à « résolu ».
Aucune exigence EXG modifiée, aucune formule touchée, aucun renumérotage.

## Changements depuis v3 (2026-09-21)
Un seul ajout, issu de l'implémentation de la vague 1 : **ADR-16** (§15) tranche ce que la spec laissait
ouvert sur le périmètre du reset de prestige — les paliers d'améliorations sont remis à zéro, ceux
d'équipement survivent. Aucune exigence modifiée, aucune formule touchée, aucun renumérotage.

## Changements depuis v2 (2026-09-20)
Base : `challenge-v2.md` (13 points) + `interview.md` §« Complément après challenge de la spec v2 ». Détail
complet dans ces deux fichiers, non recopié ici.

**Tranché par l'utilisateur (points #1-3 du challenge v2)** :
- Cible de durée : « 14 jours calendaires » → **≥ 40 h de jeu cumulé en simulation continue** (métrique
  vérifiable par le simulateur) ; le hors-ligne reste une fonctionnalité produit (EXG-4/5/49) mais n'entre
  pas dans cette mesure.
- Zones générées par **formule paramétrique sans borne** ; chaque run strictement plus profond que le
  précédent ; rejouer le contenu déjà vu est **2-3× plus rapide** ; durée réelle d'un run croissante,
  plancher 2 h, plafond 24 h. **Les formes des formules** (exposants, nœuds répétables à rangs infinis) sont
  désormais des sorties du simulateur, pas seulement les constantes.
- Arbre d'Éclats **remis à zéro à l'Ascension** (Éclats possédés + nœuds de l'arbre) ; seul l'arbre
  d'Ascension est permanent — corrige « permanent » en §3.1/§5/EXG-38 pour l'arbre d'Éclats.

**Intégré du rapport challenger v2, marqué `[complété par le challenger v2]` dans le texte** (points #4-13) :
constantes de fin (`N_ASCENSIONS_REQUISES`, `PRESTIGES_PAR_ASCENSION`, `H`) fixées par T-14 et injectées par
T-15 ; T-13 les lit depuis `donnees/` (ordre après T-15) ; EXG-54 (jalons de quête) ; contrainte dure
20-30 prestiges au total ; `N_PROJECTILES_MAX = 200` déclarée ; arbres d'Éclats (8-12 nœuds) et d'Ascension
(6-10 nœuds) avec ≥ 1 nœud répétable chacun ; boss final défini mécaniquement (EXG-28) ; traçabilité UI
complétée (T-20, T-23) ; `equilibrage:check` (verify.sh, hook Stop) séparé de `equilibrage:search`
(manuel, T-14) ; §10 renvoie au rapport idle-balance + `src/donnees/` ; revue lecture seule ajoutée à la
preuve de fin de vague 2.

Changements v1→v2 : voir `challenge-v1.md` (15 trous), non recopiés ici.

## 1. Contexte & vision
Jeu idle/incrémental web, gratuit, sans compte : un magicien affronte des vagues de monstres et des boss
de zone, débloque des écoles de magie (générateurs de DPS), lance des sorts actifs au clic et au clavier,
progresse via or/renommée/quêtes, puis relance sa partie via deux couches de méta-progression (Prestige en
Éclats, Ascension). Inspiré de *Magic Archery* (Barribob, itch.io, voir fiche interview §Thème 1) mais visé
**beaucoup plus long** : fin définie après 3 à 5 Ascensions (5-8 prestiges chacune, contrainte dure
20 ≤ prestiges_total ≤ 30 `[complété par le challenger v2]`), plusieurs jours de jeu en usage normal.
Métrique vérifiable par le simulateur : **≥ 40 h de jeu cumulé en simulation continue** (remplace « 14
jours calendaires », non mesurable par un simulateur sans horloge réelle — tranché en interview, complément
challenge v2).

**Succès à 3 mois** : jeu simple à prendre en main, joué par un public plus large que la référence,
sauvegarde 100 % locale (pas de compte, pas de cloud) — comme Cookie Clicker / Antimatter Dimensions.

**Pire échec à éviter** : équilibrage raté (trop lent = abandon, trop rapide = fin en un après-midi). Parade :
un simulateur d'équilibrage (`idle-balance`) tourne **avant** tout code de contenu et produit les valeurs de
§8 — plus de valeurs manuelles figées avant simulation (la v1 en contenait ; cause du trou bloquant #2 du
challenge, mur mathématique non détecté).

## 2. Utilisateurs & parcours
| Persona | Contexte d'usage | Appareil | Parcours clés |
| --- | --- | --- | --- |
| Joueur idle grand public | Sessions actives de quelques minutes, onglet laissé en fond, retours toutes les heures ou le lendemain | Ordinateur d'abord (layout multi-panneaux), mobile jouable (layout replié) | Découverte → premier sort → premier mur → premier prestige → cycles Ascension → fin |

Parcours détaillés :
- **Première session** — déclencheur : ouverture du jeu. Étapes : clic tutoriel sur un monstre, gain d'or,
  achat du 1er niveau d'École du Feu, déblocage du 1er sort actif. Résultat : boucle cœur comprise.
  Durée cible : premier sort actif obtenu **~5 min**.
- **Premier mur** — déclencheur : progression naturelle sans achat optimisé. Résultat : le joueur sent qu'il
  doit attendre/accumuler avant d'avancer. Durée cible **~1 h** après le début.
- **Premier prestige** — déclencheur : zone assez avancée pour que l'Éclat gagné soit significatif.
  Résultat : reset du run, gain durable pour le cycle d'Ascension en cours (bonus passif + choix dans
  l'arbre d'Éclats, remis à zéro à l'Ascension suivante — corrigé `[complété par le challenger v2]`). Durée
  cible **2-3 h**.
- **Retour après absence** — déclencheur : réouverture de l'onglet après un hors-ligne. Résultat : encart
  non bloquant (or gagné, temps écoulé, plafond atteint ou non), fermable sans confirmation (EXG-53).
  Durée cible : lecture du résumé **< 10 s**.
- **Fin de partie** — déclencheur : boss final vaincu après la dernière Ascension (3 à 5, valeur exacte
  fixée par le simulateur dans la fourchette tranchée en interview, §8). Résultat : écran de fin,
  statistiques du run. Durée cible totale du contenu : **plusieurs jours** en usage normal (sessions courtes
  + hors-ligne) ; métrique vérifiée par le simulateur : **≥ 40 h de jeu cumulé en simulation continue**
  (hors-ligne exclu de cette mesure) `[complété par le challenger v2]`.

## 3. Périmètre
### 3.1 V1 — fonctionnalités
- Boucle cœur : clic + sort de clic, sorts actifs à cooldown sur touches 1-6 (5 de base + 1 débloquée à la
  1re Ascension), 5 écoles de magie de base + 1 débloquée à la 1re Ascension (Lumière).
- Zones de monstres (vagues + boss chronométré), déblocage d'école par boss de zone + coût en or.
- Monnaies : Or (écoles, améliorations), Renommée (quêtes → équipement), Éclats (prestige, double usage).
- Améliorations (or) et équipement (renommée) : multiplicateurs de dégâts à coûts croissants (EXG-42/43).
- Prestige (reset run → Éclats : bonus passif + arbre 8-12 nœuds **par cycle d'Ascension**, non permanent)
  et Ascension (reset Éclats + arbre d'Éclats → arbre de Points **permanent** : auto-cast, synergies, bonus
  de départ ; 6e école à la 1re Ascension) `[complété par le challenger v2]`.
- Quêtes, Renommée → équipement ; succès fusionnés aux quêtes (pas de panneau séparé).
- Condition de fin codée dans le moteur (boss final après la dernière Ascension), écran de fin dédié.
- Sauvegarde locale versionnée, auto-save 30 s, export/import texte (base64) validé par schéma,
  `sauvegarde.bak` restaurable, migrations, verrou multi-onglet.
- Rendu Canvas 2D (combat) + DOM (UI), option « performance » (auto si `prefers-reduced-motion`), budget de
  frame ≤ 4 ms et plafond de projectiles.
- Accessibilité minimum (contraste AA, clavier, canvas décoratif, cibles tactiles ≥ 44 px pour les sorts),
  responsive desktop-first mobile jouable.
- Narration légère : petite histoire qui ne bloque jamais, textes courts (§7).

### 3.2 Hors périmètre explicite
- Multijoueur, classements, tout serveur applicatif.
- Monétisation (pubs, achats in-app) — jeu 100 % gratuit et statique.
- Application native / stores mobiles.
- Comptes utilisateurs, cloud save, anti-triche serveur (pas de serveur du tout).
- Narration longue/branchante, choix scénaristiques multiples.
- **Panneau de succès séparé : succès fusionnés aux quêtes** (tranché après challenge, trou #9).
- PWA installable, zip de distribution itch.io — au-delà de la V1 (GitHub Pages seul en V1).
Les agents doivent refuser d'ajouter ces éléments sans une nouvelle décision explicite (nouvelle version
de cette spec).

## 4. Exigences (EARS)
Format : `EXG-n` · type · énoncé · critère d'acceptation · priorité (P0/P1/P2). 55 exigences au total
(EXG-1 à EXG-55) ; table de traçabilité EXG → tâche en fin de §16.

### 4.1 Tick, delta-time, hors-ligne
| ID | Type | Énoncé | Critère d'acceptation (testable) | P |
| --- | --- | --- | --- | --- |
| EXG-1 | Ubiquitaire | Le système doit faire progresser la simulation par pas fixes de 100 ms. | Test : 10 ticks de 100 ms produisent un état dont l'écart relatif avec un seul appel de 1000 ms est < 1e-9. `[complété par le challenger]` | P0 |
| EXG-2 | Événementiel | Quand le delta-time entre deux frames dépasse 1 s, le système doit rattraper les ticks manquants sans re-render intermédiaire. | Test : delta = 5000 ms produit exactement l'état de 50 ticks successifs. | P0 |
| EXG-3 | Indésirable | Si le nombre de ticks à rattraper dépasse un seuil `nTicksMax` (sortie du simulateur, `src/donnees/constantes.ts` : 600 au rapport du 2026-09-21, seul seuil nommé pour tout rattrapage, cf. EXG-55), alors le système doit basculer sur un calcul en forme fermée pour la production passive. | Test : un delta de 2 h ne déclenche pas plus de `nTicksMax` itérations, mesurées via un compteur `ticksRattrapes` exposé par le moteur. `[complété par le challenger]` `[nommage unifié, complété par le challenger v9, N10]` | P0 |
| EXG-4 | Événementiel | Quand le joueur revient après une absence, le système doit créditer la production hors-ligne des écoles (générateurs passifs), plafonnée à H heures (H ∈ [8, 12], valeur fixée par le simulateur et lue depuis `src/donnees/`, §8), et afficher un résumé (or gagné, temps écoulé, plafond atteint ou non). | Test : une absence simulée de 20 h ne crédite que la durée H ; le résumé affiche les 3 valeurs. | P0 |
| EXG-5 | Ubiquitaire | Le système ne doit pas créditer le sort de clic ni les sorts actifs pendant le hors-ligne : seule la production passive des écoles compte. | Test : hors-ligne avec 0 niveau d'école ne rapporte aucun gain. | P1 |
| EXG-49 | Ubiquitaire | Le système doit calculer l'écart hors-ligne comme `Δt = clamp(horodatage_actuel − dernier_horodatage_sauvegardé, 0, H)`, `dernier_horodatage_sauvegardé` étant persisté à chaque sauvegarde. | Test : horloge système reculée artificiellement → `Δt = 0`, aucun crédit négatif ni NaN. `[complété par le challenger]` | P0 |
| EXG-53 | Ubiquitaire | Le résumé hors-ligne (EXG-4) doit s'afficher en encart non bloquant, fermable sans confirmation, qui n'intercepte aucune interaction de jeu pendant son affichage. | Test : le résumé affiché n'intercepte aucun clic destiné aux panneaux de jeu ; fermeture en un clic ou automatique après lecture. `[complété par le challenger]` | P1 |
| EXG-55 | Événementiel | Quand un delta de frame dépasse le seuil de rattrapage `nTicksMax × PAS_TICK_MS` (EXG-3, sortie du simulateur, `src/donnees/` ; 60 s avec les constantes actuelles), le système doit traiter cet écart comme une absence hors-ligne (EXG-4 : plafond H, production passive, résumé), créditée une seule fois, puis remettre à zéro sa référence de temps — que l'onglet ait changé de visibilité ou non (fermé, caché, ou veille système sans `visibilitychange`). `[bloquant #1, tranché par l'utilisateur, challenge v8]` Pendant que l'onglet est `hidden`, le tick, la sauvegarde et l'auto-sauvegarde sont suspendus et seul le battement du verrou (EXG-48) continue ; l'écart mesuré au retour se calcule hors `derniereSauvegardeMs` (comparaison d'horloge dédiée, pas la date de dernière écriture). `[complété par le challenger v9, N1/N2/N10]` | Test : onglet caché 20 h puis revenu visible → crédit plafonné à H, un seul crédit, aucune écriture pendant l'absence (pas de double comptage avec l'auto-sauvegarde ou un second `visibilitychange`). Test : delta de 8 h sans `visibilitychange` (veille système) → même traitement, crédit plafonné à H une seule fois. Test : 10 frames après un retour sous le seuil → jeu normal, aucun passage par `calculHorsLigne`. `[complété par le challenger v9]` | P0 |

### 4.2 Monnaies, générateurs, déblocage
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-6 | Ubiquitaire | Le système doit calculer l'or gagné par monstre tué en fonction de ses PV et de la zone (formule §8). | Test : 3 cas de la formule vérifiés à l'unité près. | P0 |
| EXG-7 | État | Tant qu'une école n'est pas débloquée, le système doit afficher son nom et son coût de déblocage et masquer sa production. | Test : une école verrouillée n'affiche pas de DPS et n'apparaît pas dans le total de dégâts. | P1 |
| EXG-8 | Événementiel | Quand le boss d'une zone de déblocage est vaincu, le système doit révéler l'école suivante contre le coût en or de son premier niveau. | Test : victoire du boss de la zone 2 débloque l'affichage de l'École de Glace ; son 1er niveau reste verrouillé tant que l'or est insuffisant. | P0 |
| EXG-9 | Ubiquitaire | Le système doit calculer le coût du niveau n+1 d'une école comme `coût_base × croissance^n`. | Test : les 5 premiers coûts de l'École du Feu correspondent à la formule sans écart. | P0 |
| EXG-10 | Ubiquitaire | Le système doit calculer la Renommée gagnée par quête accomplie et la réserver exclusivement à l'achat d'équipement. | Test : un achat d'équipement est refusé si la Renommée est insuffisante, accepté sinon ; l'or ne peut pas se substituer à la Renommée. | P1 |
| EXG-54 | Événementiel | Quand un jalon de quête est atteint (zone atteinte, nombre de monstres tués, ou 1er prestige effectué), le système doit marquer la quête accomplie une seule fois et créditer la Renommée associée. | Test : rejouer/redéclencher le jalon après accomplissement ne crédite pas de Renommée supplémentaire (non-répétabilité) ; les 3 types de jalons (zone, monstres tués, 1er prestige) sont chacun couverts par un test. `[complété par le challenger v2]` | P1 |

### 4.3 Sorts actifs
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-11 | Ubiquitaire | Le système doit appliquer les dégâts du sort de clic à chaque clic ou frappe dédiée, sans cooldown. | Test : 10 clics en 1 s produisent 10 applications de dégâts. | P0 |
| EXG-12 | État | Tant qu'un sort actif est en cooldown, le système doit empêcher son déclenchement et afficher le temps restant. | Test : un déclenchement pendant le cooldown est ignoré et ne consomme aucune ressource. | P0 |
| EXG-13 | Événementiel | Quand le joueur appuie sur une touche 1 à 6, le système doit déclencher le sort actif correspondant s'il est débloqué et disponible ; la touche 6 ne produit d'effet qu'après la 1re Ascension (EXG-41). | Test clavier : la touche « 2 » déclenche le 2ᵉ sort actif hors cooldown, ne fait rien sinon ; la touche « 6 » ne fait rien avant la 1re Ascension, déclenche le sort de Lumière après. | P0 |
| EXG-14 | Optionnel | Si un sort actif n'est pas encore débloqué, alors le système doit ignorer la touche associée et afficher son état verrouillé. | Test : touche d'un sort non débloqué → aucun effet, tooltip « verrouillé ». | P2 |

### 4.4 Zones, vagues, boss
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-15 | Ubiquitaire | Le système doit faire progresser les monstres par vagues numérotées au sein d'une zone, chaque vague augmentant les PV selon `croissance_vague(zone)` (§8). | Test : PV de la vague 5 = PV de la vague 1 × croissance⁴. | P0 |
| EXG-16 | Événementiel | Quand la dernière vague normale d'une zone est vaincue, le système doit lancer le combat de boss chronométré (durée §8). | Test : le timer démarre à la valeur attendue pour la zone. | P0 |
| EXG-17 | Indésirable | Si le timer de boss expire avant sa mort, alors le système doit renvoyer le joueur à la vague précédente sans perte de progression déjà acquise (or, niveaux d'écoles). | Test : échec de boss → or et niveaux inchangés, vague courante redevient la précédente. | P1 |

### 4.5 Prestige & Ascension — méta profonde
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-18 | Ubiquitaire | Le système doit calculer les Éclats gagnés au prestige comme une fonction croissante de la zone maximale atteinte durant le run (formule §8). | Test : Éclats(zone_max=10) < Éclats(zone_max=20), formule vérifiée sur 3 valeurs. | P0 |
| EXG-19 | Événementiel | Quand le joueur confirme un prestige, le système doit réinitialiser zone/or/niveaux d'écoles du run courant et créditer les Éclats calculés. | Test : prestige confirmé → zone=1, or=0, niveaux=0, Éclats totaux augmentés du montant calculé. | P0 |
| EXG-20 | Événementiel | Quand le joueur confirme une Ascension (disponible après 5-8 prestiges, fourchette tranchée en interview, valeur exacte fixée par le simulateur), le système doit remettre à zéro les Éclats possédés ET tous les nœuds de l'arbre d'Éclats (EXG-39), laisser intacts les nœuds de l'arbre d'Ascension (EXG-40), et créditer des Points d'Ascension dépensables dans l'arbre d'Ascension. `[complété par le challenger v2]` | Test : Ascension confirmée → Éclats possédés=0, tous les nœuds de l'arbre d'Éclats reviennent à rang 0, nœuds de l'arbre d'Ascension inchangés, Points d'Ascension crédités selon la formule §8. | P1 |
| EXG-21 | Ubiquitaire | Le système doit exiger une confirmation à deux étapes avant toute réinitialisation irréversible (prestige, Ascension) ; le second écran affiche le gain calculé (Éclats pour un prestige, Points d'Ascension pour une Ascension), même quand la formule le rend nul. `[complété par l'interview vague 2]` | Test : un prestige annulé au premier écran ne modifie aucun état. Test : un prestige déclenché sous la zone 4 (la formule y rend 0 Éclat) affiche une confirmation à « 0 Éclat », pas un écran vide ni une erreur. | P0 |
| EXG-38 | Ubiquitaire | Le système doit appliquer aux dégâts globaux un bonus passif fonction des Éclats possédés du cycle d'Ascension en cours, de forme `(1 + B × Éclats_possédés)^β` (ou forme multiplicative équivalente, constantes/exposant `B`/`β` issus du simulateur, §8) ; ce bonus est remis à son état zéro Éclat à chaque Ascension, avec les Éclats possédés (EXG-20). `[complété par le challenger, trou #1] [complété par le challenger v2]` | Test : dégâts avec 10 Éclats possédés vs 0 Éclat suivent la formule `(1 + B × Éclats)^β` archivée par le simulateur (T-14) ; après une Ascension, le bonus retombe à son état zéro Éclat. | P0 |
| EXG-39 | Ubiquitaire | Le système doit proposer, pour le cycle d'Ascension en cours, un arbre de dépense des Éclats de 8 à 12 nœuds à coût croissant (dégâts, or, zone de départ, cooldowns) dont au moins un nœud répétable à rangs infinis à coût croissant ; la dépense d'Éclats dans l'arbre est indépendante du solde d'Éclats possédés qui alimente le bonus passif (EXG-38) ; l'arbre entier est remis à zéro à chaque Ascension (EXG-20). `[complété par le challenger, trou #1] [complété par le challenger v2]` | Test : l'achat d'un nœud décrémente le solde dépensable sans réduire le compte total d'Éclats possédés utilisé par EXG-38 ; le nœud répétable reste achetable indéfiniment à coût croissant ; après une Ascension, tous les nœuds reviennent à rang 0. | P0 |
| EXG-40 | Ubiquitaire | Le système doit proposer un arbre de Points d'Ascension **permanent** (jamais réinitialisé) de 6 à 10 nœuds (auto-cast des sorts, synergies entre écoles, bonus de départ de run) dont au moins un nœud répétable à rangs infinis à coût croissant, alimenté par les Points calculés en §8. `[complété par le challenger, trou #1] [complété par le challenger v2]` | Test : l'achat d'un nœud d'auto-cast déclenche le sort correspondant automatiquement au tick suivant, sans clic ni frappe ; le nombre total de nœuds est compris entre 6 et 10, dont au moins un répétable. | P1 |
| EXG-41 | Événementiel | Quand la 1re Ascension est confirmée, le système doit débloquer la 6e école (Lumière) et son sort actif sur la touche 6. | Test : avant la 1re Ascension, l'École de Lumière n'apparaît pas ; après, elle est visible et son sort répond à la touche 6 une fois débloqué. `[complété par le challenger, trou #1]` | P1 |

### 4.6 Améliorations & équipement — multiplicateurs
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-42 | Ubiquitaire | Le système doit calculer chaque amélioration (or) comme un multiplicateur de dégâts `mult_améliorations`, coût du palier n+1 = `coût_base × croissance^n` (même famille de formule que EXG-9). | Test : 3 paliers d'une amélioration vérifiés à l'unité ; `mult_améliorations` recalculé après achat et appliqué à la chaîne de DPS (§8). `[complété par le challenger, trou #9]` | P0 |
| EXG-43 | Ubiquitaire | Le système doit calculer chaque équipement (renommée) comme un multiplicateur de dégâts `mult_équipement`, coût croissant par palier, achat réservé à la Renommée (EXG-10). | Test : 3 paliers d'un équipement vérifiés ; `mult_équipement` recalculé après achat et appliqué à la chaîne de DPS (§8). `[complété par le challenger, trou #9]` | P0 |

### 4.7 Sauvegarde
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-22 | Ubiquitaire | Le système doit sauvegarder automatiquement l'état de jeu toutes les 30 s dans `localStorage`. | Test : après 31 s simulées, `localStorage` contient un état plus récent que le précédent. | P0 |
| EXG-23 | Événementiel | Quand la page se ferme ou passe en arrière-plan, le système doit déclencher une sauvegarde immédiate, indépendante du cycle de 30 s. | Test : les événements `visibilitychange`/`beforeunload` déclenchent l'écriture. | P0 |
| EXG-24 | Ubiquitaire | Le système doit permettre l'export de la sauvegarde en une chaîne texte encodée base64 et son import inverse. | Test round-trip : export puis import reproduit l'état à l'identique. | P0 |
| EXG-25 | Ubiquitaire | Le système doit inscrire un numéro de version de schéma dans chaque sauvegarde. | Test : le champ `version` est présent et correspond à la version courante du code. | P0 |
| EXG-26 | Événementiel | Quand une sauvegarde d'une version de schéma antérieure est chargée, le système doit appliquer les migrations successives sans perte de progression avant de continuer. | Test : une fixture de sauvegarde v1 migrée vers la version courante conserve or/niveaux/Éclats connus. | P0 |
| EXG-27 | Indésirable | Si une sauvegarde est corrompue ou illisible, alors le système doit le signaler clairement et proposer une nouvelle partie sans écraser silencieusement la donnée existante avant confirmation. | Test : sauvegarde tronquée → message d'erreur, `localStorage` original intact tant que non confirmé. | P1 |
| EXG-45 | Indésirable | Si un import de sauvegarde contient une valeur non finie (NaN/Infinity), un champ positif reçu négatif, une valeur hors des bornes déclarées du schéma, ou une clé non reconnue (`__proto__`, `constructor`, `prototype` ou absente du schéma), alors le système doit rejeter l'import, ignorer les clés inconnues plutôt que les fusionner, et afficher un message d'erreur explicite. | Test : fixtures d'import avec `Infinity`, clé `__proto__`, champ négatif → import refusé, état courant intact. `[complété par le challenger, trou #4]` | P0 |
| EXG-46 | Ubiquitaire | Avant tout import ou toute nouvelle partie qui écraserait une sauvegarde existante **lisible**, le système doit copier la sauvegarde courante dans `sauvegarde.bak`, restaurable en un clic. Exception : si le principal est illisible (`OptionsImport.contenuCourant: null`), aucune copie n'est faite — un `.bak` valide n'est jamais écrasé par un principal corrompu ; l'écran d'erreur EXG-27 propose « restaurer » seulement si `restaurerSecours` réussit. `[complété par le challenger, trou #4]` `[complété par le challenger v9, N6]` | Test : import réussi puis clic « restaurer » recharge l'état d'avant import à l'identique. Test : principal tronqué à l'ouverture → `.bak` existant inchangé octet pour octet, aucune écriture de `.bak` ; bouton « restaurer » visible seulement si `restaurerSecours` réussit. `[complété par le challenger v9, N6]` | P0 |
| EXG-47 | Ubiquitaire | Le système ne doit jamais injecter un champ de sauvegarde (texte importé, futur nom personnalisé) dans le DOM comme HTML brut. | Revue de code : aucun `dangerouslySetInnerHTML`/`innerHTML` avec une donnée issue de la sauvegarde ; test avec charge `<img src=x onerror=...>` dans un champ texte → rendu échappé, aucun script exécuté. `[complété par le challenger, trou #4]` | P0 |
| EXG-48 | Événementiel | Quand un deuxième onglet du jeu s'ouvre, le système doit détecter l'onglet déjà actif (verrou par `BroadcastChannel` ou clé `owner` + heartbeat) et placer les onglets secondaires en lecture seule : tick arrêté, canvas arrêté, actions désactivées, bandeau visible. Quand le verrou se libère (fermeture propre du principal) ou expire (délai chiffré dans le code, > 60 s, `[complété par le challenger v9, N4]`), l'onglet secondaire doit reprendre la main automatiquement en rejouant le démarrage complet depuis le stockage (jamais l'état en mémoire, potentiellement périmé) : `importerTexte` du principal (branche EXG-27 comprise si le principal est illisible) puis `calculHorsLigne` avant de redémarrer sa propre boucle. Toute acquisition de verrou autre que le tout premier démarrage de l'application suit cette même branche de rejeu complet ; toute perte de verrou détectée sans acquisition (ex. `pageshow` depuis le bfcache avec un état périmé) fige l'onglet sans appeler `calculHorsLigne`. `[complété par le challenger, trou #5] [bloquant #2, tranché par l'utilisateur, challenge v8] [complété par le challenger v9, N3]` | Test : deux onglets ouverts → seul le premier écrit `localStorage`, le second affiche le bandeau, ne tick pas, ne dessine pas le canvas, actions désactivées. Test : fermeture propre du premier onglet → relais immédiat, le second relit le principal depuis le stockage, applique le hors-ligne, démarre sa propre boucle. Test : disparition du premier onglet sans fermeture propre (crash, perte réseau du heartbeat) → le second reste figé jusqu'à `expiration − 1 ms`, puis relaie. Test `pageshow` (retour depuis le bfcache) : l'onglet rejoue le démarrage complet plutôt que de réutiliser l'état en mémoire. Test principal tronqué au moment du relais : l'onglet secondaire fige, n'appelle pas `calculHorsLigne`, affiche EXG-27. `[complété par le challenger, trou #5] [complété par le challenger v9, N3/N4]` | P1 |

### 4.8 Fin de partie
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-28 | Événementiel | Le système doit placer le boss final dans une zone dédiée, accessible seulement si `ascensions ≥ N_ASCENSIONS_REQUISES` (constante fixée par le simulateur, T-14), combat chronométré selon EXG-16 ; quand ce boss est vaincu, le système doit afficher un écran de fin dédié (texte court, statistiques du run). `[complété par le challenger v2]` | Test : tentative d'accès à la zone du boss final avant `ascensions = N_ASCENSIONS_REQUISES` → zone inaccessible ; une fois le seuil atteint, la zone est accessible, le combat suit le timer de boss (EXG-16), et sa victoire affiche un écran de fin avec au moins durée totale, zone max, nombre d'Ascensions. | P1 |
| EXG-44 | Indésirable | Si la dernière Ascension requise (3 à 5, valeur exacte issue du simulateur) est atteinte et le boss final vaincu, alors le système doit marquer la partie terminée et empêcher tout nouveau prestige ou Ascension. | Test : état `partie_terminee = true` après victoire du boss final ; tentative de prestige après → refusée. `[complété par le challenger, trou #3]` | P0 |

### 4.9 Performance & rendu
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-29 | Optionnel | Si l'option « performance » est activée, alors le système doit cesser de dessiner les projectiles et impacts sur le canvas tout en conservant les dégâts calculés. | Test : option ON → aucun appel de dessin de projectile, DPS mesuré inchangé. | P1 |
| EXG-30 | Ubiquitaire | Le système ne doit exécuter aucune boucle de complexité proportionnelle à l'historique de jeu à chaque frame de rendu. | Test déterministe (pas de chronométrage, instable en CI, cf. EXG-52) : après 2 h de jeu simulées, le nombre de structures parcourues par le rendu à chaque frame reste borné par `N_PROJECTILES_MAX`, indépendamment de la durée écoulée depuis le début de la session. `[complété par le challenger, trou #13]` `[complété par le challenger v9, #13]` | P1 |
| EXG-52 | Ubiquitaire | Le système doit plafonner le nombre de projectiles actifs simultanés à `N_PROJECTILES_MAX = 200` (constante de rendu, propriété de T-21, `src/canvas/`, §8), avec dégradation silencieuse (suppression des plus anciens) au-delà, et viser un budget de rendu ≤ 4 ms par frame pour le canvas de combat. Le moteur `domain/` n'émet aucun événement « projectile » : le canvas dérive ses effets des écarts de compteurs de jeu (dégâts infligés, monstres tués) entre deux frames. `[complété par le challenger, trou #14] [complété par le challenger v2] [complété par le challenger v8, trou #13]` | Test : critère déterministe — scénario forçant plus de 200 écarts de compteur sur une frame → demandes de dessin > 200, dessins effectifs ≤ `N_PROJECTILES_MAX` (200), les plus anciens supprimés en premier. Le temps de frame mesuré en ms reste informatif, non bloquant en CI (instabilité machine connue). | P1 |

### 4.10 Accessibilité & responsive
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-31 | Ubiquitaire | Le système doit maintenir un contraste texte/fond conforme WCAG 2.2 AA (≥ 4.5:1 texte normal, ≥ 3:1 grand texte) sur tous les panneaux. | Test outillé (ex. axe-core) : 0 violation de contraste sur les écrans principaux. | P0 |
| EXG-32 | Ubiquitaire | Le système doit rendre disponible dans le DOM toute information affichée sur le canvas (PV du monstre courant, timer de boss). | Test : le DOM contient les mêmes valeurs numériques que l'état affiché au canvas. | P0 |
| EXG-33 | Ubiquitaire | Le canvas de combat doit être marqué décoratif (`aria-hidden="true"` ou équivalent) et ne porter aucune information exclusive. | Revue de code : attribut présent, audit lecteur d'écran ne perd aucune information de jeu. | P0 |
| EXG-34 | Ubiquitaire | Le système doit rester utilisable au clavier seul pour les actions critiques (sorts 1-6, confirmation prestige/Ascension, navigation entre panneaux). | Test : parcours clavier complet sans souris jusqu'au premier prestige. | P0 |
| EXG-35 | Ubiquitaire | Le système doit afficher une mise en page desktop en panneaux multiples et une mise en page mobile en pile verticale jouable, cibles tactiles ≥ 24 px hors barre de sorts (EXG-51). | Test visuel à 375 px et 1440 px de large ; mesure des cibles. | P1 |
| EXG-50 | Ubiquitaire | Le système doit détecter la préférence système `prefers-reduced-motion: reduce` et activer par défaut l'option « performance » (EXG-29) dans ce cas, réglable ensuite par le joueur. | Test : media query simulée à `reduce` → projectiles/impacts non dessinés dès le premier rendu, sans action du joueur. `[complété par le challenger, trou #10]` | P1 |
| EXG-51 | Ubiquitaire | La barre de sorts actifs doit offrir des cibles tactiles d'au moins 44×44 px sur mobile. | Test : mesure des zones cliquables de la barre de sorts à 375 px de large ≥ 44 px. `[complété par le challenger, trou #11]` | P1 |

### 4.11 Notation des nombres
| ID | Type | Énoncé | Critère d'acceptation | P |
| --- | --- | --- | --- | --- |
| EXG-36 | Ubiquitaire | Le système doit afficher les grands nombres en notation abrégée (K, M, B, T…) jusqu'au seuil défini en §9, puis en notation scientifique au-delà. | Test : 1 234 567 → « 1,23 M » ; 10^34 → notation scientifique. | P1 |
| EXG-37 | Indésirable | Si une valeur de jeu normale (hors dépassement transitoire) dépasse 1e300 au cours du développement, alors le simulateur doit le signaler comme condition de migration vers une bibliothèque de grands nombres (`break_infinity.js`). | Test : simulation longue durée du simulateur `idle-balance` ; alerte si une valeur dépasse 1e300. | P2 |

## 5. Données & modèle
Objets métier : Magicien (stats globales), École (niveau, production), Sort (actif, cooldown, école liée),
Zone, Vague, Monstre, Boss, Quête (inclut les succès, EXG fusion §3.2), Amélioration (or, multiplicateur),
Équipement (renommée, multiplicateur), Prestige (Éclats : bonus passif + arbre), Ascension (Points :
arbre permanent), Sauvegarde (état sérialisé versionné + `sauvegarde.bak`). Relations : une École débloque
un Sort ; une Zone contient des Vagues et un Boss ; un Boss vaincu débloque l'École suivante ; une Quête
accomplie crédite de la Renommée dépensée en Équipement ; un Prestige réinitialise le run, crédite des
Éclats (bonus passif, par cycle d'Ascension) et alimente l'arbre d'Éclats (par cycle d'Ascension, non
permanent) ; une Ascension réinitialise les Éclats possédés et remet à zéro l'arbre d'Éclats, crédite des
Points d'Ascension pour l'arbre d'Ascension permanent (jamais réinitialisé), et débloque la 6e école à la
1re occurrence. `[complété par le challenger v2]`

- **Source de référence** : contenu défini dans le code (fichiers TypeScript/JSON sous `src/donnees/`),
  aucune API externe, aucune licence tierce.
- **Volumes à 1 an** : quelques centaines d'entrées de contenu (écoles, sorts, zones, monstres, quêtes,
  équipements, textes) ; une sauvegarde de quelques Ko, exportable en base64.
- **Données sensibles** : aucune (pas de compte, pas d'email, pas de paiement).
- **Hors-ligne** : le jeu fonctionne intégralement sans réseau après le premier chargement (aucune synchro,
  aucun conflit possible — une seule source de vérité, `localStorage` du navigateur, protégée par un
  verrou multi-onglet, EXG-48). PWA installable explicitement hors périmètre V1 (§3.2).
- **Invariant de données** : aucune donnée de jeu (dégâts, or, PV) ne provient d'un appel réseau ou d'un
  LLM ; tout est calculé par le moteur pur `domain/` (cf. §9, invariant miroir de l'invariant nutrition de
  `nylnatosport`).
- **Invariant d'import** : aucune donnée importée n'est fusionnée sans validation de schéma (EXG-45) ni
  rendue en HTML brut (EXG-47) ; une sauvegarde de secours existe toujours avant écrasement (EXG-46).
  `[complété par le challenger, trou #4]`

## 6. Sécurité & vie privée
- **Authentification** : aucune (pas de compte). **Rôles** : aucun.
- **Autorisation par route/action** : sans objet — application statique, aucune route serveur, aucune API.
- **Isolation des données** : sans objet (une seule sauvegarde locale, un seul joueur, pas de RLS) ; le
  seul risque de collision est le multi-onglet, traité par un verrou applicatif (EXG-48).
- **Paiements** : aucun (hors périmètre §3.2).
- **Secrets** : aucun secret applicatif. Seul secret du projet : le jeton GitHub Actions pour le déploiement
  Pages, géré par GitHub, jamais en clair dans le dépôt.
- **Surface d'attaque locale** : l'import de sauvegarde est la seule entrée non fiable du système —
  validation par schéma (EXG-45), aucune valeur injectée en HTML (EXG-47), sauvegarde de secours avant
  écrasement (EXG-46). `[complété par le challenger, trou #4]`
- **Ce qui est relu par un agent lecture seule à chaque vague** : la sauvegarde/export (pas de fuite
  d'information hors du blob base64 attendu, pas de rendu HTML non échappé), le workflow GitHub Actions
  (pas de secret exposé dans les logs), et le respect des frontières §10.

## 7. UX / UI & accessibilité
**Principes (3 max)** : dense mais lisible (panneaux écoles + combat + sorts visibles d'un coup, comme la
référence) ; sombre, fantasy sobre ; jamais d'écran qui bloque la boucle (narration incluse, résumé
hors-ligne non bloquant EXG-53).

**Bibliothèque** : Tailwind CSS 4 + shadcn/ui. **Langue** : français seul en V1, clés i18n-ready (pas de
texte en dur hors fichiers de contenu `src/donnees/`). Note : `npm run equilibrage:empreinte` ne compare que
`src/donnees/constantes.ts` (§12) — un fichier de textes d'UI ajouté sous `src/donnees/` (ex. `donnees/textes-ui.ts`)
n'est donc pas couvert par cette commande ; seule la revue lecture seule et `grep` manuel en attestent.

**Disposition (tranchée en interview vague 2, 2026-09-23)** : desktop (1440 px) en 3 colonnes — écoles à
gauche, combat + barre de sorts au centre, améliorations/équipement/arbre d'Éclats/prestige à droite — avec
un bandeau haut pour les monnaies et la zone courante. Mobile (375 px) : combat + barre de sorts fixes en
haut, onglets Écoles / Améliorations / Prestige dessous. Canvas de combat en rendu **procédural
géométrique** (silhouettes, particules, traînées colorées par école) : aucun asset graphique en V1, des
sprites pourront remplacer ce rendu sans toucher au moteur.

**Heuristiques de Nielsen à surveiller** : visibilité de l'état du système (cooldowns, compteurs or/
renommée/Éclats toujours visibles) ; prévention des erreurs (confirmation à deux étapes avant tout reset
irréversible, EXG-21) ; reconnaissance plutôt que rappel (coûts et productions affichés en permanence, pas
à calculer de tête).

**Cible WCAG 2.2 AA** : contraste (EXG-31), taille de cible 24 px générale / 44 px barre de sorts (EXG-35,
EXG-51), focus visible non masqué, navigation clavier complète (EXG-34), `prefers-reduced-motion` respecté
par défaut (EXG-50, WCAG 2.3.1/2.2.2), pas de saisie redondante (aucun formulaire en V1 hors import de
sauvegarde).

**États obligatoires de chaque écran** : vide (nouvelle partie, aucun palier débloqué), chargement (lecture
de la sauvegarde), erreur (sauvegarde corrompue, EXG-27), succès (jeu courant), hors-ligne = état normal
d'usage (encart non bloquant au retour, EXG-4/EXG-53) — pas de bannière réseau, le jeu ne fait aucun appel
réseau après chargement.

### Narration — guide de ton
Décision validée en interview (§Validation) : **très petite histoire qui ne bloque jamais le joueur**,
ton familier, petits jeux de mots, humour, **explicitement pas un style « IA »** — pas de grandiloquence,
pas de tournures creuses, pas de listes à puces lissées dans les textes narratifs eux-mêmes.

| À faire | À éviter |
| --- | --- |
| Phrases courtes, une idée par ligne, adressées au joueur (« tu ») | Phrases-tunnels avec trois adjectifs empilés |
| Jeu de mots ciblé sur le thème magie/monstre (« l'École du Feu ne fait pas dans la demi-mesure ») | Emphase artificielle (« Préparez-vous à une aventure épique et inoubliable ! ») |
| Auto-dérision sur la lenteur idle assumée (« pendant ce temps, ton or continue d'affluer, lui au moins il bosse ») | Formules creuses type IA (« plongez dans un monde de magie et de mystère ») |
| Un défaut ou un tic par école/boss, pour la couleur | Personnages parfaits sans aspérité |
| Une ligne d'intro, une ligne par Ascension (palier de rupture de ton, pas de rallonge narrative) | Cinématique, dialogue à choix, texte bloquant la progression |

Portée des textes en V1 : nom + description courte par école/sort/zone/boss (1 ligne chacun), 1 ligne
d'intro, 1 ligne par Ascension, 1 texte de fin. Rédaction : §16 vague 3.

## 8. Performance & optimisation
Budgets génériques (site Vite statique) : LCP < 2,5 s, INP < 200 ms, poids initial < 1 Mo hors polices.
Points chauds spécifiques idle : le tick (coût constant, jamais O(n) sur l'historique, EXG-30), le calcul
hors-ligne (forme fermée obligatoire au-delà du seuil, EXG-3/EXG-4/EXG-49), le rendu canvas (option
performance, budget ≤ 4 ms/frame, plafond de projectiles, EXG-29/EXG-52).

### Structure des données (contrat, pas de valeurs)
Toute valeur numérique de cette section est une **graine du simulateur, non contractuelle** : elle amorce
`tools/idle-balance` (T-14) et sera remplacée par sa sortie avant tout code de contenu (T-15) — trou
bloquant #2 du challenge, tranché en interview. Les colonnes et formules ci-dessous sont le contrat ; les
nombres, non.

- **École** : `id | coût_base | croissance | production_base | palier_seuils[] | déblocage`. Coût du
  niveau n+1 : `Coût(n) = coût_base × croissance^n` (EXG-9). Palier : ×2 franchi à chaque seuil de
  `palier_seuils` (10/25/50/100, confirmé en interview).
- **Zone** : `id | PV_base_vague1 | croissance_vague | nb_vagues | mult_boss | timer_boss_s`. PV vague k :
  `PV(k) = PV_base_vague1 × croissance_vague^(k-1)` (EXG-15). PV boss : `PV_boss(z) = PV(nb_vagues) ×
  mult_boss`. Zone suivante : `PV_base_vague1(z+1) = PV_boss(z) × mult_zone_suivante` — `mult_zone_suivante`
  est une graine, non figée (la valeur ×87,9 composée observée en v1 générait un mur mathématique avant le
  boss 8 ; le simulateur doit trouver `(croissance_vague, mult_zone_suivante, mult_boss)` qui respecte les
  contraintes ci-dessous, pas l'inverse).
- **Amélioration (or)** et **Équipement (renommée)** : `id | coût_base | croissance | effet_mult | monnaie`.
  Coût du palier n+1 : même formule que les écoles (EXG-42, EXG-43). `effet_mult` s'applique en facteur
  dans la chaîne de DPS ci-dessous — source de croissance exponentielle attendue (trou #9).

### Chaîne complète des multiplicateurs de dégâts
```
DPS = Σ(niveau_école × production_base_école × palier_école)
      × mult_améliorations        (produit des effet_mult achetés, or — EXG-42)
      × mult_équipement           (produit des effet_mult achetés, renommée — EXG-43)
      × (1 + B × Éclats_possédés)^β   (bonus passif du prestige, forme sortie du simulateur — EXG-38)
      × mult_arbre_Éclats         (produit des nœuds achetés dans l'arbre d'Éclats, remis à 0 à
                                    l'Ascension — EXG-39)
      × mult_arbre_Ascension      (produit des nœuds achetés dans l'arbre d'Ascension, permanent — EXG-40)
```
`B`, `β` : constante et exposant du bonus passif (ou forme multiplicative équivalente), graines
`[à valider par simulation idle-balance]` — la **forme** elle-même (puissance vs produit) est une sortie du
simulateur, pas seulement `B`/`β` `[complété par le challenger v2]`.

### Autres constantes de formule `[complété par le challenger, trou #6]`
- `or_par_dégât_moyen` : or moyen obtenu par point de dégât infligé, utilisé par le calcul hors-ligne —
  graine `[à valider par simulation idle-balance]`.
- `mult_or_zone(z)` : multiplicateur d'or par zone, croissant, appliqué au gain par monstre — graine
  `[à valider par simulation idle-balance]`.
- Protection du hors-ligne : `Δt = clamp(horodatage_actuel − dernier_horodatage_sauvegardé, 0, H)`
  (EXG-49) — empêche tout crédit négatif ou NaN si l'horloge système recule.
- `N_ASCENSIONS_REQUISES` (3-5) et `PRESTIGES_PAR_ASCENSION` (5-8) : fourchettes secondaires sous la
  contrainte dure `20 ≤ N_ASCENSIONS_REQUISES × PRESTIGES_PAR_ASCENSION ≤ 30` ; couple fixé par le rapport
  T-14, utilisé par EXG-20/EXG-28/EXG-44. `[complété par le challenger v2]`
- `H` : plafond hors-ligne en heures, `H ∈ [8, 12]` (EXG-4/EXG-49), valeur fixée par T-14.
  `[complété par le challenger v2]`
- `N_PROJECTILES_MAX = 200` : plafond de projectiles actifs simultanés (EXG-52), constante de rendu propriété
  de T-21 — **pas** une sortie du simulateur d'équilibrage, déclarée dans `src/canvas/` et non dans
  `src/donnees/` (elle ne vient d'aucun rapport `idle-balance`, `equilibrage:empreinte` ne la vérifie pas).
  `[complété par le challenger v2] [complété par le challenger v8, trou #13]`

### Formules
- Dégâts au clic : `D_clic = base_clic × (1 + Σ bonus_améliorations)`, `base_clic = 1` `[à valider]`.
- Or par monstre tué : `Or = PV_monstre × or_par_dégât_moyen × mult_or_zone(z)` `[à valider]`.
- Éclats au prestige : `Éclats = floor(k × zone_max^α)`, `k` et l'exposant `α` `[à valider par simulation
  idle-balance]` — la **forme** (`zone_max^α`, pas `√zone_max`) est elle-même tranchée en interview
  (complément challenge v2, point #2) : doit produire des paliers compatibles avec 8-12 nœuds d'arbre + un
  bonus passif utile dès le 1er prestige, sur 20-30 prestiges.
- Points d'Ascension : `Points = floor(k_ascension × √Éclats_cumulés_à_vie)`, `k_ascension` `[à valider]`,
  disponible après `PRESTIGES_PAR_ASCENSION` prestiges (5-8, fourchette tranchée en interview, valeur exacte
  fixée par T-14).
- Hors-ligne (forme fermée) : `Or_horsligne = DPS_passif_actuel × or_par_dégât_moyen × min(Δt, H)`,
  `H ∈ [8, 12] h`, valeur fixée par le rapport T-14 `[complété par le challenger v2]`. Seule la portion
  passive (écoles) est comptée (EXG-5).
- Notation : entiers sous 10⁶, notation abrégée K/M/B/T/Qa/Qi… jusqu'à 10³³, notation scientifique
  au-delà ; migration vers `break_infinity.js` seulement si le simulateur mesure un dépassement de 10³⁰⁰
  en régime normal (EXG-37).

### Contraintes sur la sortie du simulateur (`idle-balance`)
La croissance inter-zone, les coûts, les paliers, **les formes des formules** et les constantes ci-dessus ne
sont pas fixés a priori : ce sont des **sorties** du simulateur, contraintes par :
- **Zones générées par une formule paramétrique sans borne** : aucun nombre de zones fixé a priori ; chaque
  run (entre deux prestiges consécutifs) atteint une zone strictement plus profonde que le run précédent.
  `[tranché en interview, complément challenge v2]`
- Rejouer le contenu déjà vu du run précédent est **2-3× plus rapide** ; le contenu neuf allonge la durée
  réelle du run. Durée réelle d'un run **stable ou croissante à 10 % près** — aucun run ne dure moins de
  90 % du précédent —, plancher **2 h**, plafond **24 h**.
  `[tranché en interview, complément challenge v2] [amendé par ADR-17 — « croissante » était inatteignable]`
- 1er sort actif ~5 min, 1er mur ~1 h, **1er prestige en 2-3 h**.
- **Aucun blocage de progression > 90 min** avant le 1er prestige — « blocage » = intervalle sans aucune
  zone gagnée. Le mur au sens littéral « aucun achat abordable » est mesuré séparément, à titre de garde
  secondaire (15 min), car il ne dépasse jamais 0,5 min en pratique. `[seuil confirmé par T-14, ADR-17]`
- Contrainte dure : **20 ≤ prestiges_total ≤ 30**, répartis en une fourchette **3-5 Ascensions** ×
  **5-8 prestiges** par Ascension (`N_ASCENSIONS_REQUISES` × `PRESTIGES_PAR_ASCENSION`) ; le simulateur
  choisit un couple compatible avec la borne dure. `[complété par le challenger v2]`
- Cible mesurable de durée totale : **≥ 40 h de jeu cumulé en simulation continue** — métrique du
  simulateur ; le hors-ligne (plafonné à `H` heures, EXG-4) existe comme fonctionnalité produit mais
  n'entre pas dans cette mesure.
- Toute valeur de jeu normale reste **< 1e300** (EXG-37).

**Les formes des formules sont elles-mêmes des sorties**, pas seulement leurs constantes
`[tranché en interview, complément challenge v2]` :
- `Éclats = floor(k × zone_max^α)` (prestige, EXG-18).
- Bonus passif du prestige `(1 + B × Éclats_possédés)^β`, ou forme multiplicative équivalente (EXG-38).
- Au moins un nœud répétable à rangs infinis à coût croissant dans chaque arbre (Éclats EXG-39, Ascension
  EXG-40).

`tools/idle-balance` (T-14, vague 1) cherche un jeu de constantes **et de formes** qui satisfait ces
contraintes et produit un rapport chiffré ; ce rapport fixe aussi les constantes de fin
`N_ASCENSIONS_REQUISES`, `PRESTIGES_PAR_ASCENSION` et `H`, et remplace les graines ci-dessus dans
`donnees/` (T-15, vague 1).

### Budget de calcul
Coût du tick constant (indépendant du nombre de ticks écoulés) ; aucune boucle O(n) sur l'historique de
jeu par frame (EXG-30) ; forme fermée obligatoire pour le hors-ligne au-delà du seuil `nTicksMax` (EXG-3) ; entiers
JS natifs (`number`) tant que < 10³⁰⁰, arrondis d'affichage à 2-3 chiffres significatifs en notation
abrégée ; budget de rendu ≤ 4 ms/frame et plafond `N_PROJECTILES_MAX = 200` sur le canvas (EXG-52).

## 9. Architecture & stack
| Couche | Choix | Version | Pourquoi | Alternatives écartées |
| --- | --- | --- | --- | --- |
| Build | Vite | 6.x | Site statique, démarrage rapide, convention du thème 7 de l'interview | Webpack/CRA (plus lourds, hors convention) |
| UI | React | 19 | Imposé par l'interview | — |
| Langage | TypeScript | 5.x strict | Convention `nylnatosport`, sécurité des formules de jeu | JavaScript seul (pas de garde-fou sur les types de jeu) |
| Styles | Tailwind CSS + shadcn/ui | 4.x | Imposé par l'interview, dense et rapide à composer | CSS modules maison (plus lent à produire) |
| Pont état / React | Zustand 5 en store vanilla (`createStore`) | ADR-19 | Le tick à 100 ms doit éviter un re-render global à chaque pas ; souscriptions sélectives nécessaires | Context + `useReducer` naïf (re-render global à chaque tick) ; Redux (boilerplate disproportionné pour ce périmètre) |
| Rendu combat | Canvas 2D natif | — | Suffit pour projectiles/impacts, cohérent avec la référence (HTML5 simple) | PixiJS/Phaser (poids et complexité disproportionnés pour V1) |
| Validation d'entrée | `zod` (ou équivalent) | à fixer T-9 vague 1 | Schéma déclaratif pour valider l'import de sauvegarde (EXG-45), rejette clés inconnues et valeurs hors bornes | Validation manuelle ad hoc (plus sujette à oubli, moins lisible, risque de prototype pollution) |
| Tests | Vitest | convention `nylnatosport` | Rapide, déjà standard du thème 7 | Jest (redondant avec la convention) |
| Sauvegarde | `localStorage` + JSON versionné + export base64 + `.bak` | — | Suffisant pour quelques Ko, aucune requête nécessaire | IndexedDB (overkill pour ce volume) |
| Verrou multi-onglet | `BroadcastChannel` natif | — | API navigateur standard, aucune dépendance | Polling `localStorage` seul (plus fragile, latence) |
| Grands nombres | `number` natif + notation abrégée maison | — | Suffit tant que < 10³⁰⁰ (cf. §8) | `break_infinity.js` dès V1 (prématuré, à réévaluer si le simulateur le déclenche) |
| Hébergement | GitHub Pages via GitHub Actions sur `main` | — | Statique, gratuit, décidé en interview (dépôt public MIT) | GitHub Pages sur dépôt privé (nécessite GitHub Pro) |

### Structure des dossiers
```
idlev1/
  src/
    domain/            # moteur pur, AUCUN import react/dom — testable en isolation
      ecoles/
      sorts/
      zones/
      monnaies/
      ameliorations/
      equipement/
      prestige/
      ascension/
      sauvegarde/
      types.ts
      moteur.ts         # tick(), appliquerDelta(), calculHorsLigne()
    state/              # pont React <-> domain (store), seul endroit qui connaît les deux mondes
    components/         # panneaux UI (écoles, sorts, HUD, confirmations)
    canvas/             # rendu combat (projectiles, impacts), option performance
    donnees/            # contenu : écoles, zones, monstres, quêtes, équipements, textes narratifs
    styles/
  tools/
    idle-balance/       # simulateur d'équilibrage (T-14)
  tests/
    domain/             # miroir de src/domain, tests critiques (moteur, formules)
    migrations/         # fixtures de sauvegardes anciennes versions
  scripts/
    verify.sh
  docs/
    specs/
```

### Conventions fortes
Nommage français (fichiers, identifiants métier), calqué sur `nylnatosport`. `domain/` ne doit **jamais**
importer `react` ni le DOM (invariant vérifié par `verify.sh`, cf. §12, par analogie avec l'anti-duplication
du socle de calcul de `nylnatosport`). Tests co-localisés sous `tests/domain/` en miroir de `src/domain/`.
Toute migration de sauvegarde est accompagnée d'une fixture dans `tests/migrations/` — jamais supprimée.

## 10. Frontières pour les agents
- **Toujours** : lire cette spec et `CLAUDE.md` avant de coder ; lancer `scripts/verify.sh` avant de dire
  fait ; garder `domain/` pur (aucun import React/DOM) ; committer sur une branche, jamais sur `main`
  directement ; documenter toute nouvelle constante d'équilibrage dans le rapport idle-balance et
  `src/donnees/` et relancer le simulateur (`npm run equilibrage:search`) ; dater et versionner toute
  modification de cette spec. `[complété par le challenger v2]`
- **Demander d'abord** : installer une nouvelle dépendance npm ; **supprimer un fichier** ; modifier le
  format de sauvegarde (bump de version de schéma) sans écrire la migration correspondante ; changer une
  formule d'équilibrage déjà validée par simulation ; pousser une branche vers `origin`.
- **Jamais** : `git push --force` ; `git reset --hard` ; push direct sur `main` ; toucher aux secrets
  GitHub ou au workflow de déploiement sans le signaler explicitement ; livrer du code hors périmètre
  §3.2 (multijoueur, monétisation, app native, panneau de succès séparé) ; supprimer une fixture de
  migration de sauvegarde.

## 11. FinOps
- **Produit** : aucun usage de LLM en production — le jeu est 100 % statique, zéro appel réseau après
  chargement, zéro coût d'inférence à l'exécution.
- **Agents de développement** : « capacité d'abord » (décision interview). Règle **restreinte et explicite**
  (trou #12 du challenge) : Opus pour tout module `domain/` qui porte une **formule de jeu** (tick,
  écoles, zones, prestige, Ascension, améliorations/équipement, condition de fin) ou le **simulateur**
  d'équilibrage, ainsi que pour la **sauvegarde** (intégrité, sécurité de l'import — erreurs coûteuses à
  corriger après coup) ; Sonnet pour la logique `domain/` mécanique sans formule (verrou multi-onglet,
  notation d'affichage, injection de valeurs, scripts), l'UI, le contenu et le CI. Concrètement en vague 1 :
  T-1 à T-8, T-10, T-13, T-14 en Opus ; T-9, T-11, T-12, T-15, T-16, T-17 en Sonnet (voir §16). Le modèle
  « Fable » (mentionné en interview) reste **à justifier par écrit** avant tout usage — pas de valeur par
  défaut. `CLAUDE_CODE_SUBAGENT_MODEL` proposé : Opus pour les rôles `implémenteur-domaine` (tâches à
  formule) et `équilibrage-simulateur`, Sonnet pour les autres rôles.
- **Extension vague 2** (challenge v8, trou #15) : la règle « Opus pour la sauvegarde » couvre l'intégrité
  et la sécurité de l'import quelle que soit la couche qui les porte, pas seulement `src/domain/sauvegarde/`.
  `implementeur-domaine` n'écrit jamais dans `src/state/` (§9) ; la tâche qui branche réellement la
  persistance, le verrou multi-onglet et l'ordre de démarrage (**T-23a**) est donc confiée à
  `implementeur-ui`, avec le **modèle Opus forcé** pour cette tâche précise — erreurs coûteuses à corriger
  après coup, même logique que pour `domain/sauvegarde`. Le reste de `src/state/` (T-18, T-19… T-23b) reste
  Sonnet.

### Estimation de coût du chantier (ordre de grandeur, hypothèses posées) `[complété par le challenger, trou #12]`
- 32 tâches au total (§16, v10) : **13 Opus**, **18 Sonnet**, **1 sans modèle** (T-18-agent : tâche méta de
  création de l'agent `implementeur-ui`, aucune exécution de modèle facturée). Hypothèse : ~150k tokens en
  moyenne par tâche Opus (domaine/formules/sauvegarde/simulateur/revue, itérations incluses), ~60k tokens
  par tâche Sonnet (UI, contenu, CI, logique mécanique), tarifs standard de la plateforme Claude.
  `[complété par le challenger v9, N9]`
- Opus : 13 × 150k ≈ 1,95 M tokens. Sonnet : 18 × 60k ≈ 1,08 M tokens. Total ≈ **3,0 M tokens** sur le
  chantier complet, hors itérations de correction post-revue (non comptées ici). `[complété par le
  challenger v9, N9]`
- Ordre de grandeur dominé par les 13 tâches Opus (domaine, formules, sauvegarde, simulateur, T-23a, revue
  finale) — cohérent avec « capacité d'abord » ; à recaler après la vague 1 avec la consommation réelle
  mesurée (pas encore fait : cette estimation n'a pas été révisée depuis la fin de la vague 1).
- Vague 2 (challenge v8, trou #15) : **T-23a** bascule en Opus (persistance/verrou, cf. ci-dessus) — la
  vague 2 compte donc un Opus de plus et un Sonnet de moins que dans un découpage naïf « toute l'UI en
  Sonnet ». Le chiffrage ci-dessus (13 Opus / 18 Sonnet / 1 sans modèle, ≈ 3,0 M tokens) intègre déjà ce
  basculement ; il devra être recalé avec la consommation mesurée en vague 1 et vague 2.

### MCP autorisés (≤ 5) `[complété par le challenger, trou #12]`
- `context7` — documentation à jour Vite / React 19 / Tailwind 4 / shadcn/ui. Seul MCP nécessaire : le
  projet est 100 % statique sans backend, pas de base de données, pas de paiement, pas de déploiement
  externe à outiller (1 MCP utilisé sur 5 autorisés).

- Revue lecture seule à chaque vague (§16), `CLAUDE.md` du projet à garder court (< 200 lignes) une fois
  écrit, pour rester dans le cache de contexte.

## 12. Qualité & vérification
| EXG | Preuve (test, commande, parcours) |
| --- | --- |
| EXG-1 à EXG-5, EXG-49, EXG-53, EXG-55 (tick, hors-ligne, Δt, résumé, onglet caché) | `tests/domain/tick.test.ts`, `tests/domain/hors-ligne.test.ts` ; EXG-55 et EXG-53 : vague 2, T-23a (détection + crédit unique) / T-23b (encart `role="status"`) |
| EXG-6 à EXG-10, EXG-54 (monnaies, générateurs, déblocage, quêtes) | `tests/domain/ecoles.test.ts`, `tests/domain/quetes.test.ts` |
| EXG-11 à EXG-14 (sorts actifs) | `tests/domain/sorts.test.ts` + test clavier/tactile UI (vague 2) |
| EXG-15 à EXG-17 (zones/boss) | `tests/domain/zones.test.ts` |
| EXG-18 à EXG-21, EXG-38 à EXG-41 (prestige/ascension, arbres, 6e école) | `tests/domain/prestige.test.ts`, `tests/domain/ascension.test.ts` |
| EXG-42, EXG-43 (améliorations/équipement, multiplicateurs) | `tests/domain/ameliorations.test.ts`, `tests/domain/equipement.test.ts` |
| EXG-24 à EXG-26, EXG-45 (sauvegarde, sécurité import) | `tests/domain/sauvegarde.test.ts`, `tests/migrations/*.test.ts`, fixtures malveillantes |
| EXG-27, EXG-46 (sauvegarde corrompue, `.bak`) | **vague 2, T-23a** : test navigateur — principal tronqué → message, `localStorage` identique octet pour octet après 31 s et `hidden` ; `.bak` valide jamais écrasé par un principal illisible ; « restaurer » recharge l'état d'avant import. `[complété par le challenger v8, trou #6]` |
| EXG-47 (jamais de HTML brut depuis la sauvegarde) | `[complété par le challenger v8, trou #8]` rattachée à **T-19** : test navigateur (nom d'école/texte d'erreur hostile → rendu en texte littéral, aucun `<img>`, `window.__x` indéfini) + `grep -E 'dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML' src/` dans `scripts/verify.sh`, vu rouge une fois sur une injection volontaire avant d'être corrigé |
| EXG-22, EXG-23 (auto-sauvegarde 30 s, sauvegarde événementielle) | **vague 2, T-23a** : indémontrables depuis `domain/`, qui n'a accès ni au stockage ni à l'horloge ; le moteur n'en porte que la constante d'intervalle et la politique `.bak` `[corrigé par la revue de vague 1]`. « Écriture » = un `setItem` sur la clé `magic-battle:sauvegarde` observé après la fin du démarrage (les écritures du démarrage lui-même — sauvegarde initiale, battements du verrou — ne comptent pas dans ce total). Preuve par comptage d'écritures : 0 écriture à 29,9 s, 1 à 31 s ; 0→1 sur `hidden` et sur `pagehide` ; 0 dans l'onglet secondaire ; toute clé écrite porte le préfixe `magic-battle:` ; fixtures `magic-battle:reglages` hostiles (JSON invalide, type inattendu) vues rouges avant validation (ADR-21). `[complété par le challenger v8, trou #4]` `[complété par le challenger v9, N7]` |
| EXG-48 (verrou multi-onglet, onglet secondaire figé) | politique pure : `tests/domain/verrou.test.ts` ; transport `BroadcastChannel` et preuve « seul le premier onglet écrit » : vague 2, **T-23a** (détection, expiration, relais par relecture du stockage) et **T-23b** (bandeau, actions désactivées à l'écran). `[complété par le challenger v8, trou #5]` |
| EXG-28, EXG-44 (fin de partie) | `tests/domain/fin.test.ts`, test d'intégration UI (vague 3) |
| EXG-29, EXG-30, EXG-52 (performance/rendu) | test `canvas/`, revue de code (aucune boucle O(n) par frame), mesure de frame CI |
| EXG-31 à EXG-35, EXG-50, EXG-51 (accessibilité/responsive) | audit outillé (axe-core) sur la liste d'états auditée par T-22 (vide, chargement, erreur, succès, résumé hors-ligne, confirmation prestige/Ascension, bandeau lecture seule) : `violations = 0` **et** `incomplete` de la règle `color-contrast` = 0 (axe classe certains contrastes douteux en `incomplete`, pas en `violations` — un `incomplete` non nul laisse passer un vrai défaut) ; test clavier ; test visuel 375/1440 px avec assertions de mise en page, mesure de toutes les cibles tactiles. `[complété par le challenger v8, trou #12]` |
| EXG-36, EXG-37 (notation) | `tests/domain/notation.test.ts`, sortie de `tools/idle-balance` |

Commandes : `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` (vitest) ·
`npm run equilibrage:check` (rejoue les constantes archivées par T-14 contre les contraintes §8, < 10 s ;
échoue si un mur dépasse le seuil ou si la fenêtre de durée totale — ≥ 40 h cumulées — est ratée ; c'est
cette commande qui tourne dans `verify.sh` et le hook Stop) · `npm run equilibrage:search` (recherche
complète de nouvelles constantes/formes, manuelle, lancée par T-14 et le skill `equilibrage-pass`, jamais
dans `verify.sh` ni le hook Stop) · `bash scripts/verify.sh` (enchaîne build/lint/typecheck/test/
`equilibrage:check`, même politique « ignoré proprement si l'outillage manque » que `nylnatosport`). Porte
de qualité : **hook Stop bloquant sur `equilibrage:check`**, oui, comme `nylnatosport`.
`[complété par le challenger v2]`

Tests UI en navigateur (ADR-20) : Vitest browser mode + Playwright (Chromium) + `@testing-library/react` +
`axe-core`, exécutés dans `npm test` — c'est ce qui prouve les critères de T-18 à T-23b (renders, cibles
24/44 px, clavier, contraste). jsdom écarté : pas de mise en page réelle, ces mesures n'y prouveraient rien
(LRN-004). Conséquence : Chromium doit être disponible en CI, donc `.github/workflows/` est modifié — geste
soumis à « Demander d'abord » (§10) au moment de le faire.

L'absence de Chromium sur la machine est un **ÉCHEC** de `verify.sh`, `--strict` ou non — aucun chemin de
saut des tests navigateur, jamais : la politique de tolérance à l'outillage absent (§9, comme
`nylnatosport`) ne s'applique pas aux tests UI en navigateur une fois T-18a livré, et le mode non strict
n'y fait pas exception. Un test qui ne peut pas s'exécuter n'est pas une preuve. En CI, le binaire Chromium
est mis en cache entre exécutions (coût d'installation payé une fois). Le hook Stop qui bloque sur
`verify.sh` (§12) porte un budget de temps explicite pour les tests navigateur : au-delà, le hook échoue
plutôt que d'attendre indéfiniment — valeur du budget à fixer par T-18a en fonction du temps réel mesuré,
non inventée ici. `[complété par le challenger v8, trou #15]` `[complété par le challenger v9, N9]`

Revue lecture seule : un agent dédié relit, à chaque vague, la pureté de `domain/` (aucun import React),
le workflow GitHub Actions (aucun secret exposé), la sécurité de l'import de sauvegarde (§6) et — vague 3 —
le respect du guide de ton narratif (§7, aucun texte « style IA »).

## 13. Savoir-faire à capitaliser (skills prévus)
| Skill | Déclencheur (phrase utilisateur) | Ce qu'il contient | Source / provenance |
| --- | --- | --- | --- |
| `ajouter-ecole-sort` | « Ajoute une école/un sort » | Ajout d'une entrée `donnees/ecoles`, du sort associé, des tests domain, relance du simulateur | Adapté de `ajouter-generateur` (module domaine idle-game) |
| `ajouter-zone-monstres` | « Ajoute une zone/un boss » | Ajout d'une zone (PV, vagues, boss, timer) dans `donnees/zones`, tests, mise à jour de la structure §8 | Spécifique au projet |
| `equilibrage-pass` | « Repasse l'équilibrage » / « recalcule les courbes » | Relance `tools/idle-balance`, compare avant/après, réinjecte le rapport dans `donnees/` | Module domaine idle-game |
| `sauvegarde-migration` | « Fais évoluer le format de sauvegarde » | Bump de version, fonction de migration, fixture de test associée, jamais de perte de progression | Module domaine idle-game |

## 14. Risques & questions ouvertes
Seules les questions encore réellement ouvertes après les compléments d'interview (§Changements). Les
autres (valeurs de courbes, N prestiges avant Ascension, plafond hors-ligne exact, nombre/profondeur des
zones — formule sans borne —, formes des formules et bornes des arbres, détail équipement) sont désormais
résolues **structurellement** : ce sont des sorties du simulateur (§8) ou du contenu de vague 3, pas des
arbitrages stratégiques restant à trancher.

| Risque / question | Impact | Plan B ou décision attendue | Qui tranche, quand |
| --- | --- | --- | --- |
| Noms définitifs des écoles/sorts/zones/boss/équipements | Le tableau §8 et le code utilisent des noms de travail (Feu, Glace…) | Rédaction du guide de ton et du contenu en vague 3 | Vague 3 |
| ~~Palette de contraste exacte (couleurs sombres + fantasy)~~ **résolu** | — | Charbon neutre (thème shadcn `neutral` sombre) + un accent par école ; la couleur ne porte jamais seule une information (icône + libellé toujours associés) ; jetons CSS dans `src/index.css` ; deux vérificateurs de nature différente (LRN-004) : script de ratios sur les paires de jetons dans `verify.sh` et audit axe-core sur les écrans rendus | Tranché, vague 2 (interview 2026-09-23) |
| ~~Store React définitif (Zustand ou équivalent)~~ **résolu** | — | Zustand en store vanilla (`createStore`), tick hors React, sélecteurs fins, canvas lisant `getState()` dans son rAF — ADR-19 | Tranché, vague 2 (interview 2026-09-23) |
| ~~Seuil exact de mur (minutes) pour faire échouer `verify.sh`~~ **résolu** | — | 90 min sur le **blocage de progression** (aucune zone gagnée) ; le mur « aucun achat abordable » ne dépasse jamais 0,5 min et n'est pas la métrique utile. Rapport T-14 du 2026-09-21 | Tranché, vague 1 (T-14) |

## 15. Décisions (ADR)
- **ADR-1** (2026-09-20) — Sauvegarde locale uniquement, pas de cloud. Raison : simplicité, cohérence avec
  la référence du genre (Cookie Clicker, Antimatter Dimensions), aucun serveur à opérer. Écarté : sync
  cloud (hors périmètre, complexité et coût disproportionnés pour un jeu gratuit statique).
- **ADR-2** (2026-09-20) — Deux couches de progression (Prestige en Éclats + Ascension). Raison : tenir 2
  semaines+ de contenu sans complexifier la boucle cœur au-delà du nécessaire. Écarté : une seule couche
  de prestige (ne tiendrait pas la durée visée) ; trois couches ou plus (trop complexe pour une V1 « jeu
  simple »).
- **ADR-3** (2026-09-20) — Rendu hybride Canvas 2D (combat) + DOM (UI). Raison : satisfaction visuelle des
  projectiles comme dans la référence, tout en gardant l'UI accessible et testable en DOM. Écarté : tout
  Canvas (accessibilité impossible sans dupliquer l'info) ; tout DOM (moins satisfaisant pour les
  projectiles, contredit le retour joueur de la référence).
- **ADR-4** (2026-09-20) — Dépôt GitHub public (MIT) + GitHub Pages via Actions sur `main`. Raison : Pages
  sur dépôt privé nécessite GitHub Pro, contredit l'hébergement gratuit visé. Écarté : dépôt privé
  (contradiction explicite relevée en interview, tranchée en faveur du public).
- **ADR-5** (2026-09-20) — Narration légère, jamais bloquante, ton familier explicitement anti-« style
  IA ». Raison : cohérent avec « jeu simple » et une durée de 2 semaines qui ne peut pas porter une
  histoire riche sans alourdir chaque session. Écarté : histoire riche à embranchements (contredit
  « simple » et le rythme visé).
- **ADR-6** (2026-09-20) — Store dédié séparé du moteur `domain/` pour le pont React (proposition
  Zustand ou équivalent, à confirmer en vague 2). Raison : le tick à 100 ms doit permettre des
  souscriptions sélectives sans re-render global. Écarté : Context + `useReducer` naïf (re-render global
  à chaque tick, mauvais pour la fluidité des cooldowns) ; Redux (boilerplate disproportionné ici).
- **ADR-7** (2026-09-20) — Tick 100 ms avec rattrapage par delta-time et bascule en forme fermée au-delà
  d'un seuil. Raison : équilibre entre réactivité des cooldowns (sorts) et coût de calcul du rattrapage
  après une longue absence. Écarté : tick 1 s (moins précis pour des cooldowns courts) ; simulation
  event-driven pure sans pas fixe (plus complexe à tester et à rendre déterministe).
- **ADR-8** (2026-09-20) — Éclats à double usage : bonus passif permanent + arbre de dépense. Raison :
  donne un sens immédiat même aux premiers Éclats (bonus passif) tout en gardant un choix stratégique
  cumulatif (arbre) — répond au trou bloquant #1 (gain d'Éclats défini, jamais son effet). Écarté : un
  seul usage — bonus plat seul (aucun choix stratégique) ou arbre seul (les premiers prestiges n'ont aucun
  effet perceptible, mauvais pour la motivation à prestiger tôt).
- **ADR-9** (2026-09-20) — Ascension = arbre de Points d'Ascension, 6e école débloquée à la 1re Ascension
  uniquement. Raison : distingue clairement Ascension de Prestige, donne un palier de contenu net (nouvelle
  école) tôt dans la méta-couche, cohérent avec le trou bloquant #3 (aucune tâche ne codait la condition de
  fin ni la progression Ascension). Écarté : 6e école débloquée par un mur d'or classique (redondant avec
  la zone 8, n'exploite pas la 2e couche de méta).
- **ADR-10** (2026-09-20) — Les valeurs de §8 sont une sortie du simulateur, jamais un tableau figé avant
  rapport. Raison : la v1 contenait des tableaux manuels qui produisaient un mur mathématique non détecté
  (croissance inter-zone composée ×87,9, trou bloquant #2) — le pire échec du §1 (équilibrage raté)
  s'appliquait à la spec elle-même. Écarté : valeurs manuelles ajustées itérativement en cours de dev
  (corrections coûteuses après coup, contenu déjà écrit autour de nombres faux).
- **ADR-11** (2026-09-20) — Succès fusionnés aux quêtes, pas de panneau séparé. Raison : réduit la surface
  UI et le contenu à rédiger sans perdre la mécanique (une quête peut jouer le rôle d'un succès) ; répond
  au trou majeur #9 (améliorations/succès présents dans le modèle sans EXG ni tâche). Écarté : système de
  succès indépendant (double contenu à équilibrer et rédiger pour un gain de jeu marginal).
- **ADR-12** (2026-09-20) — Cible de durée mesurée en heures de jeu cumulées (≥ 40 h de simulation
  continue), pas en jours calendaires. Raison : « 14 jours » mélangeait sessions réelles et hors-ligne,
  invérifiable par un simulateur sans horloge réelle (trou bloquant #1 du challenge v2) ; 40 h cumulées est
  une métrique que `idle-balance` peut mesurer directement. Écarté : garder « 14 jours » comme contrainte
  dure (invérifiable en simulation) ; mesurer en jours simulés à raison de X h/jour (ajoute un paramètre
  arbitraire non tranché).
- **ADR-13** (2026-09-20) — Zones générées par formule paramétrique sans borne, chaque run strictement plus
  profond que le précédent. Raison : un nombre de zones fixé a priori ne peut pas garantir 40 h cumulées
  sans mur ni répétition ennuyeuse ; le run₁ × facteur 2-3 seul convergeait vers ~5 h, pas 40 h (trou
  bloquant #1) — laisser la profondeur croître par run est la seule façon de tenir la durée sans rédiger un
  contenu infini. Écarté : nombre de zones fixe avec scaling infini dans la dernière zone (moins lisible
  pour le joueur, casse la sensation de progression par zone).
- **ADR-14** (2026-09-20) — Arbre d'Éclats remis à zéro à chaque Ascension (Éclats possédés et nœuds de
  l'arbre) ; seul l'arbre d'Ascension est permanent. Raison : lève l'ambiguïté du trou majeur #3 du
  challenge v2, où « permanent » contredisait le reset des Éclats à l'Ascension (EXG-20 vs §3.1/§5) ;
  distingue clairement les deux échelles de temps (cycle d'Ascension vs partie entière). Écarté : conserver
  l'arbre d'Éclats entre Ascensions (rend les Ascensions ultérieures triviales, contredit la 2e couche de
  méta voulue en ADR-2).
- **ADR-15** (2026-09-20) — Les formes des formules (exposants, puissance vs produit, nœuds répétables à
  rangs infinis) sont des sorties du simulateur, pas seulement leurs constantes. Raison : des arbres bornés
  et un bonus linéaire en Éclats laissent un espace de recherche vide pour atteindre les multiplicateurs
  visés sur 20-30 prestiges (trou bloquant #2 du challenge v2) ; le simulateur doit pouvoir choisir la forme
  (`zone_max^α`, `(1+B×Éclats)^β` ou multiplicatif équivalent) en plus des valeurs. Écarté : figer les
  formes a priori et ne faire varier que les constantes (c'est précisément ce qui produisait l'espace de
  recherche vide, cause du trou bloquant).
- **ADR-16** (2026-09-21) — Le reset de prestige (EXG-19) remet à zéro les **paliers d'améliorations**
  (achetés en or) et **laisse survivre les paliers d'équipement** (achetés en Renommée). Raison : EXG-19
  n'énumérait que zone, or et niveaux d'écoles, mais T-6 devait trancher le sort des deux guichets de
  multiplicateurs de T-8. Côté équipement le choix est forcé : la Renommée vient de quêtes-jalons
  explicitement non répétables (EXG-54), donc un équipement remis à zéro serait définitivement
  irrécupérable et le joueur perdrait du contenu à chaque prestige. Côté améliorations, l'or est la monnaie
  du run (il est lui-même remis à zéro) : garder ses paliers viderait le prestige de son sens de reset et
  donnerait au simulateur une courbe sans point de rupture. Règle générale qui en découle, valable pour
  tout futur guichet : **un achat se réinitialise avec la monnaie qui l'a payé**. Écarté : tout remettre à
  zéro (perte sèche de Renommée non regagnable, contredit EXG-54) ; tout conserver (le prestige ne
  réinitialise plus rien de la chaîne de DPS, contredit l'intention d'ADR-2 et d'ADR-8).
- **ADR-17** (2026-09-21) — La durée réelle d'un run est exigée **stable ou croissante à 10 % près**
  (aucun run ne dure moins de 90 % du précédent ; plancher 2 h, plafond 24 h) au lieu de **croissante**.
  La tolérance est explicite plutôt qu'implicite : « non décroissante » au sens strict serait à son tour
  inatteignable, la durée oscillant de quelques pour cent d'un run au suivant selon l'ordre des achats. Raison : le simulateur
  (T-14) démontre que la croissance est un point fixe du design, pas un réglage. La durée d'un run vaut
  `D = patience × g/(g−1)`, où `g` est le facteur de croissance du temps par zone ; les multiplicateurs de
  méta-progression déplacent la **zone atteinte**, pas la durée, donc `D` ne dépend pas du numéro de run.
  Mesure : 2,38 h → 2,88 h sur 28 runs, pente ×0,9991 ; 18 designs alternatifs rejoués par le script
  donnent des pentes de ×0,985 à ×1,007. La seule politique qui fait croître les durées (prestiger au
  doublement du stock d'Éclats) les projette à 260-270 h par run, hors du plafond de 24 h, et réduit la
  partie à 2-5 runs. L'**objectif** de la contrainte est néanmoins atteint avec une large marge : elle
  avait été écrite pour garantir ≥ 40 h sans mur ni répétition ennuyeuse (trou bloquant #1 du challenge
  v2), et la mesure donne **72,28 h**. Écarté : ajouter au moteur une source de croissance progressive
  (paliers d'école à seuils illimités) — coût réel (types, schéma de sauvegarde, recherche complète à
  refaire) pour satisfaire la lettre d'un mécanisme dont l'objectif est déjà dépassé, avec un risque de
  débordement mesuré sur ce terrain précis (porter le nombre de pistes d'amélioration de 2 à 3 projette la
  valeur maximale à 1,6e308, contre 5,22e173 aujourd'hui). Écarté aussi : assouplir en silence dans le
  simulateur — la dérogation est archivée dans `src/donnees/` sous `CONTRAINTES_NON_TENUES`, avec garde
  anti-péremption (un rouge non listé échoue, un vert encore listé échoue également). Rallonger le jeu plus
  tard ne demande pas de code : adoucir `g` (de 1,21 à 1,10 double presque `D`), monter le couple vers
  5 × 6 = 30, ou étaler le contenu par zone — trois leviers d'une seule passe `equilibrage:search`.
- **ADR-18** (2026-09-22) — Les fichiers **engendrés par un outil tiers** gardent le nom et la langue que
  cet outil leur donne (`src/components/ui/button.tsx`, `src/lib/utils.ts` pour shadcn/ui) ; la règle
  « nommage français » de §9 ne s'applique qu'au code écrit par le projet. Raison : la revue de fin de
  vague 1 a relevé la contradiction, et la trancher dans l'autre sens coûterait cher pour rien — renommer
  un composant shadcn casse la capacité du CLI à le mettre à jour (`npx shadcn add` réécrit le fichier à
  son nom amont), et on rejouerait l'arbitrage à chaque composant ajouté en vague 2. Frontière pratique :
  un fichier est « engendré » s'il est réécrit par une commande, jamais édité à la main — même famille de
  règle que `src/donnees/constantes.ts`, produit par le simulateur. Le code que le projet écrit autour
  reste en français, y compris quand il importe ces fichiers. Écarté : renommer et maintenir une couche
  d'adaptation (coût permanent, bénéfice cosmétique) ; laisser la contradiction ouverte (la vague 2
  arbitrerait dans les deux sens selon le fichier, ce que la revue reprochait précisément).
- **ADR-19** (2026-09-23) — Le store React (`state/`) est un store **Zustand vanilla** (`createStore`, pas
  le hook React seul) : le tick tourne hors React, les composants souscrivent par sélecteurs fins, et le
  canvas de combat lit l'état directement via `getState()` dans son propre `requestAnimationFrame`, sans
  passer par un re-render React. Raison : c'était la question ouverte de §14 (ADR-6 proposait Zustand sans
  l'avoir comparé en conditions réelles de tick 100 ms) ; le test de comptage de renders de T-18 (aucun
  re-render global du HUD à chaque tick) est la preuve que ce choix tient. Écarté : un banc comparatif
  formel avant de trancher (coût disproportionné pour une bibliothèque déjà choisie en ADR-6, seul le
  patron d'utilisation restait ouvert) ; un store maison sur `useSyncExternalStore` (c'est exactement ce que
  Zustand fait sous le capot — réécrire la même chose sans son écosystème de sélecteurs).
- **ADR-20** (2026-09-23) — L'outillage de test UI est **Vitest en mode navigateur + Playwright (Chromium)
  + `@testing-library/react` + `axe-core`** ; tous les tests d'interface (T-18 à T-23) tournent en vrai
  navigateur. Raison : les critères de done de T-18 à T-23 portent sur des mesures de mise en page réelle
  (cibles tactiles ≥ 24/44 px, comptage de renders, contraste, parcours clavier) — invérifiables sans mise
  en page. Écarté : jsdom (pas de mise en page réelle, les mesures 24/44 px n'y prouveraient rien, LRN-004).
  Conséquence assumée : Chromium doit tourner en CI, donc `.github/workflows/` est modifié — geste soumis à
  « Demander d'abord » (§10) au moment de le faire, pas couvert par cet ADR.
- **ADR-21** (2026-09-23) — Les réglages d'affichage (option « performance », EXG-29/EXG-50) vivent dans une
  clé `localStorage` séparée `magic-battle:reglages`, **hors sauvegarde**, gérée par `src/state/`, validée à
  la lecture (`try/catch`, seul le booléen `performance` est lu, jamais d'étalement d'objet non validé ; clé
  absente ou invalide → suit la media query `prefers-reduced-motion`). Toutes les clés `localStorage` et le
  nom du `BroadcastChannel` du verrou (EXG-48) sont préfixés `magic-battle:` : GitHub Pages partage
  l'origine entre dépôts, un préfixe évite toute collision avec un autre projet publié sur le même compte.
  `[complété par le challenger v8, trou #9]` Raison : ce sont des préférences de machine, pas de
  progression de jeu ; le format de sauvegarde (§9, EXG-24 à 27) reste inchangé, aucune migration
  nécessaire, le skill `sauvegarde-migration` reste différé. Conséquence assumée : les réglages ne voyagent
  pas avec l'export/import de sauvegarde (EXG-24) — voulu, pas un oubli. Écarté : stocker les réglages dans
  la sauvegarde principale (les ferait voyager entre machines via l'export, contredit « préférence de
  machine » et forcerait une migration de schéma pour un champ qui n'est pas de la progression) ; clés
  `localStorage` non préfixées (risque de collision d'origine sur GitHub Pages, trou #9).

## 16. Livraison par vagues

### Vague 1 — Moteur & équilibrage (risque n°1)
Objectif utilisable : un simulateur `idle-balance` exécutable en CLI qui rejoue une partie type, rapporte
murs/temps de prestige et injecte ses valeurs dans le contenu, un moteur `domain/` pur avec la boucle
complète (écoles, sorts, zones, prestige+arbre d'Éclats, Ascension+arbre+6e école, améliorations,
équipement, quêtes/Renommée, sauvegarde sécurisée, condition de fin), entièrement testé — sans UI
graphique — et le déploiement Pages fonctionnel dès la fin de vague (preview par vague, trou #15).

| T | Tâche | EXG couvertes | Agent | Modèle | Done quand |
| --- | --- | --- | --- | --- | --- |
| T-1 | `domain/types.ts` : Magicien, École, Sort, Zone, Vague, Monstre, Boss, Quête, Amélioration, Équipement, Prestige, Ascension, Sauvegarde | fondation | implémenteur-domaine | Opus | `npm run typecheck` passe sur `domain/types.ts` ; revue lecture seule confirme la couverture des objets §5 |
| T-2 | Tick + delta-time + bascule forme fermée + hors-ligne + protection `Δt` | EXG-1 à 5, EXG-49 | implémenteur-domaine | Opus | `tests/domain/tick.test.ts` et `tests/domain/hors-ligne.test.ts` verts, y compris le cas horloge reculée |
| T-3 | Écoles : coûts croissants, production, déblocage par boss + or | EXG-6 à 9 | implémenteur-domaine | Opus | `tests/domain/ecoles.test.ts` vert (structure §8, aucune valeur figée codée en dur) |
| T-4 | Sorts actifs (clic + cooldown, logique pure, pas de clavier ici) | EXG-11, 12 | implémenteur-domaine | Opus | `tests/domain/sorts.test.ts` (cooldown) vert |
| T-5 | Zones/vagues/boss chronométré | EXG-15 à 17 | implémenteur-domaine | Opus | `tests/domain/zones.test.ts` vert (structure §8, aucune valeur figée codée en dur) |
| T-6 | Prestige + arbre de dépense des Éclats (8-12 nœuds) + bonus passif | EXG-18, 19, 21, 38, 39 | implémenteur-domaine | Opus | `tests/domain/prestige.test.ts` vert, incluant bonus passif et arbre |
| T-7 | Ascension + arbre de Points d'Ascension + déblocage 6e école à la 1re | EXG-20, 21, 40, 41 | implémenteur-domaine | Opus | `tests/domain/ascension.test.ts` vert, incluant arbre d'Ascension (6-10 nœuds, ≥ 1 répétable), déblocage École de Lumière, et remise à zéro des Éclats possédés + des nœuds de l'arbre d'Éclats à l'Ascension (EXG-20) `[complété par le challenger v2]` |
| T-8 | Améliorations (or) et équipement (renommée) comme multiplicateurs de dégâts | EXG-10, 42, 43 | implémenteur-domaine | Opus | `tests/domain/ameliorations.test.ts` et `tests/domain/equipement.test.ts` verts, `mult_améliorations`/`mult_équipement` branchés à la chaîne DPS §8 |
| T-9 | Quêtes/Renommée (crédit de quête sur jalon), succès fusionnés aux quêtes | EXG-10, 54 | implémenteur-domaine | Sonnet | `tests/domain/quetes.test.ts` vert : aucune entité « succès » séparée, 3 types de jalons couverts (zone atteinte, monstres tués, 1er prestige), non-répétabilité vérifiée (rejouer le jalon ne crédite pas deux fois) `[complété par le challenger v2]` |
| T-10 | Sauvegarde : sérialisation, version, migration no-op v1, export/import base64, validation par schéma, `sauvegarde.bak`, anti-XSS | EXG-24 à 27, 45 à 47 (EXG-22 déplacée en T-23, `[corrigé par la revue de vague 1]`) | implémenteur-domaine | Opus | `tests/domain/sauvegarde.test.ts` vert, incluant fixtures malveillantes (Infinity, `__proto__`, négatif) rejetées et restauration `.bak` |
| T-11 | Verrou multi-onglet (`BroadcastChannel` + heartbeat) | EXG-48 | implémenteur-domaine | Sonnet | Test de verrou vert (simulation de deux instances, une seule écrit) |
| T-12 | Notation des grands nombres | EXG-36, 37 | implémenteur-domaine | Sonnet | `tests/domain/notation.test.ts` vert |
| T-13 | Condition de fin + boss final (domaine), lit `N_ASCENSIONS_REQUISES`/`PRESTIGES_PAR_ASCENSION` depuis `src/donnees/` — **s'exécute après T-15** malgré la numérotation `[complété par le challenger v2]` | EXG-28, 44 | implémenteur-domaine | Opus | `tests/domain/fin.test.ts` vert : `partie_terminee=true` après `ascensions ≥ N_ASCENSIONS_REQUISES` (lu depuis `donnees/`) et boss final vaincu dans sa zone dédiée (EXG-28), prestige/Ascension refusés ensuite |
| T-14 | `tools/idle-balance` : simulateur qui rejoue N heures de jeu optimal, cherche des constantes et des formes satisfaisant les contraintes de §8, fixe les constantes de fin (`N_ASCENSIONS_REQUISES`, `PRESTIGES_PAR_ASCENSION`, `H`), rapporte murs et durées | EXG-3, 4, 49, contraintes §8 | équilibrage-simulateur | Opus | Rapport chiffré archivé, incluant `N_ASCENSIONS_REQUISES`/`PRESTIGES_PAR_ASCENSION`/`H` ; `npm run equilibrage:search` échoue sur une fixture de constantes volontairement déséquilibrée (mur > 90 min ou durée totale < 40 h cumulées) `[complété par le challenger v2]` |
| T-15 | Injecter les valeurs issues du rapport T-14 dans `src/donnees/` (écoles, zones, améliorations, équipement, formules, constantes de fin) | §8 | implémenteur-domaine | Sonnet | `donnees/*.ts` contiennent les valeurs du rapport T-14 y compris les constantes de fin ; aucune occurrence de « à valider »/« graine » dans `src/` (`grep` vide) `[complété par le challenger v2]` |
| T-16 | `scripts/verify.sh` (lint, typecheck, vitest, `npm run equilibrage:check`) + hook Stop | §12 | implémenteur-domaine | Sonnet | `bash scripts/verify.sh` vert sur le squelette complet ; `npm run equilibrage:check` s'exécute en < 10 s `[complété par le challenger v2]` |
| T-17 | Workflow GitHub Actions : build + déploiement Pages sur `main` (remonté ici pour preview par vague) | — | implémenteur-ci | Sonnet | Workflow vert en CI sur la branche (build + déploiement configurés) ; déploiement effectif sur GitHub Pages constaté après merge sur `main` par l'utilisateur (les agents ne poussent jamais sur `main`, §10) `[complété par le challenger v2]` |

Preuve de fin de vague : `bash scripts/verify.sh` vert, rapport `idle-balance` archivé, revue lecture seule
confirmant que `domain/` n'importe ni `react` ni le DOM et que l'import de sauvegarde est sécurisé (§6),
site de squelette (sans UI graphique) publié sur GitHub Pages.

### Vague 2 — UI & Canvas
Objectif : jouer réellement au clavier/souris/tactile, panneaux desktop + repli mobile, canvas de combat,
option performance (auto si `prefers-reduced-motion`), accessibilité de base, sauvegarde événementielle et
résumé hors-ligne non bloquant.

| T | Tâche | EXG couvertes | Agent | Modèle | Done quand |
| --- | --- | --- | --- | --- | --- |
| T-18-agent | Créer l'agent `implementeur-ui` (rôle, périmètre `src/state/`+`src/components/`+`src/canvas/`, modèle par défaut Sonnet). `implementeur-domaine` n'a pas le droit d'écrire dans `src/state/` (§11) : c'est pour ça que T-23a, et non un élargissement de `implementeur-domaine`, porte la persistance UI. | — | — (méta) | — | Fichier de config de l'agent `implementeur-ui` présent avant toute tâche T-18a-T-23b ; modèle par défaut Sonnet documenté, avec la dérogation Opus forcée de T-23a explicitement notée. `[complété par le challenger v8, trou #15]` |
| T-18a | Outillage de test UI (ADR-20) : Vitest browser mode + Playwright (Chromium) + `@testing-library/react` + `axe-core`, cache du binaire Chromium en CI, budget de temps du hook Stop pour les tests navigateur, absence de Chromium = échec en `--strict` (§12) | — | implementeur-ui | Sonnet | Un test navigateur trivial (rouge puis vert) tourne dans `npm test` et dans `bash scripts/verify.sh` ; `verify.sh --strict` sans Chromium installé échoue (test exprès sur machine sans binaire) ; le job CI restaure Chromium depuis le cache s'il est présent. `[complété par le challenger v8, trou #15]` |
| T-18 | Store pont React (`state/`) branché sur `domain/` (Zustand vanilla, tick hors React, sélecteurs fins — ADR-19), boucle de rendu, fabrique injectable `creerStoreJeu({ horloge, stockage, canal, matchMedia, idOnglet, portPage, portPlanificateur, etatInitial })` (aucune dépendance globale câblée en dur) avec deux ports dédiés : `portPage` (visibilité, `pagehide`, `pageshow`, `beforeunload`) et `portPlanificateur` (intervalles, `requestAnimationFrame`) — sans eux, deux onglets ouverts dans un même document de test reçoivent les mêmes événements et rien ne les distingue. `[complété par le challenger v9, N5]` Démarrage écrit en **contrat typé** (interface `SequenceDemarrage` : verrou → `importerTexte(principal)` sans exécuter son plan → `calculHorsLigne` (propriétaire du verrou seulement) → sauvegarde immédiate → boucle → auto-sauvegarde + battement), vérifié ici contre une **persistance factice en mémoire** (`stockage`/`canal` de test, jamais `localStorage`/`BroadcastChannel` réels) ; T-23a implémente ce même contrat avec la persistance réelle. `[complété par le challenger v8, trou #3] [complété par le challenger v9, N8]` | EXG-1 à 3 côté UI | implementeur-ui | Sonnet | Test de comptage de renders avec témoin positif : le panneau HUD ne re-rend pas à chaque tick de 100 ms, **mais** re-rend bien quand l'or affiché change après 10 ticks (témoin que le test peut détecter un vrai re-render) ; un panneau indépendant reste à 0 commit pendant la même fenêtre ; un delta de 5 s ne produit qu'une seule notification ; aucun `setState` déclenché si `nbTicks = 0` ; sélecteurs Zustand retournant des primitives, jamais l'état entier ; deux fabriques avec des ports `portPage`/`portPlanificateur` distincts reçoivent des événements indépendants (témoin de l'isolation multi-onglet). `[complété par le challenger v8, trou #10] [complété par le challenger v9, N5]` |
| T-19 | HUD panneaux (écoles, sorts, or/renommée/Éclats), disposition desktop 3 colonnes + repli mobile en onglets (§7) | EXG-35, 47 | implementeur-ui | Sonnet | Test visuel à 375 px et 1440 px passe, mesure des cibles ≥ 24 px ; test navigateur EXG-47 (nom d'école ou message d'erreur hostile `<img src=x onerror=...>` → rendu en texte littéral, `window.__x` indéfini) + `grep -E 'dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML' src/` dans `scripts/verify.sh`, vu rouge sur une injection volontaire avant correction. `[complété par le challenger v8, trou #8]` |
| T-20 | Sorts au clavier 1-6 + clic souris + barre tactile ≥ 44 px + affichage du cooldown | EXG-11, 12, 13, 14, 51 | implementeur-ui | Sonnet | Test clavier touches 1-6 (dont verrouillage touche 6 avant Ascension) vert ; mesure des cibles tactiles ≥ 44 px ; temps de cooldown restant affiché et vérifié par test (EXG-12) `[complété par le challenger v2]` |
| T-21 | Canvas combat (`src/canvas/`), rendu procédural géométrique sans asset (§7), effets (projectiles/impacts) dérivés des écarts de compteurs de jeu entre deux frames (le moteur n'émet aucun événement « projectile ») + option performance + `prefers-reduced-motion` + budget de frame + plafond projectiles, `N_PROJECTILES_MAX = 200` déclarée dans `src/canvas/` (pas `src/donnees/`) `[complété par le challenger v8, trou #13]` | EXG-29, 30, 33, 50, 52 | implementeur-ui | Sonnet | Media query `reduce` simulée → effets réduits par défaut ; scénario forçant > 200 écarts de compteur sur une frame → demandes de dessin > 200, dessins effectifs ≤ `N_PROJECTILES_MAX`, plus anciens supprimés ; test déterministe EXG-30 : après 2 h simulées, nombre de structures parcourues par frame borné par `N_PROJECTILES_MAX`, indépendant de la durée écoulée ; temps de frame mesuré en ms **informatif seulement**, jamais bloquant en CI. `[complété par le challenger v9, #13]` |
| T-23a | **Persistance réelle**, implémente le contrat typé de T-18 avec les ports réels : sauvegarde auto 30 s + événementielle (`visibilitychange`/`beforeunload`/`pagehide`), verrou multi-onglet et son transport (`BroadcastChannel` préfixé `magic-battle:`, ping ~500 ms au démarrage, écrire-puis-relire, expiration chiffrée dans le code à une valeur numérique fixe > 60 s, ≥ 3× la cadence de battement et > le ralentissement d'arrière-plan connu, relecture du verrou avant chaque écriture, `liberer` sur `pagehide`, re-revendication sur `pageshow`) `[complété par le challenger v9, N4]`, ordre de démarrage (cf. T-18) rejoué intégralement depuis le stockage à toute acquisition de verrou hors 1er démarrage (branche EXG-27 comprise), gel sans `calculHorsLigne` sur toute perte de verrou détectée sans acquisition `[complété par le challenger v9, N3]`, écran d'erreur EXG-27 sans écraser la donnée corrompue, `.bak` avec l'exception « principal illisible » d'EXG-46 `[complété par le challenger v9, N6]`, sur `hidden` : tick, sauvegarde et auto-sauvegarde suspendus, seul le battement du verrou continue (EXG-55) `[complété par le challenger v9, N1]`, onglet caché ou tout autre delta au-dessus du seuil traités comme hors-ligne (EXG-55), relais automatique de l'onglet secondaire (EXG-48) par rejeu complet du démarrage, action de store `importer(texte)` testée **sans UI**, réglages `magic-battle:reglages` lus en `try/catch` (ADR-21) avec fixtures hostiles (JSON invalide, type inattendu, clé étrangère) vues rouges avant validation `[complété par le challenger v9, N7]`. Le contrat de `src/state/` est déjà écrit côté domaine — pas à redéfinir ici : `src/domain/sauvegarde/index.ts` (`PlanEcrasement`, `OptionsImport.contenuCourant`), `sauvegarde/verrou.ts` (transport, délai d'expiration dérivé de la cadence de battement), `normalisation.ts` (`normaliserEtat`, à rejouer après reprise). Piège à éviter : le principal stocké est le **texte produit par `exporterTexte`** (base64), pas un JSON brut — `importerTexte` le relit tel quel ; un `deserialiser(JSON.parse(...))` direct déclencherait EXG-27 à chaque démarrage. `[complété par le challenger v8, trous #3, #4, #5, #6, #7, #9]` | EXG-4, 22, 23, 27, 46, 48, 55 | implementeur-ui | **Opus forcé** (§11 : `implementeur-domaine` n'écrit jamais dans `src/state/`, la responsabilité sauvegarde/verrou y bascule sur `implementeur-ui`) | « Écriture » = `setItem` sur `magic-battle:sauvegarde` compté après le démarrage : 0 à 29,9 s, 1 à 31 s ; 0→1 sur `hidden` et sur `pagehide` ; 0 dans l'onglet secondaire ; toute clé écrite par T-23a porte le préfixe `magic-battle:` (test qui échoue sur une clé non préfixée injectée exprès). `[complété par le challenger v9, N7]` Test EXG-55 : onglet caché 20 h → crédit hors-ligne plafonné à H, une seule fois ; sur `hidden`, aucune écriture de sauvegarde/auto-sauvegarde tant que l'onglet reste cadré, seul le battement du verrou continue ; écart < seuil au retour → crédit ≈ 0, test toujours vert. `[complété par le challenger v9, N1]` Test EXG-27 : principal tronqué → message, stockage identique octet pour octet après 31 s et `hidden`, `.bak` valide jamais écrasé (aucune copie faite quand le principal est illisible, EXG-46). Test EXG-46 : `importer(texte)` (action de store, sans UI) confirmé → `.bak` créé, restauration recharge l'état d'avant import, `derniereSauvegardeMs = maintenant`, aucun crédit hors-ligne sur une restauration (import sans crédit, `[complété par le challenger v9, N10]`). Test EXG-48 : deuxième onglet détecté, figé (tick/canvas arrêtés, actions du store **sans effet** — distinct du `disabled` visuel porté par T-23b, `[complété par le challenger v9, N10]`) ; fermeture propre du premier → relais immédiat ; disparition sans fermeture propre → figé jusqu'à `expiration − 1 ms` puis relais ; `pageshow` (bfcache) → rejeu du démarrage complet ; principal tronqué au moment du relais → figé, aucun `calculHorsLigne`, EXG-27. `[complété par le challenger v9, N3/N4/N10]` |
| T-23b | **Confirmations et affichage** : confirmations prestige/Ascension à deux étapes (EXG-19, 20, 21 — gain affiché **au clic**, pas recalculé pendant que la modale est ouverte ; raccourcis 1-6 ignorés sous modale ou dans un champ ; focus initial sur « Annuler » ; boutons désactivés si `partieTerminee` ; tests dédiés pour l'annulation et pour l'Ascension à gain 0), encart hors-ligne non bloquant (EXG-4, 53 — `role="status"`, **pas** un `Dialog` shadcn qui bloquerait la page ; affiché seulement si le delta dépasse le seuil de rattrapage `nTicksMax × PAS_TICK_MS` (EXG-55, 60 s avec les constantes actuelles) ; pas de fermeture automatique, ou ≥ 20 s avec pause au survol), bandeau de lecture seule sur onglet secondaire (EXG-48, affichage conditionné à l'état exposé par T-23a). `[complété par le challenger v8, trous #11, #14]` `[complété par le challenger v9, N10]` | EXG-4, 19, 20, 21, 48, 53 | implementeur-ui | Sonnet | Test de recouvrement par clics réels Playwright (ou `elementFromPoint`), pas seulement `fireEvent`/user-event, qui ne détectent pas un encart superposé ; à 375 px et 1440 px, assertion explicite que le rectangle (`getBoundingClientRect`) de l'encart hors-ligne et celui de chaque cible de jeu (barre de sorts, panneaux) ne se chevauchent pas **avant** le clic, pas seulement après coup `[complété par le challenger v9, #11]` ; test de confirmation de prestige sous la zone 4 → affiche « 0 Éclat » au clic, pas un écran vide ; test d'annulation au premier écran → aucun état modifié ; test d'Ascension à gain 0 Point ; touches 1-6 sans effet pendant qu'une modale est ouverte ; focus initial vérifié sur « Annuler » ; boutons de confirmation désactivés une fois `partieTerminee` ; bandeau visible, actions **sans effet** sur le second onglet (T-23a, N10), `disabled` visuel + bandeau à l'écran (T-23b, N10) (EXG-48). |
| T-22 | Accessibilité (contraste AA, miroir DOM, focus clavier) + script de ratios de palette (§14), audit sur la liste complète des états d'écran (vide, chargement, erreur EXG-27, succès, résumé hors-ligne EXG-4/53, confirmation prestige/Ascension EXG-21, bandeau lecture seule EXG-48) — **placée après T-23a/T-23b** : ces états (erreur EXG-27, bandeau EXG-48, encart hors-ligne EXG-53) n'existent qu'une fois T-23 livrée, un audit avant produirait des états factices non représentatifs. `[complété par le challenger v9, N8]` | EXG-31, 32, 34 | implementeur-ui | Sonnet | Audit axe-core `violations = 0` **et** `incomplete` de la règle `color-contrast` = 0 sur chacun des états listés, rendus par le code réel de T-19/T-21/T-23a/T-23b ; parcours clavier complet jusqu'au premier prestige sans souris ; script de ratios de palette vu rouge sur une paire de jetons injectée hors seuil, puis vert une fois la paire retirée ; assertions de mise en page explicites à 375/1440 px, toutes les cibles tactiles mesurées ; miroir DOM sans `aria-live` continu (pas de rafraîchissement à la cadence du tick). `[complété par le challenger v8, trou #12]` `[complété par le challenger v9, N8]` |

Preuve de fin de vague : parcours clic → sort → boss → prestige jouable de bout en bout ; audit outillé
d'accessibilité sans violation de contraste ; déploiement Pages mis à jour (preview par vague) ; revue
lecture seule confirmant la pureté de `domain/` (aucun import React/DOM) et qu'aucun blob de sauvegarde
n'est rendu en HTML brut (EXG-47) `[complété par le challenger v2]`.

### Vague 3 — Contenu & narration
| T | Tâche | EXG couvertes | Agent | Modèle | Done quand |
| --- | --- | --- | --- | --- | --- |
| T-24 | Contenu des 5 écoles + 6e (nom, description, sort associé) | contenu §7 | narration-legere | Sonnet | Revue lecture seule confirme l'absence de style IA ; textes présents dans `donnees/ecoles.ts` pour les 6 écoles |
| T-25 | Contenu des zones/boss (noms, valeurs issues de T-15, 1 ligne d'ambiance chacun) | contenu §7 | contenu-zones | Sonnet | Revue lecture seule confirme l'absence de style IA ; textes présents dans `donnees/zones.ts` |
| T-26 | Quêtes/équipement (contenu + branchement Renommée/multiplicateur) | EXG-10, 43 | contenu-zones | Sonnet | `tests/domain/quetes.test.ts` et `tests/domain/equipement.test.ts` toujours verts avec noms définitifs |
| T-27 | Guide de ton appliqué, textes courts (intro, 1 ligne/Ascension, fin) | EXG-28 | narration-legere | Sonnet | Revue lecture seule du guide de ton (§7) sans texte « style IA » |

Preuve de fin de vague : relecture humaine/agent lecture seule du guide de ton (aucun texte « style IA »),
`bash scripts/verify.sh` vert.

### Vague 4 — Publication
| T | Tâche | EXG couvertes | Agent | Modèle | Done quand |
| --- | --- | --- | --- | --- | --- |
| T-28 | Export/import base64 exposé en UI | EXG-24 | implementeur-ui | Sonnet | Test UI round-trip export → import via l'interface, y compris message d'erreur sur import invalide |
| T-29 | Revue finale lecture seule (secrets Actions, frontières §10 respectées, sécurité de l'import) | — | revue lecture seule | Opus | Rapport de revue sans anomalie sur secrets/frontières §10/sécurité §6 |

Hors périmètre V1 (rappel §3.2) : zip itch.io, PWA installable, i18n multi-langue.
Preuve de fin de vague : site à jour sur GitHub Pages (déployé en continu depuis T-17), `bash
scripts/verify.sh` vert en CI.

### Table de traçabilité EXG → tâche
| EXG | Tâche(s) | EXG | Tâche(s) | EXG | Tâche(s) |
| --- | --- | --- | --- | --- | --- |
| 1 | T-2, T-18 | 19 | T-6, T-23b | 37 | T-12 |
| 2 | T-2 | 20 | T-7, T-23b | 38 | T-6 |
| 3 | T-2, T-14 | 21 | T-6, T-7, T-23b | 39 | T-6 |
| 4 | T-2, T-14, T-23a, T-23b | 22 | T-23a | 40 | T-7 |
| 5 | T-2 | 23 | T-23a | 41 | T-7 |
| 6 | T-3 | 24 | T-10, T-28 | 42 | T-8 |
| 7 | T-3 | 25 | T-10 | 43 | T-8, T-26 |
| 8 | T-3 | 26 | T-10 | 44 | T-13 |
| 9 | T-3 | 27 | T-10, T-23a | 45 | T-10 |
| 10 | T-8, T-9 | 28 | T-13, T-27 | 46 | T-10, T-23a |
| 11 | T-4, T-20 | 29 | T-21 | 47 | T-10, T-19 |
| 12 | T-4, T-20 | 30 | T-21 | 48 | T-11, T-23a, T-23b |
| 13 | T-20 | 31 | T-22 | 49 | T-2, T-14 |
| 14 | T-20 | 32 | T-22 | 50 | T-21 |
| 15 | T-5 | 33 | T-21 | 51 | T-20 |
| 16 | T-5 | 34 | T-22 | 52 | T-21 |
| 17 | T-5 | 35 | T-19 | 53 | T-23b |
| 18 | T-6 | 36 | T-12 | 54 | T-9 |
| 55 | T-23a | — | — | — | — |

## Sources
- Fiche de référence *Magic Archery* (Barribob) — recherche interview, 2026-09-20 (Steam app 2905170,
  incrementaldb.com, commentaires itch.io) : boucle de référence, retours joueurs (demande de prestige,
  option performance).
- Pecorella, *The Math of Idle Games* I-III (GDC/gamedeveloper.com, 2016-2017) : courbes de coût
  exponentielles, pacing, formules de prestige — base des formules §8.
- Padinha, *Balancing Tips: Idle Idol* (2020) : coûts en base ~1,1, importance de l'UI dans la perception
  de vitesse.
- Ian Schreiber, *Game Balance Concepts* (2010) : courbes de coût, économies, sinks.
- Machinations.io : principe de simulation d'une économie de jeu avant de coder — justifie la vague 1.
- EARS — Alistair Mavin : patterns des exigences §4.
- WCAG 2.2 (W3C, 2024-12) : cible AA, taille de cible 24 px, `prefers-reduced-motion` — §7, §4.9/4.10.
- 10 Usability Heuristics — Nielsen/NN·g : heuristiques §7.
- Addy Osmani, *How to write a good spec for AI agents* : structure de spec dense, frontières Always/Ask/
  Never — §10.
- Choosing the right model / Optimizing for cost and intelligence (Claude Platform) : base du choix
  « capacité d'abord » et du routage Opus/Sonnet — §11.
- Conventions reprises du projet `nylnatosport` (`CLAUDE.md`, `scripts/verify.sh`) : nommage français,
  moteur pur `domain/`, script de vérification tolérant à l'outillage absent, hook Stop bloquant.
- `docs/specs/projet/challenge-v1.md` (spec-challenger, 2026-09-20) : 15 trous à l'origine de cette v2.
