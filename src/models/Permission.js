const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del permiso es obligatorio'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    required: [true, 'El código del permiso es obligatorio'],
    unique: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['area', 'subarea', 'file', 'user', 'company', 'system'],
    required: [true, 'La categoría del permiso es obligatoria']
  },
  actions: [{
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'list', 'download', 'upload', 'assign']
  }],
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Método para verificar si un permiso contiene una acción específica
PermissionSchema.methods.hasAction = function(action) {
  return this.actions.includes(action);
};

module.exports = mongoose.model('Permission', PermissionSchema); 