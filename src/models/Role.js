const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del rol es obligatorio'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    required: [true, 'El código del rol es obligatorio'],
    unique: true,
    trim: true,
    enum: ['admin', 'company_admin', 'user_control', 'user_responsible', 'rol_test']
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  isSystem: {
    type: Boolean,
    default: false
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null // null para roles del sistema
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Método para verificar si un rol tiene un permiso específico
RoleSchema.methods.hasPermission = async function(permissionCode) {
  await this.populate('permissions');
  return this.permissions.some(permission => permission.code === permissionCode && permission.active);
};

// Método para verificar si un rol tiene un permiso con una acción específica
RoleSchema.methods.hasPermissionWithAction = async function(permissionCode, action) {
  await this.populate('permissions');
  const permission = this.permissions.find(p => p.code === permissionCode && p.active);
  return permission ? permission.actions.includes(action) : false;
};

// Crear roles por defecto
RoleSchema.statics.createDefaultRoles = async function() {
  const Permission = mongoose.model('Permission');
  const defaultRoles = [
    {
      name: 'Administrador de Aplicación',
      description: 'Control total sobre el sistema',
      code: 'admin',
      isSystem: true,
      active: true
    },
    {
      name: 'Administrador de Compañía',
      description: 'Control sobre una compañía específica',
      code: 'company_admin',
      isSystem: true,
      active: true
    },
    {
      name: 'Usuario de Control',
      description: 'Monitorea actividades y archivos en su área',
      code: 'user_control',
      isSystem: true,
      active: true
    },
    {
      name: 'Usuario Responsable',
      description: 'Responsable de gestionar subáreas',
      code: 'user_responsible',
      isSystem: true,
      active: true
    }
  ];

  // Obtener todos los permisos
  const allPermissions = await Permission.find({ active: true });
  
  // Crear roles si no existen y asignar permisos
  for (const roleData of defaultRoles) {
    const existingRole = await this.findOne({ code: roleData.code });
    
    if (!existingRole) {
      // Filtrar permisos según el rol
      let rolePermissions = [];
      
      switch (roleData.code) {
        case 'admin': // Administrador (Aplicación)
          // Gestión de Usuarios - Completo
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'user_management_all' || 
            p.code.startsWith('user_')
          ));
          
          // Gestión de Compañías - Completo
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'company_management_all' || 
            p.code.startsWith('company_')
          ));
          
          // Gestión de Áreas - Completo
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'area_management_all' || 
            p.code.startsWith('area_')
          ));
          
          // Gestión de Subáreas - Completo
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'subarea_management_all' || 
            p.code.startsWith('subarea_')
          ));
          
          // Asignación de Responsables - Completo
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'assign_responsible_all'
          ));
          
          // Archivos - Todos los permisos
          rolePermissions.push(...allPermissions.filter(p => 
            p.code.startsWith('file_')
          ));
          
          // Permisos de sistema
          rolePermissions.push(...allPermissions.filter(p => 
            p.category === 'system'
          ));
          break;
        
        case 'company_admin': // Administrador de Compañía
          // Gestión de Usuarios - Solo de su compañía
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'user_management_company'
          ));
          
          // Gestión de Compañías - No tiene permisos
          
          // Gestión de Áreas - Crear, Editar, Eliminar
          rolePermissions.push(...allPermissions.filter(p => 
            ['area_create', 'area_read', 'area_update', 'area_delete', 'area_list'].includes(p.code)
          ));
          
          // Gestión de Subáreas - Crear, Editar, Eliminar
          rolePermissions.push(...allPermissions.filter(p => 
            ['subarea_create', 'subarea_read', 'subarea_update', 'subarea_delete', 'subarea_list'].includes(p.code)
          ));
          
          // Asignación de Responsables - Solo en su compañía
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'assign_responsible_company'
          ));
          
          // Archivos - De su compañía
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'file_read_company' || 
            p.code === 'file_write_company' || 
            p.code === 'file_delete_company' || 
            p.code === 'file_monitor_company'
          ));
          break;
        
        case 'user_control': // Usuario - Control
          // No tiene permisos de gestión de usuarios
          // No tiene permisos de gestión de compañías
          // No tiene permisos de gestión de áreas
          // No tiene permisos de gestión de subáreas
          // No tiene permisos de asignación de responsables
          
          // Archivos - Lectura y monitoreo de su área
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'file_read_area' || 
            p.code === 'file_monitor_area'
          ));
          break;
        
        case 'user_responsible': // Usuario - Responsable
          // No tiene permisos de gestión de usuarios
          // No tiene permisos de gestión de compañías
          // No tiene permisos de gestión de áreas
          // No tiene permisos de gestión de subáreas
          // No tiene permisos de asignación de responsables
          
          // Archivos - De sus subáreas (lectura, escritura)
          rolePermissions.push(...allPermissions.filter(p => 
            p.code === 'file_read_subarea' || 
            p.code === 'file_write_subarea' || 
            p.code === 'file_monitor_subarea'
          ));
          break;
      }
      
      // Crear el rol con sus permisos
      await this.create({
        ...roleData,
        permissions: rolePermissions.map(p => p._id)
      });
    }
  }
};

module.exports = mongoose.model('Role', RoleSchema); 