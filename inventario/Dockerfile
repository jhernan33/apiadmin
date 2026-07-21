# syntax=docker/dockerfile:1

# ─── Stage 1: dependencias de producción ──────────────────
# Se aíslan en su propia etapa para que la imagen final no arrastre
# devDependencies (jest, eslint, nodemon) ni la caché de npm.
FROM node:22-alpine AS deps

WORKDIR /app

# Solo los manifiestos: esta capa se recachea únicamente cuando cambian
# las dependencias, no en cada edición de código.
COPY package.json package-lock.json ./

# `npm ci` (no `install`) para instalar exactamente lo fijado en el lockfile.
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 2: runtime ─────────────────────────────────────
FROM node:22-alpine AS runtime

# dumb-init como PID 1: reapea procesos zombie y reenvía las señales al
# proceso Node, de donde depende el graceful shutdown de bin/www.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# El usuario `node` viene en la imagen oficial. Correr como root dentro del
# contenedor convierte cualquier RCE en control total del filesystem.
USER node

EXPOSE 3000

# Usa el /health real (verifica la conexión a BD, devuelve 503 si está caída).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "./bin/www"]
