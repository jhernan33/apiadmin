'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../../../app');
const { sequelize } = require('../../../models');

// Token JWT válido para tests de rutas protegidas
const testToken = jwt.sign(
  { id: 1, email: 'test@test.com', role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const authHeader = { Authorization: `Bearer ${testToken}` };

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

// ── GET /api/v1/productos ───────────────────────────────
describe('GET /api/v1/productos', () => {
  it('retorna 200 con array vacío inicialmente', async () => {
    const res = await request(app).get('/api/v1/productos');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('valida parámetro page inválido', async () => {
    const res = await request(app).get('/api/v1/productos?page=abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('valida limit fuera de rango', async () => {
    const res = await request(app).get('/api/v1/productos?limit=200');

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('limit');
  });
});

// ── POST /api/v1/productos ──────────────────────────────
describe('POST /api/v1/productos', () => {
  it('rechaza sin token con 401', async () => {
    const res = await request(app)
      .post('/api/v1/productos')
      .send({ codi_prod: 1, nomb_prod: 'Test', prec_prod: 9.99 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rechaza body inválido con 400', async () => {
    const res = await request(app)
      .post('/api/v1/productos')
      .set(authHeader)
      .send({ nomb_prod: '' }); // Faltan codi_prod y prec_prod, nombre vacío

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('crea un producto válido con 201', async () => {
    const res = await request(app)
      .post('/api/v1/productos')
      .set(authHeader)
      .send({ codi_prod: 1, nomb_prod: 'Laptop Dell', prec_prod: 1299.99 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nomb_prod).toBe('Laptop Dell');
    expect(res.body.data.codi_prod).toBe(1);
  });

  it('rechaza código duplicado con 409', async () => {
    const res = await request(app)
      .post('/api/v1/productos')
      .set(authHeader)
      .send({ codi_prod: 1, nomb_prod: 'Otro', prec_prod: 50 }); // codi_prod 1 ya existe

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/v1/productos/:id ───────────────────────────
describe('GET /api/v1/productos/:id', () => {
  it('retorna 200 con el producto existente', async () => {
    // Primero crear uno
    const created = await request(app)
      .post('/api/v1/productos')
      .set(authHeader)
      .send({ codi_prod: 2, nomb_prod: 'Mouse', prec_prod: 29.99 });

    const res = await request(app).get(`/api/v1/productos/${created.body.data.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.nomb_prod).toBe('Mouse');
  });

  it('retorna 404 para ID inexistente', async () => {
    const res = await request(app).get('/api/v1/productos/99999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('retorna 400 para ID inválido', async () => {
    const res = await request(app).get('/api/v1/productos/abc');

    expect(res.status).toBe(400);
  });
});

// ── PUT /api/v1/productos/:id ───────────────────────────
describe('PUT /api/v1/productos/:id', () => {
  let productoId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/productos')
      .set(authHeader)
      .send({ codi_prod: 3, nomb_prod: 'Teclado', prec_prod: 49.99 });
    productoId = res.body.data.id;
  });

  it('actualiza el producto con 200', async () => {
    const res = await request(app)
      .put(`/api/v1/productos/${productoId}`)
      .set(authHeader)
      .send({ nomb_prod: 'Teclado Mecánico' });

    expect(res.status).toBe(200);
    expect(res.body.data.nomb_prod).toBe('Teclado Mecánico');
  });

  it('rechaza precio negativo con 400', async () => {
    const res = await request(app)
      .put(`/api/v1/productos/${productoId}`)
      .set(authHeader)
      .send({ prec_prod: -5 });

    expect(res.status).toBe(400);
  });

  it('rechaza sin token con 401', async () => {
    const res = await request(app)
      .put(`/api/v1/productos/${productoId}`)
      .send({ nomb_prod: 'Sin auth' });

    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/v1/productos/:id ───────────────────────
describe('DELETE /api/v1/productos/:id', () => {
  let productoId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/productos')
      .set(authHeader)
      .send({ codi_prod: 4, nomb_prod: 'Para eliminar', prec_prod: 1.00 });
    productoId = res.body.data.id;
  });

  it('elimina el producto con 204', async () => {
    const res = await request(app)
      .delete(`/api/v1/productos/${productoId}`)
      .set(authHeader);

    expect(res.status).toBe(204);
  });

  it('el producto eliminado no aparece en el listado', async () => {
    const res = await request(app).get('/api/v1/productos');
    const ids = res.body.data.map((p) => p.id);

    expect(ids).not.toContain(productoId);
  });

  it('retorna 404 al intentar acceder al producto eliminado', async () => {
    const res = await request(app).get(`/api/v1/productos/${productoId}`);

    expect(res.status).toBe(404);
  });
});

// ── GET /health ─────────────────────────────────────────
describe('GET /health', () => {
  it('retorna status ok con BD conectada', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });
});
