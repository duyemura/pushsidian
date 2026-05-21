# Pushsidian

Team knowledge layer on top of Obsidian. Selectively share markdown notes with granular permissions, and let your team's collective notes power AI context injection.

## Architecture

- **api/** — Fastify backend (auth, orgs, documents, search, AI context)
- **web/** — React frontend (dashboard, document viewer, team settings, AI chat)
- **obsidian-plugin/** — Obsidian plugin (file watcher, sync, share modal, team panel)
- **packages/shared-types/** — Shared Zod schemas and TypeScript types

## Local Development

```bash
# Start Postgres + MinIO (S3-compatible)
docker compose up -d

# Install dependencies
pnpm install

# Run API
cd api && pnpm dev

# Run Web
cd web && pnpm dev

# Build Obsidian plugin
cd obsidian-plugin && pnpm build
```

## Tech Stack

- API: Fastify 5.x + Zod + Kysely + pgvector
- Auth: Clerk
- Storage: Cloudflare R2 (S3-compatible)
- AI: OpenAI embeddings + Claude completions
- Frontend: React 19 + Vite + Tailwind
- Obsidian Plugin: TypeScript + Obsidian API
