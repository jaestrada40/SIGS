# syntax=docker/dockerfile:1
# Interfaz de SISG (TanStack Start con renderizado en servidor). Se compila como servidor Node (preset node-server de Nitro).

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# La URL de la API se incorpora al compilar (VITE_*): hay que reconstruir la imagen si cambia.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL NITRO_PRESET=node-server
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
