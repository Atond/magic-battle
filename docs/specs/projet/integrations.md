# Plan d'intégrations Claude Code — idlev1 (integration-architect, 2026-09-20)

## Décisions
- 8 rôles de la spec §16 → **4 agents + 1 différé** : `implementeur-domaine` (opus, high), `equilibrage` (opus, high,
  skill atelier:idle-balance), `revue-lecture-seule` (opus, Read/Grep/Glob seulement), `implementeur-ui` (sonnet,
  vague 2, fusionne canvas), `narrateur` (sonnet, vague 3, fusionne contenu-zones). `implementeur-ci` supprimé
  (T-17 en session principale + context7). Tâches mécaniques (T-9, T-11, T-12, T-15, T-16) → subagent générique
  au `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`.
- Points d'entrée : `/ship` (verify + build, jamais push/merge main), `/equilibrer` (= equilibrage-pass :
  search → diff rapport → réinjection donnees/ → check vert). `/nouvelle-ecole`, `/nouvelle-zone` ne sont pas des
  commandes mais les skills model-invoked `ajouter-ecole-sort`, `ajouter-zone-monstres`.
- Skills §13 : `sauvegarde-migration` après T-10 ; `ajouter-ecole-sort`, `ajouter-zone-monstres` après T-15 et le
  premier exemplaire réel (extraits du diff, jamais rédigés d'avance).
- Rules `paths:` : `.claude/rules/domaine-pur.md` (src/domain/**), `.claude/rules/donnees-simulateur.md` (src/donnees/**).
  Repli si rules indisponibles : fusion dans CLAUDE.md (+400 tokens).
- Mémoire allégée : `.claude/memory/{INDEX,LEARNINGS,BLOCKERS,EVALS}.md`. Pas d'ADR.md (spec §15 = source unique),
  pas d'ITERATION_LOG.
- MCP : **context7 seul**, déjà disponible (aucun .mcp.json). Écartés : GitHub, Playwright, repowise, DB.
- Agent team : écartée. Fable : refusé (aucune justification). skills-lock / plugin : pas en mono-projet.
- `.claude/settings.local.json` existant (headroom, ANTHROPIC_BASE_URL) : ne pas toucher ; tout va dans `.claude/settings.json`.

## Tableau des artefacts
| besoin | type | fichier | rédigé par | modèle/effort | tools | done quand |
| --- | --- | --- | --- | --- | --- | --- |
| Contexte permanent | CLAUDE.md | `CLAUDE.md` | direct + token-optimizer | — | — | < 2k tokens ; versions stack.md ; 3 « Jamais » §10 ; commandes ; lien spec ; **aucune formule** |
| Frontières §10 + modèle subagents | settings | `.claude/settings.json` | direct | — | — | deny : push --force/-f, reset --hard, clean -fd, rm -rf, push origin main · ask : npm install, Edit(.github/workflows/**), rm · allow : Read/Grep/Glob, git status/diff/log, npm run typecheck/lint/test, verify.sh, equilibrage:check · env CLAUDE_CODE_SUBAGENT_MODEL=sonnet |
| Porte de qualité | hook + script | `.claude/hooks/stop-gate.sh`, `scripts/verify.sh` | direct | — | — | Stop bloquant, anti-boucle ; verify tolérant + grep pureté domain/ toujours actif |
| Pureté moteur | rule | `.claude/rules/domaine-pur.md` | skill-author | — | — | chargée sur src/domain/** ; interdit react/DOM ; constantes lues depuis src/donnees/ ; tests miroir |
| Valeurs = simulateur | rule | `.claude/rules/donnees-simulateur.md` | skill-author | — | — | toute constante → /equilibrer + rapport T-14 ; interdit « à valider »/« graine » dans src/ |
| Moteur pur (T-1..8, 10, 13) | agent | `.claude/agents/implementeur-domaine.md` | agent-designer | opus/high | Read, Grep, Glob, Edit, Write, Bash | test avant formule ; fixture migration jamais supprimée ; refuse constante hors rapport T-14 |
| Simulateur (T-14) | agent | `.claude/agents/equilibrage.md` | agent-designer | opus/high | idem + skill idle-balance | contraintes dures §8 = critères d'échec ; rapport archivé ; exploration dans le script |
| Revue fin de vague | agent | `.claude/agents/revue-lecture-seule.md` | agent-designer | opus/high | Read, Grep, Glob | checklist 5 volets, fichier:ligne, refuse de corriger |
| Mémoire | mémoire | `.claude/memory/*.md` | direct | — | — | 4 fichiers ; EVALS porte les chiffres T-14 |
| /ship (après T-17) | point d'entrée | `.claude/skills/ship/SKILL.md` | command-author | sonnet/low | Read, Bash(verify), Bash(build) | rouge → stop ; vert → build ; jamais push |
| /equilibrer (après T-14) | point d'entrée | `.claude/skills/equilibrer/SKILL.md` | command-author | opus/medium | Read, Edit, Bash(npm run equilibrage:*) | search → diff → réinjection → check vert |
| sauvegarde-migration (après T-10) | skill | `.claude/skills/sauvegarde-migration/SKILL.md` | skill-author | sonnet/medium | hérite | bump version → migration → fixture → test non-perte, extrait du diff T-10 |
| UI vague 2 | agent | `.claude/agents/implementeur-ui.md` | agent-designer | sonnet/medium | Read, Grep, Glob, Edit, Write, Bash, context7, skills vercel:shadcn + react-best-practices | Zustand sélectif ; canvas aria-hidden + miroir DOM ; 24/44 px ; reduced-motion ; n'écrit pas dans src/domain/ |
| Narration vague 3 | agent | `.claude/agents/narrateur.md` | agent-designer | sonnet/medium | Read, Grep, Glob, Edit | guide de ton §7 + 3 exemples ; n'écrit que src/donnees/*.ts ; relu par revue |
| ajouter-ecole-sort / ajouter-zone-monstres (vague 3) | skills | `.claude/skills/…/SKILL.md` | skill-author | sonnet/medium | hérite | extraits du 1er ajout réel post-T-15 |

## Ordre de pose
Vague 0 (avant tout code) : CLAUDE.md → settings.json → verify.sh + stop-gate.sh → 2 rules → 3 agents Opus → mémoire.
Vague 1 : /ship après T-17 · sauvegarde-migration après T-10 · /equilibrer après T-14.
Vague 2 : implementeur-ui avant T-18. Vague 3 : narrateur avant T-24 ; skills ajouter-* après le 1er exemplaire.

## Budget
CLAUDE.md ~2k tokens (cache) + descriptions skills ~180 + context7 ~1-2k. Rules ~300 sur chemins concernés.
Coût/session : tâche domaine Opus 1,2-2 $ · T-14 2-3 $ · tâche UI Sonnet 0,2-0,3 $ · revue 0,3 $ · /ship < 0,05 $.
Chantier complet ≈ 20-25 $ (jusqu'à ~50 $ avec reprises). À recaler avec /usage après la vague 1.

## Patterns durables
Porte de qualité jour 0 · deny-list = « Jamais » §10 · invariant vérifié par grep · mémoire BLOCKER→LEARNING · provenance dans chaque artefact.
