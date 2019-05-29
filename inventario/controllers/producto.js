const Productos = require('../models').Productos;

module.exports = {
    /**
     * Listado de Productos
     * @param req
     * @param res
     * @returns {Promise<T | never>}
     */
    list: function (req, res) {
        return Productos
            .findAll({
                offset: 5, limit: 5,
                include: [{
                    model: Productos,
                    all:true,
                    as: 'productos',
                }],
                order: [
                    ['createdAt', 'DESC'],
                ],
            })
            .then((producto) => res.status(200).send(producto))
            .catch((error) => {
                res.status(500).send(error);
            });
    },
    /**
     * Buscar un Producto
     * @param req
     * @param res
     * @returns {Promise<T | never>}
     */
  getById(req, res) {
    return Productos
      .findByPk(req.params.id, {
        include: [{
          model: Productos,
            all:true,
          as: 'productos'
        }],
      })
      .then((producto) => {
        if (!producto) {
          return res.status(404).send({
            message: 'Producto no Encontrado',
          });
        }
        return res.status(200).send(producto);
      })
      .catch((error) => res.status(400).send(error));
  },

    /**
     * Agregar un Producto
     * @param req
     * @param res
     * @returns {Promise<T | never>}
     */
  add(req, res) {
    return Productos
      .create({
        nomb_prod: req.body.nomb_prod,
          desc_prod: req.body.desc_prod,
          codi_prod: req.body.codi_prod
      })
      .then((producto) => res.status(201).send(producto))
      .catch((error) => res.status(400).send(error));
  },

    /**
     * Actualizar un Producto
     * @param req
     * @param res
     * @returns {Promise<T | never>}
     */
  update(req, res) {
    return Productos
      .findByPk(req.params.id, {
        include: [{
          model: Productos,
            all:true,
          as: 'productos'
        }],
      })
      .then(Productos => {
        if (!Productos) {
          return res.status(404).send({
            message: 'Producto Not Found',
          });
        }
        return Productos
          .update({
            nomb_prod: req.body.nomb_prod || Productos.nomb_prod,
              desc_prod: req.body.desc_prod || Productos.desc_prod,
              codi_prod: req.body.codi_prod
          })
          .then(() => res.status(200).send(Productos))
          .catch((error) => res.status(400).send(error));
      })
      .catch((error) => res.status(500).send(error));
  },

    /**
     * Borrar un Producto
     * @param req
     * @param res
     * @returns {Promise<T | never>}
     */
  delete(req, res) {
    return Productos
      .findByPk(req.params.id)
      .then(Productos => {
        if (!Productos) {
          return res.status(400).send({
            message: 'Producto Not Found',
          });
        }
        return Productos
          .destroy()
          .then(() => res.status(204).send())
          .catch((error) => res.status(400).send(error));
      })
      .catch((error) => res.status(400).send(error));
  },
};
