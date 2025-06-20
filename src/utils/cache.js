/**
 * Servicio de caché para mejorar el rendimiento del dashboard
 * 
 * Este archivo implementa una caché en memoria para evitar 
 * cálculos repetitivos en las visualizaciones del dashboard.
 */

// Almacenamiento de caché en memoria
const cacheStore = new Map();

// Tiempo de expiración predeterminado: 5 minutos
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Obtener un valor de la caché
 * @param {string} key - Clave única para identificar el valor en caché
 * @returns {any|null} - Valor almacenado o null si no existe o expiró
 */
const get = (key) => {
  if (!cacheStore.has(key)) {
    return null;
  }
  
  const cacheItem = cacheStore.get(key);
  
  // Verificar si el item ha expirado
  if (Date.now() > cacheItem.expiry) {
    cacheStore.delete(key);
    return null;
  }
  
  return cacheItem.value;
};

/**
 * Almacenar un valor en la caché
 * @param {string} key - Clave única para identificar el valor
 * @param {any} value - Valor a almacenar
 * @param {number} ttl - Tiempo de vida en milisegundos (opcional)
 */
const set = (key, value, ttl = DEFAULT_TTL) => {
  const expiry = Date.now() + ttl;
  
  cacheStore.set(key, {
    value,
    expiry
  });
};

/**
 * Eliminar un valor de la caché
 * @param {string} key - Clave del valor a eliminar
 */
const del = (key) => {
  cacheStore.delete(key);
};

/**
 * Eliminar todos los valores de la caché que coincidan con un patrón
 * @param {string} pattern - Patrón para filtrar claves (prefijo)
 */
const delPattern = (pattern) => {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(pattern)) {
      cacheStore.delete(key);
    }
  }
};

/**
 * Función para obtener datos con caché
 * @param {string} key - Clave única para identificar los datos
 * @param {Function} fetchFunction - Función para obtener los datos si no están en caché
 * @param {number} ttl - Tiempo de vida en milisegundos (opcional)
 * @returns {Promise<any>} - Datos almacenados o recuperados
 */
const withCache = async (key, fetchFunction, ttl = DEFAULT_TTL) => {
  // Intentar obtener de la caché
  const cachedData = get(key);
  if (cachedData !== null) {
    return cachedData;
  }
  
  // Si no está en caché, obtener los datos
  const freshData = await fetchFunction();
  
  // Almacenar en caché
  set(key, freshData, ttl);
  
  return freshData;
};

/**
 * Limpiar la caché completa
 */
const clear = () => {
  cacheStore.clear();
};

module.exports = {
  get,
  set,
  del,
  delPattern,
  withCache,
  clear
}; 