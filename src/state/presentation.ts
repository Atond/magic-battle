// Mise en forme d'affichage partagée par plusieurs composants (pas une règle de jeu). Les unités et les
// tournures viennent de `TEXTES_UI`, jamais d'un littéral ici.

import { TEXTES_UI } from '../donnees/textes-ui.ts'

const MS_PAR_MINUTE = 60_000
const MINUTES_PAR_HEURE = 60

/** Minutes sous l'heure (au moins 1), heures + minutes au-delà. Une durée non finie ou négative vaut 0. */
export function formaterDuree(ms: number): string {
  const sure = Number.isFinite(ms) && ms > 0 ? ms : 0
  const minutesTotales = Math.round(sure / MS_PAR_MINUTE)
  if (minutesTotales < MINUTES_PAR_HEURE) return TEXTES_UI.duree.minutes(Math.max(minutesTotales, 1))
  const heures = Math.floor(minutesTotales / MINUTES_PAR_HEURE)
  const minutes = minutesTotales % MINUTES_PAR_HEURE
  return minutes === 0 ? TEXTES_UI.duree.heures(heures) : TEXTES_UI.duree.heuresMinutes(heures, minutes)
}
