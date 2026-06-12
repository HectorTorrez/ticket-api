# AWS Architecture — Digital Ticketing Platform

Reference document for deploying **ticket-frontend** (React app) and **ticket-api** (NestJS + PostgreSQL) on AWS. Aligned with the team infrastructure diagram and the current codebase.

---

## 1. Overview

| Layer | Technology | AWS service |
|-------|------------|-------------|
| Client | Web / mobile browser | — |
| Frontend | React + Vite + TanStack Router | **S3** (+ **CloudFront** recommended) |
| API | NestJS 11, Prisma, JWT, Socket.IO | **EC2** in **Auto Scaling Group** |
| Database | PostgreSQL 16 | **RDS** |
| Files | Event banners (ticket PDFs: planned) | **S3** (assets bucket) |
| TLS | Public certificate | **ACM** |
| HTTP(S) entry | Load balancing and health checks | **Application Load Balancer** |
| Observability | Logs and metrics | **CloudWatch** |

### Traffic flow (summary)

1. **Users** load the app from **S3** (ideally via **CloudFront** with HTTPS).
2. The app calls REST (`/api/v1/*`) and the inventory WebSocket (`/inventory`) on the **ALB** domain.
3. The **ALB** terminates TLS (**ACM** certificate) and forwards HTTP to the **ASG** of **EC2** instances.
4. Each NestJS instance reads/writes **RDS PostgreSQL** and uploads assets to **S3**.
5. **CloudWatch** receives logs and metrics from ALB, ASG, EC2, and RDS.

---

## 2. Architecture diagram

### 2.1 Logical diagram (Mermaid)

```mermaid
flowchart LR
  subgraph Clients
    Users["Web / Mobile Users"]
  end

  subgraph Frontend["Static frontend"]
    CF["CloudFront (recommended)"]
    FE["S3 — ticket-frontend SPA"]
    CF --> FE
  end

  subgraph VPC["VPC — AWS"]
    IGW["Internet Gateway"]
    ACM["ACM — SSL/TLS Certificate"]

    subgraph Public["Public subnet"]
      ALB["Application Load Balancer — HTTPS"]
    end

    subgraph Backend["Public subnet — Backend (Auto Scaling)"]
      ASG["Auto Scaling Group"]
      API1["EC2 — ticket-api"]
      API2["EC2 — ticket-api"]
      ASG --> API1
      ASG --> API2
    end

    subgraph Data["Data layer (private subnet recommended)"]
      RDS["RDS PostgreSQL"]
      S3Assets["S3 — Banners / PDFs"]
    end
  end

  CW["CloudWatch — Logs and metrics"]

  Users --> CF
  Users --> IGW --> ACM --> ALB
  ALB --> ASG
  API1 --> RDS
  API2 --> RDS
  API1 --> S3Assets
  API2 --> S3Assets
  ALB --> CW
  ASG --> CW
  API1 --> CW
  API2 --> CW
  RDS --> CW
```

### 2.2 Python `diagrams` library diagram

Script included in [`scripts/arquitectura_boletaria.py`](scripts/arquitectura_boletaria.py). Generates `arquitectura_boletaria.png`:

```bash
# Requires Graphviz (brew install graphviz / apt install graphviz)
cd ticket-api
python -m venv .venv-diagrams && source .venv-diagrams/bin/activate
pip install diagrams
python scripts/arquitectura_boletaria.py
```

---

## 3. Diagram ↔ code mapping

| AWS component | Project / module | Responsibility |
|---------------|------------------|----------------|
| S3 Frontend | `ticket-frontend` (`pnpm build` → assets) | Catalog, checkout, admin dashboard, QR scanner |
| EC2 API | `ticket-api` (Dockerfile, port **3000**) | REST `/api/v1`, Swagger `/docs`, WebSocket `/inventory` |
| RDS | Prisma + `DATABASE_URL` | Users, events, orders, tickets, inventory |
| S3 Assets | `src/aws/s3.service.ts` | Banners (`events/{eventId}/*`); PDFs: planned, not implemented |
| ALB health | `GET /api/v1/health`, `GET /api/v1/health/ready` | Liveness and readiness (DB connection) |
| JWT / roles | `src/auth/*` | `CUSTOMER`, `ADMIN`; refresh tokens in DB |
| Live inventory | `src/websocket/inventory.gateway.ts` | Socket.IO namespace `/inventory` |

### Key environment variables

**API (EC2 / Secrets Manager / SSM):**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | RDS PostgreSQL endpoint |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing (≥ 32 characters) |
| `CORS_ORIGINS` | Frontend origin(s) on S3/CloudFront |
| `FRONTEND_BASE_URL` | URLs in emails / redirects |
| `S3_BUCKET`, `S3_PUBLIC_BASE_URL` | Assets bucket and public URL (or CloudFront domain) |
| `AWS_REGION` | Region; credentials via **IAM instance profile** (preferred) or keys in dev |

**Frontend (Vite build-time):**

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Public ALB URL, e.g. `https://api.tickets.example.com` |
| `VITE_SOCKET_PATH` | Socket.IO path (default `/socket.io`) |

---

## 4. Diagram review

### Strengths

- Clear separation between static frontend (S3) and dynamic API (EC2 + ALB).
- **Auto Scaling Group** suitable for ticket sale peaks.
- **RDS PostgreSQL** matches Prisma and the current schema.
- Two **S3** uses (SPA vs assets/PDF) is the correct pattern.
- **ACM + ALB HTTPS** is the standard AWS TLS approach.
- **CloudWatch** covers minimum viable observability.

### Recommended adjustments before production

| Topic | Diagram state | Recommendation |
|-------|---------------|----------------|
| **CloudFront in front of frontend** | Not shown | Add CloudFront for HTTPS, compression, cache, SPA fallback (`index.html` on 404). |
| **Private subnet for RDS** | Generic "data layer" | RDS **only in private subnet**; SG allows 5432 **only** from ASG SG. |
| **Backend in public subnet** | EC2 in public subnet | OK for MVP/university. Production: EC2 in **private subnet** + **NAT Gateway** for outbound. |
| **WebSocket multi-instance** | Not detailed | With 2+ EC2, enable **sticky sessions** on ALB target group **or** Redis adapter for Socket.IO. |
| **Secrets** | Not shown | Use **SSM Parameter Store** or **Secrets Manager** for JWT and `DATABASE_URL`. |
| **DNS** | Not shown | **Route 53**: `www` → CloudFront, `api` → ALB. |
| **PDF in S3** | "Ticket PDF" bucket | Code generates **QR PNG on demand** (`GET /tickets/:code/qr`); PDF bucket is future work. |
| **S3 credentials on EC2** | Implicit | Prefer **IAM instance profile** over `AWS_ACCESS_KEY_ID` in production. |
| **WAF / rate limiting** | Not shown | Consider **AWS WAF** on ALB/CloudFront for checkout/login abuse. |

### ACM note

In AWS, **ACM** is not a separate network hop — the certificate is **attached to the ALB HTTPS listener** (and/or CloudFront). It is fine to show ACM as a security component in academic diagrams.

---

## 5. Network and security (Security Groups)

```
Internet
   │
   ▼
[ ALB SG ]  inbound: 443 from 0.0.0.0/0
   │
   ▼
[ EC2 SG ]  inbound: 3000 from ALB SG; SSH/SSM restricted
   │
   ├──► [ RDS SG ]  inbound: 5432 from EC2 SG
   └──► S3 / Internet (via NAT if EC2 in private subnet)
```

- **Frontend S3**: private bucket; public access only via CloudFront OAI/OAC.
- **S3 assets**: policy allowing public read on `events/*` (banners) or signed URLs for tighter control.
- **CORS**: `CORS_ORIGINS` must list the exact frontend origin, not `*` in production.

---

## 6. Component deployment

### 6.1 Frontend (S3 + CloudFront or Node server)

**Current codebase:** Nitro `node-server` preset — run `.output/server/index.mjs` on a Node host.

**Alternative (static S3):**

1. `pnpm install && pnpm build` in `ticket-frontend` with `VITE_API_BASE_URL` pointing to the ALB.
2. Sync static output to S3 (`aws s3 sync .output/public/ s3://...`).
3. Invalidate CloudFront cache after each release.
4. Configure custom error response: **403/404 → `/index.html`** for SPA routes.

### 6.2 API (EC2 + ASG + ALB)

1. Build Docker image from [`Dockerfile`](Dockerfile).
2. **Launch template**: AMI, instance profile (S3 + SSM), user-data starting the container.
3. Target group: port **3000**, health check `GET /api/v1/health`.
4. ALB listener **443** → target group; ACM certificate on listener.
5. On startup, [`docker-entrypoint.sh`](docker-entrypoint.sh) runs `prisma migrate deploy` then starts the app.

### 6.3 Database (RDS)

1. PostgreSQL 16; Multi-AZ optional per SLA.
2. Automated backups and maintenance window defined.
3. `DATABASE_URL` with SSL if required by policy.

### 6.4 Auto Scaling

| Signal | Suggested action |
|--------|------------------|
| CPU > 70% (5 min) | Scale out (+1 instance) |
| CPU < 30% (10 min) | Scale in |
| ALB `TargetResponseTime` | CloudWatch alarms |
| Sale peaks | Minimum 2 instances during events |

---

## 7. Observability

| Source | What to log |
|--------|-------------|
| EC2 / container | NestJS stdout → **CloudWatch Logs** |
| ALB | Access logs → S3 + 4xx/5xx, latency metrics |
| RDS | Enhanced Monitoring, Performance Insights |
| ASG | Desired / InService / Pending |
| Alarms | ALB 5xx, failed health checks, RDS CPU, disk space |

Synthetic monitoring endpoints:

- `GET /api/v1/health` — process alive
- `GET /api/v1/health/ready` — PostgreSQL reachable

---

## 8. Business flows in the architecture

### Ticket purchase

```
User → CloudFront/S3 (app)
     → ALB → EC2: POST /api/v1/orders
     → RDS (PENDING reservation, configurable TTL)
     → WebSocket inventory broadcast (ASG)
     → EC2: POST /api/v1/orders/:id/mock-pay
     → RDS (PAID, ticket issuance) + QR via API
```

### Gate validation (admin)

```
Admin → dashboard → ALB → EC2: POST /api/v1/qr/validate
     → RDS (ticket marked USED)
```

### Event banner

```
Admin → multipart upload → ALB → EC2 → S3 (events/{id}/...)
     → public URL saved in RDS
```

---

## 9. Future evolution (outside current diagram)

- **ElastiCache (Redis)** for Socket.IO adapter and session cache.
- **RDS Proxy** for connection pooling under many EC2 instances.
- **SQS + Lambda** for async PDF generation and email delivery.
- **CI/CD**: GitHub Actions → ECR/AMI → ASG rolling update; frontend → S3 sync (see [IMPLEMENTATION.md](./IMPLEMENTATION.md)).
- **Real payments**: PSP integration; webhooks on dedicated routes behind the same ALB.

---

## 10. Pre-go-live checklist

- [ ] ACM certificate validated in the ALB region
- [ ] RDS in private subnet; no public IP
- [ ] Secrets in SSM/Secrets Manager, not in the repository
- [ ] `CORS_ORIGINS` and `VITE_API_BASE_URL` aligned with real domains
- [ ] ALB health checks green on `/api/v1/health`
- [ ] Sticky sessions or Redis if ASG > 1 instance and WebSockets are used
- [ ] RDS backups tested (restore drill)
- [ ] CloudFront + S3 frontend with HTTPS
- [ ] IAM instance profile with minimum S3 assets bucket permissions
- [ ] Concurrency test: `pnpm run test:e2e:concurrency` against staging RDS

---

## 11. Related documents

- [`IMPLEMENTATION.md`](IMPLEMENTATION.md) — step-by-step local setup, AWS deploy, CI/CD
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — EC2/ASG operational notes
- [`API.md`](API.md) — HTTP/WebSocket contract for the frontend
- [`scripts/arquitectura_boletaria.py`](scripts/arquitectura_boletaria.py) — PNG diagram generation

---

*Last review: aligned with ticket-api (NestJS + Prisma + S3 banners + Socket.IO inventory) and ticket-frontend (Vite + TanStack Start).*
