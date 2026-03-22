'use strict';

/**
 * Setup global para Jest.
 * Define las variables de entorno mínimas antes de cargar cualquier módulo.
 */

process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_NAME = 'inventario_test';
process.env.DB_DIALECT = 'postgres';
process.env.DB_SSL = 'false';
process.env.JWT_SECRET = 'test_jwt_secret_min_32_chars_for_testing_only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SESSION_SECRET = 'test_session_secret_min_32_chars_testing';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
