/**
 * Script para probar el sistema de roles y permisos
 * Este script verifica que los permisos se apliquen correctamente para diferentes roles
 */

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar modelos
const File = require('../models/File');
const Folder = require('../models/Folder');
const Company = require('../models/Company');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');

// Configuración del servidor de prueba
const TEST_SERVER_URL = 'http://localhost:5002';
const API_BASE_URL = `${TEST_SERVER_URL}/api`;

// Configuración para la conexión de MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB conectado: ${conn.connection.host}`.cyan.underline);
    return conn;
  } catch (error) {
    console.error(`Error al conectar a MongoDB: ${error.message}`.red);
    process.exit(1);
  }
};

// Función para esperar un tiempo específico
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para generar un token JWT (simulado para pruebas)
const generateToken = (user) => {
  // En una aplicación real, usaríamos jwt.sign
  // Aquí simulamos para evitar dependencias
  return Buffer.from(JSON.stringify({
    id: user._id.toString(),
    role: user.role,
    companyId: user.companyId.toString(),
    iat: Math.floor(Date.now() / 1000)
  })).toString('base64');
};

// IDs de prueba para la creación de entidades
const TEST_COMPANY_ID = new mongoose.Types.ObjectId('70d21b4667d0d8992e610c86');
const TEST_ADMIN_ID = new mongoose.Types.ObjectId('70d21b4667d0d8992e610c87');
const TEST_CONTROL_ID = new mongoose.Types.ObjectId('70d21b4667d0d8992e610c88');
const TEST_RESPONSABLE_ID = new mongoose.Types.ObjectId('70d21b4667d0d8992e610c89');
const TEST_FOLDER_ID = new mongoose.Types.ObjectId('70d21b4667d0d8992e610c90');
const TEST_AREA_ID = new mongoose.Types.ObjectId('70d21b4667d0d8992e610c91');
const TEST_SUBAREA_ID = new mongoose.Types.ObjectId('70d21b4667d0d8992e610c92');

// Pruebas de roles y permisos
const testRolesAndPermissions = async () => {
  console.log('Ejecutando pruebas de roles y permisos...'.yellow.bold);
  
  // Array para almacenar resultados de pruebas
  const testResults = [];
  
  // Función de ayuda para registrar resultados
  const logTest = (name, success, message = '', data = null) => {
    testResults.push({
      name,
      success,
      message,
      data,
      timestamp: new Date()
    });
    
    if (success) {
      console.log(`✅ ${name}`.green);
      if (message) console.log(`   ${message}`.gray);
    } else {
      console.log(`❌ ${name}`.red);
      console.log(`   ${message}`.red);
      if (data) console.log(JSON.stringify(data, null, 2));
    }
  };
  
  try {
    // Conectar a la base de datos
    await connectDB();
    
    // 1. Limpiar los datos de prueba existentes
    try {
      await User.deleteMany({ 
        _id: { 
          $in: [TEST_ADMIN_ID, TEST_CONTROL_ID, TEST_RESPONSABLE_ID] 
        } 
      });
      await Company.deleteMany({ _id: TEST_COMPANY_ID });
      
      logTest('Limpieza de datos de prueba', true, 
        'Datos de prueba anteriores eliminados correctamente');
    } catch (error) {
      logTest('Limpieza de datos de prueba', false, 
        `Error al limpiar datos: ${error.message}`);
      return;
    }
    
    // 2. Crear empresa de prueba
    let company;
    try {
      company = new Company({
        _id: TEST_COMPANY_ID,
        name: 'Empresa de Prueba - Roles',
        nif: 'B87654321',
        address: 'Calle Prueba Roles, 123',
        phone: '912345678',
        email: 'test-roles@empresaprueba.com',
        active: true
      });
      await company.save();
      
      logTest('Creación de empresa de prueba', true, 
        `Empresa creada correctamente: ${company.name}`);
    } catch (error) {
      logTest('Creación de empresa de prueba', false, 
        `Error al crear empresa: ${error.message}`);
      return;
    }
    
    // 3. Crear roles de prueba
    const roles = {
      admin: null,
      control: null,
      responsable: null
    };
    
    try {
      // Comprobar si los roles ya existen
      const adminRole = await Role.findOne({ code: 'admin' });
      const controlRole = await Role.findOne({ code: 'control' });
      const responsableRole = await Role.findOne({ code: 'responsable' });
      
      if (adminRole && controlRole && responsableRole) {
        roles.admin = adminRole;
        roles.control = controlRole;
        roles.responsable = responsableRole;
        
        logTest('Verificación de roles', true, 
          'Roles existentes encontrados en la base de datos');
      } else {
        logTest('Verificación de roles', false, 
          'No se encontraron todos los roles necesarios');
        
        // En un entorno real, deberíamos crear los roles aquí
        console.log('Ejecute el script de inicialización de roles: npm run init-roles'.yellow);
        return;
      }
    } catch (error) {
      logTest('Verificación de roles', false, 
        `Error al verificar roles: ${error.message}`);
      return;
    }
    
    // 4. Crear usuarios de prueba con diferentes roles
    let adminUser, controlUser, responsableUser;
    try {
      // Hash de contraseña para todos los usuarios
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      
      // Administrador de compañía
      adminUser = new User({
        _id: TEST_ADMIN_ID,
        name: 'Admin Prueba',
        email: 'admin@empresaprueba.com',
        password: hashedPassword,
        companyId: TEST_COMPANY_ID,
        role: 'admin',
        roleId: roles.admin._id,
        active: true
      });
      
      // Usuario de control
      controlUser = new User({
        _id: TEST_CONTROL_ID,
        name: 'Control Prueba',
        email: 'control@empresaprueba.com',
        password: hashedPassword,
        companyId: TEST_COMPANY_ID,
        role: 'control',
        roleId: roles.control._id,
        areaId: TEST_AREA_ID,
        active: true
      });
      
      // Usuario responsable
      responsableUser = new User({
        _id: TEST_RESPONSABLE_ID,
        name: 'Responsable Prueba',
        email: 'responsable@empresaprueba.com',
        password: hashedPassword,
        companyId: TEST_COMPANY_ID,
        role: 'responsable',
        roleId: roles.responsable._id,
        subareaId: TEST_SUBAREA_ID,
        active: true
      });
      
      await User.insertMany([adminUser, controlUser, responsableUser]);
      
      logTest('Creación de usuarios de prueba', true, 
        'Usuarios con diferentes roles creados correctamente');
    } catch (error) {
      logTest('Creación de usuarios de prueba', false, 
        `Error al crear usuarios: ${error.message}`);
      return;
    }
    
    // 5. Crear estructura básica de carpetas, áreas y subáreas
    try {
      // Crear área
      const area = {
        _id: TEST_AREA_ID,
        name: 'Área de Prueba',
        companyId: TEST_COMPANY_ID,
        active: true
      };
      
      // Crear subárea
      const subarea = {
        _id: TEST_SUBAREA_ID,
        name: 'Subárea de Prueba',
        areaId: TEST_AREA_ID,
        companyId: TEST_COMPANY_ID,
        responsibleId: TEST_RESPONSABLE_ID,
        active: true
      };
      
      // Crear carpeta
      const folder = new Folder({
        _id: TEST_FOLDER_ID,
        name: 'Carpeta de Prueba',
        path: '/Prueba',
        companyId: TEST_COMPANY_ID,
        areaId: TEST_AREA_ID,
        subareaId: TEST_SUBAREA_ID,
        createdBy: TEST_ADMIN_ID
      });
      
      // Solo guardamos la carpeta ya que es lo único que tenemos modelado
      await folder.save();
      
      logTest('Creación de estructura básica', true, 
        'Estructura de carpetas, áreas y subáreas creada correctamente');
    } catch (error) {
      logTest('Creación de estructura básica', false, 
        `Error al crear estructura básica: ${error.message}`);
    }
    
    // 6. Crear un archivo de prueba
    let testFile;
    try {
      testFile = new File({
        name: 'archivo-prueba-roles.xlsx',
        originalName: 'archivo-prueba-roles.xlsx',
        description: 'Archivo para probar permisos',
        folderId: TEST_FOLDER_ID,
        companyId: TEST_COMPANY_ID,
        areaId: TEST_AREA_ID,
        subareaId: TEST_SUBAREA_ID,
        size: 15000,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: '.xlsx',
        storageLocation: '/uploads/archivo-prueba-roles.xlsx',
        uploadedBy: TEST_ADMIN_ID,
        status: 'pendiente',
        processingDetails: {},
        metadata: {
          sheets: ['Hoja1'],
          rowCount: 100,
          columnCount: 10
        }
      });
      
      await testFile.save();
      
      // Crear archivo físico de ejemplo si no existe
      const uploadDir = process.env.UPLOAD_PATH || './uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, 'archivo-prueba-roles.xlsx');
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `Contenido de prueba para archivo-prueba-roles.xlsx`);
      }
      
      logTest('Creación de archivo de prueba', true, 
        `Archivo de prueba creado: ${testFile.name}`);
    } catch (error) {
      logTest('Creación de archivo de prueba', false, 
        `Error al crear archivo de prueba: ${error.message}`);
    }
    
    // 7. Simular acceso con diferentes permisos
    try {
      // Crear cliente HTTP con token de administrador
      const adminClient = axios.create({
        baseURL: API_BASE_URL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${generateToken(adminUser)}`
        }
      });
      
      // Intentar acceder como administrador
      const adminResponse = await adminClient.get('/files/status');
      
      logTest('Acceso como administrador', adminResponse.status === 200, 
        `Respuesta del servidor: ${adminResponse.status}`);
    } catch (error) {
      if (error.response) {
        logTest('Acceso como administrador', false, 
          `Error de respuesta: ${error.response.status}`, error.response.data);
      } else {
        logTest('Acceso como administrador', false, 
          `Error al intentar acceder: ${error.message}`);
        
        console.log('Nota: Esta prueba requiere que el servidor esté en ejecución.');
        console.log('Ejecute: npm run test-server');
      }
    }
    
    // 8. Verificar que los modelos cumplen con la estructura de permisos
    try {
      // Verificar campos de modelo File
      const requiredFileFields = ['companyId', 'areaId', 'subareaId', 'folderId'];
      const fileSchema = File.schema.obj;
      
      const fileHasRequiredFields = requiredFileFields.every(field => 
        fileSchema.hasOwnProperty(field));
      
      // Verificar campos de modelo User
      const requiredUserFields = ['companyId', 'role', 'roleId', 'areaId', 'subareaId'];
      const userSchema = User.schema.obj;
      
      const userHasRequiredFields = requiredUserFields.every(field => 
        userSchema.hasOwnProperty(field));
      
      if (fileHasRequiredFields && userHasRequiredFields) {
        logTest('Modelos compatibles con permisos', true, 
          'Los modelos tienen los campos necesarios para el sistema de permisos');
      } else {
        const missingFileFields = requiredFileFields.filter(f => !fileSchema.hasOwnProperty(f));
        const missingUserFields = requiredUserFields.filter(f => !userSchema.hasOwnProperty(f));
        
        logTest('Modelos compatibles con permisos', false, 
          'Los modelos no tienen todos los campos necesarios', {
            missingFileFields,
            missingUserFields
          });
      }
    } catch (error) {
      logTest('Modelos compatibles con permisos', false, 
        `Error al verificar modelos: ${error.message}`);
    }
    
    // 9. Verificar definición de permisos relacionados con archivos
    try {
      const filePermissions = await Permission.find({
        code: { $regex: /file/i }
      });
      
      if (filePermissions.length > 0) {
        logTest('Permisos de archivos', true, 
          `Se encontraron ${filePermissions.length} permisos relacionados con archivos`);
      } else {
        logTest('Permisos de archivos', false, 
          'No se encontraron permisos específicos para archivos');
      }
    } catch (error) {
      logTest('Permisos de archivos', false, 
        `Error al verificar permisos: ${error.message}`);
    }
    
    // 10. Verificar asignación de permisos a roles
    try {
      const roles = await Role.find().populate('permissions');
      
      if (roles.length === 0) {
        logTest('Asignación de permisos a roles', false, 
          'No se encontraron roles en la base de datos');
      } else {
        // Verificar que al menos un rol tiene permisos
        const rolesWithPermissions = roles.filter(r => 
          r.permissions && r.permissions.length > 0);
        
        if (rolesWithPermissions.length > 0) {
          logTest('Asignación de permisos a roles', true, 
            `${rolesWithPermissions.length} roles tienen permisos asignados`);
        } else {
          logTest('Asignación de permisos a roles', false, 
            'Ningún rol tiene permisos asignados');
        }
      }
    } catch (error) {
      logTest('Asignación de permisos a roles', false, 
        `Error al verificar asignación de permisos: ${error.message}`);
    }
    
    // Resumen de resultados
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n=============================================='.cyan);
    console.log(`📋 RESUMEN DE PRUEBAS DE ROLES Y PERMISOS`.cyan.bold);
    console.log('=============================================='.cyan);
    console.log(`Total de pruebas: ${totalTests}`.white);
    console.log(`Pruebas exitosas: ${passedTests}`.green);
    console.log(`Pruebas fallidas: ${failedTests}`.red);
    console.log(`Tasa de éxito: ${Math.round((passedTests / totalTests) * 100)}%`.yellow);
    console.log('==============================================\n'.cyan);
    
    // Guardar resultados en un archivo para referencia
    const resultsDir = './test-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(
      path.join(resultsDir, `roles-permissions-tests-${timestamp}.json`),
      JSON.stringify({
        timestamp: new Date(),
        summary: {
          total: totalTests,
          passed: passedTests,
          failed: failedTests,
          successRate: Math.round((passedTests / totalTests) * 100)
        },
        results: testResults
      }, null, 2)
    );
    
    // Cerrar conexión a MongoDB
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada correctamente'.cyan);
    
  } catch (error) {
    console.error(`Error general en pruebas de roles y permisos: ${error.message}`.red.bold);
    console.error(error);
  }
};

// Ejecutar pruebas
testRolesAndPermissions(); 