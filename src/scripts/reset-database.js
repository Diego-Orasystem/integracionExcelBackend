/**
 * Script para limpiar la base de datos y dejar solo un usuario administrador del sistema
 * Este script elimina todos los datos excepto un usuario administrador configurado
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Company = require('../models/Company');
const File = require('../models/File');
const FilePermission = require('../models/FilePermission');
const Folder = require('../models/Folder');
const Log = require('../models/Log');
const Area = require('../models/Area');
const SubArea = require('../models/SubArea');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const Permission = require('../models/Permission');
const MenuItem = require('../models/MenuItem');
const FileVersion = require('../models/FileVersion');
const SftpSyncJob = require('../models/SftpSyncJob');

// Configuración del administrador que se conservará
const ADMIN_CONFIG = {
  name: 'Administrador del Sistema',
  email: 'admin@sistema.com',
  password: 'Admin123456', // Esta contraseña se encriptará
  role: 'admin'
};

// Si no se encuentra en .env, especifica aquí tu URI de MongoDB
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_manager';
const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_key_for_development';

// Conectar a la base de datos
async function connectDB() {
  try {
    console.log(`Intentando conectar a MongoDB con URI: ${MONGO_URI}`);
    const conn = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB conectado: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error al conectar a MongoDB: ${error.message}`);
    console.log('Asegúrate de que la URI de MongoDB esté correctamente configurada');
    console.log('Puedes modificar la constante MONGO_URI en este archivo o agregar MONGO_URI a tu archivo .env');
    process.exit(1);
  }
}

// Crear empresa por defecto
async function createDefaultCompany() {
  console.log('Creando empresa por defecto...');
  const company = new Company({
    name: 'Sistema Administración',
    description: 'Empresa por defecto del sistema',
    active: true,
    settings: {
      maxStorage: 1024,
      allowedFileTypes: ['.xlsx', '.xls', '.csv'],
      autoSyncInterval: 60
    }
  });
  
  await company.save();
  console.log('Empresa por defecto creada con ID:', company._id);
  return company;
}

// Crear usuario administrador
async function createAdminUser(companyId) {
  console.log('Creando usuario administrador...');
  
  try {
    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, salt);
    
    // Preparar documento de usuario
    const admin = {
      name: ADMIN_CONFIG.name,
      email: ADMIN_CONFIG.email,
      password: hashedPassword,
      role: ADMIN_CONFIG.role,
      companyId: companyId,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insertar directamente en la colección
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Eliminar usuario existente con el mismo email si existe
    await usersCollection.deleteOne({ email: ADMIN_CONFIG.email });
    
    // Insertar nuevo usuario
    const result = await usersCollection.insertOne(admin);
    
    console.log('Usuario administrador creado con ID:', result.insertedId);
    console.log('Contraseña asignada:', ADMIN_CONFIG.password);
    
    return admin;
  } catch (error) {
    console.error('Error al crear usuario administrador:', error);
    throw error;
  }
}

// Función para probar el login del usuario administrador
async function testLogin() {
  console.log('Probando login del administrador...');
  
  try {
    // Buscar el usuario por email
    const user = await User.findOne({ email: ADMIN_CONFIG.email }).select('+password');
    
    if (!user) {
      console.error('Error: No se encontró el usuario administrador');
      return false;
    }
    
    // Verificar la contraseña
    const isMatch = await bcrypt.compare(ADMIN_CONFIG.password, user.password);
    
    if (!isMatch) {
      console.error('Error: La contraseña no coincide');
      return false;
    }
    
    // Generar token para verificar
    const token = jwt.sign({ id: user._id }, JWT_SECRET, {
      expiresIn: '1d'
    });
    
    console.log('Login exitoso. Token generado correctamente.');
    console.log('Información del usuario:');
    console.log(`  - ID: ${user._id}`);
    console.log(`  - Nombre: ${user.name}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Rol: ${user.role}`);
    console.log(`  - CompanyID: ${user.companyId}`);
    
    return true;
  } catch (error) {
    console.error('Error al probar login:', error);
    return false;
  }
}

// Función principal para resetear la base de datos
async function resetDatabase() {
  try {
    const conn = await connectDB();
    
    console.log('Iniciando limpieza de la base de datos...');
    
    // Eliminar todos los datos excepto colecciones del sistema
    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({}),
      File.deleteMany({}),
      FilePermission.deleteMany({}),
      Folder.deleteMany({}),
      Log.deleteMany({}),
      Area.deleteMany({}),
      SubArea.deleteMany({}),
      Role.deleteMany({}),
      UserRole.deleteMany({}),
      Permission.deleteMany({}),
      MenuItem.deleteMany({}),
      FileVersion.deleteMany({}),
      SftpSyncJob.deleteMany({})
    ]);
    
    console.log('Datos eliminados correctamente.');
    
    // Crear empresa por defecto
    const company = await createDefaultCompany();
    
    // Crear usuario administrador
    const admin = await createAdminUser(company._id);
    
    // Probar login
    const loginSuccess = await testLogin();
    
    console.log('\nBase de datos restablecida con éxito. Solo queda un usuario administrador.');
    console.log('Email: ' + ADMIN_CONFIG.email);
    console.log('Contraseña: ' + ADMIN_CONFIG.password);
    console.log('Resultado de prueba de login: ' + (loginSuccess ? 'Exitoso ✅' : 'Fallido ❌'));
    
    if (!loginSuccess) {
      console.log('\nAtención: La prueba de login ha fallado. Posibles problemas:');
      console.log('1. Comprueba que la variable JWT_SECRET esté correctamente configurada en .env');
      console.log('2. Asegúrate de que el modelo User tenga el método comparePassword implementado');
      console.log('3. Verifica que la ruta de autenticación /api/auth/login esté funcionando');
    }
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión a la base de datos cerrada.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error al resetear la base de datos:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Ejecutar script
console.log('=== Script de Restablecimiento de Base de Datos ===');
console.log('ADVERTENCIA: Este script eliminará todos los datos excepto un usuario administrador.');
console.log('Base de datos destino: ' + MONGO_URI);
console.log('Presiona CTRL+C para cancelar en los próximos 5 segundos...');

setTimeout(() => {
  console.log('Iniciando proceso de restablecimiento...');
  resetDatabase();
}, 5000); 