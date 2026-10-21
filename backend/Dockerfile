FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

# Run as the image's unprivileged user, and start node directly so it gets
# SIGTERM from `docker stop` (npm doesn't forward signals).
USER node
CMD ["node", "server.js"]
