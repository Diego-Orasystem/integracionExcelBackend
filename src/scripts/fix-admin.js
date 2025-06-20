/**
 * Script para corregir el usuario administrador y asegurar que pueda iniciar sesión
 * Este script busca el usuario administrador y recrea su contraseña correctamente
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Company = require('../models/Company');

// Configuración del administrador
const ADMIN_CONFIG = {
  email: 'admin@sistema.com',
  password: 'Admin123456',
  role: 'admin'
};

// Si no se encuentra en .env, especifica aquí tu URI de MongoDB
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_manager';

async function fixAdmin() {
  try {
    // Conectar a MongoDB
    console.log(`Conectando a MongoDB: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conexión establecida');

    // Buscar el usuario administrador por email
    const admin = await User.findOne({ email: ADMIN_CONFIG.email }).select('+password');
    
    if (!admin) {
      console.log(`No se encontró un usuario con email ${ADMIN_CONFIG.email}`);
      console.log('Ejecuta primero el script init-admin.js para crear un usuario administrador');
      await mongoose.connection.close();
      return;
    }
    
    console.log(`Usuario encontrado: ${admin.name} (${admin._id})`);
    
    // Probar el método comparePassword directamente
    const passwordMatch = await admin.comparePassword(ADMIN_CONFIG.password);
    console.log(`Prueba de comparación de contraseña: ${passwordMatch ? 'Exitosa ✅' : 'Fallida ❌'}`);
    
    // Recrear la contraseña correctamente
    console.log('Actualizando contraseña del administrador...');
    
    // Generar salt y hash manualmente
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, salt);
    
    // Actualizar la contraseña directamente
    admin.password = hashedPassword;
    
    // Guardar sin activar los middleware pre-save (para evitar doble hashing)
    await User.updateOne(
      { _id: admin._id },
      { $set: { password: hashedPassword } }
    );
    
    console.log('Contraseña actualizada correctamente');
    
    // Verificar que funciona después de la actualización
    const updatedAdmin = await User.findById(admin._id).select('+password');
    
    // Comparar manualmente usando bcrypt
    const manualCheck = await bcrypt.compare(ADMIN_CONFIG.password, updatedAdmin.password);
    console.log(`Verificación manual de contraseña actualizada: ${manualCheck ? 'Exitosa ✅' : 'Fallida ❌'}`);
    
    if (manualCheck) {
      console.log('\n¡Problema resuelto! El usuario administrador ahora debería poder iniciar sesión.');
      console.log('Credenciales de acceso:');
      console.log(`  - Email: ${ADMIN_CONFIG.email}`);
      console.log(`  - Contraseña: ${ADMIN_CONFIG.password}`);
    } else {
      console.log('\nHubo un problema al actualizar la contraseña.');
      console.log('Posibles causas:');
      console.log('1. El método pre-save del esquema User podría estar causando problemas');
      console.log('2. Podría haber problemas con la biblioteca bcrypt');
      console.log('3. Revisa el modelo User para asegurarte que no haya hooks personalizados que interfieran');
    }
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión cerrada.');
    
  } catch (error) {
    console.error('Error:', error);
    try {
      await mongoose.connection.close();
    } catch (e) {
      // Ignorar error al cerrar conexión
    }
    process.exit(1);
  }
}

// Ejecutar script
console.log('=== Corrección de Usuario Administrador ===');
fixAdmin(); 