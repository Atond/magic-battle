// HUD (T-19). Store créé une seule fois, **au chargement du module** (pas dans un hook React) : ADR-19
// veut l'état hors React, et un `useState(() => creerStoreJeu(...))` serait rappelé deux fois par
// `<StrictMode>` en dev (double invocation des initialiseurs paresseux), ouvrant deux boucles de jeu et
// deux jeux de minuteurs dont un seul serait jamais nettoyé. L'évaluation d'un module, elle, n'a lieu
// qu'une fois quel que soit le mode — c'est le bon endroit pour un singleton qui vit toute la session.
//
// Ports navigateur minimaux (horloge, planificateur, page réels) ; persistance encore en mémoire — la
// persistance réelle (localStorage/BroadcastChannel, ADR-21) et le verrou multi-onglet fonctionnel sont
// T-23a.

import { etatInitial } from './domain/moteur.ts'
import { Disposition } from './components/hud/Disposition.tsx'
import { TEXTES_UI } from './donnees/textes-ui.ts'
import { creerStoreJeu } from './state/store.ts'
import { useStoreJeu } from './state/hooks.ts'
import {
  creerCanalMemoire,
  creerHorlogeNavigateur,
  creerIdOnglet,
  creerMatchMediaNavigateur,
  creerPortPageNavigateur,
  creerPortPlanificateurNavigateur,
  creerStockageMemoire,
} from './state/portsNavigateur.ts'

const store = creerStoreJeu({
  horloge: creerHorlogeNavigateur(),
  stockage: creerStockageMemoire(),
  canal: creerCanalMemoire(),
  matchMedia: creerMatchMediaNavigateur(),
  idOnglet: creerIdOnglet(),
  portPage: creerPortPageNavigateur(),
  portPlanificateur: creerPortPlanificateurNavigateur(),
  etatInitial,
})

export default function App() {
  const pret = useStoreJeu(store, (s) => s.pret)

  if (!pret) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--couleur-charbon-950)] text-[var(--couleur-charbon-texte)]">
        <p>{TEXTES_UI.chargement}</p>
      </main>
    )
  }

  return <Disposition store={store} />
}
