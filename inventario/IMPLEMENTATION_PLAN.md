# Plan de Implementación — Refactoring & Seguridad

> **Rol:** Arquitecto Backend Senior
> **Fecha:** 2026-03-21
> **Principios:** DRY · SOLID · Clean Code · Security First
> **Estrategia:** Cambios incrementales, cada fase es un PR independiente

---

## Arquitectura Objetivo

```
ACTUAL                          OBJETIVO
──────────────────────          ──────────────────────────────────────
routes/                         routes/
  index.js                        index.js  (mount /api/v1)
                                  v1/
                                    index.js
                                    productos.js  (+ validators inline)

controllers/                    controllers/
  producto.js  (fat)              v1/
                                    ProductoController.js  (thin)

                                services/           ← NUEVO
                                  ProductoService.js

                                repositories/       ← NUEVO
                                  ProductoRepository.js

models/                         models/
  index.js  (deprecated API)      index.js  (modernizado)
  producto.js  (sin constraints)  Producto.js  (constraints + scopes)

config/                         config/
  config.json  (hardcoded)        environment.js  (única fuente)
  environment.js                  database.js     (Sequelize instance)

middleware/                     middleware/
  security.js                     security.js     (sin cambios)
  validators.js  (sin usar)       auth.js         ← NUEVO (JWT)
                                  validators/
                                    index.js
                                    producto.validator.js
                                  errorHandler.js  ← NUEVO

                                utils/             ← NUEVO
                                  ApiResponse.js
                                  ApiError.js
                                  logger.js

                                tests/             ← NUEVO
                                  unit/
                                  integration/
```

---

## Índice de Fases

| Fase | Nombre | Prioridad | Archivos afectados |
|------|--------|-----------|-------------------|
| **1** | Credenciales & Config | CRÍTICA | `config/`, `models/index.js` |
| **2** | Utilidades base | ALTA | `utils/` (nuevo) |
| **3** | Error handling | ALTA | `middleware/errorHandler.js`, `app.js` |
| **4** | Modelo Producto | ALTA | `models/Producto.js`, migración nueva |
| **5** | Repository Layer | ALTA | `repositories/` (nuevo) |
| **6** | Service Layer | ALTA | `services/` (nuevo) |
| **7** | Controller (thin) | ALTA | `controllers/v1/` |
| **8** | Validators & Routes | ALTA | `middleware/validators/`, `routes/v1/` |
| **9** | Autenticación JWT | ALTA | `middleware/auth.js` |
| **10** | Tests | MEDIA | `tests/` |
| **11** | Graceful Shutdown & Logger | MEDIA | `bin/www`, `utils/logger.js` |

---

## Fase 1 — Credenciales & Configuración Unificada

> **Principio:** Single Source of Truth. Una sola fuente de configuración.
> **Commit:** `fix(security): remove hardcoded credentials, unify config`

### 1.1 Eliminar `config/config.json` del historial

```bash
# Instalar la herramienta
pip install git-filter-repo

# Purgar el archivo del historial completo
git filter-repo --path config/config.json --invert-paths --force

# Forzar push (coordinar con el equipo)
git push origin --force --all

# Rotar credenciales AWS RDS INMEDIATAMENTE después
```

### 1.2 Reemplazar `config/config.json` — Solo para Sequelize CLI

**Archivo:** `config/config.json` (nunca más se commitea — ya está en `.gitignore`)

```json
{
  "development": {
    "use_env_variable": "DATABASE_URL",
    "dialect": "postgres"
  },
  "test": {
    "use_env_variable": "DATABASE_URL",
    "dialect": "postgres"
  },
  "production": {
    "use_env_variable": "DATABASE_URL",
    "dialect": "postgres",
    "dialectOptions": {
      "ssl": {
        "require": true,
        "rejectUnauthorized": false
      }
    }
  }
}
```

### 1.3 Nuevo archivo `config/database.js`

> Responsabilidad única (SRP): este archivo solo crea la instancia de Sequelize.
> Reemplaza la lógica de `models/index.js` que mezclaba config + instanciación.

```javascript
// config/database.js
'use strict';

const { Sequelize } = require('sequelize');
const { database, isDevelopment } = require('./environment');

const sequelize = new Sequelize(
  database.name,
  database.username,
  database.password,
  {
    host: database.host,
    port: database.port,
    dialect: database.dialect,
    logging: isDevelopment ? console.log : false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30_000,
      idle: 10_000,
    },
    dialectOptions: database.ssl
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
    define: {
      underscored: false,
      freezeTableName: false,
      timestamps: true,
    },
  }
);

module.exports = sequelize;
```

### 1.4 Actualizar `config/environment.js`

> Agrega configuración de BD y DATABASE_URL para compatibilidad con Sequelize CLI.

```javascript
// config/environment.js
'use strict';

require('dotenv').config();

const requiredEnvVars = [
  'DB_HOST', 'DB_PORT', 'DB_USERNAME',
  'DB_PASSWORD', 'DB_NAME',
  'JWT_SECRET', 'SESSION_SECRET',
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[Config] Missing required env vars: ${missing.join(', ')}`);
  console.error('[Config] See .env.example for reference.');
  process.exit(1);
}

// Construir DATABASE_URL para Sequelize CLI
const { DB_USERNAME, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    `postgres://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  database: {
    host: DB_HOST,
    port: parseInt(DB_PORT, 10),
    username: DB_USERNAME,
    password: DB_PASSWORD,
    name: DB_NAME,
    dialect: process.env.DB_DIALECT || 'postgres',
    ssl: process.env.DB_SSL === 'true',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    sessionSecret: process.env.SESSION_SECRET,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900_000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },
};
```

### 1.5 Modernizar `models/index.js`

> Elimina `sequelize['import']` (deprecado). Usa `require()` directo.
> Responsabilidad única: inicializar modelos y exportar `db`.

```javascript
// models/index.js
'use strict';

const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');
const db = {};

// Cargar todos los modelos dinámicamente (sin API deprecada)
fs.readdirSync(__dirname)
  .filter((file) => file !== 'index.js' && file.endsWith('.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);
    db[model.name] = model;
  });

// Registrar asociaciones
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;

module.exports = db;
```

### 1.6 Actualizar `.env.example`

```bash
# .env.example — Agregar las nuevas variables
DATABASE_URL=postgres://user:password@localhost:5432/inventario_db
DB_SSL=false
JWT_EXPIRES_IN=24h
```

---

## Fase 2 — Utilidades Base

> **Principio:** DRY. Un solo lugar para respuestas y errores.
> **Commit:** `feat(utils): add ApiResponse, ApiError classes`

### 2.1 `utils/ApiResponse.js`

> Envelope estándar para TODAS las respuestas de la API.
> Elimina la inconsistencia actual donde cada endpoint responde diferente.

```javascript
// utils/ApiResponse.js
'use strict';

class ApiResponse {
  /**
   * @param {object} res  - Express response object
   * @param {number} statusCode
   * @param {*}      data
   * @param {string} [message]
   * @param {object} [meta]   - Paginación, totales, etc.
   */
  static success(res, statusCode, data, message = 'OK', meta = null) {
    const body = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static ok(res, data, message = 'OK', meta = null) {
    return ApiResponse.success(res, 200, data, message, meta);
  }

  static created(res, data, message = 'Created') {
    return ApiResponse.success(res, 201, data, message);
  }

  static noContent(res) {
    return res.status(204).send();
  }

  static error(res, statusCode, message, errors = null) {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
  }
}

module.exports = ApiResponse;
```

### 2.2 `utils/ApiError.js`

> Jerarquía de errores con tipo, código HTTP y metadata.
> Permite al error handler distinguir errores de negocio de errores de sistema.

```javascript
// utils/ApiError.js
'use strict';

class ApiError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true; // Distingue errores esperados de bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends ApiError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, 404);
  }
}

class ValidationError extends ApiError {
  constructor(errors) {
    super('Error de validación', 400, errors);
  }
}

class ConflictError extends ApiError {
  constructor(message = 'El recurso ya existe') {
    super(message, 409);
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = 'No autorizado') {
    super(message, 401);
  }
}

class ForbiddenError extends ApiError {
  constructor(message = 'Acceso denegado') {
    super(message, 403);
  }
}

module.exports = {
  ApiError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
};
```

---

## Fase 3 — Error Handler Centralizado

> **Principio:** Open/Closed. El handler está abierto a nuevos tipos de error
> sin modificar su lógica central.
> **Commit:** `feat(middleware): centralized error handler`

### 3.1 `middleware/errorHandler.js`

```javascript
// middleware/errorHandler.js
'use strict';

const { ApiError } = require('../utils/ApiError');
const { isDevelopment } = require('../config/environment');

/**
 * Convierte errores de Sequelize en ApiErrors legibles.
 * SRP: esta función solo se encarga de mapear errores de BD.
 */
const mapSequelizeError = (err) => {
  const { name, errors } = err;

  if (name === 'SequelizeUniqueConstraintError') {
    const field = errors[0]?.path || 'campo';
    return new ApiError(`El valor de '${field}' ya existe`, 409);
  }
  if (name === 'SequelizeValidationError') {
    const messages = errors.map((e) => ({ field: e.path, message: e.message }));
    return new ApiError('Error de validación de datos', 422, messages);
  }
  if (name === 'SequelizeForeignKeyConstraintError') {
    return new ApiError('Referencia a recurso inexistente', 400);
  }
  if (name === 'SequelizeConnectionError') {
    return new ApiError('Error de conexión con la base de datos', 503);
  }
  return null;
};

/**
 * Middleware global de manejo de errores.
 * Debe registrarse ÚLTIMO en app.js.
 */
const errorHandler = (err, req, res, _next) => {
  // Mapear errores de Sequelize
  const mappedErr = err.name?.startsWith('Sequelize')
    ? mapSequelizeError(err)
    : null;

  const error = mappedErr || err;

  const statusCode = error.statusCode || error.status || 500;
  const isOperational = error.isOperational === true;

  // Errores no operacionales (bugs) → loguear stack completo
  if (!isOperational) {
    console.error('[Unhandled Error]', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  return res.status(statusCode).json({
    success: false,
    message: isOperational || isDevelopment
      ? error.message
      : 'Error interno del servidor',
    ...(error.errors && { errors: error.errors }),
    ...(isDevelopment && !isOperational && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
```

### 3.2 Actualizar `app.js`

> Eliminar duplicado de dotenv. Registrar el nuevo error handler.
> Agregar health check profundo (verifica BD).

```javascript
// app.js  — versión simplificada y corregida
'use strict';

// config/environment.js ya llama dotenv.config() — no repetir aquí
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const logger = require('morgan');

const { applySecurityMiddleware } = require('./middleware/security');
const { errorHandler } = require('./middleware/errorHandler');
const config = require('./config/environment');
const { sequelize } = require('./models');

// Routers
const v1Router = require('./routes/v1');

const app = express();

// ── Seguridad ─────────────────────────────────────────────
applySecurityMiddleware(app);

// ── View engine (solo para error.ejs) ────────────────────
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ── Logging ───────────────────────────────────────────────
app.use(logger(config.isDevelopment ? 'dev' : 'combined'));

// ── Parsers ───────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: false }));
app.use(cookieParser(config.security.sessionSecret));

// ── Estáticos ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: false,
}));

// ── Health check profundo ─────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── API v1 ────────────────────────────────────────────────
app.use('/api/v1', v1Router);

// ── Página de bienvenida ──────────────────────────────────
app.get('/', (req, res) => {
  res.render('index', { title: 'Inventario API — Node.js · Express · PostgreSQL' });
});

// ── 404 ───────────────────────────────────────────────────
app.use((req, res, next) => next(createError(404, 'Ruta no encontrada')));

// ── Error handler global (siempre al final) ───────────────
app.use(errorHandler);

module.exports = app;
```

---

## Fase 4 — Modelo Producto Mejorado

> **Principio:** Fail Fast. Los constraints en el modelo son la última
> línea de defensa antes de la BD.
> **Commit:** `refactor(model): add constraints, scopes, soft-delete to Producto`

### 4.1 Renombrar y reescribir `models/Producto.js`

```javascript
// models/Producto.js
'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Producto extends Model {
    static associate(_models) {
      // Definir asociaciones futuras aquí (ej: belongsTo(Categoria))
    }
  }

  Producto.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      codi_prod: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: {
          name: 'unique_codi_prod',
          msg: 'El código de producto ya existe',
        },
        validate: {
          isInt: { msg: 'El código debe ser un entero' },
          min: { args: [1], msg: 'El código debe ser mayor a 0' },
        },
      },
      nomb_prod: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'El nombre no puede estar vacío' },
          len: { args: [2, 150], msg: 'El nombre debe tener entre 2 y 150 caracteres' },
        },
      },
      desc_prod: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      prec_prod: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          isDecimal: { msg: 'El precio debe ser un número decimal' },
          min: { args: [0], msg: 'El precio no puede ser negativo' },
        },
      },
      imag_prod: {
        type: DataTypes.JSONB,  // JSONB es más eficiente que JSON en PostgreSQL
        allowNull: true,
        defaultValue: [],
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Producto',
      tableName: 'Productos',
      timestamps: true,
      // Scope por defecto: siempre excluir eliminados
      defaultScope: {
        where: { deleted: false },
        attributes: { exclude: ['deleted'] },
      },
      scopes: {
        // Usar cuando se necesiten ver registros eliminados
        withDeleted: { where: {} },
        active: { where: { deleted: false } },
      },
    }
  );

  return Producto;
};
```

### 4.2 Nueva migración — Constraints e Índices

**Archivo:** `migrations/YYYYMMDD000000-add-constraints-indexes-producto.js`

```javascript
// migrations/20260321000000-add-constraints-indexes-producto.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Agregar restricción NOT NULL a columnas críticas
      await queryInterface.changeColumn('Productos', 'codi_prod', {
        type: Sequelize.INTEGER,
        allowNull: false,
      }, { transaction });

      await queryInterface.changeColumn('Productos', 'nomb_prod', {
        type: Sequelize.STRING(150),
        allowNull: false,
      }, { transaction });

      await queryInterface.changeColumn('Productos', 'prec_prod', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      }, { transaction });

      // 2. Migrar imag_prod de JSON a JSONB
      await queryInterface.changeColumn('Productos', 'imag_prod', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      }, { transaction });

      // 3. Agregar restricción UNIQUE en codi_prod
      await queryInterface.addConstraint('Productos', {
        fields: ['codi_prod'],
        type: 'unique',
        name: 'unique_codi_prod',
        transaction,
      });

      // 4. Índices de rendimiento
      await queryInterface.addIndex('Productos', ['codi_prod'], {
        unique: true,
        name: 'idx_productos_codi_prod',
        transaction,
      });

      await queryInterface.addIndex('Productos', ['nomb_prod'], {
        name: 'idx_productos_nomb_prod',
        transaction,
      });

      // Índice parcial: solo registros activos (los más consultados)
      await queryInterface.addIndex('Productos', ['deleted'], {
        name: 'idx_productos_deleted',
        where: { deleted: false },
        transaction,
      });

      await queryInterface.addIndex('Productos', ['createdAt'], {
        name: 'idx_productos_created_at',
        transaction,
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('Productos', 'idx_productos_codi_prod', { transaction });
      await queryInterface.removeIndex('Productos', 'idx_productos_nomb_prod', { transaction });
      await queryInterface.removeIndex('Productos', 'idx_productos_deleted', { transaction });
      await queryInterface.removeIndex('Productos', 'idx_productos_created_at', { transaction });
      await queryInterface.removeConstraint('Productos', 'unique_codi_prod', { transaction });

      await queryInterface.changeColumn('Productos', 'codi_prod', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      await queryInterface.changeColumn('Productos', 'prec_prod', {
        type: Sequelize.DOUBLE,
        allowNull: true,
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
```

---

## Fase 5 — Repository Layer

> **Principio:** DIP (Dependency Inversion). Los servicios dependen de
> abstracciones (el repository), no del ORM directamente.
> SRP: el repository solo sabe acceder a datos, nada de lógica de negocio.
> **Commit:** `feat(repository): ProductoRepository — data access layer`

### 5.1 `repositories/ProductoRepository.js`

```javascript
// repositories/ProductoRepository.js
'use strict';

const { Op } = require('sequelize');
const { Producto } = require('../models');
const { NotFoundError } = require('../utils/ApiError');

class ProductoRepository {
  /**
   * Obtener todos los productos activos con paginación opcional.
   * @param {object} options
   * @param {number} [options.page]
   * @param {number} [options.limit]
   * @param {string} [options.orderBy]
   * @param {string} [options.order]
   */
  async findAll({ page, limit = 10, orderBy = 'codi_prod', order = 'ASC' } = {}) {
    const queryOptions = {
      order: [[orderBy, order]],
    };

    if (page) {
      const offset = (page - 1) * limit;
      queryOptions.limit = limit;
      queryOptions.offset = offset;
    }

    const result = page
      ? await Producto.findAndCountAll(queryOptions)
      : { rows: await Producto.findAll(queryOptions), count: null };

    return result;
  }

  /**
   * Buscar producto por ID (solo activos).
   * @param {number} id
   */
  async findById(id) {
    const producto = await Producto.findByPk(id);
    if (!producto) throw new NotFoundError('Producto');
    return producto;
  }

  /**
   * Buscar producto por código.
   * @param {number} codiProd
   */
  async findByCode(codiProd) {
    return Producto.findOne({ where: { codi_prod: codiProd } });
  }

  /**
   * Crear un producto.
   * @param {object} data
   */
  async create(data) {
    return Producto.create(data);
  }

  /**
   * Actualizar un producto por ID.
   * @param {number} id
   * @param {object} data
   */
  async update(id, data) {
    const producto = await this.findById(id);
    await producto.update(data);
    return producto.reload();
  }

  /**
   * Soft-delete: marca como eliminado sin borrar el registro.
   * @param {number} id
   */
  async softDelete(id) {
    const producto = await this.findById(id);
    // Usar scope withDeleted para poder actualizar el campo deleted
    await Producto.scope('withDeleted').update(
      { deleted: true },
      { where: { id: producto.id } }
    );
  }
}

// Exportar una sola instancia (Singleton) — DRY
module.exports = new ProductoRepository();
```

---

## Fase 6 — Service Layer

> **Principio:** SRP. El servicio contiene la lógica de negocio y coordina
> con el repository. No conoce Express (req/res).
> **Commit:** `feat(service): ProductoService — business logic layer`

### 6.1 `services/ProductoService.js`

```javascript
// services/ProductoService.js
'use strict';

const productoRepository = require('../repositories/ProductoRepository');
const { ConflictError } = require('../utils/ApiError');

class ProductoService {
  /**
   * Listar productos con paginación.
   * @param {object} params
   * @param {number} [params.page]
   * @param {number} [params.limit]
   */
  async list({ page, limit } = {}) {
    const { rows, count } = await productoRepository.findAll({ page, limit });

    if (!page) return { productos: rows };

    const pages = Math.ceil(count / limit);
    return {
      productos: rows,
      meta: {
        total: count,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Obtener un producto por ID.
   * @param {number} id
   */
  async getById(id) {
    return productoRepository.findById(id);
  }

  /**
   * Crear un producto. Verifica unicidad de código.
   * @param {object} data
   */
  async create(data) {
    const existing = await productoRepository.findByCode(data.codi_prod);
    if (existing) {
      throw new ConflictError(`Ya existe un producto con el código ${data.codi_prod}`);
    }
    return productoRepository.create(data);
  }

  /**
   * Actualizar un producto. Solo actualiza los campos enviados (PATCH behavior).
   * @param {number} id
   * @param {object} data
   */
  async update(id, data) {
    // Verificar conflicto de código si se está cambiando
    if (data.codi_prod !== undefined) {
      const existing = await productoRepository.findByCode(data.codi_prod);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Ya existe un producto con el código ${data.codi_prod}`);
      }
    }
    return productoRepository.update(id, data);
  }

  /**
   * Eliminar un producto (soft-delete).
   * @param {number} id
   */
  async delete(id) {
    await productoRepository.softDelete(id);
  }
}

// Singleton — DRY: una sola instancia reutilizable
module.exports = new ProductoService();
```

---

## Fase 7 — Controller Delgado

> **Principio:** SRP. El controller solo orquesta: extrae datos del request,
> llama al servicio, devuelve la respuesta. Sin lógica de negocio.
> **Commit:** `refactor(controller): thin ProductoController using service layer`

### 7.1 `controllers/v1/ProductoController.js`

```javascript
// controllers/v1/ProductoController.js
'use strict';

const productoService = require('../../services/ProductoService');
const ApiResponse = require('../../utils/ApiResponse');

class ProductoController {
  /**
   * GET /api/v1/productos?page=1&limit=10
   */
  async list(req, res, next) {
    try {
      const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

      const result = await productoService.list({ page, limit });

      return ApiResponse.ok(res, result.productos, 'Productos obtenidos', result.meta);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/productos/:id
   */
  async getById(req, res, next) {
    try {
      const producto = await productoService.getById(parseInt(req.params.id, 10));
      return ApiResponse.ok(res, producto, 'Producto encontrado');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/productos
   */
  async create(req, res, next) {
    try {
      const { codi_prod, nomb_prod, desc_prod, prec_prod, imag_prod } = req.body;
      const producto = await productoService.create({
        codi_prod, nomb_prod, desc_prod, prec_prod, imag_prod,
      });
      return ApiResponse.created(res, producto, 'Producto creado');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/productos/:id
   */
  async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { codi_prod, nomb_prod, desc_prod, prec_prod, imag_prod } = req.body;
      const producto = await productoService.update(id, {
        codi_prod, nomb_prod, desc_prod, prec_prod, imag_prod,
      });
      return ApiResponse.ok(res, producto, 'Producto actualizado');
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/productos/:id
   */
  async delete(req, res, next) {
    try {
      await productoService.delete(parseInt(req.params.id, 10));
      return ApiResponse.noContent(res);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProductoController();
```

---

## Fase 8 — Validators y Routes Versionados

> **Principio:** DRY. Un solo archivo de validators por entidad.
> OCP: agregar nuevas reglas sin modificar las existentes.
> **Commit:** `feat(routes): versioned API v1, connected validators`

### 8.1 `middleware/validators/producto.validator.js`

```javascript
// middleware/validators/producto.validator.js
'use strict';

const { body, query, param } = require('express-validator');
const { handleValidationErrors } = require('./index');

// ── Reglas reutilizables (DRY) ──────────────────────────
const rules = {
  id: param('id')
    .isInt({ min: 1 }).withMessage('El ID debe ser un entero positivo')
    .toInt(),

  codi_prod: (required = true) => {
    const chain = body('codi_prod')
      .isInt({ min: 1 }).withMessage('El código debe ser un entero positivo')
      .toInt();
    return required ? chain.notEmpty().withMessage('El código es requerido') : chain.optional();
  },

  nomb_prod: (required = true) => {
    const chain = body('nomb_prod')
      .isString().withMessage('El nombre debe ser texto')
      .trim()
      .isLength({ min: 2, max: 150 }).withMessage('El nombre debe tener entre 2 y 150 caracteres');
    return required ? chain.notEmpty().withMessage('El nombre es requerido') : chain.optional();
  },

  desc_prod: body('desc_prod')
    .optional()
    .isString().withMessage('La descripción debe ser texto')
    .trim()
    .isLength({ max: 500 }).withMessage('La descripción no puede superar 500 caracteres'),

  prec_prod: (required = true) => {
    const chain = body('prec_prod')
      .isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo')
      .toFloat();
    return required ? chain.notEmpty().withMessage('El precio es requerido') : chain.optional();
  },

  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('page debe ser >= 1').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit debe estar entre 1 y 100').toInt(),
  ],
};

// ── Middleware compuestos por operación ─────────────────
const validateList = [...rules.pagination, handleValidationErrors];

const validateGetById = [rules.id, handleValidationErrors];

const validateCreate = [
  rules.codi_prod(true),
  rules.nomb_prod(true),
  rules.desc_prod,
  rules.prec_prod(true),
  handleValidationErrors,
];

const validateUpdate = [
  rules.id,
  rules.codi_prod(false),
  rules.nomb_prod(false),
  rules.desc_prod,
  rules.prec_prod(false),
  handleValidationErrors,
];

const validateDelete = [rules.id, handleValidationErrors];

module.exports = {
  validateList,
  validateGetById,
  validateCreate,
  validateUpdate,
  validateDelete,
};
```

### 8.2 `middleware/validators/index.js`

```javascript
// middleware/validators/index.js
'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware para manejar errores de validación.
 * Formato de respuesta consistente con ApiResponse.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: errors.array().map(({ path, msg, value }) => ({ field: path, message: msg, value })),
    });
  }
  next();
};

module.exports = { handleValidationErrors };
```

### 8.3 `routes/v1/productos.js`

```javascript
// routes/v1/productos.js
'use strict';

const { Router } = require('express');
const controller = require('../../controllers/v1/ProductoController');
const {
  validateList,
  validateGetById,
  validateCreate,
  validateUpdate,
  validateDelete,
} = require('../../middleware/validators/producto.validator');

const router = Router();

// GET    /api/v1/productos?page=1&limit=10
router.get('/', validateList, controller.list.bind(controller));

// GET    /api/v1/productos/:id
router.get('/:id', validateGetById, controller.getById.bind(controller));

// POST   /api/v1/productos
router.post('/', validateCreate, controller.create.bind(controller));

// PUT    /api/v1/productos/:id
router.put('/:id', validateUpdate, controller.update.bind(controller));

// DELETE /api/v1/productos/:id
router.delete('/:id', validateDelete, controller.delete.bind(controller));

module.exports = router;
```

### 8.4 `routes/v1/index.js`

```javascript
// routes/v1/index.js
'use strict';

const { Router } = require('express');
const productosRouter = require('./productos');

const router = Router();

// Montar sub-routers — agregar nuevas entidades aquí
router.use('/productos', productosRouter);

module.exports = router;
```

### 8.5 `routes/index.js` — Actualizar para montar v1

```javascript
// routes/index.js
'use strict';

const { Router } = require('express');
const v1Router = require('./v1');

const router = Router();

router.use('/api/v1', v1Router);

module.exports = router;
```

---

## Fase 9 — Autenticación JWT

> **Principio:** SRP. El middleware de auth solo verifica tokens,
> no conoce nada de la lógica de negocio.
> **Commit:** `feat(auth): JWT authentication middleware`

### 9.1 Instalar dependencia

```bash
npm install jsonwebtoken --save-exact
```

### 9.2 `middleware/auth.js`

```javascript
// middleware/auth.js
'use strict';

const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/ApiError');
const { security } = require('../config/environment');

/**
 * Extrae el token del header Authorization: Bearer <token>
 * SRP: solo extrae, no valida.
 */
const extractToken = (req) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
};

/**
 * Middleware de autenticación.
 * Verifica el JWT y adjunta el payload a req.user.
 */
const authenticate = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next(new UnauthorizedError('Token no proporcionado'));

  try {
    req.user = jwt.verify(token, security.jwtSecret);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expirado'));
    }
    return next(new UnauthorizedError('Token inválido'));
  }
};

/**
 * Middleware de autorización por roles.
 * Uso: router.delete('/:id', authenticate, authorize('admin'), controller.delete)
 * OCP: agregar nuevos roles sin modificar este middleware.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!allowedRoles.includes(req.user.role)) {
    return next(new ForbiddenError('No tienes permisos para esta acción'));
  }
  next();
};

module.exports = { authenticate, authorize };
```

### 9.3 Aplicar auth a las rutas de productos

```javascript
// routes/v1/productos.js — con auth aplicado
const { authenticate } = require('../../middleware/auth');

// Rutas públicas (lectura)
router.get('/', validateList, controller.list.bind(controller));
router.get('/:id', validateGetById, controller.getById.bind(controller));

// Rutas protegidas (escritura)
router.post('/', authenticate, validateCreate, controller.create.bind(controller));
router.put('/:id', authenticate, validateUpdate, controller.update.bind(controller));
router.delete('/:id', authenticate, validateDelete, controller.delete.bind(controller));
```

---

## Fase 10 — Tests

> **Principio:** Tests como documentación ejecutable.
> Cada capa se testea de forma aislada.
> **Commit:** `test: add unit and integration tests`

### 10.1 Instalar dependencias de test

```bash
npm install --save-dev jest supertest @jest/globals
```

Agregar en `package.json`:
```json
"scripts": {
  "test": "NODE_ENV=test jest --forceExit",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage --forceExit"
},
"jest": {
  "testEnvironment": "node",
  "testMatch": ["**/tests/**/*.test.js"],
  "coverageThreshold": {
    "global": { "lines": 80 }
  }
}
```

### 10.2 `tests/unit/services/ProductoService.test.js`

```javascript
// tests/unit/services/ProductoService.test.js
'use strict';

const ProductoService = require('../../../services/ProductoService');
const productoRepository = require('../../../repositories/ProductoRepository');
const { ConflictError, NotFoundError } = require('../../../utils/ApiError');

// Mock del repository — los unit tests no tocan la BD
jest.mock('../../../repositories/ProductoRepository');

describe('ProductoService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create()', () => {
    it('crea un producto si el código no existe', async () => {
      productoRepository.findByCode.mockResolvedValue(null);
      productoRepository.create.mockResolvedValue({ id: 1, codi_prod: 100 });

      const result = await ProductoService.create({ codi_prod: 100, nomb_prod: 'Test', prec_prod: 9.99 });

      expect(productoRepository.findByCode).toHaveBeenCalledWith(100);
      expect(productoRepository.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(1);
    });

    it('lanza ConflictError si el código ya existe', async () => {
      productoRepository.findByCode.mockResolvedValue({ id: 5, codi_prod: 100 });

      await expect(
        ProductoService.create({ codi_prod: 100, nomb_prod: 'Test', prec_prod: 9.99 })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('list()', () => {
    it('retorna array sin meta cuando no hay paginación', async () => {
      productoRepository.findAll.mockResolvedValue({ rows: [{ id: 1 }], count: null });

      const result = await ProductoService.list();
      expect(result.productos).toHaveLength(1);
      expect(result.meta).toBeUndefined();
    });

    it('retorna meta de paginación cuando se envía page', async () => {
      productoRepository.findAll.mockResolvedValue({ rows: [{ id: 1 }], count: 25 });

      const result = await ProductoService.list({ page: 1, limit: 10 });
      expect(result.meta.total).toBe(25);
      expect(result.meta.pages).toBe(3);
    });
  });

  describe('delete()', () => {
    it('llama softDelete en el repository', async () => {
      productoRepository.softDelete.mockResolvedValue();

      await ProductoService.delete(1);
      expect(productoRepository.softDelete).toHaveBeenCalledWith(1);
    });
  });
});
```

### 10.3 `tests/integration/api/productos.test.js`

```javascript
// tests/integration/api/productos.test.js
'use strict';

const request = require('supertest');
const app = require('../../../app');
const { sequelize } = require('../../../models');

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

describe('API /api/v1/productos', () => {
  describe('GET /', () => {
    it('retorna 200 con array vacío', async () => {
      const res = await request(app).get('/api/v1/productos');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /', () => {
    it('crea un producto válido (requiere token)', async () => {
      const res = await request(app)
        .post('/api/v1/productos')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ codi_prod: 1, nomb_prod: 'Laptop', prec_prod: 999.99 });
      expect(res.status).toBe(201);
      expect(res.body.data.nomb_prod).toBe('Laptop');
    });

    it('rechaza body inválido con 400', async () => {
      const res = await request(app)
        .post('/api/v1/productos')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ nomb_prod: '' }); // Faltan campos requeridos
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('rechaza sin token con 401', async () => {
      const res = await request(app)
        .post('/api/v1/productos')
        .send({ codi_prod: 2, nomb_prod: 'Mouse', prec_prod: 29.99 });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /:id', () => {
    it('retorna 404 para ID inexistente', async () => {
      const res = await request(app).get('/api/v1/productos/99999');
      expect(res.status).toBe(404);
    });

    it('retorna 400 para ID inválido', async () => {
      const res = await request(app).get('/api/v1/productos/abc');
      expect(res.status).toBe(400);
    });
  });
});
```

---

## Fase 11 — Graceful Shutdown y Logger Estructurado

> **Commit:** `feat(ops): graceful shutdown, structured logger`

### 11.1 Logger con Pino

```bash
npm install pino pino-pretty --save-exact
```

**`utils/logger.js`:**

```javascript
// utils/logger.js
'use strict';

const pino = require('pino');
const { isDevelopment } = require('../config/environment');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    },
  }),
  redact: {
    // Nunca loguear datos sensibles
    paths: ['req.headers.authorization', 'body.password', 'body.token'],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
```

### 11.2 Graceful Shutdown en `bin/www`

```javascript
// Agregar al final de bin/www
const { sequelize } = require('../models');

const shutdown = async (signal) => {
  console.log(`[Server] ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await sequelize.close();
      console.log('[Server] Database connection closed.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Forzar cierre si no termina en 10 segundos
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

---

## Resumen de Archivos por Fase

```
Fase 1 — Credenciales & Config
  MODIFICAR:  config/environment.js
  CREAR:      config/database.js
  REEMPLAZAR: config/config.json  (sin credenciales)
  MODIFICAR:  models/index.js
  MODIFICAR:  .env.example

Fase 2 — Utilidades
  CREAR:  utils/ApiResponse.js
  CREAR:  utils/ApiError.js

Fase 3 — Error Handler
  CREAR:    middleware/errorHandler.js
  MODIFICAR: app.js

Fase 4 — Modelo
  CREAR:    models/Producto.js
  ELIMINAR: models/producto.js  (reemplazado)
  CREAR:    migrations/20260321000000-add-constraints-indexes-producto.js

Fase 5 — Repository
  CREAR:  repositories/ProductoRepository.js

Fase 6 — Service
  CREAR:  services/ProductoService.js

Fase 7 — Controller
  CREAR:    controllers/v1/ProductoController.js
  ELIMINAR: controllers/producto.js  (reemplazado)

Fase 8 — Validators & Routes
  CREAR:    middleware/validators/index.js
  CREAR:    middleware/validators/producto.validator.js
  CREAR:    routes/v1/index.js
  CREAR:    routes/v1/productos.js
  MODIFICAR: routes/index.js

Fase 9 — Auth JWT
  INSTALAR: jsonwebtoken
  CREAR:    middleware/auth.js
  MODIFICAR: routes/v1/productos.js

Fase 10 — Tests
  INSTALAR: jest, supertest
  CREAR:    tests/unit/services/ProductoService.test.js
  CREAR:    tests/integration/api/productos.test.js

Fase 11 — Ops
  INSTALAR: pino, pino-pretty
  CREAR:    utils/logger.js
  MODIFICAR: bin/www
```

---

## Orden de Ejecución y Commits

```
git checkout -b refactor/architecture

Fase 1  →  fix(security): remove hardcoded credentials, unify config
Fase 2  →  feat(utils): ApiResponse and ApiError classes
Fase 3  →  feat(middleware): centralized error handler, update app.js
Fase 4  →  refactor(model): Producto with constraints, scopes, new migration
Fase 5  →  feat(repository): ProductoRepository data access layer
Fase 6  →  feat(service): ProductoService business logic layer
Fase 7  →  refactor(controller): thin ProductoController v1
Fase 8  →  feat(routes): versioned API v1 with connected validators
Fase 9  →  feat(auth): JWT authentication and authorization middleware
Fase 10 →  test: unit and integration test suite
Fase 11 →  feat(ops): graceful shutdown and structured logger (pino)

git push origin refactor/architecture
# → Abrir PR → Code Review → Merge
```

---

## Checklist Final

- [ ] Credenciales rotadas en AWS RDS
- [ ] `config/config.json` purgado del historial git
- [ ] `npm audit` → 0 vulnerabilidades
- [ ] `npm test` → todos los tests pasan
- [ ] `GET /health` verifica conexión a BD
- [ ] `POST /api/v1/productos` sin token → 401
- [ ] `POST /api/v1/productos` con body inválido → 400 con errores detallados
- [ ] `GET /api/v1/productos?page=1&limit=10` retorna meta de paginación
- [ ] `DELETE /api/v1/productos/:id` → soft-delete (no aparece en listados)
- [ ] Stack trace nunca se expone en producción
- [ ] `SIGTERM` cierra conexiones de BD limpiamente
