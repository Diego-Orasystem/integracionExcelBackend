const mongoose = require('mongoose');

/**
 * Modelo para permisos a nivel de archivo individual
 * Permite asignar permisos específicos a usuarios o roles para archivos individuales,
 * independientemente de su ubicación en la estructura jerárquica
 */
const FilePermissionSchema = new mongoose.Schema({
  // El archivo al que se aplica el permiso
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: [true, 'El ID del archivo es obligatorio']
  },

  // Tipo de entidad a la que se concede el permiso: usuario individual o rol
  entityType: {
    type: String,
    enum: ['user', 'role'],
    required: [true, 'El tipo de entidad es obligatorio']
  },

  // ID del usuario o rol al que se concede el permiso
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'El ID de la entidad es obligatorio'],
    refPath: 'entityType' // Referencia dinámica según entityType (User o Role)
  },

  // Compañía a la que pertenece este permiso (para segmentación)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'La compañía es obligatoria']
  },

  // Acciones permitidas para este permiso específico
  actions: {
    read: {
      type: Boolean,
      default: true,
      description: 'Permiso para ver y descargar el archivo'
    },
    write: {
      type: Boolean,
      default: false,
      description: 'Permiso para modificar o reemplazar el archivo'
    },
    delete: {
      type: Boolean,
      default: false,
      description: 'Permiso para eliminar el archivo'
    },
    admin: {
      type: Boolean,
      default: false,
      description: 'Permiso para administrar los permisos del archivo'
    }
  },

  // Vigencia del permiso (opcional)
  validUntil: {
    type: Date,
    default: null,
    description: 'Fecha de expiración del permiso, null si no expira'
  },

  // Quién concedió este permiso
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Se debe registrar quién concedió el permiso']
  },

  // Estado (activo/inactivo)
  active: {
    type: Boolean,
    default: true
  },

  // Notas o motivo del permiso
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
FilePermissionSchema.index({ fileId: 1, entityType: 1, entityId: 1 }, { unique: true });
FilePermissionSchema.index({ entityType: 1, entityId: 1 });
FilePermissionSchema.index({ companyId: 1 });

// Método para verificar si un permiso es válido (no ha expirado)
FilePermissionSchema.methods.isValid = function() {
  if (!this.active) return false;
  if (this.validUntil && new Date() > this.validUntil) return false;
  return true;
};

// Método para verificar si el permiso concede una acción específica
FilePermissionSchema.methods.hasPermission = function(action) {
  if (!this.isValid()) return false;
  return this.actions[action] === true;
};

// Método estático para verificar permisos de forma global
FilePermissionSchema.statics.checkFilePermission = async function(fileId, userId, roleIds, action) {
  // Buscar permisos explícitos para el usuario
  const userPermission = await this.findOne({
    fileId,
    entityType: 'user',
    entityId: userId,
    active: true,
    $or: [
      { validUntil: null },
      { validUntil: { $gt: new Date() } }
    ]
  });
  
  if (userPermission && userPermission.actions[action]) {
    return true;
  }

  // Buscar permisos por roles del usuario
  if (roleIds && roleIds.length > 0) {
    const rolePermission = await this.findOne({
      fileId,
      entityType: 'role',
      entityId: { $in: roleIds },
      active: true,
      $or: [
        { validUntil: null },
        { validUntil: { $gt: new Date() } }
      ]
    });
    
    if (rolePermission && rolePermission.actions[action]) {
      return true;
    }
  }

  // No se encontraron permisos específicos
  return false;
};

module.exports = mongoose.model('FilePermission', FilePermissionSchema); 