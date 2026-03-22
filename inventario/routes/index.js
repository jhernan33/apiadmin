'use strict';

const { Router } = require('express');
const v1Router = require('./v1');

const router = Router();

/**
 * Router raíz — monta versiones de API.
 * OCP: agregar /api/v2 aquí sin tocar rutas existentes.
 */
router.use('/api/v1', v1Router);

module.exports = router;
