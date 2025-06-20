const express = require('express');
const router = express.Router();
const logController = require('../controllers/log.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { check } = require('express-validator');

// Validaciones para crear log
const logValidation = [
  check('action', 'La acción es obligatoria').not().isEmpty(),
  check('entityType', 'El tipo de entidad es obligatorio').not().isEmpty()
];

// Rutas protegidas - Todas modificadas para permitir acceso a cualquier usuario autenticado
router.get('/', authMiddleware.protect, logController.getAllLogs);
router.get('/file/:fileId', authMiddleware.protect, logController.getFileActivityLogs);
router.get('/user/:userId', authMiddleware.protect, logController.getUserActivityLogs);
router.get('/search', authMiddleware.protect, logController.searchLogs);
router.post('/', [authMiddleware.protect, ...logValidation], logController.createLog);
router.delete('/:id', authMiddleware.protect, logController.deleteLog);

module.exports = router; 