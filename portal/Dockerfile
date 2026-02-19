FROM node:22-bookworm-slim

WORKDIR /app

COPY portal/package*.json ./
RUN npm ci --omit=dev

COPY portal/src ./src
COPY portal/public ./public

EXPOSE 8080

CMD ["npm", "start"]
