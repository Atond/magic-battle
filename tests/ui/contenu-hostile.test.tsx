// Rendu de texte hostile (T-19, EXG-47). Vrai navigateur (Vitest browser mode + Playwright, ADR-20) :
// preuve d'exécution, pas seulement de syntaxe — le grep `dangerouslySetInnerHTML|innerHTML|
// insertAdjacentHTML` de `scripts/verify.sh` attrape l'écriture d'un tel appel dans `src/`, mais pas un
// contournement sémantique (une bibliothèque qui insère du HTML sans que ce texte apparaisse littéralement
// dans notre code). Ce test-ci prouve que le résultat affiché est littéral, quel que soit le chemin pris.
//
// `src/domain/sauvegarde/index.ts` documente cette frontière comme la responsabilité de la couche
// d'affichage, pas la sienne (spec EXG-47) : un champ hostile — ici un nom de sauvegarde imaginaire —
// traverse le HUD comme une chaîne de caractères, jamais comme du balisage.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

const CHARGE_HOSTILE = '<img src=x onerror="window.__exg47 = true">'

/**
 * Représentatif du patron utilisé par tout le HUD (`BandeauHaut`, `PanneauEcoles`, …) pour afficher du
 * texte dynamique : interpolation JSX (`{texte}`), jamais `dangerouslySetInnerHTML`. Aucun composant du
 * HUD n'affiche encore de champ fourni par le joueur (le nom de sauvegarde arrive en T-23a) — ce composant
 * miniature capture le seul patron qui sera réutilisé à ce moment-là, pour que le garde-fou existe avant
 * la fonctionnalité plutôt qu'après un premier incident.
 */
function AfficheurDeTexte({ texte }: { readonly texte: string }) {
  return <p data-testid="texte-affiche">{texte}</p>
}

describe('rendu de texte hostile — jamais interprété comme balisage (EXG-47)', () => {
  it('un nom de sauvegarde hostile s’affiche comme texte littéral, sans exécuter de script', () => {
    // @ts-expect-error — sonde posée par le test, jamais par le code applicatif.
    delete window.__exg47

    const { getByTestId, unmount } = render(<AfficheurDeTexte texte={CHARGE_HOSTILE} />)

    expect(getByTestId('texte-affiche').textContent).toBe(CHARGE_HOSTILE)
    // Aucune balise `<img>` n'a été créée : la chaîne est restée du texte, jamais parsée comme HTML.
    expect(document.querySelector('img')).toBeNull()
    // Le gestionnaire `onerror` n'a donc jamais pu s'exécuter.
    // @ts-expect-error — sonde posée par le test.
    expect(window.__exg47).toBeUndefined()

    unmount()
  })
})
