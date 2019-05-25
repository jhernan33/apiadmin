'use strict';
module.exports = (sequelize, DataTypes) => {
  const Productos = sequelize.define('Productos', {
    codi_prod: DataTypes.INTEGER,
    nomb_prod: DataTypes.STRING,
    desc_prod: DataTypes.STRING,
    deleted: DataTypes.BOOLEAN
  }, {});
  Productos.associate = function(models) {
    // associations can be defined here
  };
  return Productos;
};