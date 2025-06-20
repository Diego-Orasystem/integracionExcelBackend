const mongoose = require('mongoose');

const FolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre de la carpeta es obligatorio'],
    trim: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null // null significa que es carpeta raíz
  },
  path: {
    type: String,
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'La carpeta debe pertenecer a una empresa']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Se debe especificar quién creó la carpeta']
  },
  permissions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    access: {
      type: String,
      enum: ['read', 'write', 'admin'],
      default: 'read'
    }
  }]
}, {
  timestamps: true
});

// Método para verificar si un usuario tiene permisos sobre esta carpeta
FolderSchema.methods.hasPermission = function(userId, requiredAccess = 'read') {
  // Admin de la empresa siempre tiene acceso
  if (userId.equals(this.createdBy)) return true;
  
  // Verificar permisos específicos
  const permission = this.permissions.find(p => p.userId.equals(userId));
  if (!permission) return false;
  
  if (requiredAccess === 'read') return true;
  if (requiredAccess === 'write' && ['write', 'admin'].includes(permission.access)) return true;
  if (requiredAccess === 'admin' && permission.access === 'admin') return true;
  
  return false;
};

module.exports = mongoose.model('Folder', FolderSchema); 