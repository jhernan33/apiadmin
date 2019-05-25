const Productos = require('../models').Productos;

module.exports = {
    list: function (req, res) {
        return Productos
            .findAll({
                include: [{
                    model: Productos,
                    all:true,
                    as: 'productos'
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

  getById(req, res) {
    return Productos
      .findById(req.params.id, {
        include: [{
          model: Productos,
            all:true,
          as: 'productos'
        }],
      })
      .then((producto) => {
        if (!producto) {
          return res.status(404).send({
            message: 'Classroom Not Found',
          });
        }
        return res.status(200).send(producto);
      })
      .catch((error) => res.status(400).send(error));
  },

  add(req, res) {
    return Productos
      .create({
        nomb_prod: req.body.nomb_prod,
      })
      .then((producto) => res.status(201).send(producto))
      .catch((error) => res.status(400).send(error));
  },

  update(req, res) {
    return Productos
      .findById(req.params.id, {
        include: [{
          model: Productos,
          as: 'productos'
        }],
      })
      .then(producto => {
        if (!producto) {
          return res.status(404).send({
            message: 'Producto Not Found',
          });
        }
        return productos
          .update({
            nomb_prod: req.body.nomb_prod || producto.nomb_prod,
          })
          .then(() => res.status(200).send(producto))
          .catch((error) => res.status(400).send(error));
      })
      .catch((error) => res.status(400).send(error));
  },

  delete(req, res) {
    return Productos
      .findById(req.params.id)
      .then(producto => {
        if (!producto) {
          return res.status(400).send({
            message: 'Producto Not Found',
          });
        }
        return producto
          .destroy()
          .then(() => res.status(204).send())
          .catch((error) => res.status(400).send(error));
      })
      .catch((error) => res.status(400).send(error));
  },
};
