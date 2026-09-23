// Disposition HUD (T-19, spec §7 « disposition »). Bascule CSS pure entre deux mises en page — pas de
// JS de détection de largeur (`matchMedia` reste réservé à `prefers-reduced-motion`, EXG-29/EXG-50) :
//   - desktop (≥ 1024 px, `lg:`) : 3 colonnes — écoles | combat + sorts | améliorations/équipement/
//     arbre d'Éclats/prestige — sous le bandeau haut ;
//   - mobile (< 1024 px) : combat + sorts fixes en haut, onglets Écoles / Améliorations / Prestige
//     dessous (le regroupement « Améliorations » couvre améliorations + équipement + arbre d'Éclats).
//
// Les deux arborescences existent toutes les deux dans le DOM ; seule celle qui correspond à la largeur
// réelle est visible (`hidden`/`lg:hidden` → `display: none`), donc absente des requêtes de rôle et des
// mesures de mise en page (`getBoundingClientRect` d'un élément caché vaut zéro) — jamais deux versions
// visibles en même temps du même bouton.

import { useState } from 'react'

import { TEXTES_UI } from '../../donnees/textes-ui.ts'
import type { StoreJeuApi } from '../../state/store.ts'
import { BandeauHaut } from './BandeauHaut.tsx'
import { BandeauLectureSeule } from './BandeauLectureSeule.tsx'
import { EncartHorsLigne } from './EncartHorsLigne.tsx'
import { EncartNarration } from './EncartNarration.tsx'
import { EncartStockagePlein } from './EncartStockagePlein.tsx'
import { useRaccourcisSorts } from './BarreSorts.tsx'
import { PanneauAmeliorations } from './PanneauAmeliorations.tsx'
import { PanneauArbreEclats } from './PanneauArbreEclats.tsx'
import { PanneauCentral } from './PanneauCentral.tsx'
import { PanneauEcoles } from './PanneauEcoles.tsx'
import { PanneauEquipement } from './PanneauEquipement.tsx'
import { PanneauPrestige } from './PanneauPrestige.tsx'
import { PanneauQuetes } from './PanneauQuetes.tsx'
import { useUneModaleEstOuverte } from './modaleOuverteGlobale.ts'

type OngletMobile = 'ecoles' | 'ameliorations' | 'prestige'

const ONGLETS: readonly { readonly id: OngletMobile; readonly libelle: string }[] = [
  { id: 'ecoles', libelle: TEXTES_UI.onglets.ecoles },
  { id: 'ameliorations', libelle: TEXTES_UI.onglets.ameliorations },
  { id: 'prestige', libelle: TEXTES_UI.onglets.prestige },
]

/**
 * Améliorations + équipement + quêtes + arbre d'Éclats. Les quêtes sont rangées juste après
 * l'équipement : c'est leur Renommée qui le paie (EXG-10), le joueur voit d'où vient la monnaie à côté
 * de ce qu'elle achète — même onglet « Améliorations » sur mobile.
 */
function ColonneAchats({ store }: { readonly store: StoreJeuApi }) {
  return (
    <>
      <PanneauAmeliorations store={store} />
      <PanneauEquipement store={store} />
      <PanneauQuetes store={store} />
      <PanneauArbreEclats store={store} />
    </>
  )
}

function DispositionDesktop({ store }: { readonly store: StoreJeuApi }) {
  return (
    <div className="hidden gap-3 p-3 lg:grid lg:grid-cols-[260px_1fr_300px] lg:items-start">
      <div className="flex flex-col overflow-y-auto">
        <PanneauEcoles store={store} />
      </div>
      <div className="flex flex-col overflow-y-auto">
        <PanneauCentral store={store} />
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto">
        <ColonneAchats store={store} />
        <PanneauPrestige store={store} />
      </div>
    </div>
  )
}

function DispositionMobile({ store }: { readonly store: StoreJeuApi }) {
  const [onglet, setOnglet] = useState<OngletMobile>('ecoles')

  return (
    <div className="flex flex-col gap-2 p-2 lg:hidden">
      <PanneauCentral store={store} />
      <div role="tablist" aria-label={TEXTES_UI.titre} className="flex gap-1 border-b border-[var(--couleur-charbon-bordure)]">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={onglet === o.id}
            className="min-h-11 flex-1 rounded-t-md px-2 py-2 text-sm font-medium text-[var(--couleur-charbon-texte)] aria-selected:bg-[var(--couleur-charbon-800)] aria-selected:font-semibold"
            onClick={() => setOnglet(o.id)}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-col gap-2">
        {onglet === 'ecoles' && <PanneauEcoles store={store} />}
        {onglet === 'ameliorations' && <ColonneAchats store={store} />}
        {onglet === 'prestige' && <PanneauPrestige store={store} />}
      </div>
    </div>
  )
}

export function Disposition({ store }: { readonly store: StoreJeuApi }) {
  // Une seule fois pour toute la disposition (EXG-13/EXG-34) : `PanneauCentral` est monté deux fois en
  // parallèle (desktop caché + mobile visible), voir le commentaire de `useRaccourcisSorts`.
  useRaccourcisSorts(store)

  // Tant qu'une modale est ouverte (prestige, Ascension…), le reste de l'appli est réellement retiré du
  // flux (`display:none`, pas seulement `aria-hidden`) — `modaleOuverteGlobale.ts` documente pourquoi :
  // du contenu de fond en flux normal, simplement couvert visuellement par le voile `position: fixed` de
  // la modale (portée hors de cet arbre via `createPortal`), peut sinon se retrouver aux mêmes
  // coordonnées écran qu'elle, ambigu pour un lecteur d'écran en mode « parcourir » comme pour un audit
  // géométrique automatisé.
  const modaleOuverte = useUneModaleEstOuverte()

  return (
    <div className="min-h-screen bg-[var(--couleur-charbon-950)]">
      <div className={modaleOuverte ? 'hidden' : undefined} aria-hidden={modaleOuverte || undefined}>
        <BandeauHaut store={store} />
        <BandeauLectureSeule store={store} />
        <EncartStockagePlein store={store} />
        <EncartHorsLigne store={store} />
        <EncartNarration store={store} />
        {/* T-22, règle axe `region` : tout le contenu visible doit vivre dans un point de repère. Le
            bandeau haut est déjà un `<header>` ; le reste (bannières de statut + les deux dispositions,
            desktop caché en CSS + mobile visible) va dans ce `<main>` unique. */}
        <main>
          <DispositionDesktop store={store} />
          <DispositionMobile store={store} />
        </main>
      </div>
    </div>
  )
}
