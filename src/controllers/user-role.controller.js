const UserRole = require('../models/UserRole');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const Area = require('../models/Area');
const SubArea = require('../models/SubArea');
const Log = require('../models/Log');

// @desc    Obtener todas las asignaciones de roles a usuarios
// @route   GET /api/user-roles
// @access  Privado (Admin o Admin de Compañía)
exports.getAllUserRoles = async (req, res) => {
  try {
    // Construir query según el rol del usuario
    const query = { active: true };
    
    // Si no es admin, solo ver asignaciones de su compañía
    if (req.user.role !== 'admin') {
      query.companyId = req.user.companyId;
    }
    
    const userRoles = await UserRole.find(query)
      .populate('userId', 'name email')
      .populate('roleId', 'name code')
      .populate('areaId', 'name')
      .populate('subareaId', 'name')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: userRoles.length,
      data: userRoles
    });
  } catch (error) {
    console.error('Error al obtener asignaciones de roles:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener asignaciones de roles'
      }
    });
  }
};

// @desc    Obtener asignaciones de roles para un usuario específico
// @route   GET /api/user-roles/user/:userId
// @access  Privado (Admin, Admin de Compañía o el propio usuario)
exports.getUserRolesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar si el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }
    
    // Verificar permisos
    if (req.user.role !== 'admin' && 
        req.user.role !== 'company_admin' && 
        req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para ver los roles de este usuario'
        }
      });
    }
    
    // Si es admin de compañía, verificar que el usuario pertenezca a su empresa
    if (req.user.role === 'company_admin' && 
        user.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para ver los roles de este usuario'
        }
      });
    }
    
    // Buscar roles asignados
    const userRoles = await UserRole.find({ 
      userId,
      active: true 
    })
    .populate('roleId', 'name code description')
    .populate('areaId', 'name')
    .populate('subareaId', 'name')
    .populate('additionalPermissions', 'name code category actions')
    .populate('deniedPermissions', 'name code category');
    
    res.status(200).json({
      success: true,
      count: userRoles.length,
      data: userRoles
    });
  } catch (error) {
    console.error('Error al obtener roles del usuario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener roles del usuario'
      }
    });
  }
};

// @desc    Asignar un rol a un usuario
// @route   POST /api/user-roles
// @access  Privado (Admin o Admin de Compañía)
exports.assignRoleToUser = async (req, res) => {
  try {
    const { 
      userId, 
      roleId, 
      areaId, 
      subareaId, 
      additionalPermissions, 
      deniedPermissions 
    } = req.body;
    
    // Validar datos básicos
    if (!userId || !roleId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Usuario y rol son obligatorios'
        }
      });
    }
    
    // Verificar si el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }
    
    // Verificar si el rol existe
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Rol no encontrado'
        }
      });
    }
    
    // Si es admin de compañía, solo puede asignar en su compañía
    if (req.user.role !== 'admin') {
      if (user.companyId.toString() !== req.user.companyId.toString()) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No puedes asignar roles a usuarios de otra compañía'
          }
        });
      }
      
      // Admin de compañía no puede asignar roles administrativos del sistema
      if (role.isSystem && ['admin'].includes(role.code)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tienes permisos para asignar este rol'
          }
        });
      }
    }
    
    // Verificar área si se proporciona
    if (areaId) {
      const area = await Area.findOne({ 
        _id: areaId,
        companyId: user.companyId
      });
      
      if (!area) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'AREA_NOT_FOUND',
            message: 'Área no encontrada o no pertenece a la compañía del usuario'
          }
        });
      }
    }
    
    // Verificar subárea si se proporciona
    if (subareaId) {
      const subarea = await SubArea.findOne({ 
        _id: subareaId,
        companyId: user.companyId
      });
      
      if (!subarea) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SUBAREA_NOT_FOUND',
            message: 'Subárea no encontrada o no pertenece a la compañía del usuario'
          }
        });
      }
      
      // Si también hay área, verificar que la subárea pertenezca al área
      if (areaId && subarea.areaId.toString() !== areaId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SUBAREA',
            message: 'La subárea no pertenece al área especificada'
          }
        });
      }
    }
    
    // Verificar si ya existe una asignación activa con los mismos parámetros
    const existingUserRole = await UserRole.findOne({
      userId,
      roleId,
      companyId: user.companyId,
      areaId: areaId || null,
      subareaId: subareaId || null,
      active: true
    });
    
    if (existingUserRole) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ROLE_ALREADY_ASSIGNED',
          message: 'El usuario ya tiene asignado este rol con los mismos parámetros'
        }
      });
    }
    
    // Verificar permisos adicionales
    if (additionalPermissions && additionalPermissions.length > 0) {
      const permIds = additionalPermissions.map(p => p.toString());
      const existingPerms = await Permission.find({ 
        _id: { $in: permIds },
        active: true
      });
      
      if (existingPerms.length !== permIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERMISSIONS',
            message: 'Algunos permisos adicionales no existen o no están activos'
          }
        });
      }
    }
    
    // Verificar permisos denegados
    if (deniedPermissions && deniedPermissions.length > 0) {
      const permIds = deniedPermissions.map(p => p.toString());
      const existingPerms = await Permission.find({ 
        _id: { $in: permIds },
        active: true
      });
      
      if (existingPerms.length !== permIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERMISSIONS',
            message: 'Algunos permisos denegados no existen o no están activos'
          }
        });
      }
    }
    
    // Crear asignación de rol
    const userRole = await UserRole.create({
      userId,
      roleId,
      companyId: user.companyId,
      areaId: areaId || null,
      subareaId: subareaId || null,
      additionalPermissions: additionalPermissions || [],
      deniedPermissions: deniedPermissions || [],
      assignedBy: req.user._id
    });
    
    // Poblar para la respuesta
    await userRole.populate([
      { path: 'userId', select: 'name email' },
      { path: 'roleId', select: 'name code' },
      { path: 'areaId', select: 'name' },
      { path: 'subareaId', select: 'name' }
    ]);
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'assign_role',
      entityType: 'user_role',
      entityId: userRole._id,
      details: {
        userId: userId,
        roleName: role.name,
        roleCode: role.code,
        areaId: areaId || undefined,
        subareaId: subareaId || undefined
      }
    });
    
    res.status(201).json({
      success: true,
      data: userRole
    });
  } catch (error) {
    console.error('Error al asignar rol a usuario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al asignar rol a usuario'
      }
    });
  }
};

// @desc    Actualizar una asignación de rol
// @route   PUT /api/user-roles/:id
// @access  Privado (Admin o Admin de Compañía)
exports.updateUserRole = async (req, res) => {
  try {
    const { additionalPermissions, deniedPermissions, active } = req.body;
    
    // Buscar la asignación de rol
    let userRole = await UserRole.findById(req.params.id);
    
    if (!userRole) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_ROLE_NOT_FOUND',
          message: 'Asignación de rol no encontrada'
        }
      });
    }
    
    // Verificar permisos (solo puedes modificar asignaciones de tu compañía)
    if (req.user.role !== 'admin' && 
        userRole.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para modificar esta asignación de rol'
        }
      });
    }
    
    // Verificar permisos adicionales si se modifican
    if (additionalPermissions && additionalPermissions.length > 0) {
      const permIds = additionalPermissions.map(p => p.toString());
      const existingPerms = await Permission.find({ 
        _id: { $in: permIds },
        active: true
      });
      
      if (existingPerms.length !== permIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERMISSIONS',
            message: 'Algunos permisos adicionales no existen o no están activos'
          }
        });
      }
    }
    
    // Verificar permisos denegados si se modifican
    if (deniedPermissions && deniedPermissions.length > 0) {
      const permIds = deniedPermissions.map(p => p.toString());
      const existingPerms = await Permission.find({ 
        _id: { $in: permIds },
        active: true
      });
      
      if (existingPerms.length !== permIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERMISSIONS',
            message: 'Algunos permisos denegados no existen o no están activos'
          }
        });
      }
    }
    
    // Actualizar asignación
    userRole = await UserRole.findByIdAndUpdate(
      req.params.id,
      {
        additionalPermissions: additionalPermissions !== undefined ? additionalPermissions : userRole.additionalPermissions,
        deniedPermissions: deniedPermissions !== undefined ? deniedPermissions : userRole.deniedPermissions,
        active: active !== undefined ? active : userRole.active
      },
      { new: true }
    );
    
    // Poblar para la respuesta
    await userRole.populate([
      { path: 'userId', select: 'name email' },
      { path: 'roleId', select: 'name code' },
      { path: 'areaId', select: 'name' },
      { path: 'subareaId', select: 'name' }
    ]);
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'update_user_role',
      entityType: 'user_role',
      entityId: userRole._id,
      details: {
        userId: userRole.userId._id.toString(),
        roleId: userRole.roleId._id.toString(),
        active: userRole.active
      }
    });
    
    res.status(200).json({
      success: true,
      data: userRole
    });
  } catch (error) {
    console.error('Error al actualizar asignación de rol:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar asignación de rol'
      }
    });
  }
};

// @desc    Revocar una asignación de rol (soft delete)
// @route   DELETE /api/user-roles/:id
// @access  Privado (Admin o Admin de Compañía)
exports.revokeUserRole = async (req, res) => {
  try {
    // Buscar la asignación de rol
    const userRole = await UserRole.findById(req.params.id);
    
    if (!userRole) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_ROLE_NOT_FOUND',
          message: 'Asignación de rol no encontrada'
        }
      });
    }
    
    // Verificar permisos (solo puedes revocar asignaciones de tu compañía)
    if (req.user.role !== 'admin' && 
        userRole.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para revocar esta asignación de rol'
        }
      });
    }
    
    // Soft delete
    userRole.active = false;
    await userRole.save();
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'revoke_user_role',
      entityType: 'user_role',
      entityId: userRole._id,
      details: {
        userId: userRole.userId.toString(),
        roleId: userRole.roleId.toString()
      }
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error al revocar asignación de rol:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al revocar asignación de rol'
      }
    });
  }
}; 