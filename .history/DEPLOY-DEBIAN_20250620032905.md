# 🚀 Guía de Deploy en Debian - Sistema de Gestión de Archivos Excel

Esta guía te ayudará a desplegar la aplicación dockerizada en una máquina Debian.

## 📋 Prerrequisitos

### 1. Actualizar el sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instalar Docker
```bash
# Instalar dependencias
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Agregar la clave GPG oficial de Docker
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Agregar el repositorio de Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Actualizar e instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Agregar usuario al grupo docker (opcional, para no usar sudo)
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Instalar Docker Compose
```bash
# Descargar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Dar permisos de ejecución
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalación
docker-compose --version
```

### 4. Instalar Git (si no está instalado)
```bash
sudo apt install -y git
```

## 🔧 Configuración del Servidor

### 1. Configurar Firewall (UFW)
```bash
# Habilitar UFW
sudo ufw enable

# Permitir SSH
sudo ufw allow ssh

# Permitir puertos de la aplicación
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 5000/tcp    # API Backend (opcional, solo si no usas nginx)

# Verificar estado
sudo ufw status
```

### 2. Crear usuario para la aplicación (recomendado)
```bash
# Crear usuario
sudo adduser excelapp

# Agregar al grupo docker
sudo usermod -aG docker excelapp

# Cambiar a ese usuario
sudo su - excelapp
```

## 📦 Despliegue de la Aplicación

### 1. Clonar el repositorio
```bash
# Ir al directorio home del usuario
cd ~

# Clonar el repositorio
git clone <URL_DE_TU_REPOSITORIO> excel-manager
cd excel-manager
```

### 2. Configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp env.production .env

# Editar las variables de entorno
nano .env
```

**⚠️ IMPORTANTE: Edita las siguientes variables:**
- `JWT_SECRET`: Cambia por una clave secreta fuerte
- `MONGO_ROOT_PASSWORD`: Cambia la contraseña de MongoDB
- Configura SMTP si necesitas envío de correos

### 3. Construir y ejecutar los contenedores
```bash
# Construir las imágenes
docker-compose build

# Ejecutar en segundo plano
docker-compose up -d

# Verificar que los contenedores están corriendo
docker-compose ps
```

### 4. Verificar el despliegue
```bash
# Ver logs de la aplicación
docker-compose logs backend

# Ver logs de MongoDB
docker-compose logs mongodb

# Probar la API
curl http://localhost:5000/

# Deberías ver: {"message":"API del Sistema de Gestión de Archivos Excel"}
```

## 🔒 Configuración de Nginx (Opcional pero Recomendado)

### 1. Crear directorio de configuración
```bash
mkdir -p nginx/ssl
```

### 2. Crear configuración de Nginx
```bash
nano nginx/nginx.conf
```

Contenido del archivo:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:5000;
    }

    server {
        listen 80;
        server_name tu-dominio.com;  # Cambia por tu dominio
        
        # Redirigir HTTP a HTTPS (opcional)
        # return 301 https://$server_name$request_uri;
        
        client_max_body_size 50M;
        
        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /uploads/ {
            alias /var/www/uploads/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Configuración HTTPS (descomenta si tienes certificados SSL)
    # server {
    #     listen 443 ssl;
    #     server_name tu-dominio.com;
    #     
    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     
    #     client_max_body_size 50M;
    #     
    #     location / {
    #         proxy_pass http://backend;
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #     }
    #     
    #     location /uploads/ {
    #         alias /var/www/uploads/;
    #         expires 1y;
    #         add_header Cache-Control "public, immutable";
    #     }
    # }
}
```

### 3. Ejecutar con Nginx
```bash
# Ejecutar con el perfil de nginx
docker-compose --profile with-nginx up -d

# Verificar que nginx está corriendo
docker-compose ps
```

## 🔄 Comandos de Gestión

### Comandos básicos
```bash
# Iniciar servicios
docker-compose up -d

# Parar servicios
docker-compose down

# Reiniciar servicios
docker-compose restart

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend

# Acceder al contenedor de la aplicación
docker-compose exec backend sh

# Acceder a MongoDB
docker-compose exec mongodb mongosh
```

### Actualizar la aplicación
```bash
# Obtener últimos cambios
git pull origin main

# Reconstruir y reiniciar
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup de la base de datos
```bash
# Crear backup
docker-compose exec mongodb mongodump --out /data/backup

# Copiar backup al host
docker cp excel-manager-mongo:/data/backup ./mongodb-backup-$(date +%Y%m%d)
```

### Restaurar base de datos
```bash
# Copiar backup al contenedor
docker cp ./mongodb-backup-20240101 excel-manager-mongo:/data/restore

# Restaurar
docker-compose exec mongodb mongorestore /data/restore
```

## 📊 Monitoreo y Logs

### Ver estado de los servicios
```bash
# Estado de contenedores
docker-compose ps

# Uso de recursos
docker stats

# Logs de sistema
sudo journalctl -u docker.service
```

### Configurar rotación de logs
```bash
# Crear archivo de configuración
sudo nano /etc/docker/daemon.json
```

Contenido:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Reiniciar Docker
sudo systemctl restart docker
```

## 🔧 Solución de Problemas

### Problemas comunes

1. **Puerto 5000 ocupado:**
   ```bash
   # Ver qué proceso usa el puerto
   sudo netstat -tulpn | grep :5000
   
   # Cambiar puerto en .env
   BACKEND_PORT=5001
   ```

2. **Problemas de permisos con uploads:**
   ```bash
   # Verificar permisos del volumen
   docker-compose exec backend ls -la /app/uploads
   
   # Arreglar permisos si es necesario
   docker-compose exec backend chown -R nextjs:nodejs /app/uploads
   ```

3. **MongoDB no inicia:**
   ```bash
   # Ver logs de MongoDB
   docker-compose logs mongodb
   
   # Limpiar volúmenes si es necesario (¡CUIDADO: borra datos!)
   docker-compose down -v
   ```

4. **Problemas de memoria:**
   ```bash
   # Ver uso de memoria
   free -h
   
   # Limpiar imágenes no utilizadas
   docker system prune -a
   ```

## 🔐 Seguridad Adicional

### 1. Configurar fail2ban
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 2. Configurar actualizaciones automáticas
```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. Configurar certificados SSL con Let's Encrypt
```bash
# Instalar certbot
sudo apt install -y certbot

# Obtener certificado (reemplaza tu-dominio.com)
sudo certbot certonly --standalone -d tu-dominio.com

# Los certificados se guardan en /etc/letsencrypt/live/tu-dominio.com/
```

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker-compose logs`
2. Verifica la configuración: `docker-compose config`
3. Comprueba el estado: `docker-compose ps`
4. Reinicia los servicios: `docker-compose restart`

---

## 🎉 ¡Listo!

Tu aplicación debería estar corriendo en:
- **API Backend:** `http://tu-servidor:5000`
- **Con Nginx:** `http://tu-servidor` (puerto 80)

¡Tu Sistema de Gestión de Archivos Excel está listo para usar! 🚀 