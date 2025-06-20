# 🐳 Docker - Sistema de Gestión de Archivos Excel

## 🚀 Inicio Rápido

### 1. Configurar variables de entorno
```bash
# Copiar archivo de producción
cp env.production .env

# Editar variables importantes (¡OBLIGATORIO!)
# - JWT_SECRET: Cambiar por una clave segura
# - MONGO_ROOT_PASSWORD: Cambiar contraseña de MongoDB
nano .env
```

### 2. Deploy automático
```bash
# Hacer el script ejecutable (Linux/Mac)
chmod +x deploy.sh

# Deploy completo
./deploy.sh deploy

# O manualmente:
docker-compose up -d
```

### 3. Verificar funcionamiento
```bash
# Ver estado
docker-compose ps

# Probar API
curl http://localhost:5000/

# Ver logs
docker-compose logs -f backend
```

## 📁 Archivos Docker

- **`Dockerfile`** - Imagen de la aplicación Node.js
- **`docker-compose.yml`** - Orquestación de servicios
- **`.dockerignore`** - Archivos excluidos del build
- **`deploy.sh`** - Script de deploy automatizado
- **`env.production`** - Variables de entorno para producción

## 🛠️ Comandos Útiles

### Con script de deploy
```bash
./deploy.sh help              # Ver ayuda
./deploy.sh deploy            # Deploy completo
./deploy.sh deploy-nginx      # Deploy con Nginx
./deploy.sh status            # Ver estado
./deploy.sh logs backend      # Ver logs del backend
./deploy.sh backup            # Backup de BD
./deploy.sh update            # Actualizar desde git
```

### Comandos Docker directos
```bash
# Iniciar servicios
docker-compose up -d

# Parar servicios
docker-compose down

# Ver logs
docker-compose logs -f

# Rebuild
docker-compose build --no-cache

# Acceder al contenedor
docker-compose exec backend sh
```

## 🔧 Servicios

### Backend (Node.js)
- **Puerto:** 5000
- **URL:** http://localhost:5000
- **Logs:** `docker-compose logs backend`

### MongoDB
- **Puerto:** 27017
- **Usuario:** admin (configurado en .env)
- **Acceso:** `docker-compose exec mongodb mongosh`

### Nginx (Opcional)
- **Puerto:** 80, 443
- **Configuración:** `nginx/nginx.conf`
- **Activar:** `docker-compose --profile with-nginx up -d`

## 📊 Monitoreo

```bash
# Estado de contenedores
docker-compose ps

# Uso de recursos
docker stats

# Logs en tiempo real
docker-compose logs -f

# Healthcheck
docker-compose exec backend wget -q --spider http://localhost:5000/ && echo "OK"
```

## 🔄 Mantenimiento

### Backup
```bash
# Manual
docker-compose exec mongodb mongodump --out /data/backup
docker cp excel-manager-mongo:/data/backup ./backup-$(date +%Y%m%d)

# Con script
./deploy.sh backup
```

### Actualización
```bash
# Con script (recomendado)
./deploy.sh update

# Manual
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Limpieza
```bash
# Limpiar imágenes no utilizadas
docker system prune -a

# Con script
./deploy.sh cleanup
```

## 🐛 Solución de Problemas

### Puerto ocupado
```bash
# Ver qué usa el puerto 5000
sudo netstat -tulpn | grep :5000

# Cambiar puerto en .env
BACKEND_PORT=5001
```

### Problemas de permisos
```bash
# Verificar permisos uploads
docker-compose exec backend ls -la /app/uploads

# Arreglar permisos
docker-compose exec backend chown -R nextjs:nodejs /app/uploads
```

### MongoDB no inicia
```bash
# Ver logs
docker-compose logs mongodb

# Resetear volúmenes (¡CUIDADO: borra datos!)
docker-compose down -v
```

### Aplicación no responde
```bash
# Ver logs detallados
docker-compose logs backend

# Reiniciar servicio
docker-compose restart backend

# Verificar conectividad a MongoDB
docker-compose exec backend ping mongodb
```

## 🔐 Seguridad

### Variables críticas a cambiar:
- `JWT_SECRET` - Clave para tokens JWT
- `MONGO_ROOT_PASSWORD` - Contraseña de MongoDB
- `SMTP_*` - Configuración de correo si se usa

### Recomendaciones:
- Usar certificados SSL en producción
- Configurar firewall (UFW en Debian)
- Ejecutar como usuario no root
- Mantener Docker actualizado

## 📝 Notas

- Los archivos se suben a volumen persistente `uploads_data`
- Los datos de MongoDB se guardan en `mongodb_data`
- La aplicación usa usuario no root por seguridad
- Healthchecks configurados para monitoreo automático

## 🆘 Soporte

Si tienes problemas:

1. **Verifica logs:** `./deploy.sh logs`
2. **Comprueba estado:** `./deploy.sh status`
3. **Reinicia servicios:** `./deploy.sh restart`
4. **Consulta documentación:** `DEPLOY-DEBIAN.md` 