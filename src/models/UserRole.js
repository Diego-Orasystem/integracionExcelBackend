const mongoose = require('mongoose');

const UserRoleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es obligatorio']
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'El rol es obligatorio']
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'La compañía es obligatoria']
  },
  // Para roles específicos de área
  areaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Area',
    default: null
  },
  // Para roles específicos de subárea
  subareaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubArea',
    default: null
  },
  // Permios adicionales específicos para este usuario y rol
  additionalPermissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  // Permisos que se quieren denegar específicamente
  deniedPermissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  active: {
    type: Boolean,
    default: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Es necesario especificar quién asignó el rol']
  }
}, {
  timestamps: true
});

// Índice compuesto para evitar duplicados
UserRoleSchema.index(
  { 
    userId: 1, 
    roleId: 1, 
    companyId: 1, 
    areaId: 1, 
    subareaId: 1 
  }, 
  { 
    unique: true,
    partialFilterExpression: { active: true }
  }
);

// Método para verificar si un usuario tiene un permiso específico en este rol
UserRoleSchema.methods.hasPermission = async function(permissionCode) {
  // Primero verificar si está en permisos denegados
  await this.populate('deniedPermissions');
  if (this.deniedPermissions.some(p => p.code === permissionCode)) {
    return false;
  }
  
  // Verificar en permisos adicionales
  await this.populate('additionalPermissions');
  if (this.additionalPermissions.some(p => p.code === permissionCode)) {
    return true;
  }
  
  // Verificar en el rol asignado
  await this.populate('roleId');
  return this.roleId.hasPermission(permissionCode);
};

module.exports = mongoose.model('UserRole', UserRoleSchema); 