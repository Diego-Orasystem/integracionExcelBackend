const mongoose = require('mongoose');

const SftpSyncJobSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'El trabajo debe estar asociado a una empresa']
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['scheduled', 'manual'],
    default: 'manual'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  results: {
    filesAdded: {
      type: Number,
      default: 0
    },
    filesUpdated: {
      type: Number,
      default: 0
    },
    filesFailed: {
      type: Number,
      default: 0
    },
    totalSizeProcessed: {
      type: Number,
      default: 0
    }
  },
  errors: [{
    file: String,
    error: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('SftpSyncJob', SftpSyncJobSchema); 