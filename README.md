# Ticket API

REST and WebSocket backend for a digital ticketing platform. Organizers publish events, define ticket types, and sell seats; customers browse, checkout, and receive QR tickets; admins validate tickets at the gate.

**Repository:** [github.com/HectorTorrez/ticket-api](https://github.com/HectorTorrez/ticket-api)

## What it does

| Area | Description |
|------|-------------|
| **Auth** | JWT access + refresh tokens, roles `CUSTOMER` and `ADMIN` |
| **Events** | Public catalog, admin CRUD, banner uploads |
| **Orders** | Inventory reservation with TTL, mock payment flow, expiry scheduler |
| **Tickets** | Issuance after payment, QR PNG generation on demand |
| **QR gate** | Admin validation endpoint marks tickets as used |
| **Realtime** | Socket.IO namespace `/inventory` broadcasts availability updates |
| **Dashboard** | Admin summary metrics |

## Tech stack

- **NestJS 11** — HTTP API, guards, Swagger at `/docs`
- **Prisma 7 + PostgreSQL 16** — persistence
- **Socket.IO** — live inventory
- **AWS S3** — event banner storage (optional in dev)
- **Docker** — production image with auto-migrations

## How it works

```
Browser / ticket-frontend
        │
        ▼
   ALB (production) or localhost:3001
        │
        ▼
   NestJS  /api/v1/*
        ├──► PostgreSQL (users, events, orders, tickets)
        ├──► S3 (event banners, when configured)
        └──► WebSocket /inventory (JWT auth)
```

1. A customer creates an order → seats are reserved in PostgreSQL with a configurable TTL.
2. Payment is simulated via `POST /orders/:id/mock-pay` (real PSP integration is planned).
3. Paid orders emit tickets with public codes; QR images are generated on `GET /tickets/:code/qr`.
4. Inventory changes are pushed to connected clients on the `/inventory` socket namespace.

See [API.md](./API.md) for the full HTTP/WebSocket contract.

## Configuration status

| Feature | Status | Notes |
|---------|--------|-------|
| PostgreSQL | **Required** | `DATABASE_URL` |
| JWT secrets | **Required** | ≥ 32 characters each |
| S3 banners | **Optional** | Code is ready; set `S3_BUCKET` + `S3_PUBLIC_BASE_URL` or uploads return 503 |
| Mock payments | **MVP** | `POST /orders/:id/mock-pay` — replace with a real PSP later |
| Ticket PDFs in S3 | **Future** | QR PNG is served on demand today |
| Email notifications | **Future** | Planned via SQS + Lambda |
| Redis / Socket.IO scaling | **Future** | Use ALB sticky sessions or Redis adapter for multi-instance ASG |
| CI/CD to AWS | **Future** | GitHub Actions workflow runs build/tests; deploy steps documented in [IMPLEMENTATION.md](./IMPLEMENTATION.md) |

Copy [`.env.example`](./.env.example) to `.env` and fill in secrets. Never commit `.env`.

## Local development

**Prerequisites:** Node 20+, pnpm, PostgreSQL 16 (or use Docker Compose).

```bash
pnpm install
cp .env.example .env
# Edit .env — at minimum DATABASE_URL and JWT secrets

pnpm prisma:migrate
pnpm exec prisma db seed   # optional ADMIN user (SEED_ADMIN_* in .env)

pnpm run start:dev         # http://localhost:3001
```

**Swagger:** http://localhost:3001/docs  
**Health:** http://localhost:3001/api/v1/health

### Docker Compose (API + Postgres)

```bash
docker compose up --build
# API on http://localhost:3001 (or PORT from .env)
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm run start:dev` | Watch mode |
| `pnpm run build` | Compile (runs `prisma generate` first) |
| `pnpm run start:prod` | Run compiled app |
| `pnpm prisma:migrate` | Dev migrations |
| `pnpm prisma:migrate:deploy` | Production migrations |
| `pnpm run test` | Unit tests (Jest) |
| `pnpm run test:e2e` | Smoke e2e |
| `pnpm run test:e2e:concurrency` | Concurrency test (needs Postgres) |
| `pnpm run lint` | ESLint |

## Project structure

```
src/
├── auth/           JWT login, register, refresh
├── events/         Public + admin event endpoints
├── orders/         Checkout, mock pay, reservation expiry
├── tickets/        Customer tickets, QR PNG
├── qr/             Gate validation (admin)
├── websocket/      Inventory Socket.IO gateway
├── aws/            S3 banner uploads
├── dashboard/      Admin metrics
└── health/         Liveness + readiness (DB)
prisma/             Schema and migrations
```

## Related documentation

| Document | Content |
|----------|---------|
| [API.md](./API.md) | REST/WebSocket reference for frontend consumers |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | AWS topology, security groups, env mapping |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | EC2/ASG/ALB operational notes |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Step-by-step local setup, AWS deployment, and CI/CD |

**Frontend:** [ticket-frontend](https://github.com/HectorTorrez/ticket-frontend)

## License

[MIT](./LICENSE) — free to use, modify, and fork.
