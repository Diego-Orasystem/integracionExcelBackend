const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: 6,
    select: false // No incluir por defecto en las consultas
  },
  roles: {
    type: [String],
    enum: ['admin', 'company_admin', 'user', 'user_control', 'user_responsible'],
    default: ['user']
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'El usuario debe pertenecer a una empresa']
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    language: {
      type: String,
      default: 'es'
    },
    theme: {
      type: String,
      default: 'light'
    }
  },
  active: {
    type: Boolean,
    default: true
  },
  // Nuevos campos para el código de verificación por correo
  verificationCode: {
    type: String,
    select: false // No incluir por defecto en las consultas
  },
  verificationCodeExpires: {
    type: Date,
    select: false // No incluir por defecto en las consultas
  },
  loginMethod: {
    type: String,
    enum: ['password', 'email_code'],
    default: 'password'
  }
}, {
  timestamps: true
});

// Encriptar contraseña antes de guardar
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar contraseñas
UserSchema.methods.comparePassword = async function (enteredPassword) {
  try {
    // Usar bcrypt directamente para comparar la contraseña ingresada con la almacenada
    // Esto funciona independientemente de cómo se haya generado el hash (usando pre-save o directamente)
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    
    // Para debugging
    console.log(`Comparando contraseñas para ${this.email}:`);
    console.log(`  - Contraseña ingresada: ${enteredPassword}`);
    console.log(`  - Hash almacenado: ${this.password.substring(0, 20)}...`);
    console.log(`  - Resultado: ${isMatch ? 'Coinciden ✅' : 'No coinciden ❌'}`);
    
    return isMatch;
  } catch (error) {
    console.error(`Error al comparar contraseña para usuario ${this.email}:`, error);
    // En caso de error, devolver false para rechazar el login
    return false;
  }
};

// Método para generar un código de verificación
UserSchema.methods.generateVerificationCode = async function() {
  // Generar un código aleatorio de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Establecer fecha de expiración (10 minutos)
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + 10);
  
  // Guardar el código y su expiración en el usuario
  this.verificationCode = code;
  this.verificationCodeExpires = expirationTime;
  
  // Guardar el usuario
  await this.save({ validateBeforeSave: false });
  
  return code;
};

// Método para verificar un código
UserSchema.methods.verifyCode = function(code) {
  // Verificar si el código coincide y no ha expirado
  const isValid = 
    this.verificationCode === code && 
    this.verificationCodeExpires > new Date();
  
  return isValid;
};

module.exports = mongoose.model('User', UserSchema); 