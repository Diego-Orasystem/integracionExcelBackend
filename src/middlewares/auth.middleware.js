const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('./async.middleware');

/**
 * Middleware de autenticación
 * Verifica el token JWT y añade el usuario a la solicitud
 */
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  
  console.log('Verificando autenticación...');
  console.log('URL solicitada:', req.originalUrl);
  console.log('Método HTTP:', req.method);
  console.log('Headers completos:', JSON.stringify(req.headers));
  
  // Verificar si hay token en los headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Extraer token del header Authorization
    token = req.headers.authorization.split(' ')[1];
    console.log('Token extraído de Authorization header');
  } else if (req.cookies && req.cookies.token) {
    // Si no, verificar en cookies
    token = req.cookies.token;
    console.log('Token extraído de cookies');
  }

  // Verificar si el token existe
  if (!token) {
    console.log('No se encontró token de autenticación');
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'No está autorizado para acceder a este recurso'
      }
    });
  }

  try {
    // Verificar token
    console.log('Verificando token JWT...');
    console.log('Longitud del token:', token.length);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    console.log('Token verificado para usuario ID:', decoded.id);
    console.log('Datos del token:', JSON.stringify(decoded));
    
    // Añadir usuario al request
    console.log('Buscando usuario en la base de datos con ID:', decoded.id);
    const user = await User.findById(decoded.id);
    
    // Si no existe el usuario
    if (!user) {
      console.log(`Usuario con ID ${decoded.id} no encontrado en la base de datos`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'El usuario ya no existe en el sistema'
        }
      });
    }
    
    if (!user.active) {
      console.log(`Usuario ${user._id} (${user.email}) está inactivo`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Usuario inactivo'
        }
      });
    }
    
    console.log(`Usuario autenticado: ${user._id} (${user.email}), Roles: ${user.roles.join(', ')}, Compañía: ${user.companyId}`);
    
    // Para mantener compatibilidad con el código existente, agregamos un campo role virtual
    // Este representa el rol principal (el primero en la lista)
    if (user.roles && user.roles.length > 0) {
      user.role = user.roles[0];
      console.log(`Rol principal asignado: ${user.role}`);
    } else {
      user.role = 'user'; // Valor por defecto
      console.log('No se encontraron roles, asignando rol por defecto: user');
    }
    
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Error verificando token:', error.message);
    console.error('Tipo de error:', error.name);
    console.error('Stack trace:', error.stack);
    
    // Información adicional sobre el error
    let errorMessage = 'Token inválido o expirado';
    let errorCode = 'INVALID_TOKEN';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'El token ha expirado';
      errorCode = 'TOKEN_EXPIRED';
      console.error('Fecha de expiración del token:', error.expiredAt);
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Token JWT malformado';
      errorCode = 'MALFORMED_TOKEN';
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: error.message
      }
    });
  }
});

/**
 * Middleware de autenticación opcional
 * Verifica el token JWT si existe, pero no devuelve error si no hay token
 */
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  console.log('Verificando autenticación opcional...');
  
  // Verificar si hay token en los headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Extraer token del header Authorization
    token = req.headers.authorization.split(' ')[1];
    console.log('Token extraído de Authorization header');
  } else if (req.cookies && req.cookies.token) {
    // Si no, verificar en cookies
    token = req.cookies.token;
    console.log('Token extraído de cookies');
  }

  // Si no hay token, continuar sin usuario autenticado
  if (!token) {
    console.log('No se encontró token de autenticación, continuando como anónimo');
    return next();
  }

  try {
    // Verificar token
    console.log('Verificando token JWT...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    console.log('Token verificado para usuario ID:', decoded.id);
    
    // Añadir usuario al request
    const user = await User.findById(decoded.id);
    
    // Si no existe el usuario o está inactivo, continuar sin usuario
    if (!user || !user.active) {
      console.log(`Usuario inválido o inactivo, continuando como anónimo`);
      return next();
    }
    
    console.log(`Usuario autenticado: ${user._id} (${user.email}), Roles: ${user.roles.join(', ')}, Compañía: ${user.companyId}`);
    
    // Para mantener compatibilidad con el código existente
    if (user.roles && user.roles.length > 0) {
      user.role = user.roles[0];
    } else {
      user.role = 'user';
    }
    
    req.user = user;
    
    next();
  } catch (error) {
    // Si hay un error con el token, continuar sin usuario autenticado
    console.error('Error verificando token:', error.message);
    return next();
  }
});

// Middleware para restringir roles
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Verificar si alguno de los roles del usuario está permitido
    const hasPermission = req.user.roles.some(role => allowedRoles.includes(role));
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para acceder a esta ruta'
        }
      });
    }
    next();
  };
};

// Middleware para verificar pertenencia a empresa
exports.sameCompany = (userField = 'user.companyId', resourceField = 'companyId') => {
  return (req, res, next) => {
    // Si es admin, permitir acceso
    if (req.user.roles.includes('admin')) {
      return next();
    }

    // Obtener IDs
    const userCompanyId = req.user.companyId.toString();
    const resourceCompanyId = req.params[resourceField] || 
                             (req.body[resourceField] && req.body[resourceField].toString());

    // Si no hay companyId en el recurso o coincide, permitir
    if (!resourceCompanyId || userCompanyId === resourceCompanyId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'No tienes permisos para acceder a recursos de otra empresa'
      }
    });
  };
}; 