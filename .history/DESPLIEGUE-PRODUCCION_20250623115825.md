# 🚀 Guía de Despliegue en Producción

Esta guía te ayudará a desplegar la aplicación en el servidor de producción con las correcciones aplicadas para el problema de autenticación MongoDB.

## 📋 Requisitos Previos

- Servidor con Docker y Docker Compose instalados
- Acceso SSH al servidor de producción
- Git instalado en el servidor

## 🔧 Pasos para el Despliegue

### 1. Conectar al servidor de producción

```bash
ssh usuario@tu-servidor-produccion
```

### 2. Clonar o actualizar el repositorio

```bash
# Si es la primera vez
git clone [URL_DEL_REPOSITORIO] /opt/excel-manager
cd /opt/excel-manager

# Si ya existe el proyecto
cd /opt/excel-manager
git pull origin main
```

### 3. Configurar variables de entorno

```bash
# Copiar el template de configuración
cp env.production.template .env

# Editar con las configuraciones reales
nano .env
```

**⚠️ IMPORTANTE:** Configura estos valores en el archivo `.env`:

```bash
# Cambia esta contraseña por una segura
MONGO_ROOT_PASSWORD=TuPasswordMongoDB_Super_Segura_123!

# Cambia esta clave JWT por una única
JWT_SECRET=tu-clave-jwt-super-secreta-y-unica-para-produccion

# Configura el correo SMTP real
SMTP_HOST=smtp.gmail.com
SMTP_USER=tu_correo_real@gmail.com
SMTP_PASS=tu_password_de_aplicacion_gmail
EMAIL_FROM=tu_correo_real@gmail.com
```

### 4. Ejecutar el despliegue

```bash
# Dar permisos de ejecución al script
chmod +x deploy-production.sh

# Ejecutar el despliegue
./deploy-production.sh
```

### 5. Verificar el despliegue

El script automáticamente:
- ✅ Para servicios existentes
- ✅ Construye las imágenes
- ✅ Inicia los servicios con autenticación MongoDB
- ✅ Verifica que MongoDB funcione
- ✅ Crea usuario administrador si no existe
- ✅ Muestra el estado final

## 🔐 Credenciales Iniciales

Después del despliegue exitoso:

- **URL:** `http://tu-servidor:5000`
- **Usuario:** `admin@sistema.com`
- **Contraseña:** `Admin123456`

**⚠️ IMPORTANTE:** Cambia esta contraseña inmediatamente después del primer login.

## 📊 Comandos de Gestión

```bash
# Ver logs en tiempo real
docker-compose -f docker-compose.prod.yml logs -f

# Parar servicios
docker-compose -f docker-compose.prod.yml down

# Reiniciar servicios
docker-compose -f docker-compose.prod.yml restart

# Ver estado de servicios
docker-compose -f docker-compose.prod.yml ps

# Ejecutar comandos en el backend
docker-compose -f docker-compose.prod.yml exec backend node src/scripts/init-admin.js
```

## 🔧 Resolución de Problemas

### Si hay errores de autenticación MongoDB:

1. Verifica que las variables `MONGO_ROOT_USER` y `MONGO_ROOT_PASSWORD` estén correctas
2. Asegúrate de que la `MONGODB_URI` incluya las credenciales:
   ```
   MONGODB_URI=mongodb://admin:TuPassword@mongodb:27017/excelmanager?authSource=admin
   ```

### Si necesitas recrear la base de datos:

```bash
# Parar servicios
docker-compose -f docker-compose.prod.yml down

# Eliminar volúmenes (⚠️ ESTO BORRA TODOS LOS DATOS)
docker volume rm integracionexcelbackend_mongodb_data
docker volume rm integracionexcelbackend_mongodb_config

# Reiniciar servicios
./deploy-production.sh
```

### Si necesitas acceso directo a MongoDB:

```bash
# Conectar a MongoDB con credenciales
docker-compose -f docker-compose.prod.yml exec mongodb mongosh \
  --authenticationDatabase admin \
  -u admin \
  -p TuPassword \
  excelmanager
```

## 🔒 Seguridad en Producción

1. **Cambia todas las contraseñas por defecto**
2. **Configura HTTPS con certificados SSL**
3. **Configura un firewall apropiado**
4. **Realiza backups regulares de la base de datos**
5. **Monitorea los logs regularmente**

## 📝 Notas Técnicas

- **Problema resuelto:** Error de autenticación MongoDB `Command find requires authentication`
- **Solución aplicada:** Configuración correcta de credenciales MongoDB en producción
- **Campo agregado:** `emailDomain` en el modelo Company (requerido)
- **Script mejorado:** `init-admin.js` incluye `emailDomain: 'sistema.com'`

## 🆘 Soporte

Si encuentras problemas durante el despliegue:

1. Revisa los logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verifica la configuración del archivo `.env`
3. Asegúrate de que todos los servicios estén corriendo: `docker-compose -f docker-compose.prod.yml ps` 