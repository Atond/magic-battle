// Zones, vagues et boss — point d'entrée du domaine de combat (T-5).
//   `formules.ts` : les formules paramétriques sans borne (ADR-13, EXG-6, EXG-15, EXG-16) ;
//   `combat.ts`   : l'avancement d'un pas de combat à coût constant (EXG-16, EXG-17, EXG-30).
// Découpé en deux fichiers pour rester lisible ; la frontière est nette (calcul pur vs progression).

export {
  creerBoss,
  creerMonstre,
  facteurZone,
  multOrZone,
  orMonstre,
  orPourDegats,
  pvBaseVague1,
  pvBoss,
  pvCumulVagues,
  pvVague,
  timerBossMs,
  vaguesNettoyees,
} from './formules.ts'
export { avancerCombat } from './combat.ts'
