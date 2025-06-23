const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar modelos
const User = require('../src/models/User');
const Company = require('../src/models/Company');
const Area = require('../src/models/Area');
const SubArea = require('../src/models/SubArea');
const Folder = require('../src/models/Folder');
const Log = require('../src/models/Log');
const Role = require('../src/models/Role');
const UserRole = require('../src/models/UserRole');
const Permission = require('../src/models/Permission');

// Conectar a MongoDB
async function connectDB() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Conexión exitosa a MongoDB');
    return true;
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error.message);
    return false;
  }
}

// Función auxiliar para limpiar las colecciones necesarias
async function cleanCollections() {
  console.log('Limpiando colecciones existentes...');
  await User.deleteMany({ email: { $ne: 'admin@sistema.com' } }); // Mantener al admin del sistema
  await Company.deleteMany({});
  await Area.deleteMany({});
  await SubArea.deleteMany({});
  await Folder.deleteMany({});
  console.log('Colecciones limpiadas: usuarios (excepto admin), empresas, áreas, subáreas y carpetas');
}

// Crear empresas de prueba
async function createCompanies() {
  console.log('Creando empresas de prueba...');
  
  // Eliminar empresas si existen
  await Company.deleteMany({ name: { $in: ['ACME Corporation', 'Globex Industries'] } });
  
  const acmeCompany = await Company.create({
    name: 'ACME Corporation',
    emailDomain: 'acme.com',
    description: 'Empresa principal de pruebas',
    active: true,
    settings: {
      maxStorage: 1024,
      allowedFileTypes: ['.xlsx', '.xls', '.csv'],
      autoSyncInterval: 60
    }
  });
  console.log(`Empresa ACME creada con ID: ${acmeCompany._id}`);
  
  const globexCompany = await Company.create({
    name: 'Globex Industries',
    emailDomain: 'globex.com',
    description: 'Empresa secundaria para pruebas',
    active: true,
    settings: {
      maxStorage: 1024,
      allowedFileTypes: ['.xlsx', '.xls', '.csv'],
      autoSyncInterval: 60
    }
  });
  console.log(`Empresa Globex creada con ID: ${globexCompany._id}`);
  
  return { acme: acmeCompany, globex: globexCompany };
}

// Crear usuarios de prueba
async function createUsers(companies) {
  console.log('Creando usuarios de prueba...');
  
  // Eliminar usuarios existentes (excepto admin del sistema)
  await User.deleteMany({
    email: { 
      $in: [
        'admin@acme.com', 
        'admin@globex.com',
        'finanzas@acme.com',
        'rrhh@acme.com',
        'operaciones@acme.com',
        'control@acme.com',
        'proyectos@globex.com'
      ]
    }
  });
  
  const users = [
    {
      name: 'Admin ACME',
      email: 'admin@acme.com',
      password: 'AcmeAdmin2023',
      role: 'company_admin',
      companyId: companies.acme._id
    },
    {
      name: 'Admin Globex',
      email: 'admin@globex.com',
      password: 'GlobeX2023!',
      role: 'company_admin',
      companyId: companies.globex._id
    },
    {
      name: 'Usuario Finanzas',
      email: 'finanzas@acme.com',
      password: 'Finanzas2023!',
      role: 'user_responsible',
      companyId: companies.acme._id
    },
    {
      name: 'Usuario RRHH',
      email: 'rrhh@acme.com',
      password: 'RRHH2023!',
      role: 'user_responsible',
      companyId: companies.acme._id
    },
    {
      name: 'Usuario Operaciones',
      email: 'operaciones@acme.com',
      password: 'Operaciones2023!',
      role: 'user_responsible',
      companyId: companies.acme._id
    },
    {
      name: 'Usuario Control',
      email: 'control@acme.com',
      password: 'Control2023!',
      role: 'user_control',
      companyId: companies.acme._id
    },
    {
      name: 'Usuario Proyectos',
      email: 'proyectos@globex.com',
      password: 'Proyectos2023!',
      role: 'user_responsible',
      companyId: companies.globex._id
    }
  ];
  
  const createdUsers = {};
  
  for (const userData of users) {
    try {
      // Primero, asegurarse de que el usuario no exista
      await User.deleteOne({ email: userData.email });
      
      // Obtener el admin del sistema para referencia
      const adminSystem = await User.findOne({ email: 'admin@sistema.com' });
      console.log(`Admin del sistema: ${adminSystem ? adminSystem._id : 'No encontrado'}`);
      
      // Encriptar contraseña manualmente
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Insertar usuario directamente usando Model.create()
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        password: userData.password, // El hook pre-save encriptará la contraseña
        role: userData.role,
        companyId: userData.companyId,
        active: true
      });
      
      console.log(`Usuario ${userData.email} creado con ID: ${user._id} - Contraseña: ${userData.password}`);
      createdUsers[userData.email] = user;
    } catch (error) {
      console.error(`Error al crear usuario ${userData.email}:`, error);
    }
  }
  
  return createdUsers;
}

// Crear áreas y subáreas
async function createAreasAndSubAreas(companies, users) {
  console.log('Creando áreas y subáreas...');
  
  // Definir la estructura de áreas y subáreas
  const areasData = [
    {
      company: companies.acme,
      name: 'Finanzas',
      description: 'Área financiera de la empresa',
      icon: 'money-bill-wave',
      color: '#2ecc71',
      responsibleUserId: users['finanzas@acme.com']._id,
      subAreas: ['Contabilidad', 'Presupuestos', 'Impuestos']
    },
    {
      company: companies.acme,
      name: 'Recursos Humanos',
      description: 'Gestión del personal',
      icon: 'users',
      color: '#3498db',
      responsibleUserId: users['rrhh@acme.com']._id,
      subAreas: ['Reclutamiento', 'Capacitación', 'Nómina']
    },
    {
      company: companies.acme,
      name: 'Operaciones',
      description: 'Operaciones y logística',
      icon: 'cogs',
      color: '#e74c3c',
      responsibleUserId: users['operaciones@acme.com']._id,
      subAreas: ['Producción', 'Logística', 'Control de Calidad']
    },
    {
      company: companies.globex,
      name: 'Proyectos',
      description: 'Gestión de proyectos',
      icon: 'project-diagram',
      color: '#f39c12',
      responsibleUserId: users['proyectos@globex.com']._id,
      subAreas: ['Diseño', 'Implementación', 'Seguimiento']
    }
  ];
  
  for (const areaData of areasData) {
    // Crear carpeta asociada para el área
    const folder = await Folder.create({
      name: areaData.name,
      parentId: null, // Carpeta raíz para el área
      path: `/${areaData.name}`,
      companyId: areaData.company._id,
      createdBy: areaData.responsibleUserId
    });
    
    // Crear área
    const area = await Area.create({
      name: areaData.name,
      description: areaData.description,
      companyId: areaData.company._id,
      responsibleUserId: areaData.responsibleUserId,
      icon: areaData.icon,
      color: areaData.color,
      folderId: folder._id,
      isDefault: true
    });
    
    console.log(`Área ${areaData.name} creada con ID: ${area._id}`);
    
    // Crear subáreas
    for (const subAreaName of areaData.subAreas) {
      // Crear carpeta para la subárea
      const subAreaFolder = await Folder.create({
        name: subAreaName,
        parentId: folder._id,
        path: `/${areaData.name}/${subAreaName}`,
        companyId: areaData.company._id,
        createdBy: areaData.responsibleUserId
      });
      
      // Crear subárea
      const subArea = await SubArea.create({
        name: subAreaName,
        description: `Subárea de ${areaData.name}`,
        areaId: area._id,
        companyId: areaData.company._id,
        responsibleUserId: areaData.responsibleUserId,
        icon: 'folder',
        color: areaData.color,
        folderId: subAreaFolder._id
      });
      
      console.log(`  Subárea ${subAreaName} creada con ID: ${subArea._id}`);
    }
    
    // Registrar log
    await Log.create({
      userId: areaData.responsibleUserId,
      companyId: areaData.company._id,
      action: 'create_area',
      entityType: 'area',
      entityId: area._id,
      details: {
        name: area.name,
        subAreas: areaData.subAreas
      }
    });
  }
}

// Función para asignar roles y permisos a los usuarios
async function assignRolesAndPermissions(companies, users, areas) {
  console.log('Asignando roles y permisos a usuarios...');
  
  // Limpiar asignaciones existentes
  await UserRole.deleteMany({});
  
  // Obtener roles del sistema
  const adminRole = await Role.findOne({ code: 'admin' });
  const companyAdminRole = await Role.findOne({ code: 'company_admin' });
  const userControlRole = await Role.findOne({ code: 'user_control' });
  const userResponsibleRole = await Role.findOne({ code: 'user_responsible' });
  
  if (!adminRole || !companyAdminRole || !userControlRole || !userResponsibleRole) {
    console.error('❌ Roles del sistema no encontrados. Verifica que se hayan creado correctamente.');
    return;
  }
  
  // Verificar que todas las áreas estén definidas
  if (!areas || !areas.finanzas || !areas.rrhh || !areas.operaciones || !areas.proyectos) {
    console.error('❌ No se encontraron todas las áreas necesarias');
    console.log('Áreas encontradas:', Object.keys(areas || {}));
    return;
  }
  
  // Obtener el administrador del sistema
  const adminSystem = await User.findOne({ email: 'admin@sistema.com' });
  if (!adminSystem) {
    console.error('❌ No se encontró el usuario administrador del sistema (admin@sistema.com)');
    return;
  }
  
  console.log(`Usuario administrador del sistema encontrado: ${adminSystem._id}`);
  
  // Asignar roles para cada usuario
  const roleAssignments = [
    // Admin ACME - Rol de administrador de compañía
    {
      userId: users['admin@acme.com']._id,
      roleId: companyAdminRole._id,
      companyId: companies.acme._id,
      areaId: null, // Acceso a todas las áreas de la compañía
      subareaId: null,
      assignedBy: adminSystem._id
    },
    // Admin Globex - Rol de administrador de compañía
    {
      userId: users['admin@globex.com']._id,
      roleId: companyAdminRole._id,
      companyId: companies.globex._id,
      areaId: null, // Acceso a todas las áreas de la compañía
      subareaId: null,
      assignedBy: adminSystem._id
    },
    // Finanzas - Rol responsable específico para su área
    {
      userId: users['finanzas@acme.com']._id,
      roleId: userResponsibleRole._id,
      companyId: companies.acme._id,
      areaId: areas.finanzas._id, // Solo para el área de finanzas
      subareaId: null, // Para todas las subáreas de Finanzas
      assignedBy: users['admin@acme.com']._id
    },
    // RRHH - Rol responsable específico para su área
    {
      userId: users['rrhh@acme.com']._id,
      roleId: userResponsibleRole._id,
      companyId: companies.acme._id,
      areaId: areas.rrhh._id, // Solo para el área de RRHH
      subareaId: null, // Para todas las subáreas de RRHH
      assignedBy: users['admin@acme.com']._id
    },
    // Operaciones - Rol responsable específico para su área
    {
      userId: users['operaciones@acme.com']._id,
      roleId: userResponsibleRole._id,
      companyId: companies.acme._id,
      areaId: areas.operaciones._id, // Solo para el área de Operaciones
      subareaId: null, // Para todas las subáreas de Operaciones
      assignedBy: users['admin@acme.com']._id
    },
    // Control - Rol de control para ver todas las áreas pero sin modificación
    {
      userId: users['control@acme.com']._id,
      roleId: userControlRole._id,
      companyId: companies.acme._id,
      areaId: null, // Acceso de monitoreo a todas las áreas
      subareaId: null,
      assignedBy: users['admin@acme.com']._id
    },
    // Proyectos - Rol responsable específico para su área
    {
      userId: users['proyectos@globex.com']._id,
      roleId: userResponsibleRole._id,
      companyId: companies.globex._id,
      areaId: areas.proyectos._id, // Solo para el área de Proyectos
      subareaId: null, // Para todas las subáreas de Proyectos
      assignedBy: users['admin@globex.com']._id
    }
  ];
  
  // Crear asignaciones de roles
  for (const roleData of roleAssignments) {
    try {
      const userRole = await UserRole.create(roleData);
      console.log(`Rol asignado a usuario: ${roleData.userId} - Rol: ${roleData.roleId} - Área: ${roleData.areaId || 'Todas'}`);
    } catch (error) {
      console.error(`Error al asignar rol: ${error.message}`);
    }
  }
  
  console.log('✅ Roles y permisos asignados correctamente');
}

// Función principal
async function main() {
  try {
    console.log('🔶 INICIANDO CREACIÓN DE DATOS DE PRUEBA 🔶');
    
    // Conectar a MongoDB
    const connected = await connectDB();
    if (!connected) {
      console.error('Error al conectar a la base de datos. Abortando...');
      process.exit(1);
    }
    
    // Limpiar colecciones existentes
    await cleanCollections();
    
    // Crear empresas
    const companies = await createCompanies();
    
    // Crear usuarios
    const users = await createUsers(companies);
    
    // Crear áreas y subáreas y guardar referencias
    await createAreasAndSubAreas(companies, users);
    
    // Obtener las áreas creadas para asignar permisos
    const areasMap = {};
    
    const areasData = [
      { company: companies.acme, name: 'Finanzas', key: 'finanzas' },
      { company: companies.acme, name: 'Recursos Humanos', key: 'rrhh' },
      { company: companies.acme, name: 'Operaciones', key: 'operaciones' },
      { company: companies.globex, name: 'Proyectos', key: 'proyectos' }
    ];
    
    // Obtener todas las áreas creadas
    for (const areaData of areasData) {
      const area = await Area.findOne({ 
        name: areaData.name, 
        companyId: areaData.company._id 
      });
      
      if (area) {
        areasMap[areaData.key] = area;
        console.log(`Área encontrada para permisos: ${areaData.name} (${areaData.key}) - ID: ${area._id}`);
      } else {
        console.error(`No se encontró el área: ${areaData.name}`);
      }
    }
    
    // Verificar que se encontraron todas las áreas
    if (Object.keys(areasMap).length === areasData.length) {
      // Asignar roles y permisos
      await assignRolesAndPermissions(companies, users, areasMap);
    } else {
      console.error(`No se encontraron todas las áreas. Se requieren ${areasData.length}, se encontraron ${Object.keys(areasMap).length}`);
    }
    
    console.log('✅ DATOS DE PRUEBA CREADOS CON ÉXITO');
    console.log('Empresas creadas: ACME Corporation, Globex Industries');
    console.log('Usuarios creados: admin@acme.com, admin@globex.com, finanzas@acme.com, rrhh@acme.com, operaciones@acme.com, control@acme.com, proyectos@globex.com');
    console.log('Áreas creadas: Finanzas, Recursos Humanos, Operaciones, Proyectos');
    console.log('Subáreas creadas para cada área según la especificación');
    console.log('Roles y permisos asignados según especificación');
    
    // Verificar que los usuarios se hayan creado correctamente
    const verifyUser = async (email, password) => {
      try {
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
          console.log(`  ❌ Usuario ${email} no encontrado`);
          return;
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`  ${isMatch ? '✅' : '❌'} Usuario ${email}: contraseña ${isMatch ? 'correcta' : 'incorrecta'}`);
      } catch (error) {
        console.error(`Error al verificar usuario ${email}:`, error);
      }
    };
    
    console.log('\nVerificando credenciales creadas:');
    await verifyUser('admin@acme.com', 'AcmeAdmin2023');
    await verifyUser('admin@globex.com', 'GlobeX2023!');
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada');
    
  } catch (error) {
    console.error('Error durante la creación de datos de prueba:', error);
    process.exit(1);
  }
}

// Ejecutar función principal
main(); 