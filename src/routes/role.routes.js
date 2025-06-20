const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

// Rutas para roles
router.route('/')
  .get(protect, authorize('admin', 'company_admin'), roleController.getAllRoles)
  .post(protect, authorize('admin', 'company_admin'), roleController.createRole);

router.route('/:id')
  .get(protect, authorize('admin', 'company_admin'), roleController.getRoleById)
  .put(protect, authorize('admin', 'company_admin'), roleController.updateRole)
  .delete(protect, authorize('admin', 'company_admin'), roleController.deleteRole);

module.exports = router; 