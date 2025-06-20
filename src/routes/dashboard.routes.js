const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

// Ruta para obtener estadísticas generales del dashboard
router.get('/stats/dashboard', optionalAuth, dashboardController.getStats);

// Rutas para el dashboard de visualizaciones
router.get('/dashboard/areas', protect, dashboardController.getAreas);
router.get('/dashboard/areas/:areaId', protect, dashboardController.getAreaById);
router.get('/dashboard/summary', protect, dashboardController.getSummary);

// Rutas para visualizaciones específicas
router.get('/dashboard/visualizations/treemap', protect, dashboardController.getTreemapData);
router.get('/dashboard/visualizations/hexagons', protect, dashboardController.getHexagonsData);
router.get('/dashboard/visualizations/radialtree', protect, dashboardController.getRadialTreeData);

// Ruta para invalidar la caché
router.post('/dashboard/cache/invalidate', protect, dashboardController.invalidateCache);

module.exports = router; 