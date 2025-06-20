const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El log debe estar asociado a un usuario']
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'El log debe estar asociado a una empresa']
  },
  action: {
    type: String,
    required: [true, 'Se debe especificar la acción realizada'],
    enum: [
      'login', 'logout', 'create_user', 'update_user', 'delete_user',
      'activate_user', 'deactivate_user',
      'create_folder', 'update_folder', 'delete_folder',
      'upload_file', 'download_file', 'update_file', 'delete_file',
      'upload_file_version', 'download_file_version', 'revert_file_version', 'create_test_version',
      'sftp_sync', 'sftp_config', 'sftp_error',
      'create_company', 'update_company', 'delete_company',
      'create_permission', 'update_permission', 'delete_permission', 'create_default_permissions',
      'create_role', 'update_role', 'delete_role', 'assign_role',
      'create_area', 'update_area', 'delete_area',
      'create_subarea', 'update_subarea', 'delete_subarea', 'create_default_subareas',
      'menu_access', 'create_menu_item', 'update_menu_item', 'delete_menu_item', 'create_default_menu_items',
      'system_init',
      'request_login_code', 'login_with_code', 'dev_login',
      'register',
      'other'
    ]
  },
  entityType: {
    type: String,
    enum: ['file', 'folder', 'user', 'company', 'system', 'permission', 'role', 'user_role', 'area', 'subarea', 'menu', 'file_version'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  details: {
    ip: String,
    userAgent: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    message: String,
    count: Number,
    code: String,
    category: String,
    active: Boolean,
    name: String,
    isSystem: Boolean,
    areaId: mongoose.Schema.Types.ObjectId,
    folderId: mongoose.Schema.Types.ObjectId,
    fileName: String,
    fileSize: Number,
    version: Number,
    fileId: mongoose.Schema.Types.ObjectId,
    previousVersionId: mongoose.Schema.Types.ObjectId,
    revertedToVersion: Number,
    newVersion: Number,
    timestamp: Date,
    itemCount: Number,
    loginMethod: String,
    devMode: Boolean
  }
}, {
  timestamps: true
});

// Crear índices para búsquedas eficientes
LogSchema.index({ companyId: 1, createdAt: -1 });
LogSchema.index({ userId: 1, createdAt: -1 });
LogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('Log', LogSchema); 