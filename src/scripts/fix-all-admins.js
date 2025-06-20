/**
 * Script para arreglar las contraseñas de todos los usuarios
 * Este script actualiza todos los usuarios en la base de datos con contraseñas predefinidas
 * para que funcionen correctamente con el sistema de autenticación
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuración
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_manager';

// Contraseñas predefinidas (usuario: contraseña)
const DEFAULT_PASSWORDS = {
  'admin@sistema.com': 'Admin123456',
  'usuario@empresaprueba.com': 'password123',
  // Añadir más usuarios según sea necesario
};

// Hashes predefinidos (calculados previamente)
const PREDEFINED_HASHES = {
  'Admin123456': '$2a$10$iW5luGI6Abe65orrxQ9hk.ft.Gsk89rw8.D34jnO1OFxDI201tAwm',
  'password123': '$2a$10$oN.jxlz1xK1waqDhXD/Jw.FABCn0zoH0I5JDa4.1OlmEL7jJtXefm',
  // Añadir más hashes según sea necesario
};

async function fixAllUserPasswords() {
  let connection;
  
  try {
    // Conectar a MongoDB
    console.log(`Conectando a MongoDB: ${MONGO_URI}`);
    connection = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Acceder directamente a las colecciones
    const db = connection.connection.db;
    const usersCollection = db.collection('users');
    
    // Buscar todos los usuarios
    const users = await usersCollection.find({}).toArray();
    
    console.log(`\nSe encontraron ${users.length} usuarios en la base de datos:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user._id}) - Rol: ${user.role}`);
    });
    
    // Actualizar las contraseñas según el email o usar una contraseña por defecto
    console.log('\nActualizando contraseñas de usuarios...');
    
    let updatedCount = 0;
    
    for (const user of users) {
      // Determinar qué contraseña usar
      let passwordToUse = 'Admin123456'; // Valor por defecto
      
      if (DEFAULT_PASSWORDS[user.email]) {
        passwordToUse = DEFAULT_PASSWORDS[user.email];
      } else {
        console.log(`No hay contraseña predefinida para ${user.email}, usando 'Admin123456'`);
      }
      
      // Obtener el hash predefinido
      const passwordHash = PREDEFINED_HASHES[passwordToUse];
      
      // Actualizar la contraseña
      const result = await usersCollection.updateOne(
        { _id: user._id },
        { $set: { password: passwordHash } }
      );
      
      if (result.modifiedCount === 1) {
        console.log(`✅ Contraseña actualizada para ${user.email} -> '${passwordToUse}'`);
        updatedCount++;
      } else {
        console.log(`❌ No se pudo actualizar la contraseña para: ${user.email}`);
      }
    }
    
    console.log(`\n✅ PROCESO COMPLETADO. Se actualizaron ${updatedCount} de ${users.length} usuarios.`);
    console.log('\nContraseñas para iniciar sesión:');
    
    // Mostrar las credenciales de inicio de sesión para cada usuario
    Object.entries(DEFAULT_PASSWORDS).forEach(([email, password]) => {
      console.log(`- ${email}: ${password}`);
    });
    
    // Para otros usuarios no definidos explícitamente
    console.log('- Otros usuarios: Admin123456');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cerrar conexión
    if (connection) {
      await connection.connection.close();
      console.log('\nConexión cerrada');
    }
  }
}

// Ejecutar
console.log('=== Script de Corrección de Contraseñas ===');
fixAllUserPasswords(); 