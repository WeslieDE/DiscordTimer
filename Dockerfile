# ---- Builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Nur Manifeste -> Cache für npm ci
COPY package*.json ./
RUN npm ci --omit=dev

# Quellcode kopieren
COPY src ./src

# ---- Runtime ----
FROM node:20-bookworm-slim
ENV NODE_ENV=production
ENV TZ=Europe/Berlin

# Datenverzeichnis für SQLite
WORKDIR /app
RUN mkdir -p /app/data && chown -R node:node /app

# Nur das Nötige übernehmen
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package*.json ./

USER node

# DB-Pfad per Env (wir lesen ihn im Code – siehe Hinweis unten)
ENV TIMER_DB_PATH=/app/data/timers.db

CMD ["node", "src/index.js"]
