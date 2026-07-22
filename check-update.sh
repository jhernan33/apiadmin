#!/usr/bin/env bash
# =============================================================================
# check-update.sh — Gate de seguridad y frescura de dependencias
# Proyecto: apiadmin (app en inventario/)
#
# Rol: verificación (read-only por defecto). Complementa a
# inventario/scripts/update-deps.sh, que es quien APLICA las actualizaciones.
#
# Uso:  ./check-update.sh [opciones]
#
#   (sin flags)        Solo verifica. Ideal para CI / pre-commit. No modifica nada.
#   --fix              Aplica actualizaciones estables seguras (patch/minor +
#                      npm audit fix SIN --force) delegando en update-deps.sh
#                      --safe, que hace backup, corre tests y sabe revertir.
#   --threshold=LEVEL  Nivel que hace fallar el gate: low|moderate|high|critical
#                      (default: high). Vulnerabilidades >= LEVEL => exit 1.
#   --json             Salida JSON (para pipelines). Implica silencio humano.
#   --report           Escribe un reporte Markdown con timestamp y lo referencia.
#   --strict           Además de vulnerabilidades, falla si hay paquetes MAJOR
#                      desactualizados (útil para forzar revisión trimestral).
#   -h, --help         Esta ayuda.
#
# Códigos de salida (consumibles por CI):
#   0  Todo OK (por debajo del threshold, sin drift crítico)
#   1  Vulnerabilidades >= threshold
#   2  Lockfile fuera de sync / package-lock desactualizado
#   3  Node/npm no cumplen `engines` de package.json
#   4  (--strict) hay actualizaciones MAJOR pendientes
# =============================================================================
set -euo pipefail

# ─── Localizar la app (donde vive package.json) ──────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF="${SCRIPT_DIR}/$(basename "${BASH_SOURCE[0]}")"   # ruta absoluta: sobrevive al cd
if   [[ -f "${SCRIPT_DIR}/package.json" ]];            then APP_DIR="${SCRIPT_DIR}"
elif [[ -f "${SCRIPT_DIR}/inventario/package.json" ]]; then APP_DIR="${SCRIPT_DIR}/inventario"
else echo "ERROR: no encuentro package.json (ni en la raíz ni en inventario/)" >&2; exit 3
fi
cd "$APP_DIR"

# ─── Colores (se desactivan si no hay TTY o en --json) ───────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; DIM=''; NC=''
fi
info()    { [[ $JSON -eq 1 ]] || echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { [[ $JSON -eq 1 ]] || echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { [[ $JSON -eq 1 ]] || echo -e "${YELLOW}[WARN]${NC}  $*" >&2; }
err()     { echo -e "${RED}[ERROR]${NC} $*" >&2; }
section() { [[ $JSON -eq 1 ]] || echo -e "\n${BOLD}━━━  $*  ━━━${NC}"; }

# ─── Argumentos ──────────────────────────────────────────────────────────────
DO_FIX=0; JSON=0; REPORT=0; STRICT=0; THRESHOLD="high"
for arg in "$@"; do
  case "$arg" in
    --fix)             DO_FIX=1 ;;
    --json)            JSON=1 ;;
    --report)          REPORT=1 ;;
    --strict)          STRICT=1 ;;
    --threshold=*)     THRESHOLD="${arg#*=}" ;;
    -h|--help)         sed -n '2,42p' "$SELF"; exit 0 ;;
    *) err "Argumento inválido: $arg (usa --help)"; exit 3 ;;
  esac
done
case "$THRESHOLD" in low|moderate|high|critical) ;; *)
  err "--threshold inválido: $THRESHOLD (low|moderate|high|critical)"; exit 3 ;;
esac

# ─── Pre-flight: herramientas y `engines` ────────────────────────────────────
section "Entorno"
command -v node >/dev/null || { err "node no encontrado"; exit 3; }
command -v npm  >/dev/null || { err "npm no encontrado";  exit 3; }

NODE_MAJOR="$(node -p 'parseInt(process.versions.node)')"
ENGINE_MIN="$(node -p "((require('./package.json').engines||{}).node||'>=0').replace(/[^0-9].*/,'')" 2>/dev/null || echo 0)"
if [[ "$NODE_MAJOR" -lt "${ENGINE_MIN:-0}" ]]; then
  err "Node $(node -v) < requerido por engines (>=${ENGINE_MIN}). Usa nvm: 'nvm use'."
  exit 3
fi
# Deriva de .nvmrc como fuente de verdad del runtime del proyecto.
if [[ -f .nvmrc ]]; then
  NVMRC="$(tr -dc '0-9' < .nvmrc | head -c2)"
  [[ -n "$NVMRC" && "$NODE_MAJOR" != "$NVMRC" ]] && \
    warn "Corriendo Node ${NODE_MAJOR}, pero .nvmrc pide ${NVMRC}. CI usa el de .nvmrc."
fi
ok "Node $(node -v) / npm $(npm -v) / app: ${APP_DIR#"$SCRIPT_DIR"/}"

# ─── Helpers: capturar audit/outdated sin que el exit!=0 mate el script ──────
audit_json()    { local t; t="$(mktemp)"; npm audit    --json >"$t" 2>/dev/null || true; cat "$t"; rm -f "$t"; }
outdated_json() { local t; t="$(mktemp)"; npm outdated --json >"$t" 2>/dev/null || true; cat "$t"; rm -f "$t"; }

# ─── 1) Vulnerabilidades ─────────────────────────────────────────────────────
section "Vulnerabilidades (npm audit)"
AUDIT="$(audit_json)"
read -r V_INFO V_LOW V_MOD V_HIGH V_CRIT V_TOTAL <<<"$(
  node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      const v=(JSON.parse(d||"{}").metadata||{}).vulnerabilities||{};
      console.log([v.info||0,v.low||0,v.moderate||0,v.high||0,v.critical||0,v.total||0].join(" "));
    })' <<<"$AUDIT"
)"
# ¿Supera el threshold?
GATE_FAIL=0
case "$THRESHOLD" in
  low)      (( V_LOW + V_MOD + V_HIGH + V_CRIT > 0 )) && GATE_FAIL=1 ;;
  moderate) (( V_MOD + V_HIGH + V_CRIT > 0 ))         && GATE_FAIL=1 ;;
  high)     (( V_HIGH + V_CRIT > 0 ))                 && GATE_FAIL=1 ;;
  critical) (( V_CRIT > 0 ))                          && GATE_FAIL=1 ;;
esac
if (( V_TOTAL == 0 )); then
  ok "0 vulnerabilidades."
else
  warn "total:${V_TOTAL} → crit:${V_CRIT} high:${V_HIGH} mod:${V_MOD} low:${V_LOW} info:${V_INFO}"
fi

# ─── 2) Paquetes desactualizados ─────────────────────────────────────────────
section "Frescura (npm outdated)"
OUTDATED="$(outdated_json)"
read -r N_TOTAL N_MAJOR <<<"$(
  node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      const o=JSON.parse(d||"{}");let total=0,major=0;
      for(const i of Object.values(o)){total++;
        const c=(i.current||"").split(".")[0],l=(i.latest||"").split(".")[0];
        if(c&&l&&c!==l)major++;}
      console.log(total+" "+major);
    })' <<<"$OUTDATED"
)"
if (( N_TOTAL == 0 )); then
  ok "Todo en la última estable."
else
  info "${N_TOTAL} paquete(s) desactualizado(s) (${N_MAJOR} major). Detalle:"
  [[ $JSON -eq 1 ]] || npm outdated || true
fi

# ─── 3) Sync del lockfile (drift silencioso rompe `npm ci` en CI/Docker) ─────
section "Integridad del lockfile"
LOCK_OK=1
if [[ -f package-lock.json ]]; then
  if npm ls --all >/dev/null 2>&1; then
    ok "package-lock.json coherente con node_modules."
  else
    LOCK_OK=0
    warn "El árbol instalado no coincide con el lockfile. Corre 'npm ci'."
  fi
else
  LOCK_OK=0
  warn "No hay package-lock.json — 'npm ci' fallará en CI y en el Docker build."
fi

# ─── Salida JSON (para pipelines) ────────────────────────────────────────────
if (( JSON == 1 )); then
  node -e '
    const [thr,gate,ci,ch,cm,cl,cinf,ctot,otot,omaj,lock]=process.argv.slice(1);
    console.log(JSON.stringify({
      threshold:thr, gateFail:gate==="1",
      vulnerabilities:{critical:+ci,high:+ch,moderate:+cm,low:+cl,info:+cinf,total:+ctot},
      outdated:{total:+otot,major:+omaj}, lockfileOk:lock==="1"
    }));
  ' "$THRESHOLD" "$GATE_FAIL" "$V_CRIT" "$V_HIGH" "$V_MOD" "$V_LOW" "$V_INFO" "$V_TOTAL" "$N_TOTAL" "$N_MAJOR" "$LOCK_OK"
fi

# ─── Reporte Markdown opcional ───────────────────────────────────────────────
if (( REPORT == 1 )); then
  RDIR="scripts/.backups"; mkdir -p "$RDIR"
  RFILE="${RDIR}/check-$(date +%Y%m%d_%H%M%S).md"
  {
    echo "# check-update — $(date -Iseconds)"
    echo ""
    echo "- Node: $(node -v) / npm: $(npm -v)"
    echo "- Threshold: \`${THRESHOLD}\`"
    echo "- Vulnerabilidades: crit:${V_CRIT} high:${V_HIGH} mod:${V_MOD} low:${V_LOW} (total ${V_TOTAL})"
    echo "- Desactualizados: ${N_TOTAL} (major: ${N_MAJOR})"
    echo "- Lockfile OK: $([[ $LOCK_OK -eq 1 ]] && echo sí || echo no)"
  } > "$RFILE"
  info "Reporte: ${RFILE}"
fi

# ─── Fix opcional: delega en la herramienta que YA sabe hacerlo con seguridad ─
if (( DO_FIX == 1 )); then
  section "Aplicando actualizaciones estables (delegado a update-deps.sh --safe)"
  if [[ -x scripts/update-deps.sh || -f scripts/update-deps.sh ]]; then
    bash scripts/update-deps.sh --safe
    info "Revalidando después del fix…"
    REEXEC=( --threshold="$THRESHOLD" )
    (( STRICT == 1 )) && REEXEC+=( --strict )
    exec "$SELF" "${REEXEC[@]}"
  else
    err "No encuentro scripts/update-deps.sh para aplicar el fix con backup/revert."
    exit 1
  fi
fi

# ─── Veredicto / códigos de salida ───────────────────────────────────────────
section "Veredicto"
RC=0
if (( GATE_FAIL == 1 )); then
  err "Gate FALLÓ: hay vulnerabilidades >= '${THRESHOLD}'. Corre './check-update.sh --fix'."
  RC=1
elif (( LOCK_OK == 0 )); then
  err "Lockfile fuera de sync."
  RC=2
elif (( STRICT == 1 && N_MAJOR > 0 )); then
  err "--strict: hay ${N_MAJOR} actualización(es) MAJOR pendiente(s) de revisar."
  RC=4
else
  ok "Todo dentro de umbrales. Sin acción requerida."
fi
exit "$RC"
