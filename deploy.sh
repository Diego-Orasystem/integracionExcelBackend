#!/bin/bash

# Script de Deploy Automatizado para Sistema de Gestión de Archivos Excel
# Para usar: ./deploy.sh [comando]

set -e  # Salir si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Verificar si Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker no está instalado. Por favor instala Docker primero."
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose no está instalado. Por favor instala Docker Compose primero."
    fi
    
    log "Docker y Docker Compose están instalados ✓"
}

# Verificar variables de entorno
check_env() {
    if [ ! -f ".env" ]; then
        if [ -f "env.production" ]; then
            log "Copiando env.production a .env"
            cp env.production .env
        else
            error "No se encontró archivo .env ni env.production. Crea uno basado en env.ejemplo"
        fi
    fi
    
    log "Archivo .env encontrado ✓"
}

# Construir imágenes
build() {
    log "Construyendo imágenes Docker..."
    docker-compose build --no-cache
    log "Imágenes construidas exitosamente ✓"
}

# Iniciar servicios
start() {
    log "Iniciando servicios..."
    docker-compose up -d
    
    # Esperar a que los servicios estén listos
    log "Esperando a que los servicios estén listos..."
    sleep 10
    
    # Verificar estado
    docker-compose ps
    
    log "Servicios iniciados ✓"
}

# Parar servicios
stop() {
    log "Deteniendo servicios..."
    docker-compose down
    log "Servicios detenidos ✓"
}

# Reiniciar servicios
restart() {
    log "Reiniciando servicios..."
    docker-compose restart
    log "Servicios reiniciados ✓"
}

# Deploy completo
deploy() {
    log "Iniciando deploy completo..."
    
    check_docker
    check_env
    
    # Parar servicios existentes
    log "Deteniendo servicios existentes..."
    docker-compose down 2>/dev/null || true
    
    # Construir y iniciar
    build
    start
    
    # Verificar que la API responde
    log "Verificando que la API responde..."
    sleep 5
    
    if curl -f http://localhost:5000/ &> /dev/null; then
        log "✅ Deploy completado exitosamente!"
        log "La API está disponible en: http://localhost:5000"
    else
        error "❌ La API no responde. Revisa los logs con: docker-compose logs"
    fi
}

# Deploy con Nginx
deploy_nginx() {
    log "Iniciando deploy con Nginx..."
    
    check_docker
    check_env
    
    # Crear directorio nginx si no existe
    if [ ! -d "nginx" ]; then
        warn "Directorio nginx no encontrado. Debes crear nginx/nginx.conf manualmente."
        warn "Consulta la documentación en DEPLOY-DEBIAN.md"
        error "Configuración de Nginx requerida"
    fi
    
    # Parar servicios existentes
    log "Deteniendo servicios existentes..."
    docker-compose --profile with-nginx down 2>/dev/null || true
    
    # Construir y iniciar con nginx
    build
    log "Iniciando servicios con Nginx..."
    docker-compose --profile with-nginx up -d
    
    # Verificar estado
    docker-compose ps
    
    log "✅ Deploy con Nginx completado!"
    log "La aplicación está disponible en: http://localhost"
}

# Ver logs
logs() {
    if [ -n "$2" ]; then
        docker-compose logs -f "$2"
    else
        docker-compose logs -f
    fi
}

# Ver estado
status() {
    log "Estado de los servicios:"
    docker-compose ps
    
    log "\nUso de recursos:"
    docker stats --no-stream
}

# Backup de base de datos
backup() {
    log "Creando backup de la base de datos..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    docker-compose exec -T mongodb mongodump --out /data/backup
    docker cp excel-manager-mongo:/data/backup "$BACKUP_DIR/"
    
    log "Backup creado en: $BACKUP_DIR"
}

# Limpiar sistema
cleanup() {
    log "Limpiando sistema Docker..."
    
    # Parar servicios
    docker-compose down
    
    # Limpiar imágenes no utilizadas
    docker system prune -f
    
    # Limpiar volúmenes huérfanos
    docker volume prune -f
    
    log "Limpieza completada ✓"
}

# Actualizar aplicación
update() {
    log "Actualizando aplicación..."
    
    # Hacer backup antes de actualizar
    backup
    
    # Obtener últimos cambios
    git pull origin main
    
    # Rebuild y restart
    docker-compose down
    build
    start
    
    log "✅ Aplicación actualizada exitosamente!"
}

# Mostrar ayuda
help() {
    echo -e "${BLUE}Sistema de Gestión de Archivos Excel - Script de Deploy${NC}"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  deploy          - Deploy completo (recomendado para primera vez)"
    echo "  deploy-nginx    - Deploy con Nginx como proxy reverso"
    echo "  start           - Iniciar servicios"
    echo "  stop            - Detener servicios"
    echo "  restart         - Reiniciar servicios"
    echo "  build           - Construir imágenes Docker"
    echo "  logs [servicio] - Ver logs (opcional: especificar servicio)"
    echo "  status          - Ver estado de servicios y recursos"
    echo "  backup          - Crear backup de la base de datos"
    echo "  update          - Actualizar aplicación desde git"
    echo "  cleanup         - Limpiar sistema Docker"
    echo "  help            - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 deploy                # Deploy completo"
    echo "  $0 logs backend         # Ver logs del backend"
    echo "  $0 status               # Ver estado actual"
}

# Función principal
main() {
    case "${1:-help}" in
        "deploy")
            deploy
            ;;
        "deploy-nginx")
            deploy_nginx
            ;;
        "start")
            start
            ;;
        "stop")
            stop
            ;;
        "restart")
            restart
            ;;
        "build")
            build
            ;;
        "logs")
            logs "$@"
            ;;
        "status")
            status
            ;;
        "backup")
            backup
            ;;
        "update")
            update
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|*)
            help
            ;;
    esac
}

# Ejecutar función principal
main "$@" 