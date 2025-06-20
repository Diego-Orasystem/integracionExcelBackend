const User = require('../models/User');
const Role = require('../models/Role');
const MenuItem = require('../models/MenuItem');
const Log = require('../models/Log');
const UserRole = require('../models/UserRole');
const Permission = require('../models/Permission');

// @desc    Obtener menú según permisos del usuario
// @route   GET /api/menu
// @access  Privado
exports.getUserMenu = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Obtener usuario
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado'
        }
      });
    }
    
    // Obtener los roles del usuario a través de UserRole
    const userRoles = await UserRole.find({
      userId: userId,
      active: true
    }).populate({
      path: 'roleId',
      populate: {
        path: 'permissions'
      }
    });
    
    // Extraer todos los códigos de permisos que tiene el usuario
    const userPermissions = new Set();
    
    // Añadir permisos basados en los roles del usuario
    for (const roleName of user.roles) {
      const rolePermissions = await Role.findOne({ code: roleName }).populate('permissions');
      if (rolePermissions) {
        rolePermissions.permissions.forEach(permission => {
          if (permission.active) {
            userPermissions.add(permission.code);
          }
        });
      }
    }
    
    // Añadir permisos de los roles adicionales asignados al usuario
    userRoles.forEach(userRole => {
      if (userRole.roleId && userRole.roleId.active) {
        userRole.roleId.permissions.forEach(permission => {
          if (permission.active) {
            userPermissions.add(permission.code);
          }
        });
      }
    });
    
    // Filtrar ítems de menú basados en permisos del usuario y su compañía
    const filter = {
      active: true,
      $or: [
        { companyId: null }, // Ítems de menú del sistema
        { companyId: req.user.companyId } // Ítems específicos de la compañía
      ]
    };
    
    // Obtener todos los ítems de menú
    const allMenuItems = await MenuItem.find(filter).sort({ order: 1 });
    
    // Filtrar ítems de menú según permisos del usuario
    const userMenu = allMenuItems.filter(item => 
      userPermissions.has(item.permissionCode)
    );
    
    // Construir estructura jerárquica
    const rootMenuItems = userMenu.filter(item => !item.parent);
    
    // Función recursiva para construir árbol de menú
    const buildMenuTree = (items) => {
      return items.map(item => {
        const menuItem = item.toObject();
        const children = userMenu.filter(child => 
          child.parent && child.parent.toString() === item._id.toString()
        );
        
        if (children.length > 0) {
          menuItem.children = buildMenuTree(children);
        } else {
          menuItem.children = [];
        }
        
        return menuItem;
      });
    };
    
    const menuTree = buildMenuTree(rootMenuItems);
    
    // Registrar log de acceso al menú
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'menu_access',
      entityType: 'menu',
      details: {
        timestamp: new Date(),
        itemCount: menuTree.length
      }
    });
    
    res.status(200).json({
      success: true,
      data: menuTree
    });
  } catch (error) {
    console.error('Error al obtener menú del usuario:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener el menú'
      }
    });
  }
};

// @desc    Crear ítem de menú
// @route   POST /api/menu
// @access  Privado (Admin)
exports.createMenuItem = async (req, res) => {
  try {
    // Verificar permisos (solo admin)
    if (!req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para crear ítems de menú'
        }
      });
    }
    
    const { name, url, icon, permissionCode, parent, order, companyId } = req.body;
    
    // Validar nombre y código de permiso
    if (!name || !permissionCode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'El nombre y código de permiso son obligatorios'
        }
      });
    }
    
    // Verificar que el permiso existe
    const permissionExists = await Permission.findOne({ code: permissionCode });
    
    if (!permissionExists) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PERMISSION',
          message: 'El código de permiso especificado no existe'
        }
      });
    }
    
    // Verificar que el padre existe si se especifica
    if (parent) {
      const parentExists = await MenuItem.findById(parent);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARENT',
            message: 'El ítem de menú padre no existe'
          }
        });
      }
    }
    
    // Crear ítem de menú
    const menuItem = await MenuItem.create({
      name,
      url,
      icon,
      permissionCode,
      parent,
      order,
      companyId: companyId || null,
      active: true
    });
    
    // Si es un ítem hijo, actualizar la lista de hijos del padre
    if (parent) {
      await MenuItem.findByIdAndUpdate(parent, {
        $push: { children: menuItem._id }
      });
    }
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_menu_item',
      entityType: 'menu',
      entityId: menuItem._id,
      details: {
        name: menuItem.name,
        permissionCode: menuItem.permissionCode
      }
    });
    
    res.status(201).json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    console.error('Error al crear ítem de menú:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear el ítem de menú'
      }
    });
  }
};

// @desc    Actualizar ítem de menú
// @route   PUT /api/menu/:id
// @access  Privado (Admin)
exports.updateMenuItem = async (req, res) => {
  try {
    // Verificar permisos (solo admin)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para actualizar ítems de menú'
        }
      });
    }
    
    const { name, url, icon, permissionCode, parent, order, active } = req.body;
    
    // Buscar ítem de menú
    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MENU_ITEM_NOT_FOUND',
          message: 'Ítem de menú no encontrado'
        }
      });
    }
    
    // Verificar que el permiso existe si se cambia
    if (permissionCode && permissionCode !== menuItem.permissionCode) {
      const permissionExists = await Permission.findOne({ code: permissionCode });
      
      if (!permissionExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERMISSION',
            message: 'El código de permiso especificado no existe'
          }
        });
      }
    }
    
    // Verificar que el padre existe si se cambia
    if (parent && parent !== menuItem.parent?.toString()) {
      // Si tenía un padre anterior, remover este ítem de su lista de hijos
      if (menuItem.parent) {
        await MenuItem.findByIdAndUpdate(menuItem.parent, {
          $pull: { children: menuItem._id }
        });
      }
      
      // Verificar que el nuevo padre existe
      const parentExists = await MenuItem.findById(parent);
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARENT',
            message: 'El ítem de menú padre no existe'
          }
        });
      }
      
      // Añadir este ítem a la lista de hijos del nuevo padre
      await MenuItem.findByIdAndUpdate(parent, {
        $push: { children: menuItem._id }
      });
    } else if (parent === null && menuItem.parent) {
      // Si se está removiendo el padre, quitar este ítem de su lista de hijos
      await MenuItem.findByIdAndUpdate(menuItem.parent, {
        $pull: { children: menuItem._id }
      });
    }
    
    // Actualizar ítem de menú
    const updateData = {
      name: name || menuItem.name,
      url: url !== undefined ? url : menuItem.url,
      icon: icon || menuItem.icon,
      permissionCode: permissionCode || menuItem.permissionCode,
      parent: parent !== undefined ? parent : menuItem.parent,
      order: order !== undefined ? order : menuItem.order,
      active: active !== undefined ? active : menuItem.active
    };
    
    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'update_menu_item',
      entityType: 'menu',
      entityId: updatedMenuItem._id,
      details: {
        name: updatedMenuItem.name,
        active: updatedMenuItem.active
      }
    });
    
    res.status(200).json({
      success: true,
      data: updatedMenuItem
    });
  } catch (error) {
    console.error('Error al actualizar ítem de menú:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar el ítem de menú'
      }
    });
  }
};

// @desc    Eliminar ítem de menú
// @route   DELETE /api/menu/:id
// @access  Privado (Admin)
exports.deleteMenuItem = async (req, res) => {
  try {
    // Verificar permisos (solo admin)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para eliminar ítems de menú'
        }
      });
    }
    
    // Buscar ítem de menú
    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MENU_ITEM_NOT_FOUND',
          message: 'Ítem de menú no encontrado'
        }
      });
    }
    
    // Verificar si tiene hijos
    if (menuItem.children && menuItem.children.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_CHILDREN',
          message: 'No se puede eliminar un ítem de menú con hijos. Elimine primero los hijos o reasígnelos.'
        }
      });
    }
    
    // Si tiene padre, remover este ítem de su lista de hijos
    if (menuItem.parent) {
      await MenuItem.findByIdAndUpdate(menuItem.parent, {
        $pull: { children: menuItem._id }
      });
    }
    
    // Eliminar ítem de menú
    await MenuItem.findByIdAndDelete(req.params.id);
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'delete_menu_item',
      entityType: 'menu',
      details: {
        name: menuItem.name,
        id: menuItem._id
      }
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error al eliminar ítem de menú:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar el ítem de menú'
      }
    });
  }
};

// @desc    Crear ítems de menú por defecto
// @route   POST /api/menu/default
// @access  Privado (Admin)
exports.createDefaultMenuItems = async (req, res) => {
  try {
    // Verificar permisos (solo admin)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para crear ítems de menú por defecto'
        }
      });
    }
    
    // Llamar al método estático del modelo para crear ítems por defecto
    await MenuItem.createDefaultMenuItems();
    
    // Obtener los ítems creados
    const menuItems = await MenuItem.find().sort({ order: 1 });
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_default_menu_items',
      entityType: 'menu',
      details: {
        count: menuItems.length
      }
    });
    
    res.status(200).json({
      success: true,
      data: menuItems
    });
  } catch (error) {
    console.error('Error al crear ítems de menú por defecto:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear los ítems de menú por defecto'
      }
    });
  }
}; 