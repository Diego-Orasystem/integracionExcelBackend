#!/bin/bash

# Script para probar APIs simples del Sistema de Gestión de Archivos Excel
# Uso: ./test-api-simple.sh [URL_BASE]

# Configuración
BASE_URL="${1:-http://localhost:5000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Probando APIs del Sistema de Gestión de Archivos Excel${NC}"
echo -e "${BLUE}URL Base: $BASE_URL${NC}"
echo ""

# Función para hacer peticiones y mostrar resultados
test_api() {
    local name="$1"
    local url="$2"
    local headers="$3"
    local expected_status="${4:-200}"
    
    echo -n "🔄 Probando $name... "
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "%{http_code}" -H "$headers" "$url")
    else
        response=$(curl -s -w "%{http_code}" "$url")
    fi
    
    # Extraer código de estado (últimos 3 caracteres)
    status_code="${response: -3}"
    # Extraer cuerpo de respuesta (todo excepto los últimos 3 caracteres)
    body="${response%???}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ OK (HTTP $status_code)${NC}"
        if [ -n "$body" ] && command -v jq &> /dev/null; then
            echo "$body" | jq . 2>/dev/null | head -10
        else
            echo "$body" | head -5
        fi
    else
        echo -e "${RED}❌ FALLO (HTTP $status_code)${NC}"
        echo "Respuesta: $body"
    fi
    echo ""
}

# 1. Probar endpoint básico
echo -e "${YELLOW}=== 1. Endpoint Básico (Sin Autenticación) ===${NC}"
test_api "Endpoint raíz" "$BASE_URL/"

# 2. Obtener token de prueba
echo -e "${YELLOW}=== 2. Obtener Token de Prueba ===${NC}"
token_response=$(curl -s "$BASE_URL/api/auth/test-token")
echo "🔄 Obteniendo token de prueba..."

if echo "$token_response" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Token obtenido exitosamente${NC}"
    
    # Extraer token usando diferentes métodos según disponibilidad
    if command -v jq &> /dev/null; then
        TOKEN=$(echo "$token_response" | jq -r '.token')
    else
        # Método alternativo sin jq
        TOKEN=$(echo "$token_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    fi
    
    echo "Token: ${TOKEN:0:50}..."
    echo ""
    
    # 3. Probar endpoints con autenticación
    echo -e "${YELLOW}=== 3. Endpoints Protegidos (Con Token) ===${NC}"
    
    test_api "Perfil de usuario" "$BASE_URL/api/auth/me" "Authorization: Bearer $TOKEN"
    
    test_api "Listar áreas" "$BASE_URL/api/areas" "Authorization: Bearer $TOKEN"
    
    test_api "Métricas de archivos" "$BASE_URL/api/files/metrics" "Authorization: Bearer $TOKEN"
    
    test_api "Estado de archivos" "$BASE_URL/api/file-status/metrics" "Authorization: Bearer $TOKEN"
    
else
    echo -e "${RED}❌ No se pudo obtener token de prueba${NC}"
    echo "Respuesta: $token_response"
    echo ""
    echo -e "${YELLOW}💡 Esto puede ser normal si no hay usuarios en la base de datos${NC}"
    echo -e "${YELLOW}   Intenta inicializar el sistema primero${NC}"
fi

# 4. Probar inicialización del sistema
echo -e "${YELLOW}=== 4. Inicialización del Sistema ===${NC}"
test_api "Inicializar sistema" "$BASE_URL/api/auth/init" "" "200"

# 5. Probar endpoints públicos adicionales
echo -e "${YELLOW}=== 5. Otros Endpoints Públicos ===${NC}"

# Probar algunos endpoints que podrían no requerir autenticación
test_api "Healthcheck básico" "$BASE_URL/health" "" "404"  # Esperamos 404 porque no existe

echo -e "${BLUE}🏁 Pruebas completadas${NC}"
echo ""
echo -e "${YELLOW}📝 Notas:${NC}"
echo "• Si el endpoint básico funciona, Docker está corriendo correctamente"
echo "• Si obtienes token, la base de datos está conectada"
echo "• Si los endpoints protegidos funcionan, la autenticación está OK"
echo "• Los errores 404 en algunos endpoints son normales"
echo ""
echo -e "${YELLOW}🔧 Para más pruebas detalladas:${NC}"
echo "• Revisa logs: docker-compose logs backend"
echo "• Estado: docker-compose ps"
echo "• Documentación completa en: DEPLOY-DEBIAN.md" 