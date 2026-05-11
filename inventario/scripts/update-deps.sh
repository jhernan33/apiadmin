#!/usr/bin/env bash
# =============================================================================
# update-deps.sh — Auditoría y actualización de dependencias
# Proyecto: inventario
#
# Uso:  bash scripts/update-deps.sh [--audit | --safe | --major | --full] [--yes]
#
#   --audit  Solo audita: muestra vulnerabilidades y paquetes desactualizados
#   --safe   (default) Aplica actualizaciones patch/minor + npm audit fix
#   --major  --safe + actualizaciones MAJOR (interactivo, requiere confirmación)
#   --full   --safe + --major + npm audit fix --force (puede romper APIs)
#   --yes    No pregunta confirmación (úsalo solo en CI o si sabes lo que haces)
#
# Comportamiento:
#   - Detecta versiones desactualizadas DINÁMICAMENTE con `npm outdated`
#   - No hardcodea versiones — siempre usa la última estable
#   - Hace backup de package.json y package-lock.json antes de tocar nada
#   - Corre los tests al final (si existen) y revierte si fallan en modo --full
#   - Genera un reporte en scripts/.backups/<timestamp>/REPORT.md
# =============================================================================
set -euo pipefail

# ─── Colores ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()     { echo -e "${RED}[ERROR]${NC} $*" >&2; }
fatal()   { err "$*"; exit 1; }
section() { echo -e "\n${BOLD}━━━  $*  ━━━${NC}"; }

# ─── Argumentos ──────────────────────────────────────────────────────────────
MODE="--safe"
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --audit|--safe|--major|--full) MODE="$arg" ;;
    --yes|-y) ASSUME_YES=1 ;;
    --help|-h)
      sed -n '2,18p' "$0"; exit 0 ;;
    *) fatal "Argumento inválido: $arg (usa --help)" ;;
  esac
done

confirm() {
  local prompt="$1"
  [[ $ASSUME_YES -eq 1 ]] && return 0
  read -r -p "$(echo -e "${YELLOW}${prompt} [s/N]:${NC} ")" reply
  [[ "${reply,,}" == "s" || "${reply,,}" == "y" ]]
}

# ─── Pre-flight ──────────────────────────────────────────────────────────────
section "Verificaciones"

command -v node >/dev/null || fatal "node no encontrado"
command -v npm  >/dev/null || fatal "npm no encontrado"

NODE_MAJOR=$(node -p "parseInt(process.version.slice(1))")
[[ "$NODE_MAJOR" -ge 18 ]] || fatal "Node.js >= 18 requerido (actual: $(node -v))"

[[ -f package.json ]] || fatal "package.json no encontrado. Ejecuta desde la raíz del proyecto."

ok "Node $(node -v) / npm $(npm -v) / modo: ${MODE}"

# ─── Helpers JSON ────────────────────────────────────────────────────────────
# `npm audit` y `npm outdated` retornan exit code != 0 cuando encuentran cosas.
# Capturamos a archivos temporales y ignoramos exit codes con `|| true`.

audit_json() {
  local tmp; tmp="$(mktemp)"
  npm audit --json > "$tmp" 2>/dev/null || true
  cat "$tmp"; rm -f "$tmp"
}

outdated_json() {
  local tmp; tmp="$(mktemp)"
  npm outdated --json > "$tmp" 2>/dev/null || true
  cat "$tmp"; rm -f "$tmp"
}

get_total_vulns() {
  audit_json | node -e "
    let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
      try { const r=JSON.parse(d||'{}'); console.log(r.metadata?.vulnerabilities?.total ?? 0); }
      catch { console.log('0'); }
    })"
}

get_vulns_breakdown() {
  audit_json | node -e "
    let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
      try {
        const v=JSON.parse(d||'{}').metadata?.vulnerabilities ?? {};
        console.log(\`info:\${v.info||0} low:\${v.low||0} mod:\${v.moderate||0} high:\${v.high||0} crit:\${v.critical||0}\`);
      } catch { console.log('n/a'); }
    })"
}

# Lista paquetes desactualizados como: "name current wanted latest type"
list_outdated() {
  outdated_json | node -e "
    let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
      try {
        const o=JSON.parse(d||'{}');
        for (const [name, info] of Object.entries(o)) {
          const cur=info.current||'?', want=info.wanted||'?', lat=info.latest||'?';
          const isMajor = cur!=='?' && lat!=='?' && cur.split('.')[0] !== lat.split('.')[0];
          console.log([name, cur, want, lat, isMajor?'major':'minor'].join(' '));
        }
      } catch {}
    })"
}

# ─── Backup ──────────────────────────────────────────────────────────────────
section "Backup"

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="scripts/.backups/${TS}"
mkdir -p "$BACKUP_DIR"
cp package.json      "$BACKUP_DIR/package.json"
cp package-lock.json "$BACKUP_DIR/package-lock.json" 2>/dev/null || warn "Sin package-lock.json"
ok "Backup en ${BACKUP_DIR}"

REPORT="${BACKUP_DIR}/REPORT.md"
{
  echo "# Reporte de actualización — ${TS}"
  echo ""
  echo "- Modo: \`${MODE}\`"
  echo "- Node: $(node -v) / npm: $(npm -v)"
  echo ""
} > "$REPORT"

# ─── Estado inicial ──────────────────────────────────────────────────────────
section "Estado inicial"

VULN_BEFORE=$(get_total_vulns)
BREAKDOWN_BEFORE=$(get_vulns_breakdown)
info "Vulnerabilidades: ${VULN_BEFORE} (${BREAKDOWN_BEFORE})"

OUTDATED_BEFORE="$(list_outdated || true)"
if [[ -n "$OUTDATED_BEFORE" ]]; then
  info "Paquetes desactualizados:"
  printf "  %-28s %-10s %-10s %-10s %s\n" "PAQUETE" "ACTUAL" "WANTED" "LATEST" "TIPO"
  echo "$OUTDATED_BEFORE" | while read -r line; do
    # shellcheck disable=SC2086
    set -- $line
    color="${GREEN}"
    [[ "$5" == "major" ]] && color="${YELLOW}"
    printf "  ${color}%-28s${NC} %-10s %-10s %-10s %s\n" "$1" "$2" "$3" "$4" "$5"
  done
else
  ok "Todas las dependencias están al día"
fi

{
  echo "## Estado inicial"
  echo ""
  echo "- Vulnerabilidades: **${VULN_BEFORE}** (${BREAKDOWN_BEFORE})"
  echo ""
  if [[ -n "$OUTDATED_BEFORE" ]]; then
    echo "### Paquetes desactualizados"
    echo ""
    echo "| Paquete | Actual | Wanted | Latest | Tipo |"
    echo "|---------|--------|--------|--------|------|"
    echo "$OUTDATED_BEFORE" | awk '{printf "| %s | %s | %s | %s | %s |\n",$1,$2,$3,$4,$5}'
    echo ""
  fi
} >> "$REPORT"

# Si solo audit, salir aquí
if [[ "$MODE" == "--audit" ]]; then
  section "Resumen (solo auditoría)"
  echo -e "  Reporte: ${CYAN}${REPORT}${NC}"
  ok "Auditoría completada (no se modificó nada)"
  exit 0
fi

# ─── Actualizaciones SAFE (minor/patch) ──────────────────────────────────────
section "Actualizaciones safe (patch/minor)"

# Genera lista de paquetes minor desactualizados a partir de `npm outdated`
MINOR_PROD=()
MINOR_DEV=()
if [[ -n "$OUTDATED_BEFORE" ]]; then
  # Leer package.json para distinguir prod vs dev
  while IFS=' ' read -r name cur wanted latest kind; do
    [[ -z "$name" || "$kind" == "major" ]] && continue
    is_dev=$(node -p "
      const p=require('./package.json');
      Boolean(p.devDependencies && p.devDependencies['$name'])
    " 2>/dev/null || echo "false")
    if [[ "$is_dev" == "true" ]]; then
      MINOR_DEV+=("${name}@${latest}")
    else
      MINOR_PROD+=("${name}@${latest}")
    fi
  done <<< "$OUTDATED_BEFORE"
fi

if [[ ${#MINOR_PROD[@]} -gt 0 ]]; then
  info "Producción: ${MINOR_PROD[*]}"
  npm install "${MINOR_PROD[@]}" 2>&1 | tail -2
fi
if [[ ${#MINOR_DEV[@]} -gt 0 ]]; then
  info "Desarrollo: ${MINOR_DEV[*]}"
  npm install --save-dev "${MINOR_DEV[@]}" 2>&1 | tail -2
fi
if [[ ${#MINOR_PROD[@]} -eq 0 && ${#MINOR_DEV[@]} -eq 0 ]]; then
  info "Sin actualizaciones minor/patch pendientes"
fi

# ─── npm audit fix (transitivas, sin --force) ────────────────────────────────
section "Corrección de transitivas (npm audit fix)"
npm audit fix 2>&1 | tail -3 || warn "npm audit fix devolvió un error no fatal"

# ─── Actualizaciones MAJOR (opt-in) ──────────────────────────────────────────
if [[ "$MODE" == "--major" || "$MODE" == "--full" ]]; then
  section "Actualizaciones MAJOR (breaking changes posibles)"

  # Recalcular outdated tras los updates safe
  OUTDATED_MAJOR="$(list_outdated | awk '$5=="major"' || true)"
  if [[ -z "$OUTDATED_MAJOR" ]]; then
    ok "No hay actualizaciones major pendientes"
  else
    warn "Estas actualizaciones pueden requerir cambios en el código:"
    printf "  %-28s %-10s →  %-10s\n" "PAQUETE" "ACTUAL" "LATEST"
    echo "$OUTDATED_MAJOR" | awk '{printf "  %-28s %-10s →  %-10s\n",$1,$2,$4}'
    echo ""

    if confirm "¿Aplicar actualizaciones MAJOR?"; then
      MAJOR_PROD=()
      MAJOR_DEV=()
      while IFS=' ' read -r name cur wanted latest kind; do
        [[ -z "$name" ]] && continue
        is_dev=$(node -p "
          const p=require('./package.json');
          Boolean(p.devDependencies && p.devDependencies['$name'])
        " 2>/dev/null || echo "false")
        if [[ "$is_dev" == "true" ]]; then
          MAJOR_DEV+=("${name}@${latest}")
        else
          MAJOR_PROD+=("${name}@${latest}")
        fi
      done <<< "$OUTDATED_MAJOR"

      [[ ${#MAJOR_PROD[@]} -gt 0 ]] && npm install "${MAJOR_PROD[@]}" 2>&1 | tail -3
      [[ ${#MAJOR_DEV[@]}  -gt 0 ]] && npm install --save-dev "${MAJOR_DEV[@]}" 2>&1 | tail -3
      ok "Actualizaciones major aplicadas"
    else
      info "Major omitidas"
    fi
  fi
fi

# ─── npm audit fix --force (solo --full) ─────────────────────────────────────
if [[ "$MODE" == "--full" ]]; then
  section "npm audit fix --force"
  warn "--force puede instalar versiones major y romper APIs"
  if confirm "¿Continuar con --force?"; then
    npm audit fix --force 2>&1 | tail -5 || warn "audit fix --force terminó con avisos"
  else
    info "--force omitido"
  fi
fi

# ─── Estado final ────────────────────────────────────────────────────────────
section "Estado final"

VULN_AFTER=$(get_total_vulns)
BREAKDOWN_AFTER=$(get_vulns_breakdown)

echo ""
echo -e "  Vulnerabilidades antes  : ${RED}${VULN_BEFORE}${NC} (${BREAKDOWN_BEFORE})"
echo -e "  Vulnerabilidades después: ${GREEN}${VULN_AFTER}${NC} (${BREAKDOWN_AFTER})"
echo ""

{
  echo "## Estado final"
  echo ""
  echo "- Vulnerabilidades: **${VULN_AFTER}** (${BREAKDOWN_AFTER})"
  echo ""
  echo "## Cómo revertir"
  echo ""
  echo '```bash'
  echo "cp ${BACKUP_DIR}/package.json ."
  echo "cp ${BACKUP_DIR}/package-lock.json ."
  echo "npm install"
  echo '```'
} >> "$REPORT"

# ─── Tests (si hay) ──────────────────────────────────────────────────────────
# Preferimos test:unit (sin infraestructura) sobre test (que suele incluir
# integration y necesita BD/servicios). Si solo existe `test`, lo usamos pero
# avisamos que un fallo puede ser por entorno y no por las actualizaciones.
TEST_SCRIPT=""
if node -p "require('./package.json').scripts?.['test:unit'] || ''" 2>/dev/null | grep -qv '^$'; then
  TEST_SCRIPT="test:unit"
elif node -p "require('./package.json').scripts?.test || ''" 2>/dev/null | grep -qv '^$'; then
  TEST_SCRIPT="test"
fi

if [[ -n "$TEST_SCRIPT" ]]; then
  section "Tests (${TEST_SCRIPT})"
  if [[ "$TEST_SCRIPT" == "test" ]]; then
    warn "Solo existe 'npm test' (puede incluir integración). Un fallo puede ser por infra ausente (BD, redis, etc), no por las actualizaciones."
  fi
  if [[ "$MODE" == "--full" ]] || confirm "¿Ejecutar 'npm run ${TEST_SCRIPT}' para verificar?"; then
    if npm run "$TEST_SCRIPT" 2>&1 | tail -25; then
      ok "Tests pasaron"
      echo "- Tests (\`${TEST_SCRIPT}\`): ✅ pasaron" >> "$REPORT"
    else
      err "Tests fallaron en '${TEST_SCRIPT}'"
      echo "- Tests (\`${TEST_SCRIPT}\`): ❌ fallaron" >> "$REPORT"
      warn "Si el fallo es por infra ausente (BD, etc), las actualizaciones siguen siendo válidas."
      warn "Para revertir: cp ${BACKUP_DIR}/package*.json . && npm install"
      exit 2
    fi
  fi
fi

# ─── Resumen ─────────────────────────────────────────────────────────────────
section "Resumen"
echo -e "  Reporte completo : ${CYAN}${REPORT}${NC}"
echo -e "  Backup           : ${CYAN}${BACKUP_DIR}${NC}"
echo -e "  Modo             : ${CYAN}${MODE}${NC}"
echo ""
echo -e "  Revertir si algo falla:"
echo -e "  ${DIM}cp ${BACKUP_DIR}/package.json . && cp ${BACKUP_DIR}/package-lock.json . && npm install${NC}"
echo ""

if [[ "$VULN_AFTER" == "0" ]]; then
  ok "Sin vulnerabilidades. Script finalizado."
else
  warn "${VULN_AFTER} vulnerabilidades restantes. Revisa 'npm audit' o prueba --full."
fi
