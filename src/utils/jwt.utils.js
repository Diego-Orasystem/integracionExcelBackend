const jwt = require('jsonwebtoken');

/**
 * Genera un token JWT para la autenticación
 * @param {String} id - ID del usuario
 * @param {Object} additionalData - Datos adicionales a incluir en el token
 * @returns {String} - Token JWT generado
 */
exports.generateToken = (id, additionalData = {}) => {
  return jwt.sign(
    { id, ...additionalData },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

/**
 * Genera un token de refresco para renovar la sesión
 * @param {String} id - ID del usuario
 * @param {Object} additionalData - Datos adicionales a incluir en el token
 * @returns {String} - Token de refresco JWT generado
 */
exports.generateRefreshToken = (id, additionalData = {}) => {
  return jwt.sign(
    { id, ...additionalData },
    process.env.JWT_SECRET + '-refresh',
    { expiresIn: '7d' }
  );
};

/**
 * Verifica un token de refresco
 * @param {String} token - Token de refresco a verificar
 * @returns {Object|null} - Payload decodificado o null si es inválido
 */
exports.verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET + '-refresh');
  } catch (error) {
    return null;
  }
}; 