# syntax=docker/dockerfile:1

# ---- build the frontend ----------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /app/frontend

# `npm ci` installs exactly what the lockfile pins, so the image is identical
# every time it is built.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- install production backend dependencies -------------------------------
FROM node:22-alpine AS backend
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---- final image -----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Run as a non-root user. The node image already ships one.
RUN chown -R node:node /app
USER node

COPY --chown=node:node --from=backend /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node backend/package.json backend/package-lock.json ./backend/
COPY --chown=node:node backend/src ./backend/src

# The server serves this directory in production (see backend/src/index.js).
COPY --chown=node:node --from=frontend /app/frontend/dist ./frontend/dist

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/backend
CMD ["node", "src/index.js"]
