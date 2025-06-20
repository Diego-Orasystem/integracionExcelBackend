const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const menuController = require('../controllers/menu.controller');

// Rutas protegidas (requieren autenticación)
router.get('/', protect, menuController.getUserMenu);
router.post('/', protect, menuController.createMenuItem);
router.put('/:id', protect, menuController.updateMenuItem);
router.delete('/:id', protect, menuController.deleteMenuItem);
router.post('/default', protect, menuController.createDefaultMenuItems);

module.exports = router; 