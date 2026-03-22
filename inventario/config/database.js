'use strict';

const { Sequelize } = require('sequelize');
const { database, isDevelopment } = require('./environment');

/**
 * Instancia única de Sequelize — Single Source of Truth para la BD.
 * SRP: este módulo solo crea y exporta la conexión a la base de datos.
 */
const sequelize = new Sequelize(
  database.name,
  database.username,
  database.password,
  {
    host: database.host,
    port: database.port,
    dialect: database.dialect,
    logging: isDevelopment ? (sql) => console.log(`[SQL] ${sql}`) : false,
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
      timestamps: true,
      underscored: false,
      freezeTableName: false,
    },
  }
);

module.exports = sequelize;
