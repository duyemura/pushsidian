# Multi-stage build: API + Web
FROM node:24-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY obsidian-plugin/package.json obsidian-plugin/
COPY packages/shared-types/package.json packages/shared-types/

# Install dependencies (skip postinstall scripts to avoid pnpm v10 blocking)
RUN pnpm install --ignore-scripts

# Copy source
COPY api/ api/
COPY web/ web/
COPY packages/shared-types/ packages/shared-types/

# Build shared-types first (workspace dependency)
RUN cd packages/shared-types && pnpm build

# Build web app
RUN cd web && pnpm build

# Build API
RUN cd api && pnpm build

# Move web build to API public dir
RUN mkdir -p api/public && cp -r web/dist/* api/public/

# Production image
FROM node:24-slim

WORKDIR /app

# Copy built API + web + node_modules from builder
COPY --from=builder /app/api/dist api/dist/
COPY --from=builder /app/api/public api/public/
COPY --from=builder /app/api/src/db/migrations api/src/db/migrations/
COPY --from=builder /app/packages/shared-types/dist packages/shared-types/dist/
COPY --from=builder /app/api/node_modules api/node_modules/
COPY --from=builder /app/node_modules node_modules/

WORKDIR /app/api

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/app.js"]
