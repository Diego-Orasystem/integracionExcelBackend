const Permission = require('../models/Permission');
const Role = require('../models/Role');
const Log = require('../models/Log');

// @desc    Obtener todos los permisos
// @route   GET /api/permissions
// @access  Privado (Admin o Admin de Compañía)
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find({ active: true }).sort({ category: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: permissions.length,
      data: permissions
    });
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener permisos'
      }
    });
  }
};

// @desc    Obtener un permiso por ID
// @route   GET /api/permissions/:id
// @access  Privado (Admin o Admin de Compañía)
exports.getPermissionById = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PERMISSION_NOT_FOUND',
          message: 'Permiso no encontrado'
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: permission
    });
  } catch (error) {
    console.error('Error al obtener permiso:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener permiso'
      }
    });
  }
};

// @desc    Crear un nuevo permiso
// @route   POST /api/permissions
// @access  Privado (Solo Admin)
exports.createPermission = async (req, res) => {
  try {
    const { name, description, code, category, actions } = req.body;
    
    // Validar datos
    if (!name || !code || !category || !actions || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de permiso incompletos o inválidos'
        }
      });
    }
    
    // Verificar que no exista un permiso con el mismo código
    const existingPermission = await Permission.findOne({ code });
    if (existingPermission) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PERMISSION_CODE_EXISTS',
          message: 'Ya existe un permiso con este código'
        }
      });
    }
    
    // Crear el permiso
    const permission = await Permission.create({
      name,
      description,
      code,
      category,
      actions
    });
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_permission',
      entityType: 'permission',
      entityId: permission._id,
      details: {
        code: permission.code,
        category: permission.category
      }
    });
    
    res.status(201).json({
      success: true,
      data: permission
    });
  } catch (error) {
    console.error('Error al crear permiso:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear permiso'
      }
    });
  }
};

// @desc    Actualizar un permiso
// @route   PUT /api/permissions/:id
// @access  Privado (Solo Admin)
exports.updatePermission = async (req, res) => {
  try {
    const { name, description, actions, active } = req.body;
    
    // Buscar permiso
    let permission = await Permission.findById(req.params.id);
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PERMISSION_NOT_FOUND',
          message: 'Permiso no encontrado'
        }
      });
    }
    
    // No permitir cambiar código o categoría una vez creado
    if (req.body.code || req.body.category) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UPDATE',
          message: 'No se puede modificar el código o categoría de un permiso existente'
        }
      });
    }
    
    // Actualizar permiso
    permission = await Permission.findByIdAndUpdate(
      req.params.id,
      {
        name: name || permission.name,
        description: description !== undefined ? description : permission.description,
        actions: actions || permission.actions,
        active: active !== undefined ? active : permission.active
      },
      { new: true }
    );
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'update_permission',
      entityType: 'permission',
      entityId: permission._id,
      details: {
        code: permission.code,
        active: permission.active
      }
    });
    
    res.status(200).json({
      success: true,
      data: permission
    });
  } catch (error) {
    console.error('Error al actualizar permiso:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar permiso'
      }
    });
  }
};

// @desc    Eliminar un permiso (soft delete)
// @route   DELETE /api/permissions/:id
// @access  Privado (Solo Admin)
exports.deletePermission = async (req, res) => {
  try {
    // Buscar permiso
    const permission = await Permission.findById(req.params.id);
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PERMISSION_NOT_FOUND',
          message: 'Permiso no encontrado'
        }
      });
    }
    
    // Soft delete
    permission.active = false;
    await permission.save();
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'delete_permission',
      entityType: 'permission',
      entityId: permission._id,
      details: {
        code: permission.code
      }
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error al eliminar permiso:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar permiso'
      }
    });
  }
};

// @desc    Crear permisos predefinidos del sistema
// @route   POST /api/permissions/defaults
// @access  Privado (Solo Admin)
exports.createDefaultPermissions = async (req, res) => {
  try {
    // Definir permisos predefinidos por categoría
    const defaultPermissions = [
      // === GESTIÓN DE USUARIOS ===
      {
        name: 'Gestión de Usuarios - Completo',
        description: 'Permite gestionar todos los usuarios',
        code: 'user_management_all',
        category: 'user',
        actions: ['create', 'read', 'update', 'delete', 'list']
      },
      {
        name: 'Gestión de Usuarios - Compañía',
        description: 'Permite gestionar usuarios de su compañía',
        code: 'user_management_company',
        category: 'user',
        actions: ['create', 'read', 'update', 'list']
      },
      
      // === GESTIÓN DE COMPAÑÍAS ===
      {
        name: 'Gestión de Compañías - Completo',
        description: 'Permite gestionar todas las compañías',
        code: 'company_management_all',
        category: 'company',
        actions: ['create', 'read', 'update', 'delete', 'list']
      },
      
      // === GESTIÓN DE ÁREAS ===
      {
        name: 'Gestión de Áreas - Completo',
        description: 'Permite gestionar todas las áreas',
        code: 'area_management_all',
        category: 'area',
        actions: ['create', 'read', 'update', 'delete', 'list']
      },
      {
        name: 'Crear Área',
        description: 'Permite crear nuevas áreas',
        code: 'area_create',
        category: 'area',
        actions: ['create']
      },
      {
        name: 'Ver Área',
        description: 'Permite ver detalles de áreas',
        code: 'area_read',
        category: 'area',
        actions: ['read']
      },
      {
        name: 'Editar Área',
        description: 'Permite modificar áreas',
        code: 'area_update',
        category: 'area',
        actions: ['update']
      },
      {
        name: 'Eliminar Área',
        description: 'Permite eliminar áreas',
        code: 'area_delete',
        category: 'area',
        actions: ['delete']
      },
      {
        name: 'Listar Áreas',
        description: 'Permite ver listado de áreas',
        code: 'area_list',
        category: 'area',
        actions: ['list']
      },
      
      // === GESTIÓN DE SUBÁREAS ===
      {
        name: 'Gestión de Subáreas - Completo',
        description: 'Permite gestionar todas las subáreas',
        code: 'subarea_management_all',
        category: 'subarea',
        actions: ['create', 'read', 'update', 'delete', 'list']
      },
      {
        name: 'Crear Subárea',
        description: 'Permite crear nuevas subáreas',
        code: 'subarea_create',
        category: 'subarea',
        actions: ['create']
      },
      {
        name: 'Ver Subárea',
        description: 'Permite ver detalles de subáreas',
        code: 'subarea_read',
        category: 'subarea',
        actions: ['read']
      },
      {
        name: 'Editar Subárea',
        description: 'Permite modificar subáreas',
        code: 'subarea_update',
        category: 'subarea',
        actions: ['update']
      },
      {
        name: 'Eliminar Subárea',
        description: 'Permite eliminar subáreas',
        code: 'subarea_delete',
        category: 'subarea',
        actions: ['delete']
      },
      {
        name: 'Listar Subáreas',
        description: 'Permite ver listado de subáreas',
        code: 'subarea_list',
        category: 'subarea',
        actions: ['list']
      },
      
      // === ASIGNACIÓN DE RESPONSABLES ===
      {
        name: 'Asignación de Responsables - Completo',
        description: 'Permite asignar responsables a nivel global',
        code: 'assign_responsible_all',
        category: 'user',
        actions: ['assign']
      },
      {
        name: 'Asignación de Responsables - Compañía',
        description: 'Permite asignar responsables solo en su compañía',
        code: 'assign_responsible_company',
        category: 'user',
        actions: ['assign']
      },
      
      // === ARCHIVOS ===
      // Permisos para archivos - Lectura
      {
        name: 'Archivos - Lectura de Todos',
        description: 'Permite leer todos los archivos',
        code: 'file_read_all',
        category: 'file',
        actions: ['read']
      },
      {
        name: 'Archivos - Lectura de Compañía',
        description: 'Permite leer archivos de su compañía',
        code: 'file_read_company',
        category: 'file',
        actions: ['read']
      },
      {
        name: 'Archivos - Lectura de Área',
        description: 'Permite leer archivos de su área',
        code: 'file_read_area',
        category: 'file',
        actions: ['read']
      },
      {
        name: 'Archivos - Lectura de Subáreas',
        description: 'Permite leer archivos de sus subáreas',
        code: 'file_read_subarea',
        category: 'file',
        actions: ['read']
      },
      
      // Permisos para archivos - Escritura
      {
        name: 'Archivos - Escritura de Todos',
        description: 'Permite escribir archivos en cualquier ubicación',
        code: 'file_write_all',
        category: 'file',
        actions: ['create', 'update', 'upload']
      },
      {
        name: 'Archivos - Escritura de Compañía',
        description: 'Permite escribir archivos en su compañía',
        code: 'file_write_company',
        category: 'file',
        actions: ['create', 'update', 'upload']
      },
      {
        name: 'Archivos - Escritura de Subáreas',
        description: 'Permite escribir archivos en sus subáreas',
        code: 'file_write_subarea',
        category: 'file',
        actions: ['create', 'update', 'upload']
      },
      
      // Permisos para archivos - Eliminación
      {
        name: 'Archivos - Eliminación de Todos',
        description: 'Permite eliminar archivos en cualquier ubicación',
        code: 'file_delete_all',
        category: 'file',
        actions: ['delete']
      },
      {
        name: 'Archivos - Eliminación de Compañía',
        description: 'Permite eliminar archivos en su compañía',
        code: 'file_delete_company',
        category: 'file',
        actions: ['delete']
      },
      
      // Permisos para archivos - Monitoreo
      {
        name: 'Monitoreo de Archivos - Todos',
        description: 'Permite monitorear todos los archivos',
        code: 'file_monitor_all',
        category: 'file',
        actions: ['list', 'read']
      },
      {
        name: 'Monitoreo de Archivos - Compañía',
        description: 'Permite monitorear archivos de su compañía',
        code: 'file_monitor_company',
        category: 'file',
        actions: ['list', 'read']
      },
      {
        name: 'Monitoreo de Archivos - Área',
        description: 'Permite monitorear archivos de su área',
        code: 'file_monitor_area',
        category: 'file',
        actions: ['list', 'read']
      },
      {
        name: 'Monitoreo de Archivos - Subáreas',
        description: 'Permite monitorear archivos de sus subáreas',
        code: 'file_monitor_subarea',
        category: 'file',
        actions: ['list', 'read']
      },
      
      // === SISTEMA ===
      {
        name: 'Administración del Sistema',
        description: 'Permite configurar parámetros del sistema',
        code: 'system_admin',
        category: 'system',
        actions: ['create', 'read', 'update', 'delete']
      },
      {
        name: 'Ver Logs',
        description: 'Permite ver logs del sistema',
        code: 'system_logs',
        category: 'system',
        actions: ['read', 'list']
      }
    ];
    
    // Contador para nuevos permisos creados
    let createdCount = 0;
    
    // Crear cada permiso si no existe
    for (const permData of defaultPermissions) {
      const existingPerm = await Permission.findOne({ code: permData.code });
      
      if (!existingPerm) {
        await Permission.create(permData);
        createdCount++;
      }
    }
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_default_permissions',
      entityType: 'permission',
      details: {
        count: createdCount
      }
    });
    
    // Crear roles predefinidos con los permisos
    await Role.createDefaultRoles();
    
    const permissions = await Permission.find().sort({ category: 1, name: 1 });
    
    res.status(201).json({
      success: true,
      message: `Se crearon ${createdCount} permisos predefinidos`,
      count: permissions.length,
      data: permissions
    });
  } catch (error) {
    console.error('Error al crear permisos predefinidos:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear permisos predefinidos'
      }
    });
  }
}; 