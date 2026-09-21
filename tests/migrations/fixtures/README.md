# Fixtures de sauvegarde — **jamais supprimées, jamais modifiées**

Spec §9 « Conventions fortes » : *« Toute migration de sauvegarde est accompagnée d'une fixture dans
`tests/migrations/` — jamais supprimée. »* Et `.claude/rules/domaine-pur.md` : *« Les fixtures de
migration de sauvegarde sous `tests/migrations/` ne sont jamais supprimées, même quand une version de
schéma devient obsolète. »*

Ce dossier est donc **en ajout seul**. Une fixture obsolète reste : c'est la seule preuve qu'une
sauvegarde réelle de cette version se charge encore après la migration suivante. Refactorer une
migration n'autorise pas à toucher une fixture : on ajoute la fixture de la nouvelle version à côté.

## Contenu

| Fixture | Ce qu'elle prouve | Attendu |
| --- | --- | --- |
| `sauvegarde-v1-valide.json` | format v1 réel, cohérent, point fixe de la normalisation | import accepté, état identique |
| `incoherent-v1.json` | valide au schéma mais incohérent entre champs | **réparé** par la normalisation, pas rejeté |
| `xss-champ-texte.json` | charge `<img src=x onerror=...>` dans un champ texte (EXG-47) | traverse comme **donnée**, chaîne identique |
| `rejet-non-fini-nan.json` | littéral `NaN` (hors JSON strict) | `jsonIllisible` |
| `rejet-non-fini-infinity.json` | littéral `Infinity` | `jsonIllisible` |
| `rejet-non-fini-infinity-negatif.json` | littéral `-Infinity` | `jsonIllisible` |
| `rejet-non-fini-infinity-chaine.json` | chaîne `"Infinity"` | `typeIncorrect` |
| `rejet-non-fini-null.json` | `null` — ce que `JSON.stringify(Infinity)` produit | `typeIncorrect` |
| `rejet-negatif.json` | champ positif reçu négatif | `valeurNegative` |
| `rejet-hors-bornes-haut.json` | au-dessus de la borne déclarée | `horsBornes` |
| `rejet-hors-bornes-bas.json` | en dessous de la borne déclarée | `horsBornes` |
| `rejet-hors-bornes-rang.json` | rang d'arbre au-delà du `rangMax` du catalogue | `horsBornes` |
| `rejet-cle-proto.json` | clé `__proto__` au premier niveau de l'état | `clePolluante` |
| `rejet-cle-proto-imbriquee.json` | clé `__proto__` **dans** le dictionnaire de rangs d'arbre | `clePolluante` |
| `rejet-cle-constructor.json` | clé `constructor` comme clé de dictionnaire | `clePolluante` |
| `rejet-cle-prototype.json` | clé `prototype` au niveau de l'enveloppe | `clePolluante` |
| `rejet-type-chaine.json` | chaîne là où un nombre est attendu | `typeIncorrect` |
| `rejet-type-tableau.json` | tableau là où un objet est attendu | `typeIncorrect` |
| `rejet-type-null.json` | `null` là où un objet est attendu | `typeIncorrect` |
| `rejet-champ-manquant.json` | champ obligatoire absent | `champManquant` |
| `rejet-valeur-inattendue.json` | valeur hors du jeu de valeurs déclaré | `valeurInattendue` |
| `rejet-version-future.json` | version de schéma postérieure au code | `versionFuture` |
| `rejet-json-tronque.json` | sauvegarde coupée en deux (EXG-27) | `jsonIllisible` |
| `rejet-profondeur.json` | imbrication absurde | `profondeurExcessive` |
| `rejet-base64-invalide.txt` | texte d'import qui n'est pas du base64 | `base64Invalide` |

Chaque ligne est vérifiée par `tests/domain/sauvegarde.test.ts` (tableau des rejets) et
`tests/migrations/migrations.test.ts` (chaîne de migrations).
