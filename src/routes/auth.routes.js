const express = require('express');
const { 
  login, 
  getMe, 
  refreshToken, 
  logout, 
  register, 
  initSystem, 
  getProfile, 
  requestLoginCode,
  verifyLoginCode
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { check } = require('express-validator');

const router = express.Router();

// Validaciones para registro
const registerValidation = [
  check('name', 'El nombre es obligatorio').not().isEmpty(),
  check('email', 'Incluye un email válido').isEmail(),
  check('password', 'La contraseña debe tener al menos 6 caracteres').isLength({ min: 6 }),
  check('companyId', 'La empresa es obligatoria').not().isEmpty()
];

// Rutas públicas
router.post('/init', initSystem);
router.post('/register', registerValidation, register);
router.post('/login', login);
router.post('/refresh', refreshToken);

// Rutas para login con código
router.post('/request-code', requestLoginCode);
router.post('/verify-code', verifyLoginCode);

// Ruta temporal para obtener un token de prueba (solo para desarrollo)
router.get('/test-token', async (req, res) => {
  try {
    // Buscar un usuario admin para generar un token
    const User = require('../models/User');
    const admin = await User.findOne({ role: 'company_admin' }).select('_id companyId role');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró usuario admin para generar token'
      });
    }
    
    // Generar token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: admin._id, role: admin.role, companyId: admin.companyId },
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: '24h' }
    );
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: admin._id,
        role: admin.role,
        companyId: admin.companyId
      }
    });
  } catch (error) {
    console.error('Error al generar token de prueba:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar token de prueba'
    });
  }
});

// Rutas protegidas
router.get('/me', protect, getMe);
router.get('/profile', protect, getProfile);
router.post('/logout', protect, logout);

module.exports = router; 