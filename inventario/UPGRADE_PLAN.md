# Plan de Actualización de Dependencias

> **Estado:** Pendiente de ejecución
> **Fecha:** 2026-03-21
> **Vulnerabilidades actuales:** 0 (flatted ya corregido con `npm audit fix`)

---

## Resumen de Actualizaciones

| Paquete | Actual | Target | Tipo | Riesgo |
|---------|--------|--------|------|--------|
| `dotenv` | 16.4.7 | 17.3.1 | Mayor | Bajo |
| `express-rate-limit` | 7.5.1 | 8.3.1 | Mayor | Bajo |
| `ejs` | 3.1.10 | 5.0.1 | Mayor | Bajo |
| `eslint` | 9.39.4 | 10.1.0 | Mayor | Medio |
| `body-parser` | 1.20.4 | (eliminar) | — | Bajo |
| `express` | 4.22.1 | 5.2.1 | Mayor | **Alto** |

> **Orden sugerido:** de menor a mayor riesgo. Express 5 va al final porque afecta toda la app.

---

## Fase 0 — Preparación (pre-requisito obligatorio)

### 0.1 Crear suite de tests mínima

El proyecto **no tiene tests**. Antes de cualquier actualización mayor se recomienda crear tests de integración básicos para verificar que las rutas funcionan correctamente.

```bash
npm install --save-dev jest supertest
```

Crear `/tests/productos.test.js` que cubra:
- `GET /api/productos` → 200 con array
- `GET /api/producto/:id` → 200 / 404
- `POST /api/productos` → 201 con body válido
- `PUT /api/productos/:id` → 200 actualizado
- `DELETE /api/productos/:id` → 200 eliminado
- `GET /health` → `{ status: 'ok' }`

Agregar a `package.json`:
```json
"test": "jest --forceExit"
```

### 0.2 Backup de seguridad

```bash
npm run update:safe  # Ya ejecuta backup automático en scripts/.backups/
# O manualmente:
git add -A && git commit -m "chore: pre-upgrade snapshot"
git checkout -b upgrade/dependencies
```

> Trabajar en branch separado. Cada fase = 1 commit.

---

## Fase 1 — dotenv 16.x → 17.x (Riesgo: Bajo)

### Cambios breaking en v17
- `dotenv.config()` ahora retorna `{ parsed, error }` igual que antes, sin cambios en el API público
- Nuevo: soporte para `dotenv.config({ path: ['.env.local', '.env'] })` (array de paths)
- El método `populate()` cambió su firma interna (no afecta si solo usas `config()`)

### Archivos afectados
- `app.js` línea 2: `require('dotenv').config()`
- `config/environment.js` línea 1: `require('dotenv').config()`

### Pasos
1. Actualizar versión:
   ```bash
   npm install dotenv@17.3.1 --save-exact
   ```
2. Verificar que ambas llamadas a `dotenv.config()` siguen funcionando.
3. **Oportunidad:** Eliminar la llamada duplicada en `app.js` ya que `config/environment.js` ya la hace primero y exporta las variables.
4. Verificar que todas las variables de entorno del `.env.example` se cargan correctamente:
   ```bash
   node -e "require('./config/environment.js'); console.log(process.env.NODE_ENV)"
   ```
5. Commit: `chore: upgrade dotenv 16 → 17`

---

## Fase 2 — express-rate-limit 7.x → 8.x (Riesgo: Bajo)

### Cambios breaking en v8
- Se eliminó la opción `onLimitReached` (deprecada desde v6) — **no la usamos**
- `standardHeaders` ahora acepta `'draft-6'` | `'draft-7'` | `true` | `false`
  - `true` → ahora equivale a `'draft-6'` (comportamiento anterior igual)
- Se eliminó soporte para `handler` callback de tipo antiguo

### Archivo afectado
- `middleware/security.js` líneas 52-62

### Código actual
```javascript
const rateLimiter = rateLimit({
  windowMs: security.rateLimitWindowMs,
  max: security.rateLimitMaxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,      // ← sigue funcionando en v8
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});
```

### Pasos
1. Actualizar:
   ```bash
   npm install express-rate-limit@8.3.1 --save-exact
   ```
2. Opcionalmente migrar `standardHeaders: true` a `standardHeaders: 'draft-7'` para usar el estándar más reciente de RateLimit headers.
3. Ejecutar la app y verificar headers en respuestas: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
4. Commit: `chore: upgrade express-rate-limit 7 → 8`

---

## Fase 3 — ejs 3.x → 5.x (Riesgo: Bajo)

### Cambios breaking en v4/v5 (ejs saltó de v3 a v5)
- Se eliminó la opción `rmWhitespace` como default global
- Mayor restricción en templates con código arbitrario: `<% %>` sin `outputFunctionName` explícito
- Mejor escape por defecto en `<%= %>` (no afecta uso básico)
- La opción `strict: true` ahora es el comportamiento recomendado

### Archivos afectados
- `views/index.ejs` — solo usa `<%= title %>`
- `views/error.ejs` — usa `<%= message %>`, `<%= error.status %>`, `<%= error.stack %>`
- `app.js` líneas 25-26 — configuración del view engine

### Pasos
1. Actualizar:
   ```bash
   npm install ejs@5.0.1 --save-exact
   ```
2. Verificar templates existentes (son simples, no deberían romperse):
   ```bash
   node -e "const ejs = require('ejs'); ejs.renderFile('./views/index.ejs', {title: 'test'}, (err, str) => { if(err) console.error(err); else console.log('OK'); })"
   ```
3. Agregar opción de seguridad en `app.js`:
   ```javascript
   app.locals.rmWhitespace = false; // explícito
   ```
4. Commit: `chore: upgrade ejs 3 → 5`

---

## Fase 4 — eslint 9.x → 10.x + Crear configuración (Riesgo: Medio)

### Contexto
El proyecto **no tiene archivo de configuración de ESLint**. ESLint 9+ requiere `eslint.config.js` (flat config). ESLint 10 elimina soporte para el sistema legacy `.eslintrc.*`.

### Cambios breaking en v10
- Se elimina completamente el sistema `.eslintrc` — **no aplica**, el proyecto no tiene config
- `eslint.config.js` es obligatorio (flat config)
- Algunas reglas renombradas o movidas a plugins separados

### Pasos

1. Actualizar:
   ```bash
   npm install eslint@10.1.0 --save-dev --save-exact
   ```

2. Crear `/eslint.config.js`:
   ```javascript
   import js from '@eslint/js';

   export default [
     js.configs.recommended,
     {
       languageOptions: {
         ecmaVersion: 2022,
         sourceType: 'commonjs',
         globals: {
           process: 'readonly',
           __dirname: 'readonly',
           __filename: 'readonly',
           require: 'readonly',
           module: 'writable',
           exports: 'writable',
           console: 'readonly',
         },
       },
       rules: {
         'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
         'no-console': 'off',
         'no-undef': 'error',
       },
       ignores: ['node_modules/**', 'scripts/.backups/**'],
     },
   ];
   ```

3. Agregar script en `package.json`:
   ```json
   "lint": "eslint ."
   ```

4. Ejecutar lint y corregir errores encontrados:
   ```bash
   npx eslint . --fix
   ```

5. Commit: `chore: upgrade eslint 9 → 10, add flat config`

---

## Fase 5 — Eliminar body-parser explícito (Riesgo: Bajo)

### Contexto
El proyecto ya usa `express.json()` y `express.urlencoded()` en `app.js`. El paquete `body-parser` en `package.json` es **redundante** porque Express lo incluye internamente. En Express 5, body-parser sigue siendo la base interna pero no necesita ser dependencia explícita.

### Archivos afectados
- `package.json` — eliminar `"body-parser": "1.20.4"`
- `app.js` — verificar que no hay `require('body-parser')` directo

### Pasos
1. Verificar que no se importa directamente:
   ```bash
   grep -r "require('body-parser')" .
   ```
2. Si no hay imports directos, eliminar la dependencia:
   ```bash
   npm uninstall body-parser
   ```
3. Verificar que `req.body` sigue funcionando en las rutas POST/PUT.
4. Commit: `chore: remove redundant body-parser dependency`

---

## Fase 6 — Express 4.x → 5.x (Riesgo: Alto — hacer al final)

### Cambios breaking más relevantes para este proyecto

#### 6.1 Manejo de errores async (el más importante)
Express 5 atrapa automáticamente errores en handlers async. Los controladores actuales usan Promises con `.catch()`, lo cual **sigue funcionando**, pero ahora se puede simplificar.

**Antes (Express 4 — patrón actual en `controllers/producto.js`):**
```javascript
list(req, res) {
  Productos.findAll()
    .then(data => res.json(data))
    .catch(error => res.status(500).send(error));
}
```

**Después (Express 5 — async/await sin try/catch):**
```javascript
async list(req, res) {
  const data = await Productos.findAll();
  res.json(data);
  // Los errores van automáticamente al error handler global
}
```

#### 6.2 `res.json()` ya no acepta status como primer argumento
```javascript
// Express 4 (obsoleto)
res.json(500, { error: 'msg' });

// Express 5 (correcto)
res.status(500).json({ error: 'msg' });
```
> Revisar todos los controladores — el proyecto usa `.status(XXX).send()` que **sí es compatible**.

#### 6.3 `app.param()` callback signature cambió
> No se usa en este proyecto.

#### 6.4 `req.param()` eliminado
> No se usa en este proyecto. El proyecto usa `req.params`, `req.body`, `req.query`.

#### 6.5 Router con regexp — cambio de sintaxis
> No se usa en este proyecto.

### Archivos a modificar

| Archivo | Cambio requerido |
|---------|-----------------|
| `app.js` | Verificar middleware stack (sin cambios esperados) |
| `controllers/producto.js` | Migrar a async/await (opcional pero recomendado) |
| `routes/index.js` | Sin cambios esperados |
| `middleware/security.js` | Sin cambios esperados |

### Pasos detallados

1. **Actualizar Express:**
   ```bash
   npm install express@5.2.1 --save-exact
   ```

2. **Verificar `app.js`** — el middleware stack debería funcionar igual. Atención especial al error handler (4 parámetros `err, req, res, next`): **no cambia**.

3. **Migrar `controllers/producto.js` a async/await** (recomendado, no obligatorio):

   ```javascript
   // controllers/producto.js
   const { Productos } = require('../models');

   const list = async (req, res) => {
     const { page } = req.params;
     if (page) {
       const limit = 10;
       const offset = (parseInt(page) - 1) * limit;
       const data = await Productos.findAll({ limit, offset });
       return res.json(data);
     }
     const data = await Productos.findAll();
     res.json(data);
   };

   const getById = async (req, res) => {
     const producto = await Productos.findByPk(req.params.id);
     if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
     res.json(producto);
   };

   const add = async (req, res) => {
     const { nomb_prod, desc_prod, codi_prod } = req.body;
     const producto = await Productos.create({ nomb_prod, desc_prod, codi_prod });
     res.status(201).json(producto);
   };

   const update = async (req, res) => {
     const producto = await Productos.findByPk(req.params.id);
     if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
     await producto.update(req.body);
     res.json(producto);
   };

   const remove = async (req, res) => {
     const producto = await Productos.findByPk(req.params.id);
     if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
     await producto.destroy();
     res.json({ message: 'Producto eliminado' });
   };

   module.exports = { list, getById, add, update, delete: remove };
   ```
   > Express 5 captura cualquier error async y lo pasa al error handler global automáticamente.

4. **Ejecutar tests:**
   ```bash
   npm test
   ```

5. Commit: `feat: upgrade Express 4 → 5, migrate controllers to async/await`

---

## Fase 7 — Correcciones de seguridad adicionales (recomendaciones)

Estos puntos no son actualizaciones de paquetes pero fueron identificados durante el análisis:

### 7.1 Eliminar `config/config.json` del control de versiones

```
config/config.json contiene credenciales hardcoded (contraseñas de BD y host RDS)
```

**Pasos:**
1. Agregar a `.gitignore`:
   ```
   config/config.json
   ```
2. Reemplazar `config/config.json` con valores de entorno via `config/environment.js` (ya existe el módulo).
3. Commit: `security: remove hardcoded credentials from config.json`

### 7.2 Agregar validación en controladores

El archivo `middleware/validators.js` ya existe pero **no está siendo usado en las rutas**. Aplicar al menos validación básica en `routes/index.js`:

```javascript
const { validationRules, handleValidationErrors } = require('../middleware/validators');

router.post('/api/productos',
  validationRules.string('nomb_prod', 1, 100),
  handleValidationErrors,
  controller.add
);
```

### 7.3 Agregar script de test al CI

```json
"scripts": {
  "test": "jest --forceExit --coverage",
  "test:watch": "jest --watch"
}
```

---

## Orden de Ejecución Recomendado

```
Fase 0  →  Fase 1  →  Fase 2  →  Fase 3  →  Fase 4  →  Fase 5  →  Fase 6  →  Fase 7
Prep       dotenv     rate-lim   ejs        eslint     body-par   Express    Security
           16→17      7→8        3→5        9→10       (remove)   4→5        extras
```

Cada fase debe terminar con:
- [ ] App arranca sin errores (`npm run dev`)
- [ ] `npm audit` → 0 vulnerabilidades
- [ ] Tests pasan (cuando estén disponibles)
- [ ] Commit en branch `upgrade/dependencies`

---

## Rollback

Si alguna fase falla:
```bash
# Volver al estado anterior con git
git checkout master
git branch -D upgrade/dependencies

# O usar el backup de npm
ls scripts/.backups/
cp scripts/.backups/YYYYMMDD_HHMMSS/package.json .
cp scripts/.backups/YYYYMMDD_HHMMSS/package-lock.json .
npm ci
```
