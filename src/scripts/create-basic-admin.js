/**
 * Script para crear un usuario administrador básico
 * Este script crea un usuario administrador y una empresa asociada sin limpiar el resto de datos
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Company = require('../models/Company');

// Configuración del administrador
const ADMIN_CONFIG = {
  name: 'Administrador del Sistema',
  email: 'admin@sistema.com',
  password: 'Admin123456', // Esta contraseña se encriptará
  role: 'admin'
};

// Compañía por defecto
const DEFAULT_COMPANY = {
  name: 'Sistema Administración',
  description: 'Empresa por defecto del sistema',
  settings: {
    maxStorage: 1024,
    allowedFileTypes: ['.xlsx', '.xls', '.csv'],
    autoSyncInterval: 60
  }
};

// Si no se encuentra en .env, especifica aquí tu URI de MongoDB
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_manager';

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
    process.exit(1);
  }
}

// Crear usuario administrador
async function createAdminUser() {
  try {
    // Conectar a la base de datos
    await connectDB();
    
    // Acceder directamente a la colección de usuarios
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Verificar si ya existe el usuario con ese email
    const existingUser = await usersCollection.findOne({ email: ADMIN_CONFIG.email });
    if (existingUser) {
      console.log(`\nYa existe un usuario con el email ${ADMIN_CONFIG.email}`);
      console.log('Información del usuario existente:');
      console.log(`  - ID: ${existingUser._id}`);
      console.log(`  - Nombre: ${existingUser.name}`);
      console.log(`  - Rol: ${existingUser.role}`);
      
      const updateUser = await askQuestion('¿Quieres actualizar este usuario a administrador? (s/n): ');
      
      if (updateUser.toLowerCase() === 's') {
        await usersCollection.updateOne(
          { _id: existingUser._id },
          { $set: { role: 'admin' } }
        );
        console.log('Usuario actualizado a administrador correctamente.');
      } else {
        console.log('Operación cancelada.');
      }
      
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Buscar o crear la empresa por defecto
    let company = await Company.findOne({ name: DEFAULT_COMPANY.name });
    
    if (!company) {
      console.log('Creando empresa por defecto...');
      company = new Company({
        name: DEFAULT_COMPANY.name,
        description: DEFAULT_COMPANY.description,
        settings: DEFAULT_COMPANY.settings,
        active: true
      });
      
      await company.save();
      console.log('Empresa por defecto creada con ID:', company._id);
    } else {
      console.log('Usando empresa existente con ID:', company._id);
    }
    
    // Encriptar contraseña
    console.log('Creando usuario administrador...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, salt);
    
    // Crear el usuario administrador directamente en la base de datos
    const admin = {
      name: ADMIN_CONFIG.name,
      email: ADMIN_CONFIG.email,
      password: hashedPassword,
      role: ADMIN_CONFIG.role,
      companyId: company._id,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await usersCollection.insertOne(admin);
    
    console.log('\nUsuario administrador creado con éxito:');
    console.log(`  - ID: ${result.insertedId}`);
    console.log(`  - Nombre: ${admin.name}`);
    console.log(`  - Email: ${admin.email}`);
    console.log(`  - Contraseña: ${ADMIN_CONFIG.password}`);
    console.log(`  - Compañía: ${company.name} (${company._id})`);
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión a la base de datos cerrada.');
    
  } catch (error) {
    console.error('Error al crear el usuario administrador:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Función auxiliar para preguntas en consola
function askQuestion(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

// Ejecutar script
console.log('=== Script de Creación de Usuario Administrador ===');
createAdminUser(); 