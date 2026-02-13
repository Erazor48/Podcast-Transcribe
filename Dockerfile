FROM node:20-bullseye AS deps
WORKDIR /app

# Installation des dépendances Node
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM node:20-bullseye AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

# Build Next.js en mode production
RUN npm run build

FROM node:20-bullseye AS runner
WORKDIR /app

# Python + ffmpeg pour la transcription locale (openai-whisper)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# openai-whisper (inclut PyTorch – image ~2–3 Go, premier build long)
COPY scripts/ ./scripts/
RUN pip3 install --no-cache-dir -r scripts/requirements.txt

ENV NODE_ENV=production
# Hugging Face expose généralement le port 7860
ENV PORT=7860
# Modèle Whisper : tiny (rapide/petit) | base | small | medium | large
ENV WHISPER_MODEL=base
EXPOSE 7860

# On copie ce qui est nécessaire pour exécuter l'app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules

# Lancement de l'app Next sur le port 7860
CMD ["npm", "run", "start", "--", "-p", "7860"]

