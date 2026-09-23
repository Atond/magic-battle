#!/usr/bin/env bash
# Garde-fou « vérifier avant de dire fait » — idlev1.
# Principe (repris de nylnatosport) : ne vérifie QUE ce qui existe. Une étape dont le script npm ou
# node_modules manque est ignorée proprement. Deux étapes sont TOUJOURS actives car ce sont de simples
# grep, indépendants de l'outillage :
#   (p) pureté de src/domain/ — aucun import react / zustand / DOM (spec §9, invariant 1) ;
#   (g) aucune graine d'équilibrage dans src/ — « à valider », « graine » (spec ADR-10, invariant 2).
# Les deux étapes d'équilibrage ne font pas le même travail et aucune ne remplace l'autre :
#   · `equilibrage:check`     rejoue les contraintes §8 — il attrape une valeur qui CASSE une contrainte ;
#   · `equilibrage:empreinte` compare le fichier commité au vecteur archivé — il attrape une valeur
#     retouchée à la main qui garde 13/13, c'est-à-dire précisément celle que `check` laisse passer.
# Lancé à la main (`bash scripts/verify.sh` / `npm run verify`) ET par le hook Stop.
#
# Mode strict — `bash scripts/verify.sh --strict` (ou `VERIFY_STRICT=1`) : toute étape IGNORÉE devient un
# ÉCHEC. La tolérance ci-dessus est ce qui permet de travailler pendant la vague 1, où `equilibrage:check`
# n'existe pas encore ; en CI elle devient un angle mort, car un `node_modules` non installé ou un script
# npm disparu du `package.json` produirait IGNORÉ → sortie 0 → « vert ». Le mode strict est donc réservé
# à la CI, et n'y est branché qu'une fois toutes les étapes réellement présentes (T-16).
set -uo pipefail
# Un garde-fou ne sort jamais 0 sur un chemin d'échec : un `cd` raté passerait pour « vert ».
cd "$(dirname "$0")/.." || { echo "verify.sh : impossible d'atteindre la racine du dépôt." >&2; exit 2; }

strict=0
for argument in "$@"; do
  case "$argument" in
    --strict) strict=1 ;;
    *) echo "verify.sh : argument inconnu « $argument » (seul --strict est reconnu)." >&2; exit 64 ;;
  esac
done
[ "${VERIFY_STRICT:-0}" = "1" ] && strict=1

fail=0
lignes=()
ok()     { lignes+=("  OK      — $1"); }
ignore() {
  if [ "$strict" -eq 1 ]; then
    lignes+=("  ÉCHEC   — $1 (ignorée, refusée en mode strict : $2)"); fail=1
  else
    lignes+=("  IGNORÉ  — $1 ($2)")
  fi
}
echec()  { lignes+=("  ÉCHEC   — $1"); fail=1; }

a_script_npm() {
  [ -f package.json ] || return 1
  node -e "process.exit(require('./package.json').scripts?.['$1']?0:1)" 2>/dev/null
}
etape_npm() {
  local script="$1" libelle="$2"
  if ! a_script_npm "$script"; then ignore "$libelle" "script npm absent"
  elif [ ! -d node_modules ]; then ignore "$libelle" "node_modules absent"
  elif npm run --silent "$script"; then ok "$libelle"
  else echec "$libelle"; fi
}

echo "=== verify.sh — idlev1 ==="

# --- (p) pureté du moteur : toujours actif dès que src/domain existe ---
if [ -d src/domain ]; then
  # Trois familles, toutes signalées par la revue de fin de vague 1 comme des trous du motif d'origine :
  #  · imports interdits — pas seulement la forme `from '…'` : un `import 'zustand/vanilla'` (effet de
  #    bord), un `await import('react')` ou un `require('react')` passaient ;
  #  · accès au navigateur ou au stockage, `BroadcastChannel` compris (c'est nommément l'API d'EXG-48,
  #    et sa place est dans `src/state/`, pas dans le moteur) ;
  #  · lecture d'horloge ou hasard — le trou le plus facile à creuser par inadvertance et le plus cher :
  #    il rend le moteur non reproductible, donc le simulateur non comparable. Tout horodatage est un
  #    paramètre (EXG-49).
  interdits="(react|react-dom|zustand)"
  plateforme="window|document|localStorage|sessionStorage|requestAnimationFrame|navigator|globalThis|self|indexedDB|caches|fetch|XMLHttpRequest|BroadcastChannel|crypto|atob|btoa|process"
  horloge="Date\.now|performance\.now|new Date|Math\.random"
  impurs="$(grep -rEn "(from|import|require)[[:space:]]*\(?['\"]$interdits|\b($plateforme)\b|\b($horloge)\b" src/domain --include='*.ts' --include='*.tsx' 2>/dev/null | grep -vE ':[[:space:]]*(//|\*|/\*)' || true)"
  # L'autre moitié de l'invariant 2 : le moteur reçoit ses valeurs en paramètre, il ne les importe pas.
  # Un `import { CONSTANTES } from '../donnees/…'` dans `src/domain/` détruirait la testabilité en
  # isolation sans qu'aucune autre étape ne le voie.
  fuites="$(grep -rEn "from ['\"][^'\"]*(donnees|state|components|canvas)/" src/domain --include='*.ts' --include='*.tsx' 2>/dev/null || true)"
  impurs="$(printf '%s\n%s' "$impurs" "$fuites" | grep -v '^$' || true)"
  if [ -n "$impurs" ]; then
    echo "$impurs"; echec "pureté src/domain/ (import react/zustand ou accès DOM interdit — spec §9)"
  else ok "pureté src/domain/"; fi
else
  ignore "pureté src/domain/" "dossier absent"
fi

# --- (g) aucune graine d'équilibrage dans src/ : toujours actif dès que src existe ---
if [ -d src ]; then
  # Insensible à la casse (« Graine », « À VALIDER » passaient) et étendu au JSON : `src/donnees/`
  # pourrait un jour porter du contenu en `.json`, que le motif d'origine ne lisait pas.
  graines="$(grep -rEniI "à valider|graine|TODO équilibrage" src --include='*.ts' --include='*.tsx' --include='*.json' 2>/dev/null || true)"
  if [ -n "$graines" ]; then
    echo "$graines"; echec "graines d'équilibrage dans src/ (les valeurs viennent du rapport idle-balance — ADR-10)"
  else ok "aucune graine dans src/"; fi
else
  ignore "graines dans src/" "dossier absent"
fi

# --- (h) aucun rendu HTML non filtré dans src/ (EXG-47) : toujours actif dès que src existe ---
if [ -d src ]; then
  # Une sauvegarde ou un texte hostile traverse la couche d'affichage comme une chaîne, jamais comme du
  # balisage (spec EXG-47) : `dangerouslySetInnerHTML` (React), `.innerHTML`/`.insertAdjacentHTML` (DOM)
  # sont les trois portes qui feraient exécuter un `<img onerror=…>` planqué dans un nom de sauvegarde.
  html_non_filtre="$(grep -rEn 'dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML' src --include='*.ts' --include='*.tsx' 2>/dev/null | grep -vE ':[[:space:]]*(//|\*|/\*)' || true)"
  if [ -n "$html_non_filtre" ]; then
    echo "$html_non_filtre"; echec "aucun rendu HTML non filtré dans src/ (dangerouslySetInnerHTML/innerHTML/insertAdjacentHTML — EXG-47)"
  else ok "aucun rendu HTML non filtré dans src/ (EXG-47)"; fi
else
  ignore "rendu HTML non filtré dans src/" "dossier absent"
fi

# --- étapes npm (tolérantes) ---
etape_npm typecheck          "typecheck"
etape_npm lint               "lint"
etape_npm test               "test (vitest)"
etape_npm equilibrage:check  "equilibrage:check (rejoue les constantes archivées, < 10 s)"
etape_npm equilibrage:empreinte "equilibrage:empreinte (src/donnees/ = sortie du vecteur archivé)"
etape_npm palette:ratios      "palette:ratios (contraste WCAG des paires de jetons — T-22, EXG-31/32)"
etape_npm build              "build (vite)"

echo; printf '%s\n' "${lignes[@]}"; echo
if [ "$fail" -ne 0 ]; then
  echo "🛑 Vérification échouée : NE PAS déclarer la tâche terminée tant que ce n'est pas vert."
  exit 2
fi
echo "✅ Vérification OK."
exit 0
