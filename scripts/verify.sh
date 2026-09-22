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
cd "$(dirname "$0")/.." || exit 0

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
etape_npm equilibrage:empreinte "equilibrage:empreinte (src/donnees/ = sortie du vecteur archivé)"
etape_npm build              "build (vite)"

echo; printf '%s\n' "${lignes[@]}"; echo
if [ "$fail" -ne 0 ]; then
  echo "🛑 Vérification échouée : NE PAS déclarer la tâche terminée tant que ce n'est pas vert."
  exit 2
fi
echo "✅ Vérification OK."
exit 0
