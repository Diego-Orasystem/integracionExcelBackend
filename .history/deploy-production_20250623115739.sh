#!/bin/bash

# Script de despliegue para producción
# Este script automatiza el proceso de despliegue en el servidor de producción

set -e

echo "🚀 Iniciando despliegue en producción..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}❌ Error: No se encontró docker-compose.prod.yml${NC}"
    echo "Asegúrate de estar en el directorio raíz del proyecto"
    exit 1
fi

# Verificar que existe el archivo .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No se encontró archivo .env${NC}"
    echo "Copiando desde template..."
    if [ -f "env.production.template" ]; then
        cp env.production.template .env
        echo -e "${YELLOW}⚠️  IMPORTANTE: Edita el archivo .env con tus configuraciones reales${NC}"
        echo "Especialmente:"
        echo "  - MONGO_ROOT_PASSWORD"
        echo "  - JWT_SECRET"
        echo "  - Configuración SMTP"
        echo ""
        read -p "Presiona Enter cuando hayas configurado .env..."
    else
        echo -e "${RED}❌ Error: No se encontró template de configuración${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Parando servicios actuales...${NC}"
docker-compose -f docker-compose.prod.yml down || true

echo -e "${GREEN}✅ Construyendo imágenes...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

echo -e "${GREEN}✅ Iniciando servicios en producción...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}✅ Esperando que los servicios estén listos...${NC}"
sleep 10

# Verificar que MongoDB esté funcionando
echo -e "${GREEN}✅ Verificando MongoDB...${NC}"
docker-compose -f docker-compose.prod.yml exec -T mongodb mongosh --eval "db.adminCommand('ping')" --quiet

# Verificar si ya hay usuarios en el sistema
echo -e "${GREEN}✅ Verificando usuarios en el sistema...${NC}"
USER_COUNT=$(docker-compose -f docker-compose.prod.yml exec -T backend node -e "
const mongoose = require('mongoose');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => User.countDocuments())
  .then(count => {
    console.log(count);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" -eq "0" ]; then
    echo -e "${YELLOW}⚠️  No hay usuarios en el sistema. Creando usuario administrador...${NC}"
    docker-compose -f docker-compose.prod.yml exec -T backend node src/scripts/init-admin.js
    echo -e "${GREEN}✅ Usuario administrador creado${NC}"
    echo -e "${GREEN}   Email: admin@sistema.com${NC}"
    echo -e "${GREEN}   Contraseña: Admin123456${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANTE: Cambia esta contraseña después del primer login${NC}"
else
    echo -e "${GREEN}✅ Sistema ya inicializado con $USER_COUNT usuario(s)${NC}"
fi

echo -e "${GREEN}✅ Verificando estado de los servicios...${NC}"
docker-compose -f docker-compose.prod.yml ps

echo -e "${GREEN}✅ Verificando logs del backend...${NC}"
docker-compose -f docker-compose.prod.yml logs backend --tail 5

echo ""
echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo ""
echo "🌐 La aplicación debería estar disponible en:"
echo "   http://tu-servidor:5000"
echo ""
echo "👤 Usuario administrador:"
echo "   Email: admin@sistema.com"
echo "   Contraseña: Admin123456"
echo ""
echo "📋 Comandos útiles:"
echo "   Ver logs:     docker-compose -f docker-compose.prod.yml logs -f"
echo "   Parar:        docker-compose -f docker-compose.prod.yml down"
echo "   Reiniciar:    docker-compose -f docker-compose.prod.yml restart"
echo "" 