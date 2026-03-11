#!/usr/bin/env bash
# =============================================================================
# update-deps.sh — Actualización de dependencias y corrección de vulnerabilidades
# Proyecto: inventario
# Uso:      bash scripts/update-deps.sh [--safe | --major | --full]
#
#   --safe   (default) Solo actualiza patches/minor sin breaking changes
#   --major  Actualiza además las dependencias major (puede romper cosas)
#   --full   Equivale a --safe + --major + npm audit fix
# =============================================================================
set -euo pipefail

# ─── Colores ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
section() { echo -e "\n${BOLD}━━━  $*  ━━━${NC}"; }

# ─── Argumentos ──────────────────────────────────────────────────────────────
MODE="${1:---safe}"
[[ "$MODE" != "--safe" && "$MODE" != "--major" && "$MODE" != "--full" ]] && \
  error "Modo inválido. Usa: --safe | --major | --full"

# ─── Verificaciones previas ───────────────────────────────────────────────────
section "Verificaciones"

command -v node >/dev/null 2>&1 || error "node no encontrado"
command -v npm  >/dev/null 2>&1 || error "npm no encontrado"

NODE_VER=$(node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" 2>&1) || \
  error "Node.js >= 18 requerido (actual: $(node -v))"

[[ -f package.json ]] || error "No se encontró package.json. Ejecuta desde la raíz del proyecto."

ok "Node $(node -v) / npm $(npm -v)"

# ─── Backup ───────────────────────────────────────────────────────────────────
section "Backup"

BACKUP_DIR="scripts/.backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp package.json      "$BACKUP_DIR/package.json"
cp package-lock.json "$BACKUP_DIR/package-lock.json"
ok "Backup guardado en $BACKUP_DIR"

# ─── Auditoría inicial ────────────────────────────────────────────────────────
section "Auditoría inicial"

AUDIT_BEFORE=$(npm audit --json 2>/dev/null | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    try{ const r=JSON.parse(d); console.log(r.metadata?.vulnerabilities?.total ?? 'N/A'); }
    catch{ console.log('N/A'); }
  })" 2>/dev/null || echo "N/A")

info "Vulnerabilidades antes: ${AUDIT_BEFORE}"

# ─── Actualización SAFE (patches + minor) ────────────────────────────────────
section "Actualizaciones safe (patch/minor)"

# Dependencias directas — versiones estables sin breaking changes
SAFE_DEPS=(
  "cors@2.8.6"
  "http-errors@2.0.1"
  "sequelize@6.37.8"     # Corrige SQL Injection CVE GHSA-6457-6jrx-69cr
  "pg@8.20.0"
  "helmet@8.1.0"
  "morgan@1.10.1"
  "cookie-parser@1.4.7"
  "debug@4.4.3"
)

SAFE_DEV_DEPS=(
  "nodemon@3.1.14"
  "eslint@9.39.4"
)

info "Instalando dependencias de producción..."
npm install "${SAFE_DEPS[@]}" 2>&1 | tail -3

info "Instalando dependencias de desarrollo..."
npm install --save-dev "${SAFE_DEV_DEPS[@]}" 2>&1 | tail -3

ok "Actualizaciones safe completadas"

# ─── npm audit fix (dependencias transitivas) ─────────────────────────────────
section "Corrección de dependencias transitivas"
npm audit fix 2>&1 | tail -5
ok "npm audit fix completado"

# ─── Actualización MAJOR (opcional) ──────────────────────────────────────────
if [[ "$MODE" == "--major" || "$MODE" == "--full" ]]; then
  section "Actualizaciones MAJOR (breaking changes posibles)"

  warn "Las siguientes actualizaciones pueden requerir cambios en el código:"
  echo ""
  echo "  Paquete               Actual    →  Latest   Notas"
  echo "  ─────────────────     ────────     ──────   ──────────────────────────────"
  echo "  body-parser           1.20.4    →  2.2.2    API changes en parsers"
  echo "  dotenv                16.4.7    →  17.3.1   Nuevo sistema de config"
  echo "  ejs                   3.1.10    →  5.0.1    Saltó v4, revisar templates"
  echo "  express               4.22.1    →  5.2.1    Promesas nativas, cambios de routing"
  echo "  express-rate-limit    7.4.1     →  8.3.1    Cambios en windowMs/handler"
  echo "  eslint                9.39.1    →  10.0.3   Nuevo flat config obligatorio"
  echo ""

  read -r -p "$(echo -e "${YELLOW}¿Continuar con actualizaciones major? [s/N]:${NC} ")" CONFIRM
  if [[ "${CONFIRM,,}" == "s" ]]; then
    MAJOR_DEPS=(
      "body-parser@latest"
      "dotenv@latest"
      "ejs@latest"
      "express@latest"
      "express-rate-limit@latest"
    )
    MAJOR_DEV_DEPS=(
      "eslint@latest"
    )

    info "Instalando major deps de producción..."
    npm install "${MAJOR_DEPS[@]}" 2>&1 | tail -3

    info "Instalando major dev deps..."
    npm install --save-dev "${MAJOR_DEV_DEPS[@]}" 2>&1 | tail -3

    ok "Actualizaciones major completadas"
    warn "Ejecuta las pruebas de la aplicación antes de hacer commit."
  else
    info "Actualizaciones major omitidas."
  fi
fi

# ─── Auditoría final ──────────────────────────────────────────────────────────
section "Auditoría final"

AUDIT_AFTER=$(npm audit --json 2>/dev/null | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    try{ const r=JSON.parse(d); console.log(r.metadata?.vulnerabilities?.total ?? 'N/A'); }
    catch{ console.log('N/A'); }
  })" 2>/dev/null || echo "N/A")

echo ""
echo -e "  Vulnerabilidades antes : ${RED}${AUDIT_BEFORE}${NC}"
echo -e "  Vulnerabilidades después: ${GREEN}${AUDIT_AFTER}${NC}"
echo ""

if [[ "$AUDIT_AFTER" == "0" ]]; then
  ok "Sin vulnerabilidades detectadas."
else
  warn "${AUDIT_AFTER} vulnerabilidades restantes. Ejecuta 'npm audit' para detalles."
fi

# ─── Resumen final ────────────────────────────────────────────────────────────
section "Resumen"

echo -e "  Backup guardado en : ${CYAN}${BACKUP_DIR}${NC}"
echo -e "  Modo ejecutado     : ${CYAN}${MODE}${NC}"
echo ""
echo -e "  Para restaurar el backup si algo falla:"
echo -e "  ${YELLOW}cp ${BACKUP_DIR}/package.json . && cp ${BACKUP_DIR}/package-lock.json . && npm install${NC}"
echo ""
ok "Script finalizado correctamente."
