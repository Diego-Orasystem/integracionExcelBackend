/**
 * Script sencillo para crear un usuario administrador sin interacción
 * Útil para entornos donde la interacción por consola no es posible
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Company = require('../models/Company');

// Configuración del administrador
const ADMIN_CONFIG = {
  name: 'Administrador',
  email: 'admin@sistema.com',
  password: 'Admin123456',
  role: 'admin'
};

// Si no se encuentra en .env, especifica aquí tu URI de MongoDB
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_manager';

async function initAdmin() {
  try {
    // Conectar a MongoDB
    console.log(`Conectando a MongoDB: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conexión establecida');

    // Crear empresa principal si no existe
    let company = await Company.findOne({ name: 'Sistema Principal' });
    
    if (!company) {
      console.log('Creando empresa principal...');
      company = await Company.create({
        name: 'Sistema Principal',
        description: 'Empresa principal del sistema',
        active: true,
        settings: {
          maxStorage: 1024,
          allowedFileTypes: ['.xlsx', '.xls', '.csv'],
          autoSyncInterval: 60
        }
      });
      console.log(`Empresa creada con ID: ${company._id}`);
    } else {
      console.log(`Usando empresa existente: ${company.name} (${company._id})`);
    }

    // Verificar si ya existe un usuario con el mismo email
    const existingUser = await User.findOne({ email: ADMIN_CONFIG.email });
    
    if (existingUser) {
      console.log(`El usuario ${ADMIN_CONFIG.email} ya existe`);
      
      // Actualizar a rol admin si no lo es
      if (existingUser.role !== 'admin') {
        console.log('Actualizando a rol de administrador...');
        existingUser.role = 'admin';
        await existingUser.save();
        console.log('Usuario actualizado a administrador');
      }
      
      console.log('Información del usuario:');
      console.log(`  - ID: ${existingUser._id}`);
      console.log(`  - Nombre: ${existingUser.name}`);
      console.log(`  - Email: ${existingUser.email}`);
      console.log(`  - Rol: ${existingUser.role}`);
    } else {
      // Crear nuevo usuario admin
      console.log('Creando usuario administrador...');
      
      // Encriptar contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, salt);
      
      // Crear usuario
      const newAdmin = await User.create({
        name: ADMIN_CONFIG.name,
        email: ADMIN_CONFIG.email,
        password: hashedPassword,
        role: ADMIN_CONFIG.role,
        companyId: company._id,
        active: true
      });
      
      console.log('Usuario administrador creado:');
      console.log(`  - ID: ${newAdmin._id}`);
      console.log(`  - Nombre: ${newAdmin.name}`);
      console.log(`  - Email: ${newAdmin.email}`);
      console.log(`  - Contraseña: ${ADMIN_CONFIG.password}`);
    }
    
    console.log('\nProceso completado con éxito.');
    console.log('Puedes iniciar sesión con:');
    console.log(`  - Email: ${ADMIN_CONFIG.email}`);
    console.log(`  - Contraseña: ${ADMIN_CONFIG.password}`);
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión cerrada.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Ejecutar script
console.log('=== Inicialización de Usuario Administrador ===');
initAdmin(); 