'use strict';

/**
 * ApiResponse — Envelope estándar para todas las respuestas de la API.
 * DRY: un único lugar para construir respuestas HTTP consistentes.
 */
class ApiResponse {
  /**
   * Respuesta exitosa genérica.
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {*} data
   * @param {string} [message]
   * @param {object|null} [meta]  Paginación, totales, etc.
   */
  static success(res, statusCode, data, message = 'OK', meta = null) {
    const body = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  /** 200 OK */
  static ok(res, data, message = 'OK', meta = null) {
    return ApiResponse.success(res, 200, data, message, meta);
  }

  /** 201 Created */
  static created(res, data, message = 'Recurso creado exitosamente') {
    return ApiResponse.success(res, 201, data, message);
  }

  /** 204 No Content */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Respuesta de error.
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {Array|null} [errors]
   */
  static error(res, statusCode, message, errors = null) {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
  }
}

module.exports = ApiResponse;
