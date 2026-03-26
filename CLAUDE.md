# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Quilp** is a full-stack SaaS monorepo — a "Zero-Touch Meeting Intelligence → Social Media Engine" that converts emails from meeting tools (Fathom, Fireflies, Otter, Zoom, etc.) into AI-generated social media posts via Gmail/Outlook OAuth. Built on TypeScript/Node.js with a React frontend.

## Commands

```bash
# Run everything (API + web + ingress + cognition + publisher/scheduler/timeout workers)
npm run dev

# Run individual services
npm run dev:api        # Fastify REST API on port 3000
npm run dev:web        # React/Vite frontend on port 5173
npm run dev:ingress    # Email polling worker
npm run dev:cognition  # AI content generation worker

# Quality
npm run lint           # ESLint on .ts files
npm run test           # Vitest (all *.test.ts / *.spec.ts files)

# Database
npm run db:migrate     # Run Prisma migrations
npm run db:generate    # Regenerate Prisma client after schema changes
```

To run a single test file: `npx vitest run path/to/file.test.ts`

## Architecture

### Monorepo layout (npm workspaces)

```
apps/api          — Fastify 5 REST API (auth, routes, plugins)
apps/web          — React 18 + Vite + TailwindCSS + TanStack Query + Zustand
packages/db       — Prisma 6 schema + PostgreSQL migrations (single source of truth for data model)
packages/shared   — Encryption (AES-256-GCM), mailer, shared schemas
packages/cognition — BullMQ worker → Claude AI pipeline (classify → generate → score)
packages/ingress  — BullMQ worker → Gmail/Outlook OAuth polling, parsing, fingerprinting
packages/publish  — BullMQ workers → platform adapters (LinkedIn, X, …), scheduling, approval, retry
```

### Data flow

1. **Ingress worker** polls Gmail/Outlook → extracts structured content → enqueues cognition jobs
2. **Cognition worker** calls Claude (Anthropic SDK) → generates platform-specific posts → saves drafts
3. **Publish workers** handle approval workflows → schedule and post to social platforms → collect analytics

### Key technologies

| Concern | Technology |
|---------|-----------|
| API server | Fastify 5 with CORS, helmet, rate limiting (100 req/min auth, 10 anon) |
| Background jobs | BullMQ 5 on Redis (ioredis) |
| AI generation | `@anthropic-ai/sdk` — Claude models |
| ORM | Prisma 6 → PostgreSQL (Aurora Serverless v2 in prod) |
| Auth | Supabase (OAuth + email); JWT validated in `apps/api/src/plugins/auth.ts` |
| Frontend state | TanStack Query (server) + Zustand (client) |
| Error tracking | Sentry (backend + frontend) |

### Core data model (packages/db/prisma/schema.prisma)

Key tables: `users`, `email_connections` (encrypted OAuth tokens), `posts` (draft→queued→approved→posted→failed), `social_connections`, `processed_emails`, `voice_profiles`, `approval_requests`, `post_analytics`, `audit_log` (7-year immutable compliance log).

Post status flow: `draft → queued → approved → posted` (or `failed` / `discarded`)

### API structure (apps/api/src/)

Routes under `routes/`: health, users, gmail-auth, linkedin-auth, posts, voice-profiles, debug, approval.
Auth plugin (`plugins/auth.ts`) and user-context setter (`plugins/setUserContext.ts`) run as Fastify hooks.

### TypeScript config

`tsconfig.base.json` sets `strict: true` + `noUncheckedIndexedAccess: true`. All packages extend this. Module system is `NodeNext`. Unused variables must be prefixed with `_`.

## Environment

Copy `.env.example` to `.env`. Critical variables: `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GMAIL_CLIENT_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`, `ENCRYPTION_KEY`, `TOKEN_ENCRYPTION_KEY`.

## Documentation

`.doc/` contains the full TRD (`Quilp_TRD.md`) and roadmap (`Quilp_Roadmap_v1_0.md`), plus feature design docs for new additions. Read these before making architectural decisions.
