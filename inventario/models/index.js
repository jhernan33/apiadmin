'use strict';

const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const db = {};

/**
 * Carga todos los modelos del directorio models/ dinámicamente.
 * Elimina el uso de sequelize['import']() que fue removido en Sequelize v7.
 */
fs.readdirSync(__dirname)
  .filter((file) => file !== 'index.js' && file.endsWith('.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);
    db[model.name] = model;
  });

// Registrar asociaciones entre modelos
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;

module.exports = db;
