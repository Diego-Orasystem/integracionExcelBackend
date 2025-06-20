const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { check } = require('express-validator');

// Validaciones para crear/actualizar usuario
const userValidation = [
  check('email', 'Por favor incluye un email válido').isEmail(),
  check('name', 'El nombre es obligatorio').not().isEmpty(),
  check('password', 'La contraseña debe tener al menos 6 caracteres').isLength({ min: 6 })
];

// Ruta para obtener el usuario actual
router.get('/me', authMiddleware.protect, userController.getMe);

// Rutas protegidas - Todas modificadas para permitir acceso a cualquier usuario autenticado
router.get('/', authMiddleware.protect, userController.getAllUsers);
router.get('/:id', authMiddleware.protect, userController.getUserById);
router.get('/:id/activity', authMiddleware.protect, userController.getUserActivity);
router.post('/', [authMiddleware.protect, ...userValidation], userController.createUser);
router.put('/:id', authMiddleware.protect, userController.updateUser);
router.delete('/:id', authMiddleware.protect, userController.deleteUser);
router.put('/:id/status', authMiddleware.protect, userController.updateUserStatus);

// Nuevas rutas para gestión de roles múltiples
router.get('/:id/roles', authMiddleware.protect, userController.getUserRoles);
router.post('/:id/roles', authMiddleware.protect, userController.addRole);
router.delete('/:id/roles/:role', authMiddleware.protect, userController.removeRole);

module.exports = router; 