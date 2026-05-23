# Multi-stage build: API + Web
FROM node:24-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml package.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY obsidian-plugin/package.json obsidian-plugin/

# Install dependencies
RUN pnpm install

# Copy source
COPY api/ api/
COPY web/ web/

# Build web app
RUN cd web && pnpm build

# Build API
RUN cd api && pnpm build

# Move web build to API public dir
RUN mkdir -p api/public && cp -r web/dist/* api/public/

# Production image
FROM node:24-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml package.json ./
COPY api/package.json api/

# Install production deps only
RUN pnpm install --prod

# Copy built API + web
COPY --from=builder /app/api/dist api/dist/
COPY --from=builder /app/api/public api/public/
COPY --from=builder /app/api/src/db/migrations api/src/db/migrations/

WORKDIR /app/api

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/app.js"]
