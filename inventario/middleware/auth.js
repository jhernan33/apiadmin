'use strict';

const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('../utils/ApiError');
const { security } = require('../config/environment');

/**
 * Extrae el Bearer token del header Authorization.
 * SRP: solo extrae, no valida.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractToken = (req) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
};

/**
 * authenticate — Middleware de autenticación JWT.
 *
 * Verifica el token y adjunta el payload decodificado a req.user.
 * Lanza UnauthorizedError si el token falta, expiró o es inválido.
 */
const authenticate = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next(new UnauthorizedError('Token de autenticación no proporcionado'));
  }

  try {
    req.user = jwt.verify(token, security.jwtSecret);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('El token ha expirado'));
    }
    return next(new UnauthorizedError('Token inválido'));
  }
};

/**
 * authorize — Middleware de autorización por roles.
 *
 * Uso: router.delete('/:id', authenticate, authorize('admin'), controller.delete)
 * OCP: agregar nuevos roles sin modificar este middleware.
 *
 * @param {...string} allowedRoles
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError());
  }
  if (!allowedRoles.includes(req.user.role)) {
    return next(new ForbiddenError('No tienes permisos para realizar esta acción'));
  }
  next();
};

module.exports = { authenticate, authorize };
