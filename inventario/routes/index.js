var express = require('express');
var router = express.Router();
const ProductoController = require('../controllers').producto;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;

/**
 * Routes de Productos
 */
router.get('/api/producto',ProductoController.list);
router.get('/api/producto/:id',ProductoController.getById);
router.post('/api/producto',ProductoController.add);
router.put('/api/producto/:id',ProductoController.update);
router.delete('/api/producto/:id',ProductoController.delete);