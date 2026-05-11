# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                     # nodemon, NODE_ENV=development
npm start                       # node ./bin/www (production-style)
npm test                        # full Jest suite (NODE_ENV=test)
npm run test:unit               # tests/unit only
npm run test:integration        # tests/integration only (needs live PostgreSQL)
npm run test:coverage           # coverage report (threshold: lines ≥ 70%)
npx jest path/to/file.test.js   # single file
npx jest -t "rechaza body inválido"   # single test by name
npm run lint                    # eslint .

npx sequelize-cli db:migrate                  # run pending migrations
npx sequelize-cli db:migrate:undo             # roll back last migration
npx sequelize-cli migration:generate --name X # scaffold a new migration
```

Sequelize CLI reads `DATABASE_URL`, which `config/environment.js` builds from `DB_*` env vars at boot. Migrations live in `migrations/`; config in `config/config.json` (per-NODE_ENV, `use_env_variable: DATABASE_URL`).

Tests need a reachable PostgreSQL at `127.0.0.1:5432` with DB `inventario_test` (credentials hardcoded in `tests/setup.js`). Integration tests call `sequelize.sync({ force: true })` in `beforeAll` — they reset the schema, not just rows.

## Architecture

Layered Express 5 + Sequelize 6 + PostgreSQL API. Single resource so far (`Producto`), but the layering is set up to add more without touching existing wiring.

**Request flow** (read each layer left-to-right when tracing a request):

```
routes/v1/<entity>.js
  → middleware/auth.js (JWT, write routes only)
  → middleware/validators/<entity>.validator.js (express-validator)
  → controllers/v1/<Entity>Controller.js  ← thin, only orchestrates
  → services/<Entity>Service.js           ← business rules, throws ApiError subclasses
  → repositories/<Entity>Repository.js    ← only place that touches Sequelize models
  → models/<entity>.js
```

Controllers must not import models or repositories directly. Services must not know about `req`/`res`. The repository is the only abstraction over Sequelize — preserve that boundary when adding entities.

**Versioning.** API is mounted at `/api/v1` in `routes/index.js`; `routes/v1/index.js` aggregates per-entity routers. To add v2, mount a sibling without modifying v1 (this is the codebase's stated OCP convention, reflected in comments).

**Response envelope.** All success responses go through `utils/ApiResponse.js` (`{ success, message, data, meta? }`). `204` returns no body. Do not hand-roll `res.json(...)` in controllers.

**Error model.** Throw subclasses of `utils/ApiError.js` (`NotFoundError`, `ConflictError`, `ValidationError`, `Unauthorized/ForbiddenError`, `BadRequestError`) from services/repositories. `middleware/errorHandler.js` is the single global handler — it also maps Sequelize errors (`SequelizeUniqueConstraintError` → 409, `SequelizeValidationError` → 422, connection errors → 503). Non-operational errors return a generic 500 in production and include the stack only in development. New error types should extend `ApiError` with `isOperational = true`.

**Validation.** Two layers — they are not redundant:
- `middleware/validators/<entity>.validator.js` builds atomic rule chains (`rules.codiProd(required)`, etc.) composed into per-operation arrays (`validateCreate`, `validateUpdate`, …). `handleValidationErrors` short-circuits with 400 on failure.
- Sequelize-level `validate:` constraints in the model are a backstop and emit 422 via the error handler.
When adding fields, update both.

**Soft delete.** `Producto` has `defaultScope` filtering `deleted: false` and excluding the `deleted` column. To touch deleted rows (e.g., the soft-delete write itself), use `Producto.scope('withDeleted')`. Don't add a different soft-delete mechanism (e.g., Sequelize `paranoid`) — the scope pattern is the project convention.

**Spanish field names.** Columns use abbreviated Spanish (`codi_prod`, `nomb_prod`, `desc_prod`, `prec_prod`, `imag_prod`). Keep this convention for `Producto`; new entities can follow it or use English, but be consistent within an entity. Table names are PascalCase pluralized (`Productos`).

**Auth.** `middleware/auth.js` exports `authenticate` (Bearer JWT → `req.user`) and `authorize(...roles)`. Convention: read routes public, writes require `authenticate`. Tests sign their own JWTs with the test secret in `tests/setup.js`.

**Security middleware** is applied as a bundle by `applySecurityMiddleware(app)` (helmet w/ CSP, CORS, `express-rate-limit` skipping `/health`, body trimming/truncation). The rate limiter is global — keep `/health` skipped if you add more checks at that path.

**Config.** `config/environment.js` is the single source of truth for env vars; it fails fast at startup if any of `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME/JWT_SECRET/SESSION_SECRET` are missing. Import config from there, not `process.env` directly. `bin/www` handles graceful shutdown (SIGTERM/SIGINT → close server → close Sequelize, 10s force-quit timer).

## Repository docs

`SETUP.md` (env vars, DB setup, troubleshooting), `SECURITY.md` (security policy), `ARCHITECTURAL_REPORT.md`, `IMPLEMENTATION_PLAN.md`, `UPGRADE_PLAN.md` are tracked in the repo — consult them for historical context but treat the code as authoritative.
