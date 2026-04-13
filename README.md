# Food Reservation System

Production-grade, multi-tenant reservation platform scaffold.

## Implemented in this milestone

- Monorepo foundation using pnpm workspaces
- PostgreSQL schema foundation with indexes and constraints
- Fastify API skeleton with Zod validation
- Core guest flows:
  - `GET /v1/restaurants`
  - `GET /v1/restaurants/:id/availability`
  - `POST /v1/reservations` with idempotency + optimistic concurrency
- Structured error model aligned to product spec

## Workspace

- `apps/api` - Fastify API service
- `apps/web` - Next.js web app placeholder
- `packages/shared` - shared runtime types/helpers placeholder
- `infra/sql` - schema and migration SQL

## Quick Start

1. Install pnpm and Node.js 22+
2. Install dependencies:
   - `pnpm install`
3. Start API:
   - `pnpm --filter @frs/api dev`

## Environment

Copy `.env.example` and fill values.
