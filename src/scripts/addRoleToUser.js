/**
 * Script para añadir un rol adicional a un usuario específico
 * 
 * Ejecutar con: node src/scripts/addRoleToUser.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

console.log('Iniciando script para añadir rol a usuario');

// Utilizar la URL de MongoDB de las variables de entorno
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

// Email del usuario al que queremos añadir un rol
const userEmail = 'admin@acme.com';
// Rol adicional que queremos asignar
const additionalRole = 'user_responsible';

async function addRoleToUser() {
  try {
    // Conectar a la base de datos
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Conectado a MongoDB');
    
    // Buscar el usuario por email
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.error(`Usuario con email ${userEmail} no encontrado`);
      return;
    }
    
    console.log(`Usuario encontrado: ${user.email}`);
    console.log(`Roles actuales: ${user.roles}`);
    
    // Verificar si el usuario ya tiene el rol
    if (user.roles.includes(additionalRole)) {
      console.log(`El usuario ya tiene el rol ${additionalRole}`);
      return;
    }
    
    // Añadir el nuevo rol
    user.roles.push(additionalRole);
    await user.save();
    
    console.log(`Rol ${additionalRole} añadido exitosamente a ${user.email}`);
    console.log(`Roles actualizados: ${user.roles}`);
    
  } catch (error) {
    console.error('Error al añadir rol al usuario:', error);
  } finally {
    // Cerrar conexión
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
      console.log('Conexión a MongoDB cerrada');
    }
  }
}

// Ejecutar la función
addRoleToUser(); 