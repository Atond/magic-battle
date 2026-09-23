// Aucun texte d'interface écrit en dur dans un composant (spec §7 : « tout passe par `src/donnees/` »).
// Parse réellement les sources avec l'API `typescript` (pas un grep : un grep ne sait pas distinguer un
// texte JSX d'un `className`, ni un attribut `aria-label` d'un `data-testid`).
//
// Deux vérificateurs de nature différente, parce que le premier a un angle mort connu :
//  1. **JSX** — tout `JsxText` qui contient une lettre, tout attribut porteur de texte (`aria-label`,
//     `title`, `placeholder`, `alt`, `aria-description`, `label`…) valant un littéral avec une lettre,
//     et tout littéral chaîne posé directement comme enfant JSX (`{'Frapper'}`) ;
//  2. **littéraux de phrase** — l'angle mort du premier : un texte rangé dans une constante locale
//     (`const LIBELLE = 'Frapper le monstre'`) puis interpolé (`{LIBELLE}`) ne passe jamais par un nœud
//     JSX littéral. Tout littéral chaîne qui commence par une majuscule et contient une espace est donc
//     suspect : aucun `className`, `data-testid`, identifiant de moteur ou nom de touche n'a cette forme.
//
// Faute que ni l'un ni l'autre ne verra : un mot isolé en minuscules rangé dans une constante
// (`const x = 'fermer'`). La revue lecture seule reste le juge ; ceci est un filet.
//
// `src/components/ui/` est exclu : engendré par `npx shadcn add` (ADR-18), jamais édité à la main.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const RACINE = join(import.meta.dirname, '..', '..')

/** Répertoires balayés (récursivement) et fichiers isolés. */
const DOSSIERS = ['src/components', 'src/canvas']
const FICHIERS = ['src/App.tsx', 'src/main.tsx']
const EXCLUS = ['src/components/ui/']

/** Attributs JSX dont la valeur est lue ou affichée comme du texte. */
const ATTRIBUTS_TEXTE = new Set([
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'placeholder',
  'alt',
  'label',
])

/**
 * Exceptions explicites : `fichier` + texte exact. Vide aujourd'hui. Toute entrée doit dire pourquoi le
 * texte n'est pas du texte d'interface (ex. une icône purement décorative déjà `aria-hidden`).
 */
const EXCEPTIONS: readonly { readonly fichier: string; readonly texte: string; readonly raison: string }[] = []

const CONTIENT_LETTRE = /\p{L}/u
/** Forme d'une phrase : majuscule initiale, puis au moins une espace. */
const FORME_PHRASE = /^\p{Lu}[\p{L}’'-]*\s+\S/u

function listerSources(): string[] {
  const resultat: string[] = []
  function parcourir(dossier: string): void {
    for (const nom of readdirSync(join(RACINE, dossier))) {
      const chemin = `${dossier}/${nom}`
      if (EXCLUS.some((e) => `${chemin}/`.startsWith(e))) continue
      if (statSync(join(RACINE, chemin)).isDirectory()) parcourir(chemin)
      else if (/\.tsx?$/.test(nom)) resultat.push(chemin)
    }
  }
  for (const dossier of DOSSIERS) parcourir(dossier)
  return [...resultat, ...FICHIERS].sort()
}

interface Trouvaille {
  readonly fichier: string
  readonly ligne: number
  readonly texte: string
  readonly nature: string
}

function estException(fichier: string, texte: string): boolean {
  return EXCEPTIONS.some((e) => e.fichier === fichier && e.texte === texte)
}

function nomAttribut(attribut: ts.JsxAttribute): string {
  return attribut.name.getText()
}

/** Littéral chaîne « simple » (guillemets ou gabarit sans substitution) : sa valeur, sinon `null`. */
function valeurLitterale(noeud: ts.Node | undefined): string | null {
  if (noeud === undefined) return null
  if (ts.isStringLiteral(noeud) || ts.isNoSubstitutionTemplateLiteral(noeud)) return noeud.text
  if (ts.isJsxExpression(noeud)) return valeurLitterale(noeud.expression)
  if (ts.isParenthesizedExpression(noeud)) return valeurLitterale(noeud.expression)
  return null
}

/** Parties fixes d'un gabarit `…${x}…` : la tête et chaque segment entre substitutions. */
function partiesFixesGabarit(noeud: ts.TemplateExpression): string[] {
  return [noeud.head.text, ...noeud.templateSpans.map((s) => s.literal.text)]
}

/** Un littéral qui sert de module importé, de clé de type ou de directive n'est jamais du texte affiché. */
function estHorsAffichage(noeud: ts.Node): boolean {
  const parent = noeud.parent
  return (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isLiteralTypeNode(parent) ||
    ts.isExternalModuleReference(parent) ||
    (ts.isExpressionStatement(parent) && ts.isSourceFile(parent.parent)) // 'use strict'
  )
}

function analyser(fichier: string): Trouvaille[] {
  const source = ts.createSourceFile(
    fichier,
    readFileSync(join(RACINE, fichier), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    fichier.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const trouvailles: Trouvaille[] = []
  const signaler = (noeud: ts.Node, texte: string, nature: string): void => {
    const propre = texte.trim()
    if (estException(fichier, propre)) return
    const { line } = source.getLineAndCharacterOfPosition(noeud.getStart(source))
    trouvailles.push({ fichier, ligne: line + 1, texte: propre, nature })
  }

  function visiter(noeud: ts.Node): void {
    // (1) JSX
    if (ts.isJsxText(noeud) && CONTIENT_LETTRE.test(noeud.text)) {
      signaler(noeud, noeud.text, 'texte JSX')
    } else if (ts.isJsxAttribute(noeud) && ATTRIBUTS_TEXTE.has(nomAttribut(noeud))) {
      const valeur = valeurLitterale(noeud.initializer)
      if (valeur !== null && CONTIENT_LETTRE.test(valeur)) signaler(noeud, valeur, `attribut ${nomAttribut(noeud)}`)
      const expression = noeud.initializer !== undefined && ts.isJsxExpression(noeud.initializer)
        ? noeud.initializer.expression
        : undefined
      if (expression !== undefined && ts.isTemplateExpression(expression)) {
        for (const partie of partiesFixesGabarit(expression)) {
          if (CONTIENT_LETTRE.test(partie)) signaler(noeud, partie, `gabarit dans ${nomAttribut(noeud)}`)
        }
      }
    } else if (
      ts.isJsxExpression(noeud) &&
      (ts.isJsxElement(noeud.parent) || ts.isJsxFragment(noeud.parent))
    ) {
      const valeur = valeurLitterale(noeud.expression)
      if (valeur !== null && CONTIENT_LETTRE.test(valeur)) signaler(noeud, valeur, 'littéral enfant JSX')
      if (noeud.expression !== undefined && ts.isTemplateExpression(noeud.expression)) {
        for (const partie of partiesFixesGabarit(noeud.expression)) {
          if (CONTIENT_LETTRE.test(partie)) signaler(noeud, partie, 'gabarit enfant JSX')
        }
      }
    }

    // (2) littéraux en forme de phrase, où qu'ils soient
    if ((ts.isStringLiteral(noeud) || ts.isNoSubstitutionTemplateLiteral(noeud)) && !estHorsAffichage(noeud)) {
      if (FORME_PHRASE.test(noeud.text)) signaler(noeud, noeud.text, 'littéral en forme de phrase')
    } else if (ts.isTemplateExpression(noeud)) {
      for (const partie of partiesFixesGabarit(noeud)) {
        if (FORME_PHRASE.test(partie.trim())) signaler(noeud, partie, 'gabarit en forme de phrase')
      }
    }

    ts.forEachChild(noeud, visiter)
  }
  visiter(source)
  return trouvailles
}

describe('aucun texte d’interface en dur dans les composants (spec §7)', () => {
  const sources = listerSources()

  it('balaie bien les composants du HUD, le canvas et App.tsx', () => {
    expect(sources).toContain('src/App.tsx')
    expect(sources).toContain('src/canvas/CanvasCombat.tsx')
    expect(sources).toContain('src/components/hud/Disposition.tsx')
    expect(sources.some((s) => s.startsWith('src/components/ui/'))).toBe(false)
  })

  it('chaque exception listée existe encore (pas d’exception morte)', () => {
    for (const exception of EXCEPTIONS) {
      expect(readFileSync(join(RACINE, exception.fichier), 'utf8')).toContain(exception.texte)
    }
  })

  it.each(listerSources())('%s', (fichier) => {
    const trouvailles = analyser(fichier).map(
      (t) => `${relative(RACINE, join(RACINE, t.fichier))}:${t.ligne} — ${t.nature} : « ${t.texte} »`,
    )
    expect(trouvailles, 'déplacer ces textes dans src/donnees/textes-ui.ts').toEqual([])
  })
})
