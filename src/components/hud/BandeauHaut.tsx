// Bandeau haut (T-19) : monnaies + zone courante, toujours visibles (heuristique « visibilité de l'état
// du système », spec §7). Chaque jauge est son propre composant avec son propre sélecteur fin : l'or
// change à chaque tick (production passive), la Renommée/les Éclats/la zone beaucoup plus rarement —
// les isoler évite qu'un tick fasse re-rendre tout le bandeau (ADR-19, même patron que
// `tests/ui/panneaux-rendus.test.tsx`).

import { formater } from '../../domain/notation.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { useStoreJeu } from '../../state/hooks.ts'
import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import { indexRegion, regionParIndex } from '../../state/contenu.ts'

function Jauge({ libelle, valeur }: { readonly libelle: string; readonly valeur: string }) {
  return (
    <div className="flex min-h-6 items-baseline gap-1.5 px-2 py-1">
      <span className="text-[var(--couleur-charbon-texte-attenue)] text-xs uppercase tracking-wide">
        {libelle}
      </span>
      <span className="text-[var(--couleur-charbon-texte)] font-semibold tabular-nums">{valeur}</span>
    </div>
  )
}

function JaugeOr({ store }: { readonly store: StoreJeuApi }) {
  const or = useStoreJeu(store, (s) => s.etat.bourse.or)
  return <Jauge libelle={TEXTES_UI.bandeau.or} valeur={formater(or)} />
}

function JaugeRenommee({ store }: { readonly store: StoreJeuApi }) {
  const renommee = useStoreJeu(store, (s) => s.etat.bourse.renommee)
  return <Jauge libelle={TEXTES_UI.bandeau.renommee} valeur={formater(renommee)} />
}

function JaugeEclats({ store }: { readonly store: StoreJeuApi }) {
  const eclats = useStoreJeu(store, (s) => s.etat.bourse.eclatsPossedes)
  return <Jauge libelle={TEXTES_UI.bandeau.eclats} valeur={formater(eclats)} />
}

function JaugeZone({ store }: { readonly store: StoreJeuApi }) {
  const zone = useStoreJeu(store, (s) => s.etat.combat.zone)
  return <Jauge libelle={TEXTES_UI.bandeau.zone} valeur={String(zone)} />
}

/** Vague 3 — région de contenu de la zone courante ; ne re-rend qu'au changement de région (10 zones). */
function JaugeRegion({ store }: { readonly store: StoreJeuApi }) {
  const index = useStoreJeu(store, (s) => indexRegion(s.etat.combat.zone))
  return <Jauge libelle={TEXTES_UI.bandeau.region} valeur={regionParIndex(index).nom} />
}

export function BandeauHaut({ store }: { readonly store: StoreJeuApi }) {
  return (
    <header
      className="flex flex-wrap items-center gap-1 border-b border-[var(--couleur-charbon-bordure)] bg-[var(--couleur-charbon-900)] px-3 py-1"
      aria-label={TEXTES_UI.titre}
    >
      <span className="mr-2 px-1 text-sm font-bold text-[var(--couleur-charbon-texte)]">
        {TEXTES_UI.titre}
      </span>
      <JaugeOr store={store} />
      <JaugeRenommee store={store} />
      <JaugeEclats store={store} />
      <JaugeZone store={store} />
      <JaugeRegion store={store} />
    </header>
  )
}
