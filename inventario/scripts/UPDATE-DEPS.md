# Guía: actualización de dependencias con `scripts/update-deps.sh`

Este script automatiza el proceso de auditar y actualizar dependencias npm con respaldo automático, reporte y reversión sencilla. No hardcodea versiones: consulta `npm outdated` / `npm audit` en tiempo de ejecución.

---

## Resumen rápido

| Modo | npm script | Qué hace | Cuándo usarlo |
|------|------------|----------|---------------|
| `--audit` | *(no expuesto)* | Solo audita y reporta. **No modifica nada.** | Siempre, como primer paso |
| `--safe` | `npm run update:safe` | Patch + minor + `npm audit fix` (sin `--force`) | Mantenimiento rutinario (default) |
| `--major` | `npm run update:major` | `--safe` + actualizaciones MAJOR con confirmación | Cuando estás listo para revisar breaking changes |
| `--full` | `npm run update:full` | `--major` + `npm audit fix --force` | Solo si puedes recuperarte fácil y vas a probar a fondo |

Todos los modos pueden combinarse con `--yes` (o `-y`) para saltar confirmaciones — **no se recomienda interactivamente**, está pensado para CI.

---

## Cómo invocarlo

Desde la raíz del proyecto (`inventario/`):

```bash
# Opción A — vía npm scripts (recomendado)
npm run update:safe
npm run update:major
npm run update:full

# Opción B — directamente
bash scripts/update-deps.sh --audit
bash scripts/update-deps.sh --safe
bash scripts/update-deps.sh --major
bash scripts/update-deps.sh --full

# Ayuda
bash scripts/update-deps.sh --help
```

> Nota: `--audit` no tiene atajo en `package.json`; usa la forma directa.

---

## Qué hace el script, paso a paso

1. **Pre-flight** — verifica `node >= 18`, presencia de `npm` y de `package.json`.
2. **Backup** — copia `package.json` y `package-lock.json` a `scripts/.backups/<timestamp>/` y crea `REPORT.md`.
3. **Estado inicial** — corre `npm audit` y `npm outdated`, los muestra y los registra en el reporte.
4. **Updates safe** — instala las versiones `latest` de paquetes `minor/patch` desactualizados, distinguiendo `dependencies` vs `devDependencies`.
5. **`npm audit fix`** — corrige vulnerabilidades transitivas que no requieren saltos major.
6. **Updates major** *(solo `--major` / `--full`)* — lista los paquetes con cambio de major y pide confirmación antes de aplicarlos.
7. **`npm audit fix --force`** *(solo `--full`)* — pide confirmación adicional; puede instalar majors no contemplados.
8. **Estado final** — compara vulnerabilidades antes/después y escribe el resumen en `REPORT.md`.
9. **Tests** — prefiere `npm run test:unit`; si no existe, cae a `npm test`. En modo `--full` los corre sin preguntar y sale con código `2` si fallan.
10. **Resumen** — muestra ruta del reporte, ruta del backup y el comando exacto para revertir.

El reporte queda en `scripts/.backups/<timestamp>/REPORT.md` con tablas antes/después y el comando de rollback.

---

## Cómo revertir

Si algo se rompe después de la actualización:

```bash
# Reemplaza <timestamp> por el directorio que muestra el script al final
cp scripts/.backups/<timestamp>/package.json .
cp scripts/.backups/<timestamp>/package-lock.json .
npm install
```

El comando exacto también está al final del output del script y dentro del propio `REPORT.md`.

---

## Recomendaciones

### Antes de ejecutar

- **Commit primero.** No corras el script con cambios sin guardar — si algo sale mal, mezclarás los diffs de la actualización con tu trabajo en curso.
- **Empezar siempre por `bash scripts/update-deps.sh --audit`.** Es read-only y te muestra el panorama (vulnerabilidades + paquetes desactualizados + qué saltos son major) antes de tocar nada.
- **Rama dedicada para majors.** Si vas a ejecutar `--major` o `--full`, hazlo en una rama (`git checkout -b chore/deps-update`). El blast radius es grande y el rollback por rama es trivial.
- **Cadencia sugerida:** `--safe` semanal o quincenal; `--major` cuando haya tiempo de revisar CHANGELOGs (mensual); `--full` solo si `npm audit` reporta vulnerabilidades altas/críticas que `--safe` no resolvió.

### Durante la ejecución

- **No uses `--yes` en local.** Está pensado para CI. En tu máquina, leer cada prompt es la única salvaguarda contra un major inesperado.
- **Revisa la lista de majors antes de confirmar.** El script imprime `PAQUETE  ACTUAL → LATEST` antes de pedir la `s/N`. Para cada paquete listado, abre su CHANGELOG (`https://github.com/<org>/<repo>/releases`) y mira si menciona breaking changes que afecten al código de este repo. Paquetes a vigilar especialmente porque están en el corazón del proyecto: **express**, **sequelize**, **pg**, **jsonwebtoken**, **helmet**, **express-rate-limit**, **express-validator**, **jest**.
- **Cuidado con `--full`.** `npm audit fix --force` puede instalar versiones major saltándose el flujo interactivo de `--major`. Úsalo solo cuando aceptes ese riesgo conscientemente.

### Después de ejecutar

- **No te fíes solo de `test:unit`.** El script corre `test:unit` por preferencia (rápido, sin infraestructura), pero los tests de integración (`tests/integration/`) son los que validan que Sequelize, validators y el handler de errores siguen funcionando. Después del script, lanza también:
  ```bash
  # Requiere PostgreSQL accesible en 127.0.0.1:5432 con la BD `inventario_test`
  npm run test:integration
  ```
- **Verifica el servidor manualmente** tras un `--major` o `--full`:
  ```bash
  npm run dev
  curl -i http://localhost:3000/health     # debe responder 200 con db: connected
  curl -s http://localhost:3000/api/v1/productos | jq .
  ```
- **Revisa el `REPORT.md`** y haz un commit dedicado:
  ```bash
  git add package.json package-lock.json
  git commit -m "chore(deps): bump <packages> via update-deps.sh --safe"
  ```
  No commitees `scripts/.backups/` — está en `.gitignore` (verifica con `git status`; si aparece, ignóralo manualmente).
- **Si los tests fallan con código `2`** (solo en `--full` o si confirmaste correrlos), no hay rollback automático: revierte con el comando del paso anterior antes de seguir investigando.

### Convivencia con Dependabot

El repo recibe PRs automáticos de Dependabot (ver `git log`). Si vas a correr el script, primero merge o cierra los PRs abiertos para que no entres en conflicto al actualizar versiones manualmente.

---

## Flujo recomendado completo

```bash
# 1. Estado limpio
git status                              # debe estar limpio
git checkout -b chore/deps-update

# 2. Diagnóstico
bash scripts/update-deps.sh --audit
# → revisar el output y REPORT.md generado

# 3. Aplicar safe
npm run update:safe

# 4. Validar
npm run test:unit                       # ya lo hace el script al final
npm run test:integration                # requiere PostgreSQL levantado
npm run dev                             # smoke test manual al /health

# 5. Commit y push
git add package.json package-lock.json
git commit -m "chore(deps): safe updates via update-deps.sh"

# 6. (Opcional) majors en commit separado
npm run update:major
#  → leer CHANGELOGs antes de confirmar cada bloque
npm run test:integration
git add package.json package-lock.json
git commit -m "chore(deps): major bumps (<lista>)"
```

Mantener `--safe` y `--major` en commits separados facilita el `git bisect` si algo se rompe semanas después.
