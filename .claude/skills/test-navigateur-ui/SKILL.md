---
name: test-navigateur-ui
description: >
  Écrire ou modifier un test dans `tests/ui/` (Vitest mode navigateur + Playwright, ADR-20) ou un test de
  `tests/state/` qui monte un vrai store (`creerStoreJeu`). Se déclenche sur « test navigateur », « test UI »,
  « HUD », « composant », « canvas », « audit accessibilité », « verrou multi-onglet », « persistance
  navigateur », ou tout test qui rend un composant React réel du jeu. Rassemble les dix pièges redécouverts
  à chaque tâche de la vague 2 (T-18a à T-23b) pour ne pas les redécouvrir une onzième fois.
---

# Test navigateur UI

Vrai navigateur, jamais jsdom (ADR-20, `vite.config.ts` — projet `ui` : `browser.provider: playwright()`,
`chromium`). `tests/state/*.test.ts` (projet `domaine`) tourne en Node ; dès qu'un test rend un composant
React (`.test.tsx`), il est dans le projet `ui` et hérite de tous les pièges ci-dessous.

## Quick start — squelette minimal

```tsx
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'

// Sans cet import, Tailwind ne compile jamais les classes du test (piège 1).
import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx' // le VRAI composant (piège 8)
import { creerStoreJeu } from '../../src/state/store.ts'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from '../state/doubles.ts' // réutiliser, jamais recréer (voir plus bas)

const T0 = 1_700_000_000_000

it('…', async () => {
  await page.viewport(1440, 900) // ou 375 pour mobile (piège 7)
  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage: creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: 'onglet-test',
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial,
  })
  confirmerDemarrage(planificateur) // franchit les 500 ms d'attente du verrou (piège 5)

  const { getByRole, unmount } = render(<Disposition store={store} />)
  await userEvent.click(getByRole('button', { name: '…' })) // vrai événement (piège 7)

  unmount() // pas d'auto-cleanup (piège 3)
  store.arreter()
})
```

## Les dix pièges

1. **CSS absent** — sans `import '../../src/index.css'` dans le fichier de test, Tailwind ne compile pas
   les classes (`hidden`, `lg:grid`, `lg:hidden`…) : les deux arbres desktop **et** mobile restent visibles
   en même temps dans le DOM du test. Symptôme : `getByRole`/`queryAllByRole` renvoie 2 résultats là où 1
   est attendu, ou un test « débordement horizontal » passe pour la mauvaise raison.
2. **Thème `dark`** — le thème vit sur `<html class="dark">` (`index.html`), pas dans `:root`. Fixé une
   fois en T-19 (commit `e4b6837` : « sans la classe `.dark`, le fond de page restait blanc sous les
   panneaux »). Les tests actuels s'en sortent parce que la palette du jeu (`--couleur-charbon-*`,
   `--couleur-ecole-*`) est déclarée directement dans `:root`, indépendamment de `.dark` — mais tout
   composant qui utiliserait un jeton shadcn sémantique (`bg-background`, `bg-card`, `text-foreground`,
   `src/components/ui/`) lirait la variante **claire** dans un test qui ne pose pas
   `document.documentElement.classList.add('dark')`. À poser explicitement dès qu'un test touche un
   composant shadcn brut.
3. **Pas d'auto-cleanup** — ce projet ne charge aucun `setupFiles` (`vite.config.ts`, projet `ui`) : rien
   n'arme l'auto-cleanup de `@testing-library/react` entre deux tests. `unmount()` (rendu React) et
   `store.arreter()` (boucle du store) sont obligatoires à la fin de **chaque** `it`, dans un `finally` dès
   qu'il y a une assertion qui peut jeter avant. Symptôme sans ça : deux arbres coexistent d'un test à
   l'autre, `getByRole` devient ambigu.
4. **`act()`** — encadrer tout ce qui fait avancer l'horloge factice et déclenche une frame
   (`horloge.avancer(ms)` + `portPlanificateur.declencherFrame()`), sinon React log un avertissement et les
   assertions lisent un DOM pas encore commité (`tests/ui/panneaux-rendus.test.tsx`).
5. **`confirmerDemarrage()`** — depuis T-23a, le démarrage attend `DELAI_CONFIRMATION_VERROU_MS` (500 ms,
   `src/state/constantes.ts`) en écrivant-puis-relisant avant de tenir le verrou.
   `confirmerDemarrage(planificateur)` (`tests/state/doubles.ts`) franchit cette attente sans horloge réelle
   — appeler juste après `creerStoreJeu`. Piège lié : si le test compte des écritures de stockage
   (`ecritures.length`), **remettre le journal à zéro après** `confirmerDemarrage`, jamais avant — sinon les
   écritures de la séquence de démarrage elle-même faussent le compte (voir
   `tests/ui/bandeau-lecture-seule-et-hors-ligne.test.tsx`).
6. **Doublons desktop/mobile** — `Disposition` monte les deux arbres (desktop `lg:grid` + mobile
   `lg:hidden`) en même temps ; une requête `getByTestId`/`querySelectorAll` renvoie souvent 2 éléments.
   Filtrer avec `el.getBoundingClientRect().width > 0` (helper `visible()` de `tests/ui/aide-audit.ts`).
   Piège miroir côté logique, pas seulement affichage : si un effet global (raccourcis clavier,
   `useRaccourcisSorts`) est monté depuis un composant dupliqué plutôt que depuis `Disposition` une seule
   fois, une frappe déclenche l'action deux fois — voir piège 9.
7. **Vrais événements, vrai viewport** — `userEvent` de `vitest/browser` (pas `fireEvent` de
   `@testing-library/react`, pas de simulation manuelle), `page.viewport(largeur, hauteur)` pour basculer
   entre desktop (1440×900) et mobile (375×800/900). C'est ce qui rend les mesures de disposition et de
   cibles tactiles réelles, pas simulées.
8. **Rendre les vrais composants** — importer et rendre les composants de `src/`, jamais un composant
   défini dans le fichier de test (faute relevée par la revue de fin de vague 2, cf. le commentaire en
   tête de `tests/ui/contenu-hostile.test.tsx`) : un composant-jouet prouve la syntaxe du test, pas le
   comportement du code livré. Exception assumée et commentée : `EcranChargement` dans
   `tests/ui/audit-accessibilite.test.tsx` reproduit un état d'`App.tsx` trop simple pour valoir un
   composant dédié — à ne faire que si c'est aussi honnêtement gratuit.
9. **Garde-fou idempotent masqué** — un cooldown/état idempotent (ex. `cooldownRestantMs` déjà armé) rend
   un doublon d'appel invisible dans l'état final : deux déclenchements successifs laissent le même état
   qu'un seul. Compter les **appels réels** (remplacer l'action dans le store par un wrapper qui incrémente
   un compteur avant de déléguer à l'originale), jamais déduire le nombre d'appels de l'état — patron dans
   `tests/ui/barre-sorts.test.tsx` (« une frappe ne déclenche le sort qu'une seule fois »).
10. **Garde-fou géométrique (chevauchement)** — se prouve rouge seulement avec une faute qui **chevauche
    réellement** (déplacer l'encart hors-ligne sur une vraie cible, pas à côté). Prendre **toutes** les
    cibles visibles (`width > 0`), pas un échantillon, et refaire la mesure à chaque largeur testée
    (`it.each([375, 1440])`) — une régression de disposition qui n'apparaît qu'à une seule largeur ne se
    voit pas si on ne teste que l'autre. Patron : `seChevauchent(a, b)` + boucle sur toutes les cibles dans
    `tests/ui/bandeau-lecture-seule-et-hors-ligne.test.tsx`.

## Preuve du rouge

Pour chaque garde-fou nouveau ou modifié (pièges 9 et 10 en particulier, mais aussi tout `expect` de ce
fichier), dérouler `.claude/skills/preuve-du-rouge/SKILL.md` : écrire la faute exacte à attraper, l'injecter
dans le code surveillé, constater le rouge, lire le message, retirer, vérifier `git diff` propre. Un test
navigateur qui n'a jamais été vu rouge ne garde rien de plus qu'un test Node.

## Doubles réutilisables — ne pas en recréer

- `tests/state/doubles.ts` : un seul onglet — `creerHorlogeFactice`, `creerStockageFactice`,
  `creerCanalFactice`, `creerMatchMediaFactice`, `creerPortPageFactice`, `creerPortPlanificateurFactice`
  (frames/intervalles **jamais** automatiques, déclenchés à la main), `confirmerDemarrage`.
- `tests/state/monde.ts` (`creerMonde`) : multi-onglet, temps simulé partagé (`avancer`/`avancerJusqua`
  déclenche chaque échéance à son instant exact, tous onglets confondus), stockage **espion**
  (`StockageEspion` : `journal`, `compterEcritures(cle, depuis, onglet)`, `poser()` pour préparer sans
  journaliser) — nécessaire dès qu'un critère est temporel (« 0 écriture à 29,9 s, 1 à 31 s ») ou porte sur
  plusieurs onglets à la fois (verrou, canal `BroadcastChannel` simulé).
- `tests/ui/aide-audit.ts` : `creerStoreDeTest()` (store + `confirmerDemarrage` déjà enchaînés),
  `visible()` (piège 6), `auditerSansViolation()` (axe-core : `violations` **et** `incomplete` de
  `color-contrast` vérifiés séparément — un `incomplete` non nul laisse passer un vrai défaut de contraste).
