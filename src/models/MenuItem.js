const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del ítem de menú es obligatorio'],
    trim: true
  },
  url: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    default: 'circle'
  },
  permissionCode: {
    type: String,
    required: [true, 'El código de permiso es obligatorio']
  },
  order: {
    type: Number,
    default: 0
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }],
  active: {
    type: Boolean,
    default: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null // null para ítems de menú del sistema
  }
}, {
  timestamps: true
});

// Método para crear estructura de menú por defecto
MenuItemSchema.statics.createDefaultMenuItems = async function() {
  try {
    const defaultMenuItems = [
      // Ítems del menú principal
      {
        name: 'Dashboard',
        url: '/dashboard',
        icon: 'chart-pie',
        permissionCode: 'dashboard_access',
        order: 1
      },
      {
        name: 'Empresas',
        url: '/companies',
        icon: 'building',
        permissionCode: 'company_list',
        order: 2
      },
      {
        name: 'Áreas',
        url: '/areas',
        icon: 'sitemap',
        permissionCode: 'area_list',
        order: 3
      },
      {
        name: 'Usuarios',
        url: '/users',
        icon: 'users',
        permissionCode: 'user_list',
        order: 4
      },
      {
        name: 'Archivos',
        url: '/files',
        icon: 'file-alt',
        permissionCode: 'file_access',
        order: 5
      },
      {
        name: 'Configuración',
        url: '/settings',
        icon: 'cog',
        permissionCode: 'system_settings',
        order: 6
      }
    ];

    // Solo crear ítems si no existen
    for (const item of defaultMenuItems) {
      const exists = await this.findOne({
        name: item.name,
        permissionCode: item.permissionCode
      });

      if (!exists) {
        await this.create(item);
      }
    }

    console.log('Ítems de menú por defecto creados correctamente');
  } catch (error) {
    console.error('Error al crear ítems de menú por defecto:', error);
  }
};

module.exports = mongoose.model('MenuItem', MenuItemSchema); 