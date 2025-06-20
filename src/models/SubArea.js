const mongoose = require('mongoose');

const SubAreaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre de la subárea es obligatorio'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  areaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Area',
    required: [true, 'La subárea debe pertenecer a un área']
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'La subárea debe pertenecer a una empresa']
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
    default: 'subfolder'
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
  requiredFiles: [{
    name: String,
    description: String,
    fileType: {
      type: String,
      default: '.xlsx'
    },
    dueDay: {
      type: Number,
      min: 1,
      max: 31
    },
    required: {
      type: Boolean,
      default: true
    }
  }],
  sampleFiles: [{
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File'
    },
    name: String,
    description: String,
    isExcelTemplate: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
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

// Pre-save hook para complementar información
SubAreaSchema.pre('save', async function(next) {
  try {
    // Si es una nueva subárea y no tiene responsable pero el área sí,
    // heredar el responsable del área
    if (this.isNew && !this.responsibleUserId && this.areaId) {
      const Area = mongoose.model('Area');
      const parentArea = await Area.findById(this.areaId);
      if (parentArea && parentArea.responsibleUserId) {
        this.responsibleUserId = parentArea.responsibleUserId;
      }
    }
  } catch (err) {
    console.error('Error en pre-save de subárea:', err);
  }
  next();
});

module.exports = mongoose.model('SubArea', SubAreaSchema); 