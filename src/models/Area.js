const mongoose = require('mongoose');

const AreaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del área es obligatorio'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'El área debe pertenecer a una empresa']
  },
  responsibleUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: 'folder'
  },
  color: {
    type: String,
    default: '#3498db'
  },
  order: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  expectedFiles: {
    type: Number,
    default: 0,
    min: 0
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder'
  },
  excelTemplate: {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File'
    },
    name: String,
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  defaultFileName: {
    type: String,
    trim: true
  },
  isDefaultFileRequired: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Pre-save hook para asegurar que cada área tenga un color diferente si no se especifica
AreaSchema.pre('save', async function(next) {
  if (!this.isModified('color') && !this.isDefault) {
    // Array de colores predefinidos
    const colors = [
      '#3498db', // Azul
      '#2ecc71', // Verde
      '#e74c3c', // Rojo
      '#f39c12', // Naranja
      '#9b59b6', // Púrpura
      '#1abc9c', // Turquesa
      '#d35400', // Naranja oscuro
      '#34495e', // Azul oscuro
      '#7f8c8d', // Gris
      '#c0392b'  // Rojo oscuro
    ];
    
    try {
      // Contar áreas existentes para esta compañía
      const areaCount = await mongoose.model('Area').countDocuments({ 
        companyId: this.companyId,
        _id: { $ne: this._id }
      });
      
      // Asignar un color del array según la cantidad de áreas existentes
      this.color = colors[areaCount % colors.length];
    } catch (err) {
      // En caso de error, mantener el color por defecto
      console.error('Error al asignar color al área:', err);
    }
  }
  next();
});

module.exports = mongoose.model('Area', AreaSchema); 