# Express + signify-ts platform agent.
FROM node:20-bookworm-slim

WORKDIR /app

# Build deps: python3/make/g++ compile better-sqlite3 (native); git fetches the
# signify-ts dependency, which is installed straight from GitHub.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ git \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]
