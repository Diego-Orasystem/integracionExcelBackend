const express = require('express');
const router = express.Router();
const fileStatusController = require('../controllers/file-status.controller');
const { protect } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(protect);

// Ruta para obtener datos agregados sobre el estado de los archivos
router.get('/status', fileStatusController.getFileStatusData);

// Ruta para obtener métricas para la visualización del rompecabezas
router.get('/metrics', fileStatusController.getFileMetrics);

// Ruta para obtener estadísticas de archivos por área y subárea (para visualización de entrega)
router.get('/area-stats', fileStatusController.getAreaFileStats);

module.exports = router; 