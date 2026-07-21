'use strict';

/**
 * Configuración para Sequelize CLI (migraciones/seeders).
 *
 * Reemplaza al antiguo config.json para poder derivar el SSL de las variables
 * de entorno en lugar de hardcodear `rejectUnauthorized: false`, que aceptaba
 * cualquier certificado en producción y exponía la conexión a MITM.
 *
 * Requiere DATABASE_URL. `config/environment.js` la construye desde las
 * variables DB_* al arrancar; aquí se replica ese fallback porque el CLI carga
 * este archivo de forma aislada, sin pasar por app.js.
 */

require('./environment');

const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

const ssl = process.env.DB_SSL === 'true'
  ? { dialectOptions: { ssl: { require: true, rejectUnauthorized } } }
  : {};

const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
};

module.exports = {
  development: { ...base, logging: true },
  test: { ...base, logging: false },
  production: { ...base, logging: false, ...ssl },
};
