const FilePermission = require('../models/FilePermission');
const File = require('../models/File');
const User = require('../models/User');
const Role = require('../models/Role');
const Log = require('../models/Log');
const mongoose = require('mongoose');

/**
 * @desc    Verifica si un usuario tiene un permiso específico para un archivo
 * @route   GET /api/files/:fileId/permissions/check
 * @access  Privado
 */
exports.checkPermission = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { action = 'read' } = req.query;
    const userId = req.user._id;
    
    // Validar que la acción solicitada sea válida
    const validActions = ['read', 'write', 'delete', 'admin'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: `Acción inválida. Las acciones válidas son: ${validActions.join(', ')}`
        }
      });
    }

    // Verificar que el archivo existe
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado'
        }
      });
    }

    // 1. Verificar si hay permisos específicos para este archivo
    // Obtener todos los roles del usuario
    let userRoles = [];
    try {
      const user = await User.findById(userId).populate('roles');
      if (user && user.roles) {
        userRoles = user.roles.map(role => role._id);
      }
    } catch (error) {
      console.error('Error al obtener roles del usuario:', error);
    }

    // Verificar permisos específicos a nivel de archivo
    const hasSpecificPermission = await FilePermission.checkFilePermission(
      fileId, 
      userId, 
      userRoles, 
      action
    );

    if (hasSpecificPermission) {
      return res.status(200).json({
        success: true,
        data: {
          permitted: true,
          source: 'specific_permission'
        }
      });
    }

    // 2. Si no hay permisos específicos, verificar permisos basados en la ubicación y rol
    // Esta verificación depende de la estructura de permisos heredados
    
    // Determinar si el usuario tiene ciertos roles
    const hasAdminRole = req.user.roles.includes('admin');
    const hasCompanyAdminRole = req.user.roles.includes('company_admin');
    const hasUserResponsibleRole = req.user.roles.includes('user_responsible');
    const hasUserControlRole = req.user.roles.includes('user_control');
    
    // Verificar según la jerarquía y rol
    let permitted = false;
    let permissionSource = '';

    // Administrador tiene acceso total
    if (hasAdminRole) {
      permitted = true;
      permissionSource = 'admin_role';
    } 
    // Administrador de compañía tiene acceso a archivos de su compañía
    else if (hasCompanyAdminRole && file.companyId.toString() === req.user.companyId.toString()) {
      permitted = true;
      permissionSource = 'company_admin_role';
    }
    // Usuario responsable tiene acceso según la ubicación del archivo
    else if (hasUserResponsibleRole) {
      // Si es un archivo en una subárea que tiene asignada
      // Esta lógica depende de cómo estén estructuradas las asignaciones de subáreas
      // a los usuarios responsables en tu sistema
      
      // Simulación de lógica (debes adaptarla a tu estructura real)
      // permitted = await isFileInUserSubarea(fileId, userId);
      // permissionSource = 'responsible_assignment';
      
      // Por simplicidad aquí, suponemos que tiene permiso si la acción es 'read'
      if (action === 'read') {
        permitted = true;
        permissionSource = 'user_responsible_read';
      } else if (action === 'write' && req.user._id.toString() === file.uploadedBy.toString()) {
        // Puede escribir si es el propietario del archivo
        permitted = true;
        permissionSource = 'file_owner';
      }
    }
    // Usuario control solo puede leer
    else if (hasUserControlRole && action === 'read') {
      permitted = true;
      permissionSource = 'user_control_read';
    }

    // Responder con el resultado
    return res.status(200).json({
      success: true,
      data: {
        permitted,
        source: permissionSource || 'default_policy'
      }
    });
  } catch (error) {
    console.error('Error al verificar permisos de archivo:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al verificar permisos de archivo'
      }
    });
  }
};

/**
 * @desc    Obtiene todos los permisos para un archivo específico
 * @route   GET /api/files/:fileId/permissions
 * @access  Privado (Admin o Admin de Compañía)
 */
exports.getFilePermissions = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Verificar que el archivo existe
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado'
        }
      });
    }
    
    // Verificar permisos del usuario actual para ver los permisos
    // Solo admin o admin de compañía pueden ver los permisos
    if (!req.user.roles.includes('admin') && 
       (!req.user.roles.includes('company_admin') || file.companyId.toString() !== req.user.companyId.toString())) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tiene permisos para ver los permisos de este archivo'
        }
      });
    }
    
    // Obtener todos los permisos asociados a este archivo
    const permissions = await FilePermission.find({ 
      fileId,
      active: true
    })
    .populate({
      path: 'entityId',
      select: 'name firstName lastName email code', // campos comunes entre User y Role
    });
    
    return res.status(200).json({
      success: true,
      count: permissions.length,
      data: permissions
    });
  } catch (error) {
    console.error('Error al obtener permisos de archivo:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener permisos de archivo'
      }
    });
  }
};

/**
 * @desc    Asigna un nuevo permiso a un archivo
 * @route   POST /api/files/:fileId/permissions
 * @access  Privado (Admin, Admin de Compañía o propietario con permiso admin)
 */
exports.addFilePermission = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { 
      entityType, 
      entityId, 
      actions, 
      validUntil,
      notes 
    } = req.body;
    
    // Validaciones básicas
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Tipo de entidad e ID de entidad son obligatorios'
        }
      });
    }
    
    // Validar el tipo de entidad
    if (!['user', 'role'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ENTITY_TYPE',
          message: 'Tipo de entidad inválido. Debe ser "user" o "role"'
        }
      });
    }
    
    // Verificar que el archivo existe
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado'
        }
      });
    }
    
    // Verificar que la entidad (usuario o rol) existe
    let entityExists = false;
    if (entityType === 'user') {
      entityExists = await User.exists({ _id: entityId });
    } else if (entityType === 'role') {
      entityExists = await Role.exists({ _id: entityId });
    }
    
    if (!entityExists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: `${entityType === 'user' ? 'Usuario' : 'Rol'} no encontrado`
        }
      });
    }
    
    // Verificar permisos del usuario para asignar permisos
    // Solo admin, admin de compañía o propietario con permiso admin pueden asignar permisos
    let canAssignPermissions = false;
    
    if (req.user.role === 'admin') {
      canAssignPermissions = true;
    } else if (req.user.role === 'company_admin' && file.companyId.toString() === req.user.companyId.toString()) {
      canAssignPermissions = true;
    } else {
      // Verificar si el usuario es propietario y tiene permiso admin
      const isOwner = file.uploadedBy.toString() === req.user._id.toString();
      if (isOwner) {
        // Verificar si tiene permiso admin
        const adminPermission = await FilePermission.findOne({
          fileId,
          entityType: 'user',
          entityId: req.user._id,
          active: true,
          'actions.admin': true
        });
        
        canAssignPermissions = !!adminPermission;
      }
    }
    
    if (!canAssignPermissions) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tiene permisos para asignar permisos a este archivo'
        }
      });
    }
    
    // Verificar si ya existe un permiso para esta entidad en este archivo
    const existingPermission = await FilePermission.findOne({
      fileId,
      entityType,
      entityId
    });
    
    if (existingPermission) {
      // Actualizar el permiso existente
      existingPermission.actions = actions || existingPermission.actions;
      existingPermission.validUntil = validUntil || existingPermission.validUntil;
      existingPermission.notes = notes || existingPermission.notes;
      existingPermission.active = true; // Reactivar si estaba inactivo
      
      await existingPermission.save();
      
      // Registrar en logs
      await Log.create({
        userId: req.user._id,
        companyId: file.companyId,
        action: 'update_file_permission',
        entityType: 'file',
        entityId: fileId,
        details: {
          permissionId: existingPermission._id,
          entityType,
          entityId
        }
      });
      
      return res.status(200).json({
        success: true,
        message: 'Permiso actualizado correctamente',
        data: existingPermission
      });
    }
    
    // Crear un nuevo permiso
    const newPermission = await FilePermission.create({
      fileId,
      entityType,
      entityId,
      companyId: file.companyId,
      actions: actions || {
        read: true,
        write: false,
        delete: false,
        admin: false
      },
      validUntil: validUntil || null,
      grantedBy: req.user._id,
      notes
    });
    
    // Registrar en logs
    await Log.create({
      userId: req.user._id,
      companyId: file.companyId,
      action: 'create_file_permission',
      entityType: 'file',
      entityId: fileId,
      details: {
        permissionId: newPermission._id,
        entityType,
        entityId
      }
    });
    
    return res.status(201).json({
      success: true,
      message: 'Permiso creado correctamente',
      data: newPermission
    });
  } catch (error) {
    console.error('Error al asignar permiso de archivo:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al asignar permiso de archivo'
      }
    });
  }
};

/**
 * @desc    Modifica un permiso existente
 * @route   PUT /api/file-permissions/:permissionId
 * @access  Privado (Admin, Admin de Compañía o propietario con permiso admin)
 */
exports.updateFilePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { actions, validUntil, notes, active } = req.body;
    
    // Verificar que el permiso existe
    const permission = await FilePermission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PERMISSION_NOT_FOUND',
          message: 'Permiso no encontrado'
        }
      });
    }
    
    // Obtener información del archivo
    const file = await File.findById(permission.fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado'
        }
      });
    }
    
    // Verificar permisos del usuario para modificar permisos
    let canModifyPermissions = false;
    
    if (req.user.role === 'admin') {
      canModifyPermissions = true;
    } else if (req.user.role === 'company_admin' && file.companyId.toString() === req.user.companyId.toString()) {
      canModifyPermissions = true;
    } else {
      // Verificar si el usuario es propietario y tiene permiso admin
      const isOwner = file.uploadedBy.toString() === req.user._id.toString();
      if (isOwner) {
        // Verificar si tiene permiso admin
        const adminPermission = await FilePermission.findOne({
          fileId: permission.fileId,
          entityType: 'user',
          entityId: req.user._id,
          active: true,
          'actions.admin': true
        });
        
        canModifyPermissions = !!adminPermission;
      }
    }
    
    if (!canModifyPermissions) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tiene permisos para modificar este permiso'
        }
      });
    }
    
    // Actualizar el permiso
    if (actions) permission.actions = actions;
    if (validUntil !== undefined) permission.validUntil = validUntil;
    if (notes !== undefined) permission.notes = notes;
    if (active !== undefined) permission.active = active;
    
    await permission.save();
    
    // Registrar en logs
    await Log.create({
      userId: req.user._id,
      companyId: file.companyId,
      action: 'update_file_permission',
      entityType: 'file',
      entityId: permission.fileId,
      details: {
        permissionId: permission._id,
        entityType: permission.entityType,
        entityId: permission.entityId
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Permiso actualizado correctamente',
      data: permission
    });
  } catch (error) {
    console.error('Error al actualizar permiso de archivo:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar permiso de archivo'
      }
    });
  }
};

/**
 * @desc    Elimina un permiso
 * @route   DELETE /api/file-permissions/:permissionId
 * @access  Privado (Admin, Admin de Compañía o propietario con permiso admin)
 */
exports.deleteFilePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    
    // Verificar que el permiso existe
    const permission = await FilePermission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PERMISSION_NOT_FOUND',
          message: 'Permiso no encontrado'
        }
      });
    }
    
    // Obtener información del archivo
    const file = await File.findById(permission.fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado'
        }
      });
    }
    
    // Verificar permisos del usuario para eliminar permisos
    let canDeletePermissions = false;
    
    if (req.user.role === 'admin') {
      canDeletePermissions = true;
    } else if (req.user.role === 'company_admin' && file.companyId.toString() === req.user.companyId.toString()) {
      canDeletePermissions = true;
    } else {
      // Verificar si el usuario es propietario y tiene permiso admin
      const isOwner = file.uploadedBy.toString() === req.user._id.toString();
      if (isOwner) {
        // Verificar si tiene permiso admin
        const adminPermission = await FilePermission.findOne({
          fileId: permission.fileId,
          entityType: 'user',
          entityId: req.user._id,
          active: true,
          'actions.admin': true
        });
        
        canDeletePermissions = !!adminPermission;
      }
    }
    
    if (!canDeletePermissions) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tiene permisos para eliminar este permiso'
        }
      });
    }
    
    // Realizar eliminación lógica (marcar como inactivo)
    permission.active = false;
    await permission.save();
    
    // Registrar en logs
    await Log.create({
      userId: req.user._id,
      companyId: file.companyId,
      action: 'delete_file_permission',
      entityType: 'file',
      entityId: permission.fileId,
      details: {
        permissionId: permission._id,
        entityType: permission.entityType,
        entityId: permission.entityId
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Permiso eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar permiso de archivo:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar permiso de archivo'
      }
    });
  }
}; 