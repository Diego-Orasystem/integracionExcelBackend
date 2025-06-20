/**
 * Middleware para manejar excepciones en funciones asíncronas
 * Envuelve los controladores async para evitar try/catch repetitivos
 * @param {Function} fn - Función asíncrona a envolver
 * @returns {Function} - Middleware con manejo de errores
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler; 