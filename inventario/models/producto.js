'use strict';
module.exports = (sequelize, DataTypes) => {
  const Producto = sequelize.define('Producto', {
    codi_prod: DataTypes.INTEGER,
    nomb_prod: DataTypes.STRING,
    desc_prod: DataTypes.STRING,
    dele_prod: DataTypes.BOOLEAN
  }, {});
  Producto.associate = function(models) {
    // associations can be defined here
  };
  return Producto;
};