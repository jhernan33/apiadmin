'use strict';

const { Router } = require('express');
const productosRouter = require('./productos');

const router = Router();

/**
 * API v1 — Agregador de rutas.
 * Agregar nuevas entidades aquí sin modificar rutas existentes (OCP).
 */
router.use('/productos', productosRouter);

module.exports = router;
