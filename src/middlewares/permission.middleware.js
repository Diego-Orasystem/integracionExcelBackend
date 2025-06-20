const UserRole = require('../models/UserRole');
const Permission = require('../models/Permission');

/**
 * Middleware para verificar permisos
 * @param {string} permissionCode - Código del permiso requerido
 * @param {string} action - Acción requerida (create, read, update, delete, list, etc.)
 * @param {Object} options - Opciones adicionales
 * @param {string} options.areaIdField - Campo donde buscar el ID del área (en params, body o query)
 * @param {string} options.subareaIdField - Campo donde buscar el ID de la subárea
 * @param {Function} options.customCheck - Función personalizada para validaciones extras
 */
exports.checkPermission = (permissionCode, action, options = {}) => {
  return async (req, res, next) => {
    try {
      // Si es admin, permitir sin verificación adicional
      if (req.user.roles.includes('admin')) {
        return next();
      }
      
      // Obtener área y subárea IDs si corresponde
      const areaId = options.areaIdField ? (
        req.params[options.areaIdField] || 
        req.body[options.areaIdField] || 
        req.query[options.areaIdField]
      ) : null;
      
      const subareaId = options.subareaIdField ? (
        req.params[options.subareaIdField] || 
        req.body[options.subareaIdField] || 
        req.query[options.subareaIdField]
      ) : null;
      
      // Buscar roles del usuario para la compañía actual
      const userRoles = await UserRole.find({
        userId: req.user._id,
        companyId: req.user.companyId,
        active: true
      })
      .populate({
        path: 'roleId',
        populate: {
          path: 'permissions'
        }
      })
      .populate('additionalPermissions')
      .populate('deniedPermissions');
      
      if (userRoles.length === 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'NO_ROLES_ASSIGNED',
            message: 'No tienes roles asignados en esta compañía'
          }
        });
      }
      
      // Verificar permisos globales primero
      const hasGlobalPermission = userRoles.some(userRole => {
        // Verificar permisos denegados
        const isDenied = userRole.deniedPermissions.some(
          p => p.code === permissionCode && p.actions.includes(action)
        );
        if (isDenied) return false;
        
        // Verificar permisos adicionales
        const hasAdditional = userRole.additionalPermissions.some(
          p => p.code === permissionCode && p.actions.includes(action)
        );
        if (hasAdditional) return true;
        
        // Verificar permisos del rol
        return userRole.roleId.permissions.some(
          p => p.code === permissionCode && p.actions.includes(action)
        );
      });
      
      if (hasGlobalPermission) {
        return next();
      }
      
      // Verificar permisos específicos por área si se requiere
      if (areaId) {
        const hasAreaPermission = userRoles.some(userRole => {
          return userRole.areaId && 
                 userRole.areaId.toString() === areaId &&
                 !userRole.deniedPermissions.some(p => p.code === permissionCode) &&
                 (userRole.additionalPermissions.some(p => p.code === permissionCode && p.actions.includes(action)) ||
                  userRole.roleId.permissions.some(p => p.code === permissionCode && p.actions.includes(action)));
        });
        
        if (hasAreaPermission) {
          return next();
        }
      }
      
      // Verificar permisos específicos por subárea si se requiere
      if (subareaId) {
        const hasSubareaPermission = userRoles.some(userRole => {
          return userRole.subareaId && 
                 userRole.subareaId.toString() === subareaId &&
                 !userRole.deniedPermissions.some(p => p.code === permissionCode) &&
                 (userRole.additionalPermissions.some(p => p.code === permissionCode && p.actions.includes(action)) ||
                  userRole.roleId.permissions.some(p => p.code === permissionCode && p.actions.includes(action)));
        });
        
        if (hasSubareaPermission) {
          return next();
        }
      }
      
      // Verificación personalizada si se proporciona
      if (options.customCheck && await options.customCheck(req, userRoles)) {
        return next();
      }
      
      // No tiene permiso
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permiso para realizar esta acción'
        }
      });
    } catch (error) {
      console.error('Error al verificar permisos:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Error al verificar permisos'
        }
      });
    }
  };
};

/**
 * Middleware para verificar si el usuario es responsable de un área
 */
exports.isAreaResponsible = () => {
  return async (req, res, next) => {
    try {
      const areaId = req.params.areaId || req.body.areaId;
      
      if (!areaId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_AREA_ID',
            message: 'ID de área no proporcionado'
          }
        });
      }
      
      // Verificar si el usuario es admin o company_admin
      if (req.user.roles.includes('admin') || req.user.roles.includes('company_admin')) {
        return next();
      }
      
      // Verificar si es responsable del área
      const userRole = await UserRole.findOne({
        userId: req.user._id,
        companyId: req.user.companyId,
        areaId,
        active: true
      }).populate('roleId');
      
      if (userRole && ['area_manager', 'admin', 'company_admin'].includes(userRole.roleId.code)) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_AREA_RESPONSIBLE',
          message: 'No eres responsable de esta área'
        }
      });
    } catch (error) {
      console.error('Error al verificar responsable de área:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Error al verificar permisos'
        }
      });
    }
  };
};

/**
 * Middleware para verificar si el usuario es responsable de una subárea
 */
exports.isSubareaResponsible = () => {
  return async (req, res, next) => {
    try {
      const subareaId = req.params.subareaId || req.body.subareaId;
      
      if (!subareaId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SUBAREA_ID',
            message: 'ID de subárea no proporcionado'
          }
        });
      }
      
      // Verificar si el usuario es admin o company_admin
      if (req.user.roles.includes('admin') || req.user.roles.includes('company_admin')) {
        return next();
      }
      
      // Verificar si es responsable de la subárea directamente
      const userRole = await UserRole.findOne({
        userId: req.user._id,
        companyId: req.user.companyId,
        subareaId,
        active: true
      }).populate('roleId');
      
      if (userRole && ['subarea_manager', 'area_manager', 'admin', 'company_admin'].includes(userRole.roleId.code)) {
        return next();
      }
      
      // Verificar si es responsable del área a la que pertenece la subárea
      const SubArea = require('../models/SubArea');
      const subarea = await SubArea.findById(subareaId);
      
      if (subarea) {
        const areaManager = await UserRole.findOne({
          userId: req.user._id,
          companyId: req.user.companyId,
          areaId: subarea.areaId,
          active: true
        }).populate('roleId');
        
        if (areaManager && ['area_manager', 'admin', 'company_admin'].includes(areaManager.roleId.code)) {
          return next();
        }
      }
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_SUBAREA_RESPONSIBLE',
          message: 'No eres responsable de esta subárea'
        }
      });
    } catch (error) {
      console.error('Error al verificar responsable de subárea:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Error al verificar permisos'
        }
      });
    }
  };
}; 