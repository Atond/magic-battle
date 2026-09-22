// Vue par domaine sur `CONSTANTES` (T-15) — pas une source : les nombres viennent de
// `tools/idle-balance/rapports/2026-09-21.md` et de sa révision
// `tools/idle-balance/rapports/2026-09-21-revision-adr17-bossfinal.md`, via `src/donnees/constantes.ts`,
// généré par `npm run equilibrage:search`. Ne pas y écrire de nombre à la main.
//
// La vague 3 ajoutera ici les textes de fin de partie (boss final, épilogue) à côté de ces nombres.

import { CONSTANTES } from './constantes.ts'

/**
 * EXG-28 / EXG-44 — conditions de fin de partie et zone dédiée du boss final.
 *
 * Les cinq champs vivent désormais dans `fin` : `nAscensionsRequises`, `zoneBossFinal`,
 * `pvProfondeurEquivalente`, `pvMultiplicateur`, `timerBossFinalS`.
 *
 * `zoneBossFinal` est le **nom** de la zone dédiée, jamais une profondeur de progression : le boss final
 * ne vit pas sur l'échelle normale des zones, sinon le joueur le croiserait pendant un run ordinaire (la
 * profondeur maximale mesurée est 118). Ses PV ne s'en déduisent donc pas — ils valent
 * `pvBoss(pvProfondeurEquivalente) × pvMultiplicateur`, et son chrono est `timerBossFinalS`, distinct de
 * `zones.timerBossS`.
 */
export const FIN = CONSTANTES.fin
