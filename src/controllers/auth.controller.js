const User = require('../models/User');
const Log = require('../models/Log');
const Company = require('../models/Company');
const { generateToken, generateRefreshToken } = require('../utils/jwt.utils');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const emailService = require('../services/email.service');

// @desc    Registrar un nuevo usuario
// @route   POST /api/auth/register
// @access  Público
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error de validación',
        details: errors.array()
      }
    });
  }

  try {
    const { name, email, password, companyId } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'El usuario con este email ya existe'
        }
      });
    }

    // Verificar si la empresa existe
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'La empresa especificada no existe'
        }
      });
    }

    // Crear usuario
    const user = await User.create({
      name,
      email,
      password,
      companyId,
      roles: ['user'], // Por defecto se asigna rol de usuario
      active: true
    });

    // Generar tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Registrar en log
    await Log.create({
      userId: user._id,
      companyId: user.companyId,
      action: 'register',
      entityType: 'user',
      entityId: user._id,
      details: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          companyId: user.companyId
        }
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al registrar el usuario'
      }
    });
  }
};

// @desc    Iniciar sesión
// @route   POST /api/auth/login
// @access  Público
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // INICIO: CÓDIGO TEMPORAL PARA DESARROLLO
    // Este código crea un usuario temporal para desarrollo. Eliminar en producción.
    const usersCount = await User.countDocuments();
    if (usersCount === 0) {
      console.log('📢 ADVERTENCIA: Creando empresa y usuario temporal para desarrollo');
      
      // Crear empresa temporal
      const tempCompany = await Company.create({
        name: 'Empresa Temporal',
        emailDomain: 'temp.com',
        description: 'Empresa temporal para desarrollo',
        settings: {
          maxStorage: 1024,
          allowedFileTypes: ['.xlsx', '.xls', '.csv'],
          autoSyncInterval: 60
        },
        active: true
      });

      // Crear usuario admin temporal
      const tempUser = await User.create({
        name: 'Admin Temporal',
        email: 'admin@temp.com',
        password: 'temp123456',
        roles: ['admin'],
        companyId: tempCompany._id,
        active: true
      });

      console.log('✅ Usuario temporal creado. Email: admin@temp.com, Contraseña: temp123456');
      
      // Generar tokens para el usuario temporal
      const token = generateToken(tempUser._id);
      const refreshToken = generateRefreshToken(tempUser._id);
      
      return res.status(200).json({
        success: true,
        message: 'Usuario temporal creado automáticamente',
        data: {
          token,
          refreshToken,
          user: {
            id: tempUser._id,
            name: tempUser.name,
            email: tempUser.email,
            roles: tempUser.roles,
            companyId: tempUser.companyId
          },
          company: {
            id: tempCompany._id,
            name: tempCompany.name
          }
        }
      });
    }
    // FIN: CÓDIGO TEMPORAL PARA DESARROLLO

    // Si estamos en modo de desarrollo y hay una bandera especial, permitir login sin verificación ()
    if (process.env.NODE_ENV === 'development' && process.env.EASY_LOGIN === 'true') {
      console.log('⚠️ ADVERTENCIA: Modo de login fácil activado, esto no debe usarse en producción');
      
      // Buscar usuario por email o usar uno fijo si no existe
      let user = await User.findOne({ email });
      
      if (!user) {
        // Si no hay usuarios en el sistema
        const userCount = await User.countDocuments();
        
        if (userCount === 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'NO_USERS',
              message: 'No hay usuarios en el sistema. Use /api/auth/init para crear el primer usuario'
            }
          });
        }
        
        // Usar el primer usuario administrador como fallback
        user = await User.findOne({ roles: 'admin' });
        
        if (!user) {
          // Si no hay admins, usar cualquier usuario
          user = await User.findOne();
        }
      }
      
      // Generar tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);
      
      // Registrar en log
      await Log.create({
        userId: user._id,
        companyId: user.companyId,
        action: 'dev_login',
        entityType: 'user',
        entityId: user._id,
        details: {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          devMode: true
        }
      });
      
      return res.status(200).json({
        success: true,
        data: {
          token,
          refreshToken,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            roles: user.roles,
            companyId: user.companyId
          },
          devMode: true
        }
      });
    }

    // Flujo normal de autenticación
    // Buscar usuario por email
    const user = await User.findOne({ email }).select('+password');
    
    // Verificar si existe y la contraseña es correcta
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas'
        }
      });
    }

    // Verificar si el usuario está activo
    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Usuario inactivo. Contacte al administrador.'
        }
      });
    }

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Datos adicionales para el token
    const tokenData = {
      loginMethod: 'password',
      roles: user.roles,
      companyId: user.companyId
    };

    // Generar tokens con información adicional
    const token = generateToken(user._id, tokenData);
    const refreshToken = generateRefreshToken(user._id, tokenData);

    // Registrar en log
    await Log.create({
      userId: user._id,
      companyId: user.companyId,
      action: 'login',
      entityType: 'user',
      entityId: user._id,
      details: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        loginMethod: 'password'
      }
    });
    
    // Devolver respuesta exitosa
    res.status(200).json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          companyId: user.companyId,
          loginMethod: 'password'
        }
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
};

// @desc    Obtener información del usuario actual
// @route   GET /api/auth/me
// @access  Privado
exports.getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          roles: req.user.roles,
          companyId: req.user.companyId,
          lastLogin: req.user.lastLogin,
          preferences: req.user.preferences
        }
      }
    });
  } catch (error) {
    console.error('Error en getMe:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
};

// @desc    Obtener perfil de usuario (ruta especial para evitar errores de MongoDB)
// @route   GET /api/auth/profile
// @access  Privado
exports.getProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          roles: req.user.roles,
          companyId: req.user.companyId,
          lastLogin: req.user.lastLogin,
          preferences: req.user.preferences
        }
      }
    });
  } catch (error) {
    console.error('Error en getProfile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
};

// @desc    Refrescar token
// @route   POST /api/auth/refresh
// @access  Público
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Token de refresco no proporcionado'
        }
      });
    }

    // Verificar el token de refresco
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET + '-refresh');

    // Verificar si el usuario existe y está activo
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Usuario inactivo'
        }
      });
    }

    // Generar nuevo token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        token
      }
    });
  } catch (error) {
    console.error('Error en refreshToken:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Token de refresco inválido o expirado'
      }
    });
  }
};

// @desc    Cerrar sesión
// @route   POST /api/auth/logout
// @access  Privado
exports.logout = async (req, res) => {
  try {
    // Registrar log de cierre de sesión
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'logout',
      entityType: 'user',
      entityId: req.user._id,
      details: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
};

// @desc    Inicializar sistema con usuario admin
// @route   POST /api/auth/init
// @access  Público
exports.initSystem = async (req, res) => {
  try {
    // Verificar si ya hay usuarios en el sistema
    const userCount = await User.countDocuments();
    
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SYSTEM_ALREADY_INITIALIZED',
          message: 'El sistema ya ha sido inicializado'
        }
      });
    }

    // Crear empresa por defecto
    const defaultCompany = await Company.create({
      name: 'Empresa Principal',
      emailDomain: 'sistema.com',
      description: 'Empresa creada automáticamente durante la inicialización',
      settings: {
        maxStorage: 1024, // 1GB por defecto
        allowedFileTypes: ['.xlsx', '.xls', '.csv'],
        autoSyncInterval: 60 // 1 hora por defecto
      },
      active: true
    });

    // Crear usuario admin
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Nombre, email y contraseña son obligatorios'
        }
      });
    }

    const adminUser = await User.create({
      name,
      email,
      password,
      roles: ['admin'],
      companyId: defaultCompany._id,
      active: true
    });

    // Generar tokens
    const token = generateToken(adminUser._id);
    const refreshToken = generateRefreshToken(adminUser._id);

    // Registrar en log
    await Log.create({
      userId: adminUser._id,
      companyId: adminUser.companyId,
      action: 'system_init',
      entityType: 'user',
      entityId: adminUser._id,
      details: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          roles: adminUser.roles,
          companyId: adminUser.companyId
        },
        company: {
          id: defaultCompany._id,
          name: defaultCompany.name
        }
      }
    });
  } catch (error) {
    console.error('Error en initSystem:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al inicializar el sistema'
      }
    });
  }
};

// @desc    Solicitar código de verificación para inicio de sesión
// @route   POST /api/auth/request-code
// @access  Público
exports.requestLoginCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EMAIL',
          message: 'El correo electrónico es obligatorio'
        }
      });
    }

    // Buscar usuario por email
    const user = await User.findOne({ email }).select('+verificationCode +verificationCodeExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'No existe un usuario con este correo electrónico'
        }
      });
    }

    // Verificar si el usuario está activo
    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Usuario inactivo. Contacte al administrador.'
        }
      });
    }

    // Generar código de verificación
    const code = await user.generateVerificationCode();
    
    // Enviar correo con el código
    await emailService.sendLoginCode(user.email, code, user.name);

    // Registrar en log
    await Log.create({
      userId: user._id,
      companyId: user.companyId,
      action: 'request_login_code',
      entityType: 'user',
      entityId: user._id,
      details: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.status(200).json({
      success: true,
      message: 'Código de verificación enviado al correo electrónico'
    });
  } catch (error) {
    console.error('Error en requestLoginCode:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al solicitar código de verificación'
      }
    });
  }
};

// @desc    Verificar código y realizar inicio de sesión
// @route   POST /api/auth/verify-code
// @access  Público
exports.verifyLoginCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'El correo electrónico y el código son obligatorios'
        }
      });
    }

    // Buscar usuario por email
    const user = await User.findOne({ email }).select('+verificationCode +verificationCodeExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'No existe un usuario con este correo electrónico'
        }
      });
    }

    // Verificar si el usuario está activo
    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Usuario inactivo. Contacte al administrador.'
        }
      });
    }

    // Verificar el código
    if (!user.verifyCode(code)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Código inválido o expirado'
        }
      });
    }

    // Limpiar código y expiración
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    
    // Actualizar último login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Datos adicionales para el token
    const tokenData = {
      loginMethod: 'email_code',
      roles: user.roles,
      companyId: user.companyId
    };

    // Generar tokens con información adicional
    const token = generateToken(user._id, tokenData);
    const refreshToken = generateRefreshToken(user._id, tokenData);

    // Registrar en log
    await Log.create({
      userId: user._id,
      companyId: user.companyId,
      action: 'login_with_code',
      entityType: 'user',
      entityId: user._id,
      details: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        loginMethod: 'email_code'
      }
    });
    
    // Devolver respuesta exitosa
    res.status(200).json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          companyId: user.companyId,
          loginMethod: 'email_code'
        }
      }
    });
  } catch (error) {
    console.error('Error en verifyLoginCode:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al verificar código'
      }
    });
  }
}; 