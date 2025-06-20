const mongoose = require('mongoose');
const fs = require('fs');

const FileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del archivo es obligatorio'],
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    required: [true, 'El archivo debe estar en una carpeta']
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'El archivo debe pertenecer a una empresa']
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  extension: {
    type: String,
    required: true
  },
  storageLocation: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Se debe especificar quién subió el archivo']
  },
  uploadType: {
    type: String,
    enum: ['manual', 'sftp', 'api'],
    default: 'manual'
  },
  version: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['pendiente', 'procesando', 'procesado', 'error'],
    default: 'pendiente'
  },
  processingDetails: {
    startDate: Date,
    endDate: Date,
    duration: Number, // en milisegundos
    errorMessage: String,
    processingNotes: String
  },
  metadata: {
    sheets: [String],
    rowCount: Number,
    columnCount: Number
  },
  tags: [String]
}, {
  timestamps: true
});

// Hook pre-save para logging
FileSchema.pre('save', function(next) {
  console.log('=== PRE SAVE FILE MODEL ===');
  console.log('Guardando archivo en DB:', {
    id: this._id,
    name: this.name,
    folderId: this.folderId,
    companyId: this.companyId,
    storageLocation: this.storageLocation,
    isNew: this.isNew
  });
  
  // Verificar que el archivo existe físicamente
  if (this.storageLocation) {
    try {
      if (fs.existsSync(this.storageLocation)) {
        const stats = fs.statSync(this.storageLocation);
        console.log(`Archivo físico verificado: ${this.storageLocation} (${stats.size} bytes)`);
      } else {
        console.warn(`ADVERTENCIA: El archivo físico no existe en: ${this.storageLocation}`);
      }
    } catch (err) {
      console.error(`Error verificando archivo físico: ${err.message}`);
    }
  }
  
  next();
});

// Hook post-save para logging
FileSchema.post('save', function(doc) {
  console.log('=== POST SAVE FILE MODEL ===');
  console.log('Archivo guardado con éxito:', {
    id: doc._id,
    name: doc.name,
    folderId: doc.folderId,
    companyId: doc.companyId
  });
});

// Hook para el find
FileSchema.pre('find', function() {
  console.log('=== FIND FILES ===');
  console.log('Query de búsqueda:', this.getQuery());
});

// Hook para el findOne
FileSchema.pre('findOne', function() {
  console.log('=== FIND ONE FILE ===');
  console.log('Query de búsqueda:', this.getQuery());
});

module.exports = mongoose.model('File', FileSchema); 