FROM node:22-bookworm-slim

WORKDIR /app

# git is needed so the portal can create local commits when mapping is edited
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY portal/package*.json ./
RUN npm ci --omit=dev

COPY portal/src ./src
COPY portal/public ./public

EXPOSE 8080

CMD ["npm", "start"]
