# Etapa de construcción
FROM node:18-alpine AS builder

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache python3 make g++

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Etapa de producción
FROM node:18-alpine AS production

# Crear usuario no root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Instalar dependencias del sistema necesarias para la aplicación
RUN apk add --no-cache dumb-init

# Establecer directorio de trabajo
WORKDIR /app

# Copiar dependencias desde la etapa de construcción
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copiar código fuente
COPY --chown=nextjs:nodejs . .

# Crear directorio de uploads con permisos correctos
RUN mkdir -p uploads && chown -R nextjs:nodejs uploads

# Exponer puerto
EXPOSE 5000

# Cambiar a usuario no root
USER nextjs

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=5000

# Comando de inicio con dumb-init para manejo correcto de señales
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" 