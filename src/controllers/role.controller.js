const Role = require('../models/Role');
const Permission = require('../models/Permission');
const UserRole = require('../models/UserRole');
const Log = require('../models/Log');

// @desc    Obtener todos los roles
// @route   GET /api/roles
// @access  Privado (Admin o Admin de Compañía)
exports.getAllRoles = async (req, res) => {
  try {
    // Filtrar según el rol del usuario
    const query = { active: true };
    
    // Si no es admin del sistema, solo mostrar roles de la compañía o roles del sistema
    if (req.user.role !== 'admin') {
      query.$or = [
        { companyId: req.user.companyId },
        { isSystem: true }
      ];
    }
    
    const roles = await Role.find(query)
      .populate('permissions', 'name code category')
      .sort({ isSystem: -1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles
    });
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener roles'
      }
    });
  }
};

// @desc    Obtener un rol por ID
// @route   GET /api/roles/:id
// @access  Privado (Admin o Admin de Compañía)
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate('permissions', 'name code category actions');
    
    if (!role) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Rol no encontrado'
        }
      });
    }
    
    // Verificar permisos para ver el rol
    if (req.user.role !== 'admin' && 
        role.companyId && 
        role.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para ver este rol'
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('Error al obtener rol:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener rol'
      }
    });
  }
};

// @desc    Crear un nuevo rol
// @route   POST /api/roles
// @access  Privado (Admin o Admin de Compañía)
exports.createRole = async (req, res) => {
  try {
    const { name, description, code, permissions, isSystem } = req.body;
    
    // Validar datos básicos
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'El nombre y código del rol son obligatorios'
        }
      });
    }
    
    // Solo el admin puede crear roles del sistema
    if (isSystem && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Solo el administrador del sistema puede crear roles de sistema'
        }
      });
    }
    
    // Verificar que no exista un rol con el mismo código
    const existingRole = await Role.findOne({ code });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ROLE_CODE_EXISTS',
          message: 'Ya existe un rol con este código'
        }
      });
    }
    
    // Si es admin de compañía, asignar a la compañía actual
    const companyId = req.user.role === 'admin' ? req.body.companyId : req.user.companyId;
    
    // Verificar que los permisos existan
    if (permissions && permissions.length > 0) {
      const permissionIds = permissions.map(p => p.toString());
      const existingPermissions = await Permission.find({ _id: { $in: permissionIds }, active: true });
      
      if (existingPermissions.length !== permissionIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERMISSIONS',
            message: 'Algunos permisos especificados no existen o no están activos'
          }
        });
      }
    }
    
    // Crear el rol
    const role = await Role.create({
      name,
      description,
      code,
      permissions: permissions || [],
      isSystem: isSystem || false,
      companyId: isSystem ? null : companyId,
      active: true
    });
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_role',
      entityType: 'role',
      entityId: role._id,
      details: {
        name: role.name,
        code: role.code,
        isSystem: role.isSystem
      }
    });
    
    // Poblar permisos para la respuesta
    await role.populate('permissions', 'name code category');
    
    res.status(201).json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('Error al crear rol:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear rol'
      }
    });
  }
};

// @desc    Actualizar un rol
// @route   PUT /api/roles/:id
// @access  Privado (Admin o Admin de Compañía si es rol de compañía)
exports.updateRole = async (req, res) => {
  try {
    const { name, description, permissions, active, code, isSystem } = req.body;
    
    // Buscar rol
    let role = await Role.findById(req.params.id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Rol no encontrado'
        }
      });
    }
    
    // Verificar permisos para actualizar
    if (req.user.role !== 'admin') {
      // Los roles del sistema solo los puede modificar el admin
      if (role.isSystem) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Solo el administrador del sistema puede modificar roles de sistema'
          }
        });
      }
      
      // Admin de compañía solo puede modificar roles de su compañía
      if (role.companyId && role.companyId.toString() !== req.user.companyId.toString()) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tienes permisos para modificar este rol'
          }
        });
      }
    }
    
    // Verificar si se quiere cambiar el código, que no exista otro con ese código
    if (code && code !== role.code) {
      const existingRole = await Role.findOne({ code });
      if (existingRole && existingRole._id.toString() !== role._id.toString()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ROLE_CODE_EXISTS',
            message: 'Ya existe otro rol con este código'
          }
        });
      }
    }
    
    // Verificar permisos si se van a actualizar
    if (permissions && permissions.length > 0) {
      const permissionIds = permissions.map(p => p.toString());
      const existingPermissions = await Permission.find({ _id: { $in: permissionIds }, active: true });
      
      if (existingPermissions.length !== permissionIds.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERMISSIONS',
            message: 'Algunos permisos especificados no existen o no están activos'
          }
        });
      }
    }
    
    // Definir campos a actualizar
    let updateData = {
      name: name || role.name,
      description: description !== undefined ? description : role.description,
      permissions: permissions || role.permissions,
      active: active !== undefined ? active : role.active
    };
    
    // Agregar código y tipo si se desean actualizar
    if (code) {
      updateData.code = code;
    }
    
    if (isSystem !== undefined) {
      // Si cambia a rol de sistema, eliminar la compañía
      if (isSystem && !role.isSystem) {
        updateData.isSystem = true;
        updateData.companyId = null;
      }
      // Si cambia de rol de sistema a rol de compañía, asignar compañía
      else if (!isSystem && role.isSystem) {
        updateData.isSystem = false;
        updateData.companyId = req.user.companyId;
      }
      else {
        updateData.isSystem = isSystem;
      }
    }
    
    // Actualizar rol
    role = await Role.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    // Poblar permisos para la respuesta
    await role.populate('permissions', 'name code category');
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'update_role',
      entityType: 'role',
      entityId: role._id,
      details: {
        name: role.name,
        code: role.code,
        active: role.active,
        isSystem: role.isSystem
      }
    });
    
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar rol'
      }
    });
  }
};

// @desc    Eliminar un rol (soft delete)
// @route   DELETE /api/roles/:id
// @access  Privado (Admin o Admin de Compañía si es rol de compañía)
exports.deleteRole = async (req, res) => {
  try {
    // Buscar rol
    const role = await Role.findById(req.params.id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Rol no encontrado'
        }
      });
    }
    
    // Verificar permisos para eliminar
    if (req.user.role !== 'admin') {
      // Los roles del sistema solo los puede eliminar el admin
      if (role.isSystem) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Solo el administrador del sistema puede eliminar roles de sistema'
          }
        });
      }
      
      // Admin de compañía solo puede eliminar roles de su compañía
      if (role.companyId && role.companyId.toString() !== req.user.companyId.toString()) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tienes permisos para eliminar este rol'
          }
        });
      }
    }
    
    // Verificar si hay usuarios con este rol asignado
    const userRoleCount = await UserRole.countDocuments({ 
      roleId: role._id,
      active: true 
    });
    
    if (userRoleCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ROLE_IN_USE',
          message: 'No se puede eliminar el rol porque está asignado a usuarios. Desactívelo primero.'
        }
      });
    }
    
    // Soft delete
    role.active = false;
    await role.save();
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'delete_role',
      entityType: 'role',
      entityId: role._id,
      details: {
        name: role.name,
        code: role.code
      }
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar rol'
      }
    });
  }
}; 