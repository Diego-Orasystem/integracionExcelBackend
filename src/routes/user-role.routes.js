const express = require('express');
const router = express.Router();
const userRoleController = require('../controllers/user-role.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

// Rutas para asignaciones de roles a usuarios
router.route('/')
  .get(protect, authorize('admin', 'company_admin'), userRoleController.getAllUserRoles)
  .post(protect, authorize('admin', 'company_admin'), userRoleController.assignRoleToUser);

router.route('/:id')
  .put(protect, authorize('admin', 'company_admin'), userRoleController.updateUserRole)
  .delete(protect, authorize('admin', 'company_admin'), userRoleController.revokeUserRole);

// Obtener roles de un usuario específico
router.route('/user/:userId')
  .get(protect, userRoleController.getUserRolesByUserId);

module.exports = router; 