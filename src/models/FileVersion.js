const mongoose = require('mongoose');

const FileVersionSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: [true, 'La versión debe estar asociada a un archivo']
  },
  version: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  storageLocation: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Se debe especificar quién subió esta versión']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FileVersion', FileVersionSchema); 