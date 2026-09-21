#!/usr/bin/env bash
# Hook Stop — idlev1 (repris de nylnatosport). Deux rôles :
#   1. Gate « vérifier avant de dire fait » : si l'arbre Git a changé, lance scripts/verify.sh
#      et INTERDIT de clore tant que ça casse.
#   2. Nudge mémoire : quand verify est vert ET qu'il y a eu du travail, rappelle UNE fois de
#      journaliser un blocage résolu dans .claude/memory/ (BLOCKERS → LEARNINGS).
# Un tour sans changement (Q&R pure) ne déclenche rien.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

entree="$(cat)"
# stop_hook_active = true quand Claude Code relance ce hook après un premier blocage sur le même
# tour : anti-boucle, on ne bloque jamais deux fois de suite sur le même échec.
deja_actif=0
printf '%s' "$entree" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && deja_actif=1

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  [ -z "$(git status --porcelain 2>/dev/null)" ] && exit 0
fi

if [ -f scripts/verify.sh ]; then
  sortie="$(bash scripts/verify.sh 2>&1)"; code=$?
  if [ "$code" -ne 0 ]; then
    if [ "$deja_actif" -eq 1 ]; then
      echo "⚠️ verify.sh échoue encore après un premier blocage sur ce tour — clôture autorisée pour éviter une boucle. À corriger au prochain tour." >&2
      exit 0
    fi
    reason="Verify a échoué — NE PAS clore avant que ce soit vert :

$sortie"
    if command -v python3 >/dev/null 2>&1; then
      esc="$(printf '%s' "$reason" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
    else
      esc="\"$(printf '%s' "$reason" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n",$0}')\""
    fi
    printf '{"decision":"block","reason":%s}\n' "$esc"
    exit 0
  fi
fi

[ "$deja_actif" -eq 1 ] && exit 0
printf '{"decision":"block","reason":"✅ verify OK. Si un blocage vient d'\''être résolu ce tour, note-le dans .claude/memory/BLOCKERS.md (Résolu) et le LEARNING correspondant dans LEARNINGS.md. Sinon, referme simplement."}\n'
exit 0
