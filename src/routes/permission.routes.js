const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permission.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

// Rutas para permisos
router.route('/')
  .get(protect, authorize('admin', 'company_admin'), permissionController.getAllPermissions)
  .post(protect, authorize('admin'), permissionController.createPermission);

router.route('/:id')
  .get(protect, authorize('admin', 'company_admin'), permissionController.getPermissionById)
  .put(protect, authorize('admin'), permissionController.updatePermission)
  .delete(protect, authorize('admin'), permissionController.deletePermission);

// Crear permisos predefinidos del sistema
router.route('/defaults')
  .post(protect, authorize('admin'), permissionController.createDefaultPermissions);

module.exports = router; 