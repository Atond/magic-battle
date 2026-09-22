---
name: preuve-du-rouge
description: Procédure à dérouler avant de considérer fait l'ajout ou la modification d'un garde-fou (test, étape de scripts/verify.sh, grep d'invariant, vérificateur maison) — se déclenche sur « ajouter un test », « écrire un garde-fou », « ce test passe mais est-ce qu'il prouve quelque chose », « renforcer verify.sh », ou tout doute sur ce qu'un contrôle vert détecte vraiment.
---

# Preuve du rouge

**Un garde-fou qu'on n'a jamais vu échouer ne garde rien.** Un contrôle vert rassure à proportion de ce
qu'on croit qu'il couvre — pas de ce qu'il couvre réellement (LRN-004, BLK-004).

## Avant d'écrire le garde-fou

Écrire en une phrase **la faute qu'il doit attraper** et **la faute la plus probable qu'il ne verra pas**.
Si la seconde compte, il manque un vérificateur d'une **nature différente** — deux vérificateurs de même
nature se répètent, ils ne se couvrent pas. Exemple réel : `npm run equilibrage:check`
(`tests/equilibrage/derogations.test.ts`) rejoue les contraintes §8 — il n'attrape une constante retouchée
à la main que si elle **casse** une contrainte. `npm run equilibrage:empreinte`
(`tests/equilibrage/empreinte.test.ts`, `scripts/verify.sh`) compare le fichier livré au vecteur archivé —
il attrape la retouche qui reste dans les clous, exactement ce que `check` laisse passer (LRN-004, BLK-004).

## La procédure

1. **Injecter la faute exacte** dans le code surveillé, constater le rouge, **lire le message d'échec**
   (illisible = inutile), retirer l'injection, vérifier `git diff` propre. Jamais de `git checkout` sur un
   fichier dont le travail n'est pas commité.
2. **Injecter individuellement, jamais en bloc.** Deux bornes qui se couvrent l'une l'autre donnent un vert
   pour la mauvaise raison. Dans `deserialiser` (`tests/domain/sauvegarde.test.ts:596-715`), le budget de
   nœuds et la borne de profondeur (`PROFONDEUR_MAX`) protègent des angles différents : désactiver les deux
   ensemble aurait fait pendre le test sans dire lequel manquait.
3. **Construire l'entrée hostile pour que le chemin rapide ne soit pas pris par hasard.** Le piège doit être
   visité en dernier. Voir `tests/domain/sauvegarde.test.ts:651-680` : la clé polluante est placée dans une
   branche sœur, visitée seulement après un parcours en profondeur complet du graphe.
4. **Choisir le bon instrument.** Un compteur que le code s'attribue lui-même (`iterations + 2` en dur)
   documente une intention, il ne mesure rien (LRN-002, BLK-002). Pour une forme fermée, l'écart avec une
   boucle naïve n'est pas de quelques pourcents mais entre « quelques µs » et « ne rend jamais la main » :
   l'instrument est un **timeout serré sur une entrée astronomique** (1e9 à 1e12+), avec un commentaire
   disant que le timeout **est** l'assertion — sinon quelqu'un le retirera en le prenant pour une fragilité
   de CI. Six instances dans ce dépôt : `tests/domain/zones.test.ts:294-336` (EXG-30, combat),
   `tests/domain/fin.test.ts:356-361` (boss final), `tests/domain/prestige.test.ts:588-624` (arbre
   d'Éclats), `tests/domain/ascension.test.ts:518-543`, `tests/domain/ecoles.test.ts:116-160`,
   `tests/domain/tick.test.ts:262-290` (dérive de coût par frame), plus les trois du point 3.
5. **Une tolérance se calcule, elle ne se pose pas.** Si les deux chemins comparés sont mathématiquement
   identiques, exiger `1e-9` (voir la normalisation du bruit flottant dans
   `tests/equilibrage/empreinte.test.ts`, bloc « comparaison profonde »). Sinon, nommer la cause de l'écart
   et borner l'erreur — une pénalité au prorata plutôt qu'au poids entier avait laissé passer une
   contrainte §8 ratée à 88,6 % (LRN-003, BLK-003).
6. **Quand un apprentissage est écrit, passer en revue tous les endroits qui présentent le même motif.**
   LRN-002 était née du combat, appliquée d'abord au combat et à la sauvegarde seulement ; le tick et
   l'équilibrage ont gardé leurs compteurs auto-attribués jusqu'à la revue de fin de vague qui a produit
   LRN-004. Après tout ajout de garde-fou, chercher les autres endroits qui « comptent tout seuls ».

## Détails et citations complètes

Extraits longs (commentaires intégraux des tests cités, formulation exacte des BLK/LRN) :
[REFERENCE.md](REFERENCE.md).
