'use strict';

/**
 * ApiError — Jerarquía de errores operacionales de la aplicación.
 *
 * isOperational = true  → Error esperado (404, 409, 401…) — se responde al cliente.
 * isOperational = false → Bug inesperado — se loguea y se responde con 500 genérico.
 *
 * OCP: agregar nuevos tipos de error sin modificar el handler.
 */
class ApiError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
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

class BadRequestError extends ApiError {
  constructor(message = 'Solicitud inválida') {
    super(message, 400);
  }
}

module.exports = {
  ApiError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
};
