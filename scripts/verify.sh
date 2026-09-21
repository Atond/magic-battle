#!/usr/bin/env bash
# Garde-fou « vérifier avant de dire fait » — idlev1.
# Principe (repris de nylnatosport) : ne vérifie QUE ce qui existe. Une étape dont le script npm ou
# node_modules manque est ignorée proprement. Deux étapes sont TOUJOURS actives car ce sont de simples
# grep, indépendants de l'outillage :
#   (p) pureté de src/domain/ — aucun import react / zustand / DOM (spec §9, invariant 1) ;
#   (g) aucune graine d'équilibrage dans src/ — « à valider », « graine » (spec ADR-10, invariant 2).
# Lancé à la main (`bash scripts/verify.sh` / `npm run verify`) ET par le hook Stop.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 0

fail=0
lignes=()
ok()     { lignes+=("  OK      — $1"); }
ignore() { lignes+=("  IGNORÉ  — $1 ($2)"); }
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
  impurs="$(grep -rEn "from ['\"](react|react-dom|zustand)|\b(window|document|localStorage|sessionStorage|requestAnimationFrame|navigator)\b" src/domain --include='*.ts' --include='*.tsx' 2>/dev/null || true)"
  if [ -n "$impurs" ]; then
    echo "$impurs"; echec "pureté src/domain/ (import react/zustand ou accès DOM interdit — spec §9)"
  else ok "pureté src/domain/"; fi
else
  ignore "pureté src/domain/" "dossier absent"
fi

# --- (g) aucune graine d'équilibrage dans src/ : toujours actif dès que src existe ---
if [ -d src ]; then
  graines="$(grep -rEn "à valider|graine|TODO équilibrage" src --include='*.ts' --include='*.tsx' 2>/dev/null || true)"
  if [ -n "$graines" ]; then
    echo "$graines"; echec "graines d'équilibrage dans src/ (les valeurs viennent du rapport idle-balance — ADR-10)"
  else ok "aucune graine dans src/"; fi
else
  ignore "graines dans src/" "dossier absent"
fi

# --- étapes npm (tolérantes) ---
etape_npm typecheck          "typecheck"
etape_npm lint               "lint"
etape_npm test               "test (vitest)"
etape_npm equilibrage:check  "equilibrage:check (rejoue les constantes archivées, < 10 s)"
etape_npm build              "build (vite)"

echo; printf '%s\n' "${lignes[@]}"; echo
if [ "$fail" -ne 0 ]; then
  echo "🛑 Vérification échouée : NE PAS déclarer la tâche terminée tant que ce n'est pas vert."
  exit 2
fi
echo "✅ Vérification OK."
exit 0
