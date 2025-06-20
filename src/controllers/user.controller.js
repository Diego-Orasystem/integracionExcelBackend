const User = require('../models/User');
const Log = require('../models/Log');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

/**
 * @desc    Obtener todos los usuarios
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getAllUsers = async (req, res) => {
  try {
    // Permitir filtrado por empresa para admins de empresa
    const filter = {};
    if (req.user.role === 'company_admin') {
      filter.companyId = req.user.companyId;
    }
    
    const users = await User.find(filter).select('-passwordHash');
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener la lista de usuarios'
      }
    });
  }
};

/**
 * @desc    Obtener un usuario por ID
 * @route   GET /api/users/:id
 * @access  Private/Admin/Self
 */
exports.getUserById = async (req, res) => {
  try {
    // Verificar si el ID es válido antes de buscar
    const { id } = req.params;
    
    if (id === 'profile') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'ID de usuario no válido. Para acceder al perfil use /api/auth/profile'
        }
      });
    }
    
    // Verificar si el ID es un ObjectId válido de MongoDB
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'El ID de usuario proporcionado no es válido'
        }
      });
    }
    
    const user = await User.findById(req.params.id).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && 
        req.user.role !== 'company_admin' && 
        req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para ver este usuario'
        }
      });
    }

    // Si es company_admin, verificar que el usuario pertenezca a su empresa
    if (req.user.role === 'company_admin' && 
        user.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para ver este usuario'
        }
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener el usuario'
      }
    });
  }
};

/**
 * @desc    Crear un nuevo usuario
 * @route   POST /api/users
 * @access  Private
 */
exports.createUser = async (req, res) => {
  console.log(req.body);
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

  const { email, name, password, role, companyId, preferences } = req.body;

  try {
    // Verificar si el correo ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'El correo electrónico ya está registrado'
        }
      });
    }

    // Obtener la empresa para verificar el dominio de correo
    const company = await mongoose.model('Company').findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'La empresa especificada no existe'
        }
      });
    }

    // Verificar que el dominio del correo coincida con el de la empresa
    const emailDomain = email.split('@')[1];
    if (emailDomain !== company.emailDomain) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL_DOMAIN',
          message: `El correo debe pertenecer al dominio de la empresa: ${company.emailDomain}`
        }
      });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Crear usuario
    const newUser = new User({
      email,
      name,
      password,
      roles: role ? [role] : ['user'],
      companyId,
      preferences: preferences || {
        language: 'es',
        theme: 'light',
        defaultView: 'list'
      },
      active: true
    });

    await newUser.save();

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_user',
      entityType: 'user',
      entityId: newUser._id,
      details: {
        email: newUser.email,
        name: newUser.name,
        roles: newUser.roles
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...newUser.toObject(),
        passwordHash: undefined
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear el usuario'
      }
    });
  }
};

/**
 * @desc    Actualizar un usuario
 * @route   PUT /api/users/:id
 * @access  Private
 */
exports.updateUser = async (req, res) => {
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
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    // Permitir actualizar todos los campos para cualquier usuario
    const { name, password, role, roles, companyId, preferences, active } = req.body;
    const updateData = {};

    // Todos los campos pueden ser actualizados por cualquier usuario
    if (name) updateData.name = name;
    if (preferences) updateData.preferences = preferences;
    if (active !== undefined) updateData.active = active;
    
    // Actualizar roles (prioridad sobre el campo role para compatibilidad)
    if (roles) {
      updateData.roles = roles;
    } else if (role) {
      updateData.roles = [role];
    }
    
    if (companyId) updateData.companyId = companyId;

    // Actualizar contraseña si se proporciona
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    // Actualizar usuario
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-passwordHash');

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'update_user',
      entityType: 'user',
      entityId: updatedUser._id,
      details: {
        changes: Object.keys(updateData).join(', ')
      }
    });

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar el usuario'
      }
    });
  }
};

/**
 * @desc    Eliminar un usuario
 * @route   DELETE /api/users/:id
 * @access  Private
 */
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    // En lugar de eliminar físicamente, marcar como inactivo
    user.active = false;
    await user.save();

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'delete_user',
      entityType: 'user',
      entityId: user._id
    });

    res.json({
      success: true,
      message: 'Usuario desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar el usuario'
      }
    });
  }
};

/**
 * @desc    Obtener actividad de un usuario
 * @route   GET /api/users/:id/activity
 * @access  Private
 */
exports.getUserActivity = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    // Obtener logs de actividad
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const logs = await Log.find({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Log.countDocuments({ userId: req.params.id });
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error al obtener actividad del usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener la actividad del usuario'
      }
    });
  }
};

/**
 * @desc    Obtener el usuario actual
 * @route   GET /api/users/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    // El middleware auth.protect ya carga el usuario en req.user
    const user = await User.findById(req.user._id).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error al obtener usuario actual:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener el usuario'
      }
    });
  }
};

/**
 * @desc    Actualizar el estado de un usuario
 * @route   PUT /api/users/:id/status
 * @access  Private
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { active } = req.body;
    
    if (active === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'El estado (active) del usuario es requerido'
        }
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    // Actualizar estado
    user.active = active;
    await user.save();

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: active ? 'activate_user' : 'deactivate_user',
      entityType: 'user',
      entityId: user._id
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        active: user.active
      },
      message: `Usuario ${active ? 'activado' : 'desactivado'} correctamente`
    });
  } catch (error) {
    console.error('Error al actualizar estado del usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar el estado del usuario'
      }
    });
  }
};

/**
 * @desc    Obtener los roles de un usuario
 * @route   GET /api/users/:id/roles
 * @access  Private/Admin
 */
exports.getUserRoles = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    res.json({
      success: true,
      data: user.roles || []
    });
  } catch (error) {
    console.error('Error al obtener roles del usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener los roles del usuario'
      }
    });
  }
};

/**
 * @desc    Asignar un rol adicional a un usuario
 * @route   POST /api/users/:id/roles
 * @access  Private/Admin
 */
exports.addRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ROLE',
          message: 'Debe especificar un rol para agregar'
        }
      });
    }
    
    // Validar que el rol sea uno de los permitidos
    const allowedRoles = ['admin', 'company_admin', 'user', 'user_control', 'user_responsible'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: `Rol no válido. Debe ser uno de: ${allowedRoles.join(', ')}`
        }
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    // Verificar si el usuario ya tiene el rol
    if (user.roles && user.roles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ROLE_EXISTS',
          message: 'El usuario ya tiene asignado este rol'
        }
      });
    }

    // Asignar el nuevo rol
    if (!user.roles) {
      user.roles = [role];
    } else {
      user.roles.push(role);
    }
    
    await user.save();

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'add_user_role',
      entityType: 'user',
      entityId: user._id,
      details: {
        addedRole: role
      }
    });

    res.json({
      success: true,
      data: user.roles
    });
  } catch (error) {
    console.error('Error al agregar rol al usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al agregar rol al usuario'
      }
    });
  }
};

/**
 * @desc    Quitar un rol de un usuario
 * @route   DELETE /api/users/:id/roles/:role
 * @access  Private/Admin
 */
exports.removeRole = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }

    const { role } = req.params;

    // Verificar si el usuario tiene el rol
    if (!user.roles || !user.roles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'El usuario no tiene asignado este rol'
        }
      });
    }

    // No permitir quitar el último rol
    if (user.roles.length === 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LAST_ROLE',
          message: 'No se puede quitar el último rol del usuario'
        }
      });
    }

    // Quitar el rol
    user.roles = user.roles.filter(r => r !== role);
    await user.save();

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'remove_user_role',
      entityType: 'user',
      entityId: user._id,
      details: {
        removedRole: role
      }
    });

    res.json({
      success: true,
      data: user.roles
    });
  } catch (error) {
    console.error('Error al quitar rol del usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al quitar rol del usuario'
      }
    });
  }
}; 