# ---- 1) Builder: installiert Dependencies exakt (npm ci) ----
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# nur Manifest-Dateien zuerst kopieren -> bessere Caching-Schichten
COPY package*.json ./

# Production-Dependencies (Dev-Deps weglassen)
RUN npm ci --omit=dev

# Quellcode kopieren
COPY src ./src

# optional: Versionsinfo/Healthcheck-Datei o.ä. könnte hier erzeugt werden


# ---- 2) Runtime: möglichst schlank, läuft als Nicht-Root ----
FROM node:20-bookworm-slim

ENV NODE_ENV=production
# Server-Zeitzone (du kannst sie anpassen, die Uhrzeit-Logik nutzt Systemzeit)
ENV TZ=Europe/Berlin

# Ein dedizierter Ordner; hier entsteht timers.db (durch Working Dir)
WORKDIR /app

# Nur das Nötige aus dem Builder übernehmen
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package*.json ./

# Nicht als root laufen
USER node

# Hinweis: Der Bot liest DISCORD_TOKEN & CLIENT_ID aus der Umgebung.
# Start-Kommando
CMD ["node", "src/index.js"]
