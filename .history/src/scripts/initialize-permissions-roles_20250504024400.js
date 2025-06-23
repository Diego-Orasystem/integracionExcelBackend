/**
 * Script para inicializar permisos y roles predeterminados
 * 
 * Este script crea todos los permisos y roles definidos en la matriz,
 * siguiendo la estructura simplificada de 3 roles base y 2 subroles.
 * 
 * Ejecutar con: node src/scripts/initialize-permissions-roles.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const colors = require('colors');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const User = require('../models/User');
const Company = require('../models/Company');
const Log = require('../models/Log');

// Variable para guardar un usuario administrador para crear logs
let adminUser = null;
let defaultCompany = null;

// Conexión a la base de datos
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log(`MongoDB conectado: ${conn.connection.host}`.cyan.underline);
    return true;
  } catch (error) {
    console.error(`Error de conexión a MongoDB: ${error.message}`.red);
    process.exit(1);
  }
};

// Función para obtener o crear un usuario administrador para logs
const getOrCreateAdminUser = async () => {
  try {
    // Buscar un usuario admin existente
    let admin = await User.findOne({ role: 'admin' });
    
    // Si no existe, buscar cualquier usuario
    if (!admin) {
      admin = await User.findOne();
    }
    
    // Si aún no existe, crear un usuario temporal
    if (!admin) {
      // Buscar o crear una compañía predeterminada
      let company = await Company.findOne();
      
      if (!company) {
        company = await Company.create({
          name: 'Empresa Temporal',
          description: 'Empresa temporal para inicialización',
          settings: {
            maxStorage: 1024,
            allowedFileTypes: ['.xlsx', '.xls', '.csv'],
            autoSyncInterval: 60
          },
          active: true
        });
        console.log('Empresa temporal creada para inicialización'.yellow);
      }
      
      defaultCompany = company;
      
      // Crear usuario admin temporal
      admin = await User.create({
        name: 'Admin Temporal',
        email: 'admin@temp.com',
        password: 'temp123456',
        role: 'admin',
        companyId: company._id,
        active: true
      });
      console.log('Usuario administrador temporal creado para inicialización'.yellow);
    }
    
    // Si no hay compañía predeterminada, buscarla
    if (!defaultCompany) {
      defaultCompany = await Company.findById(admin.companyId);
    }
    
    return admin;
  } catch (error) {
    console.error(`Error al crear usuario administrador: ${error}`.red);
    throw error;
  }
};

// Función para crear permisos predeterminados
const createDefaultPermissions = async () => {
  try {
    console.log('Creando permisos predeterminados...'.yellow);
    
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
      },
      
      // === PERMISOS DE MENÚ ===
      {
        name: 'Acceso Menú Administración',
        description: 'Acceso al menú de administración general',
        code: 'menu_admin',
        category: 'system',
        actions: ['read']
      },
      {
        name: 'Acceso Menú Compañía',
        description: 'Acceso al menú de gestión de compañía',
        code: 'menu_company',
        category: 'system',
        actions: ['read']
      },
      {
        name: 'Acceso Menú Áreas',
        description: 'Acceso al menú de áreas',
        code: 'menu_area',
        category: 'system',
        actions: ['read']
      },
      {
        name: 'Acceso Menú Subáreas',
        description: 'Acceso al menú de subáreas',
        code: 'menu_subarea',
        category: 'system',
        actions: ['read']
      },
      {
        name: 'Acceso Menú Archivos',
        description: 'Acceso al menú de archivos',
        code: 'menu_files',
        category: 'system',
        actions: ['read']
      },
      {
        name: 'Acceso Menú Reportes',
        description: 'Acceso al menú de reportes',
        code: 'menu_reports',
        category: 'system',
        actions: ['read']
      },
      {
        name: 'Acceso Menú Usuarios',
        description: 'Acceso al menú de usuarios',
        code: 'menu_users',
        category: 'system',
        actions: ['read']
      },
      {
        name: 'Acceso Dashboard',
        description: 'Acceso al dashboard principal',
        code: 'dashboard_access',
        category: 'system',
        actions: ['read']
      },
      
      // === PERMISOS PARA ARCHIVOS DE EJEMPLO ===
      {
        name: 'Crear Archivos de Ejemplo',
        description: 'Permite crear y subir archivos de ejemplo',
        code: 'sample_file_create',
        category: 'file',
        actions: ['create']
      },
      {
        name: 'Ver Archivos de Ejemplo',
        description: 'Permite ver y descargar archivos de ejemplo',
        code: 'sample_file_read',
        category: 'file',
        actions: ['read', 'download']
      },
      {
        name: 'Actualizar Archivos de Ejemplo',
        description: 'Permite actualizar archivos de ejemplo existentes',
        code: 'sample_file_update',
        category: 'file',
        actions: ['update']
      },
      {
        name: 'Eliminar Archivos de Ejemplo',
        description: 'Permite eliminar archivos de ejemplo',
        code: 'sample_file_delete',
        category: 'file',
        actions: ['delete']
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
        console.log(`Permiso creado: ${permData.name} (${permData.code})`.green);
      } else {
        console.log(`Permiso ya existe: ${permData.name} (${permData.code})`.grey);
      }
    }
    
    // Registrar log si se han creado permisos
    if (createdCount > 0 && adminUser && defaultCompany) {
      try {
        await Log.create({
          userId: adminUser._id,
          companyId: defaultCompany._id,
          action: 'create_default_permissions',
          entityType: 'system',
          details: {
            count: createdCount,
            message: `Se crearon ${createdCount} permisos predefinidos`
          }
        });
      } catch (logError) {
        console.error(`Error al registrar log: ${logError}`.red);
        // Continuar aunque falle el log
      }
    }
    
    console.log(`Se crearon ${createdCount} permisos predefinidos`.cyan);
    return createdCount;
  } catch (error) {
    console.error(`Error al crear permisos predefinidos: ${error}`.red);
    throw error;
  }
};

// Crear roles predeterminados
const createDefaultRoles = async () => {
  try {
    console.log('Creando roles predeterminados...'.yellow);
    
    // Crear roles manualmente en lugar de usar el método estático
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
    let createdRoles = [];
    for (const roleData of defaultRoles) {
      const existingRole = await Role.findOne({ code: roleData.code });
      
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
        const newRole = await Role.create({
          ...roleData,
          permissions: rolePermissions.map(p => p._id)
        });
        
        createdRoles.push(newRole);
        console.log(`Rol creado: ${roleData.name} (${roleData.code})`.green);
      } else {
        console.log(`Rol ya existe: ${roleData.name} (${roleData.code})`.grey);
      }
    }
    
    // Registrar log si se han creado roles
    if (createdRoles.length > 0 && adminUser && defaultCompany) {
      try {
        await Log.create({
          userId: adminUser._id,
          companyId: defaultCompany._id,
          action: 'create_role',
          entityType: 'system',
          details: {
            count: createdRoles.length,
            message: `Se crearon ${createdRoles.length} roles predefinidos`
          }
        });
      } catch (logError) {
        console.error(`Error al registrar log: ${logError}`.red);
        // Continuar aunque falle el log
      }
    }
    
    console.log('Roles predeterminados creados con éxito'.cyan);
    return createdRoles;
  } catch (error) {
    console.error(`Error al crear roles predeterminados: ${error}`.red);
    throw error;
  }
};

// Función principal de inicialización
const initialize = async () => {
  try {
    // Conectar a la base de datos
    await connectDB();
    
    // Obtener usuario admin para logs
    adminUser = await getOrCreateAdminUser();
    
    // Crear permisos predeterminados
    await createDefaultPermissions();
    
    // Crear roles predeterminados
    await createDefaultRoles();
    
    console.log('Inicialización de permisos y roles completada con éxito'.green.bold);
    process.exit(0);
  } catch (error) {
    console.error(`Error durante la inicialización: ${error}`.red.bold);
    process.exit(1);
  }
};

// Ejecutar la inicialización
initialize(); 