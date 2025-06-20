const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company.controller');
const areaController = require('../controllers/area.controller');
const subareaController = require('../controllers/subarea.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { check } = require('express-validator');

// Validaciones para crear/actualizar empresa
const companyValidation = [
  check('name', 'El nombre de la empresa es obligatorio').not().isEmpty(),
  check('description', 'La descripción no puede superar los 500 caracteres').optional().isLength({ max: 500 })
];

// Rutas protegidas - Modificado para permitir acceso a cualquier usuario autenticado
router.get('/', authMiddleware.protect, companyController.getAllCompanies);
router.get('/:id', authMiddleware.protect, companyController.getCompanyById);
router.get('/:id/stats', authMiddleware.protect, companyController.getCompanyStats);
router.post('/', [authMiddleware.protect, ...companyValidation], companyController.createCompany);

// Nuevas rutas para filtrar áreas y subáreas por compañía
router.get('/:companyId/areas', authMiddleware.protect, areaController.getAreasByCompany);
router.get('/:companyId/subareas', authMiddleware.protect, subareaController.getSubAreasByCompany);

// Para operaciones que requieren autenticación y validación
router.put('/:id', [authMiddleware.protect, ...companyValidation], companyController.updateCompany);
router.delete('/:id', authMiddleware.protect, companyController.deleteCompany);

module.exports = router; 