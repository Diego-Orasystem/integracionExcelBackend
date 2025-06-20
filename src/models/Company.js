const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre de la empresa es obligatorio'],
    trim: true
  },
  emailDomain: {
    type: String,
    required: [true, 'El dominio de correo de la empresa es obligatorio'],
    trim: true,
    lowercase: true,
    match: [/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, 'Dominio de correo inválido']
  },
  description: {
    type: String,
    trim: true
  },
  logo: {
    type: String // URL del logo
  },
  sftp: {
    host: String,
    port: {
      type: Number,
      default: 22
    },
    username: String,
    password: String, // Debería almacenarse encriptado
    rootDirectory: String,
    enabled: {
      type: Boolean,
      default: false
    },
    targetFolder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder'
    },
    filePattern: {
      type: String,
      default: "*.xlsx"
    },
    syncSchedule: String, // formato cron
    deleteAfterSync: {
      type: Boolean,
      default: false
    }
  },
  settings: {
    maxStorage: {
      type: Number,
      default: 1024 // en MB
    },
    allowedFileTypes: {
      type: [String],
      default: ['.xlsx', '.xls']
    }
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', CompanySchema); 