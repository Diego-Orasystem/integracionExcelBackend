/**
 * Script para migrar los usuarios del campo role (string) a roles (array)
 * 
 * Ejecutar con: node src/scripts/migrateRolesToArray.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

console.log('Iniciando script de migración de roles');

// Verificar las variables de entorno
console.log('Variables de entorno: MONGODB_URI =', process.env.MONGODB_URI ? 'definida' : 'no definida');

// Si no existe la variable de entorno MONGODB_URI, usar la URL de MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://diegodiaz:Admin123.@fits.hov3igz.mongodb.net/excel-manager?retryWrites=true&w=majority&appName=Fits';
console.log('Usando URL de MongoDB:', MONGODB_URI);

// Modelo User
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  roles: [String],
  companyId: mongoose.Schema.Types.ObjectId,
  lastLogin: Date,
  preferences: {
    language: String,
    theme: String
  },
  active: Boolean,
  verificationCode: String,
  verificationCodeExpires: Date,
  loginMethod: String
}, {
  timestamps: true
});

const User = mongoose.model('User', UserSchema);

async function migrateRolesToArray() {
  try {
    // Conectar a la base de datos
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Conectado a MongoDB');
    
    // Obtener todos los usuarios
    const users = await User.find({});
    console.log(`Encontrados ${users.length} usuarios para migrar`);
    
    // Contador para seguimiento
    let migratedCount = 0;
    
    // Migrar cada usuario
    for (const user of users) {
      console.log(`Procesando usuario: ${user.email}, role: ${user.role}, roles: ${user.roles}`);
      
      // Si el usuario ya tiene roles como array, no hacer nada
      if (Array.isArray(user.roles) && user.roles.length > 0) {
        console.log(`Usuario ${user.email} ya tiene roles como array: ${user.roles}`);
        continue;
      }
      
      // Migrar el campo 'role' a 'roles'
      user.roles = user.role ? [user.role] : ['user'];
      await user.save();
      
      migratedCount++;
      console.log(`Migrado usuario ${user.email}: role=${user.role} -> roles=${user.roles}`);
    }
    
    console.log(`Migración completada: ${migratedCount} usuarios actualizados`);
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    // Cerrar conexión
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
      console.log('Conexión a MongoDB cerrada');
    }
  }
}

// Ejecutar la migración
migrateRolesToArray(); 