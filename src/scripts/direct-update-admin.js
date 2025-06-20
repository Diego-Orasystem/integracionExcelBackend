/**
 * Script directo y simple para actualizar la contraseña del usuario administrador
 * Actualiza directamente en la base de datos sin usar los hooks de Mongoose
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuración
const ADMIN_EMAIL = 'admin@sistema.com';
const ADMIN_PASSWORD = 'Admin123456';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_manager';

async function directUpdateAdmin() {
  let connection;
  
  try {
    // Conectar directamente sin Mongoose models
    console.log(`Conectando a MongoDB: ${MONGO_URI}`);
    connection = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Generar hash de contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
    
    console.log('Hash de contraseña generado correctamente');
    
    // Actualizar directamente en la colección
    const db = connection.connection.db;
    const usersCollection = db.collection('users');
    
    // Buscar usuario por email
    const user = await usersCollection.findOne({ email: ADMIN_EMAIL });
    
    if (!user) {
      console.log(`No se encontró ningún usuario con el email ${ADMIN_EMAIL}`);
      return;
    }
    
    console.log(`Usuario encontrado: ${user.name} (${user._id})`);
    
    // Actualizar contraseña directamente en la base de datos
    const result = await usersCollection.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );
    
    if (result.modifiedCount === 1) {
      console.log('✅ Contraseña actualizada correctamente');
      
      // Verificar que funciona
      const updatedUser = await usersCollection.findOne({ _id: user._id });
      console.log('Usuario actualizado:', updatedUser._id);
      
      console.log('\nAhora deberías poder iniciar sesión con:');
      console.log(`Email: ${ADMIN_EMAIL}`);
      console.log(`Contraseña: ${ADMIN_PASSWORD}`);
    } else {
      console.log('❌ No se pudo actualizar la contraseña');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cerrar conexión
    if (connection) {
      await connection.connection.close();
      console.log('Conexión cerrada');
    }
  }
}

// Ejecutar
console.log('=== Actualización Directa de Contraseña de Administrador ===');
directUpdateAdmin(); 