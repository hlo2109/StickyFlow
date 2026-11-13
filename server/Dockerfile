# StickyFlow Server (API + web de notas) — contexto de construcción = raíz del repositorio (Docker Context Path: .)

# 1) Web de notas (React + TipTap)
FROM node:22-slim AS web
WORKDIR /repo
COPY web/package.json web/package-lock.json* ./web/
RUN cd web && npm install --no-audit --no-fund
COPY web ./web
COPY src/utils/markdown.ts ./src/utils/markdown.ts
COPY src/types.ts ./src/types.ts
RUN cd web && npx vite build

# 2) Dependencias del servidor
FROM node:22-slim AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# 3) Imagen final
FROM node:22-slim
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=web /repo/web/dist ./public
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
