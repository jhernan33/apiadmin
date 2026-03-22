# Informe de Arquitectura Backend — Inventario API

> **Rol:** Arquitecto Backend Senior
> **Fecha:** 2026-03-21
> **Versión del proyecto:** 1.0.0
> **Stack:** Node.js 18+ / Express 4.22.1 / Sequelize 6.37.8 / PostgreSQL

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Vulnerabilidades de Seguridad](#2-vulnerabilidades-de-seguridad)
3. [Deficiencias Arquitectónicas](#3-deficiencias-arquitectónicas)
4. [Calidad de Código](#4-calidad-de-código)
5. [Base de Datos](#5-base-de-datos)
6. [API Design](#6-api-design)
7. [DevOps y Operaciones](#7-devops-y-operaciones)
8. [Lo que está bien](#8-lo-que-está-bien)
9. [Roadmap de Correcciones](#9-roadmap-de-correcciones)
10. [Scorecard Final](#10-scorecard-final)

---

## 1. Resumen Ejecutivo

El proyecto es una API REST para gestión de inventario basada en Express + Sequelize + PostgreSQL. Tiene una **base estructural correcta** con middleware de seguridad moderno, pero presenta **brechas críticas** que la hacen inviable para producción en su estado actual.

### Veredicto

| Dimensión | Estado |
|-----------|--------|
| Seguridad | ❌ NO lista para producción |
| Arquitectura | ⚠️ Incompleta |
| Calidad de código | ⚠️ Requiere refactoring |
| Base de datos | ⚠️ Sin constraints ni índices |
| Testing | ❌ Ausente |
| Documentación | ✅ Buena |
| DevOps | ✅ Aceptable |

---

## 2. Vulnerabilidades de Seguridad

### 2.1 Credenciales expuestas en repositorio

**Severidad: CRÍTICA**
**Archivo:** `config/config.json`

```json
{
  "test": {
    "username": "postgres",
    "password": "XXXXXXXXXX",
    "database": "d9fsgsnmg1h6v",
    "host": "ec2-54-83-201-84.compute-1.amazonaws.com"
  },
  "production": {
    "username": "postgres",
    "password": "XXXXXXXXXX",
    "database": "d9fsgsnmg1h6v",
    "host": "ec2-54-83-201-84.compute-1.amazonaws.com"
  }
}
```

**Problema:** Credenciales reales de una base de datos AWS (Amazon RDS) están hardcodeadas y han sido commiteadas al repositorio. Aunque `config/config.json` figura en el `.gitignore` actual, el daño ya está hecho — el historial de git contiene las credenciales.

**Impacto:** Cualquier persona con acceso al repositorio (o a su historial) puede conectarse directamente a la base de datos de producción. Esto constituye una brecha de datos completa.

**Acciones inmediatas requeridas:**
1. Rotar **inmediatamente** la contraseña del usuario `postgres` en la instancia RDS
2. Revocar y regenerar todos los tokens de acceso de AWS asociados
3. Ejecutar `git filter-branch` o `git-filter-repo` para purgar el historial
4. Mover toda la configuración de BD a variables de entorno (ya existe `config/environment.js` para esto)

---

### 2.2 Ausencia total de autenticación y autorización

**Severidad: CRÍTICA**
**Archivos afectados:** `routes/index.js`, todos los endpoints

Todos los endpoints CRUD son **públicamente accesibles sin ningún tipo de autenticación**:

```
GET    /api/productos      → Cualquiera puede listar
POST   /api/productos      → Cualquiera puede crear
PUT    /api/productos/:id  → Cualquiera puede modificar
DELETE /api/productos/:id  → Cualquiera puede eliminar
```

El `JWT_SECRET` está configurado en `config/environment.js` pero **nunca se usa**. El `middleware/validators.js` tiene reglas de validación de contraseña y usuario que tampoco se usan en ninguna ruta.

**Impacto:** Cualquier persona en internet puede crear, modificar o eliminar registros de la base de datos.

---

### 2.3 Sin validación de input en los endpoints

**Severidad: ALTA**
**Archivos:** `controllers/producto.js`, `routes/index.js`

Los controladores toman `req.body` directamente y lo envían al ORM sin ninguna validación:

```javascript
// controllers/producto.js — línea 114
add(req, res) {
  Productos.create({
    nomb_prod: req.body.nomb_prod,   // Sin validar
    desc_prod: req.body.desc_prod,   // Sin validar
    codi_prod: req.body.codi_prod,   // Sin validar
  })
}
```

El archivo `middleware/validators.js` existe con reglas completas y bien implementadas pero **no está conectado a ninguna ruta**.

**Riesgos:**
- Inyección de datos malformados
- Campos NULL en base de datos sin constraints
- Strings arbitrariamente largos (el sanitizador corta a 1000 chars, pero no valida tipo o formato)
- Desbordamiento de tipo en `prec_prod` (DOUBLE) si se envía texto

---

### 2.4 Soft-delete implementado a medias

**Severidad: MEDIA**
**Archivos:** `models/producto.js`, `controllers/producto.js`

El campo `deleted: BOOLEAN` existe en el modelo y en la migración, pero:
- `Productos.findAll()` **no filtra** `deleted = false`
- `DELETE` usa `destroy()` (hard delete), ignorando el campo `deleted`
- No hay ningún `scope` de Sequelize definido para filtrar registros eliminados

**Resultado:** El soft-delete es una ficción. Los productos "eliminados" deberían seguir apareciendo en los listados porque `findAll()` no lo filtra, pero `destroy()` los borra físicamente de todas formas.

---

### 2.5 Stack traces expuestos en templates

**Severidad: MEDIA**
**Archivo:** `views/error.ejs`

```html
<p><%= error.stack %></p>
```

El template `error.ejs` renderiza el stack trace completo. Aunque `app.js` controla cuándo se asigna el stack al objeto de error (solo en desarrollo), si `NODE_ENV` no está correctamente configurado en el servidor de producción, los stack traces se expondrán al usuario final revelando rutas internas, versiones de librerías y estructura de código.

---

### 2.6 Cookie parser sin configuración segura

**Severidad: BAJA**
**Archivo:** `app.js` línea 36

```javascript
app.use(cookieParser(config.security.sessionSecret));
```

La cookie está firmada pero no se configuran flags de seguridad en ningún lado (`httpOnly`, `secure`, `sameSite`). Si en algún momento se implementa autenticación basada en cookies, estas serían vulnerables a XSS y CSRF.

---

## 3. Deficiencias Arquitectónicas

### 3.1 Sin capa de servicio (Service Layer)

**Severidad: ALTA**

La arquitectura actual colapsa lógica de negocio, acceso a datos y presentación en los controladores:

```
Routes → Controllers → Models (Sequelize)
```

Lo correcto para una API mantenible y testeable:

```
Routes → Controllers → Services → Repositories → Models
```

**Consecuencias actuales:**
- Imposible reutilizar lógica de negocio entre rutas
- Lógica de paginación mezclada con acceso a BD en `producto.js`
- Imposible mockear la BD en tests sin acceder al ORM directamente

---

### 3.2 Sin versionado de API

**Severidad: ALTA**

Los endpoints actuales son:
```
/api/productos
/api/producto/:id
```

No hay versión de API (`/v1/`, `/v2/`). Cualquier cambio breaking en el contrato de la API rompe todos los clientes existentes sin posibilidad de migración gradual.

**Impacto:** En el momento en que se necesite cambiar la estructura de respuesta (por ejemplo, al agregar paginación estándar), no habrá forma de mantener compatibilidad hacia atrás.

---

### 3.3 Sin manejo centralizado de errores de Sequelize

**Severidad: MEDIA**
**Archivo:** `controllers/producto.js`

Todos los `.catch()` devuelven el objeto de error de Sequelize directamente al cliente:

```javascript
.catch((error) => res.status(500).send(error))
```

Esto expone detalles internos de la base de datos (nombres de tablas, columnas, queries SQL) al cliente. Además, no distingue entre errores de validación (400), not found (404), conflictos de unicidad (409) o errores de servidor (500).

---

### 3.4 Inconsistencia en rutas (typo en producción)

**Severidad: MEDIA**
**Archivo:** `routes/index.js`

```javascript
router.post('/api/produtos', controller.add);   // ← "produtos" (portugués)
```

vs el resto que usan:

```javascript
router.get('/api/productos', controller.list);  // ← "productos" (español)
```

El endpoint POST tiene un typo: `/api/produtos` en lugar de `/api/productos`. Este es un bug real en producción: cualquier cliente que haga `POST /api/productos` recibirá un 404.

---

### 3.5 Ausencia completa de tests

**Severidad: ALTA**

El proyecto tiene **cero tests**. Ni unitarios, ni de integración, ni end-to-end. Las consecuencias son:

- Imposible verificar regressions al actualizar dependencias
- Imposible ejecutar la Fase 0 del `UPGRADE_PLAN.md` (el plan lo reconoce)
- Ningún contrato verificable para la API
- Deployments basados en "funciona en mi máquina"

---

### 3.6 Doble carga de dotenv

**Severidad: BAJA**
**Archivos:** `app.js` línea 2, `config/environment.js` línea 1

```javascript
// app.js
require('dotenv').config();  // Primera carga

// config/environment.js (importado por app.js línea 5)
require('dotenv').config();  // Segunda carga — redundante
```

No causa bugs pero indica falta de claridad sobre quién es responsable de inicializar el entorno.

---

## 4. Calidad de Código

### 4.1 Bug en la lógica de paginación

**Archivo:** `controllers/producto.js` líneas 49-75

```javascript
list(req, res) {
  if (req.params.page) {
    const limite = 10;
    const pagina = req.params.page;
    const offset = (pagina - 1) * limite;

    // ❌ BUG: `limite` y `offset` no se pasan al siguiente .then()
    Productos.count().then((cant) => {
      Productos.findAll({
        // ❌ BUG: limit y offset no están definidos en este scope
        limit: limite,   // undefined
        offset: offset,  // undefined
      })
      .then(...)
    })
  }
}
```

Las variables `limite` y `offset` están en el scope correcto, pero el flujo de Promises anidadas hace que si `Productos.count()` falla, se ejecuta el `.catch()` exterior mostrando un error genérico. Adicionalmente, el resultado de `count()` se usa para calcular `pages` pero no se valida que `pagina` sea un número positivo.

---

### 4.2 Asociación auto-referencial sin sentido

**Archivo:** `controllers/producto.js` líneas 88-95

```javascript
getById(req, res) {
  Productos.findByPk(req.params.id, {
    include: [{
      model: Productos,    // ← El modelo se incluye a sí mismo
      as: 'productos',     // ← Sin ninguna asociación definida en el modelo
    }]
  })
}
```

El modelo `Productos` se incluye a sí mismo como asociación, pero en `models/producto.js` no hay ninguna asociación definida (`Productos.associate` está vacío). Esta query fallará o generará un JOIN sin sentido.

---

### 4.3 Controladores con Promises anidadas en lugar de async/await

**Archivo:** `controllers/producto.js`

El código usa el patrón callback pyramid con Promises:

```javascript
Productos.count().then((cant) => {
  Productos.findAll({...}).then((productos) => {
    res.json({...})
  }).catch(...)
}).catch(...)
```

Express 4 requiere capturar errores async manualmente. Express 5 los captura automáticamente. En ambos casos, `async/await` es significativamente más legible y mantenible.

---

### 4.4 Campo `imag_prod` en migración pero no en modelo

**Archivos:** `migrations/20190523191924-create-producto.js` vs `models/producto.js`

La migración define la columna `imag_prod: DataTypes.JSON` en la tabla, pero el modelo Sequelize no la declara. Esto significa:

- La columna existe en la BD pero Sequelize la ignora
- No es posible guardar o leer imágenes a través del ORM
- La funcionalidad está a medio implementar

---

### 4.5 Modelo sin constraints ni validaciones

**Archivo:** `models/producto.js`

```javascript
// Actual — sin constraints
const Productos = sequelize.define('Productos', {
  codi_prod: DataTypes.INTEGER,
  nomb_prod: DataTypes.STRING,
  desc_prod: DataTypes.STRING,
  prec_prod: DataTypes.DOUBLE,
  deleted: DataTypes.BOOLEAN
});
```

No hay `allowNull: false`, no hay `validate: {}`, no hay `unique: true` en `codi_prod`. Sequelize puede y debe ser la última línea de defensa a nivel de aplicación antes de llegar a la BD.

---

### 4.6 Uso de método deprecado en Sequelize

**Archivo:** `models/index.js` línea 24

```javascript
sequelize['import'](modelPath)  // Deprecated desde Sequelize v5
```

Este método fue eliminado en Sequelize v7. El equivalente correcto es:

```javascript
require(modelPath)(sequelize, Sequelize.DataTypes)
```

---

## 5. Base de Datos

### 5.1 Sin índices definidos

**Archivo:** `migrations/20190523191924-create-producto.js`

La migración no crea ningún índice. Con un volumen moderado de datos:

| Query | Sin índice | Con índice |
|-------|-----------|------------|
| `WHERE codi_prod = X` | O(n) scan completo | O(log n) |
| `ORDER BY nomb_prod` | Sort en memoria | Índice B-tree |
| `WHERE deleted = false` | Scan completo | Índice parcial |

**Índices recomendados:**
```sql
CREATE UNIQUE INDEX ON "Productos" (codi_prod);
CREATE INDEX ON "Productos" (deleted) WHERE deleted = false;
CREATE INDEX ON "Productos" (nomb_prod);
```

---

### 5.2 Doble fuente de verdad para la configuración de BD

El proyecto tiene **dos sistemas de configuración de base de datos** que coexisten:

| Sistema | Archivo | Método |
|---------|---------|--------|
| Sequelize CLI | `config/config.json` | JSON hardcodeado |
| Aplicación | `config/environment.js` | Variables de entorno |

`models/index.js` usa `config/config.json`. La aplicación runtime usa `environment.js`. Deben unificarse en un solo sistema basado en variables de entorno.

---

### 5.3 Sin connection pooling configurado

**Archivo:** `models/index.js`

Sequelize crea un pool por defecto (5 conexiones), pero no está explícitamente configurado. Para producción es necesario ajustar:

```javascript
new Sequelize(database, username, password, {
  pool: {
    max: 10,       // Máximo de conexiones
    min: 2,        // Mínimo en idle
    acquire: 30000, // Timeout para obtener conexión (ms)
    idle: 10000,   // Tiempo antes de liberar conexión idle (ms)
  }
})
```

---

### 5.4 Sin estrategia de backup ni migración de rollback

La única migración define solo el `up`. No hay `down` (rollback):

```javascript
// migration — solo tiene up()
queryInterface.createTable('Produtos', {...})

// No hay:
// down: (queryInterface) => queryInterface.dropTable('Produtos')
```

---

## 6. API Design

### 6.1 Naming inconsistente en endpoints

| Endpoint | Problema |
|----------|---------|
| `GET /api/productos/:page?` | El parámetro de paginación en el path viola REST |
| `GET /api/producto/:id` | Singular vs plural inconsistente |
| `POST /api/produtos` | Typo — "produtos" en lugar de "productos" |

El estándar REST para paginación es query string, no path parameter:
```
GET /api/v1/productos?page=2&limit=10   ✅
GET /api/productos/2                     ❌
```

---

### 6.2 Sin estructura de respuesta estandarizada

Las respuestas varían entre endpoints:

```javascript
// list() sin paginación
res.json(data)  // Array directo

// list() con paginación
res.json({ producto, 'cantidad': cant, 'pages': pages })  // Objeto con typo

// getById() — not found
res.status(404).send('Not found')  // String plano

// add()
res.json(data)  // Objeto ORM completo con metadata
```

No hay envelope consistente. Un cliente no sabe qué estructura esperar.

**Estructura recomendada (uniforme):**
```json
{
  "success": true,
  "data": {...},
  "meta": { "page": 1, "total": 50 },
  "error": null
}
```

---

### 6.3 Sin documentación de API (OpenAPI/Swagger)

No hay especificación OpenAPI. Los consumidores de la API (frontend, clientes móviles, terceros) no tienen contrato formal para integrarse.

---

## 7. DevOps y Operaciones

### 7.1 Sin logging estructurado

Morgan logea requests en formato texto plano. No hay logging de:
- Errores de aplicación
- Queries lentos a BD
- Eventos de seguridad (rate limit alcanzado, autenticación fallida)
- Auditoría de operaciones CRUD

Para producción se recomienda un logger estructurado como **Pino** o **Winston** con salida JSON, compatible con sistemas como CloudWatch, Datadog o ELK.

---

### 7.2 Sin health check profundo

El endpoint `/health` actual:

```javascript
res.json({ status: 'ok', timestamp: new Date().toISOString() })
```

Solo verifica que Express responde. Un health check de producción debe verificar:
- Conectividad a la BD
- Estado de servicios externos
- Uso de memoria/CPU (opcional)

```javascript
// Health check mejorado
const { sequelize } = require('./models');
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});
```

---

### 7.3 Sin configuración de CI/CD

No hay `.github/workflows/`, `.gitlab-ci.yml` ni equivalente. Los deployments son manuales.

---

### 7.4 Sin graceful shutdown

`bin/www` no maneja señales de sistema operativo (`SIGTERM`, `SIGINT`). En entornos containerizados (Docker, Kubernetes), esto significa que el proceso se mata abruptamente, potencialmente interrumpiendo requests en vuelo y dejando conexiones de BD abiertas.

```javascript
// Agregar en bin/www
process.on('SIGTERM', () => {
  server.close(() => {
    sequelize.close();
    process.exit(0);
  });
});
```

---

## 8. Lo que está bien

A pesar de las deficiencias, hay decisiones correctas que deben preservarse:

| Aspecto | Evaluación |
|---------|-----------|
| **Middleware de seguridad (Helmet)** | ✅ Bien configurado con CSP, HSTS, X-Frame |
| **Rate limiting** | ✅ Configurado con ventana y máximo razonables |
| **CORS** | ✅ Con lista blanca explícita de orígenes |
| **Límite de payload (10KB)** | ✅ Previene ataques de payload grande |
| **Sanitización de input** | ✅ Básica pero presente |
| **Variables de entorno** | ✅ `config/environment.js` con validación al inicio |
| **Separación de responsabilidades** | ✅ Routes / Controllers / Models bien separados |
| **Script de actualización de deps** | ✅ Con backup automático |
| **Documentación** | ✅ SECURITY.md, SETUP.md, UPGRADE_PLAN.md |
| **0 vulnerabilidades npm** | ✅ Limpio post-auditoría |
| **Validators.js** | ✅ Completo y reutilizable (aunque sin usar aún) |

---

## 9. Roadmap de Correcciones

### Prioridad 1 — Inmediata (antes de cualquier deploy)

| # | Acción | Archivo(s) | Esfuerzo |
|---|--------|-----------|---------|
| 1.1 | Rotar credenciales de BD en AWS | RDS Console | 30 min |
| 1.2 | Purgar historial de git (`git-filter-repo`) | `.git/` | 1 hora |
| 1.3 | Mover config de BD a env vars (unificar con `environment.js`) | `config/config.json`, `models/index.js` | 2 horas |
| 1.4 | Corregir typo en ruta POST (`/api/produtos` → `/api/productos`) | `routes/index.js` | 5 min |

### Prioridad 2 — Corto plazo (< 2 semanas)

| # | Acción | Archivo(s) | Esfuerzo |
|---|--------|-----------|---------|
| 2.1 | Crear suite de tests con Jest + Supertest | `tests/` | 3-5 días |
| 2.2 | Implementar autenticación JWT | `middleware/auth.js` | 2-3 días |
| 2.3 | Conectar validators.js a todas las rutas | `routes/index.js` | 1 día |
| 2.4 | Corregir lógica de paginación | `controllers/producto.js` | 2 horas |
| 2.5 | Eliminar asociación auto-referencial | `controllers/producto.js` | 30 min |
| 2.6 | Agregar campo `imag_prod` al modelo | `models/producto.js` | 30 min |

### Prioridad 3 — Medio plazo (< 1 mes)

| # | Acción | Archivo(s) | Esfuerzo |
|---|--------|-----------|---------|
| 3.1 | Introducir capa de servicios | `services/` | 3 días |
| 3.2 | Estandarizar respuestas de API (envelope) | `middleware/`, `controllers/` | 1 día |
| 3.3 | Agregar versionado de API (`/v1/`) | `routes/`, `app.js` | 1 día |
| 3.4 | Agregar índices en migración nueva | `migrations/` | 2 horas |
| 3.5 | Configurar connection pooling | `models/index.js` | 1 hora |
| 3.6 | Implementar graceful shutdown | `bin/www` | 1 hora |
| 3.7 | Logging estructurado con Pino | App-wide | 1 día |
| 3.8 | Health check profundo (BD) | `app.js` | 1 hora |

### Prioridad 4 — Largo plazo

| # | Acción | Esfuerzo |
|---|--------|---------|
| 4.1 | Documentación OpenAPI/Swagger | 3-5 días |
| 4.2 | Pipeline CI/CD (GitHub Actions) | 2 días |
| 4.3 | Ejecutar UPGRADE_PLAN.md (Express 5, etc.) | 1 semana |
| 4.4 | RBAC (roles y permisos) | 1 semana |
| 4.5 | Monitoreo y alertas (APM) | 2-3 días |

---

## 10. Scorecard Final

```
┌─────────────────────────────────────────────────────────────────┐
│             SCORECARD — INVENTARIO API v1.0.0                   │
├──────────────────────────────┬──────────┬────────────────────── ┤
│ Dimensión                    │ Puntaje  │ Notas                 │
├──────────────────────────────┼──────────┼───────────────────────┤
│ Seguridad: Infraestructura   │  6 / 10  │ Helmet, CORS, Rate OK │
│ Seguridad: Autenticación     │  0 / 10  │ No implementada       │
│ Seguridad: Datos sensibles   │  1 / 10  │ Credenciales en repo  │
│ Seguridad: Input validation  │  2 / 10  │ Validators exist, no  │
│                              │          │ están conectados      │
├──────────────────────────────┼──────────┼───────────────────────┤
│ Arquitectura: Capas          │  4 / 10  │ Sin service layer     │
│ Arquitectura: API Design     │  4 / 10  │ Sin versión, typos,   │
│                              │          │ paginación mal        │
│ Arquitectura: Escalabilidad  │  3 / 10  │ Sin pool, sin índices │
├──────────────────────────────┼──────────┼───────────────────────┤
│ Código: Calidad              │  5 / 10  │ Bugs en paginación,   │
│                              │          │ métodos deprecados    │
│ Código: Testing              │  0 / 10  │ 0 tests               │
│ Código: Mantenibilidad       │  5 / 10  │ Buena separación base │
├──────────────────────────────┼──────────┼───────────────────────┤
│ DevOps: Logging              │  3 / 10  │ Solo Morgan básico    │
│ DevOps: CI/CD                │  0 / 10  │ No configurado        │
│ DevOps: Observabilidad       │  2 / 10  │ Health check básico   │
├──────────────────────────────┼──────────┼───────────────────────┤
│ Documentación                │  8 / 10  │ SECURITY, SETUP,      │
│                              │          │ UPGRADE_PLAN presentes│
├──────────────────────────────┼──────────┼───────────────────────┤
│ TOTAL                        │ 43 / 110 │  39% — NO PRODUCCIÓN  │
└──────────────────────────────┴──────────┴───────────────────────┘
```

### Conclusión

El proyecto demuestra conocimiento de las prácticas modernas de seguridad (Helmet, CORS, rate limiting) y tiene una buena estructura base. Sin embargo, **no está en condiciones de recibir tráfico real** debido a la ausencia de autenticación, la falta de validación de inputs conectada, los bugs en controladores y — sobre todo — las credenciales de base de datos comprometidas.

Con un sprint de 2 semanas enfocado en las Prioridades 1 y 2, el proyecto puede alcanzar un nivel mínimo viable para producción (MVP seguro). La madurez arquitectónica completa requeriría un esfuerzo adicional de 4-6 semanas.
