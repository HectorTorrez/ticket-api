# Implementation Guide — Ticket Platform

Step-by-step guide to run, deploy, and automate **ticket-api** and **ticket-frontend** on GitHub and AWS.

| Repository | GitHub |
|------------|--------|
| API | [HectorTorrez/ticket-api](https://github.com/HectorTorrez/ticket-api) |
| Frontend | [HectorTorrez/ticket-frontend](https://github.com/HectorTorrez/ticket-frontend) |

---

## Table of contents

1. [What is already implemented](#1-what-is-already-implemented)
2. [What to configure later](#2-what-to-configure-later)
3. [Local development (full stack)](#3-local-development-full-stack)
4. [Verify everything works](#4-verify-everything-works)
5. [AWS deployment overview](#5-aws-deployment-overview)
6. [Step-by-step: AWS infrastructure](#6-step-by-step-aws-infrastructure)
7. [Step-by-step: deploy the API](#7-step-by-step-deploy-the-api)
8. [Step-by-step: deploy the frontend](#8-step-by-step-deploy-the-frontend)
9. [Optional: S3 banner uploads](#9-optional-s3-banner-uploads)
10. [CI/CD with GitHub Actions](#10-cicd-with-github-actions)
11. [Future CI/CD to AWS (manual today)](#11-future-cicd-to-aws-manual-today)
12. [Pre-go-live checklist](#12-pre-go-live-checklist)

---

## 1. What is already implemented

| Component | Status |
|-----------|--------|
| NestJS REST API (`/api/v1`) | ✅ Ready |
| Swagger docs (`/docs`) | ✅ Ready |
| PostgreSQL + Prisma migrations | ✅ Ready |
| JWT auth (CUSTOMER / ADMIN) | ✅ Ready |
| Order reservation + mock payment | ✅ Ready |
| QR ticket generation (PNG on demand) | ✅ Ready |
| Admin QR validation | ✅ Ready |
| Socket.IO inventory (`/inventory`) | ✅ Ready |
| S3 banner upload code | ✅ Ready (needs AWS bucket config) |
| Docker + docker-compose | ✅ Ready |
| Frontend SPA/SSR app | ✅ Ready |
| GitHub Actions CI (build + test) | ✅ Workflows in each repo |

---

## 2. What to configure later

These are **not blockers** for local development or a university MVP demo. Configure them when you move to production.

| Feature | When needed | What to do |
|---------|-------------|------------|
| **S3 banners** | Admin uploads event images | Create S3 bucket, set `S3_BUCKET` + `S3_PUBLIC_BASE_URL`, IAM permissions (see [§9](#9-optional-s3-banner-uploads)) |
| **Real payments** | Accept real money | Replace `mock-pay` with a PSP (Stripe, etc.) and webhook routes |
| **Email** | Send tickets by email | Add SES or SQS + Lambda (see [ARCHITECTURE.md](./ARCHITECTURE.md)) |
| **Ticket PDFs in S3** | Store PDF files | Not implemented; QR PNG API works today |
| **Redis** | Multiple API instances + WebSockets | ElastiCache + Socket.IO Redis adapter, or ALB sticky sessions |
| **AWS WAF** | Abuse protection | Attach WAF to ALB / CloudFront |
| **Full CI/CD deploy** | Auto-deploy on push to `main` | Extend GitHub Actions with ECR, S3 sync, ASG deploy (see [§11](#11-future-cicd-to-aws-manual-today)) |

---

## 3. Local development (full stack)

### 3.1 Start the API

```bash
cd ticket-api
pnpm install
cp .env.example .env
```

Edit `.env`:

```env
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticket_api?schema=public"
JWT_ACCESS_SECRET="your-access-secret-at-least-32-chars-long"
JWT_REFRESH_SECRET="your-refresh-secret-at-least-32-chars-long"
CORS_ORIGINS=http://localhost:3000
FRONTEND_BASE_URL=http://localhost:3000
```

**Option A — Docker (Postgres + API):**

```bash
docker compose up --build
```

**Option B — Local Postgres:**

```bash
pnpm prisma:migrate
pnpm exec prisma db seed    # creates admin from SEED_ADMIN_* in .env
pnpm run start:dev
```

API available at http://localhost:3001 — Swagger at http://localhost:3001/docs

### 3.2 Start the frontend

```bash
cd ticket-frontend
pnpm install
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:3001

pnpm dev
```

Frontend at http://localhost:3000

### 3.3 Default admin (after seed)

From `.env.example`:

- Email: `admin@ticket-api.local`
- Password: `Admin123!ChangeMe`

---

## 4. Verify everything works

Run these commands in each repository:

### ticket-api

```bash
pnpm run build          # ✅ must succeed
pnpm run test           # ✅ passes (no unit specs yet)
pnpm run test:e2e       # ✅ smoke test
# With Postgres running:
pnpm run test:e2e:concurrency
```

Manual smoke test:

```bash
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/events
```

### ticket-frontend

```bash
pnpm run build          # ✅ must succeed
pnpm run test           # ✅ passes with no test files
node .output/server/index.mjs   # optional: run production server
```

Manual smoke test (API must be running):

1. Open http://localhost:3000
2. Register a customer or log in as admin
3. Create an event (admin dashboard)
4. Buy a ticket (checkout → mock pay)
5. View ticket QR under **My tickets**

---

## 5. AWS deployment overview

Target architecture (details in [ARCHITECTURE.md](./ARCHITECTURE.md)):

```
Users
  ├──► CloudFront → S3 (static assets) OR Node server for SSR frontend
  └──► ALB (HTTPS, ACM) → EC2 ASG → ticket-api (Docker, port 3000)
                                    ├──► RDS PostgreSQL
                                    └──► S3 (event banners)
```

**Ports in production:**

| Service | Container/process port | Notes |
|---------|------------------------|-------|
| API | 3000 | Dockerfile `EXPOSE 3000`; map ALB target group to 3000 |
| Frontend (Nitro) | 3000 or custom | Run `.output/server/index.mjs`; use a different host port if collocated |

---

## 6. Step-by-step: AWS infrastructure

Do this once per environment (staging / production).

### Step 1 — VPC and networking

1. Create a VPC (e.g. `10.0.0.0/16`).
2. Public subnets for ALB (and optionally EC2).
3. Private subnets for RDS.
4. Internet Gateway attached; route tables configured.

### Step 2 — RDS PostgreSQL

1. Create RDS PostgreSQL 16 in **private subnets**.
2. Security group: allow inbound **5432** only from the EC2/ASG security group.
3. Note the endpoint and build:

   ```
   DATABASE_URL=postgresql://USER:PASS@endpoint:5432/ticket_api?schema=public
   ```

### Step 3 — S3 buckets

| Bucket | Purpose |
|--------|---------|
| `ticket-frontend-{env}` | Static web assets (if using static hosting) |
| `ticket-assets-{env}` | Event banners (`events/*` prefix) |

Enable block public access on both; use CloudFront OAC/OAI for frontend; public read on `events/*` for banners (or signed URLs).

### Step 4 — ACM certificate

1. Request a certificate in the **same region as the ALB** (e.g. `us-east-1`).
2. Validate via DNS (Route 53 recommended).
3. Attach to ALB HTTPS listener (`:443`).

### Step 5 — Application Load Balancer

1. Create ALB in public subnets.
2. Target group: HTTP port **3000**, health check `GET /api/v1/health`.
3. Listener `:443` → target group with ACM cert.
4. For WebSockets with **2+ API instances**: enable **sticky sessions** on the target group.

### Step 6 — EC2 Auto Scaling Group

1. Launch template with Amazon Linux 2023 (or similar).
2. Attach **IAM instance profile** with:
   - `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on assets bucket
   - `ssm:GetParameter` if using Parameter Store for secrets
3. User data: install Docker, pull/run API image (see [§7](#7-step-by-step-deploy-the-api)).
4. ASG min/desired/max sized for your load (min 2 during events if using WebSockets without Redis).

### Step 7 — Route 53

| Record | Target |
|--------|--------|
| `api.example.com` | ALB alias |
| `www.example.com` | CloudFront distribution (frontend) |

### Step 8 — CloudWatch

- Log groups for EC2/container stdout.
- Alarms: ALB 5xx, unhealthy targets, RDS CPU/storage.

---

## 7. Step-by-step: deploy the API

### Build and push Docker image

```bash
cd ticket-api
docker build -t ticket-api:latest .

# Example: push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker tag ticket-api:latest ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ticket-api:latest
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ticket-api:latest
```

### Run on EC2 (example)

```bash
docker run -d --name ticket-api -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="..." \
  -e JWT_ACCESS_SECRET="..." \
  -e JWT_REFRESH_SECRET="..." \
  -e CORS_ORIGINS="https://www.example.com" \
  -e FRONTEND_BASE_URL="https://www.example.com" \
  -e S3_BUCKET="ticket-assets-prod" \
  -e S3_PUBLIC_BASE_URL="https://assets.example.com" \
  -e AWS_REGION="us-east-1" \
  ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ticket-api:latest
```

The entrypoint runs `prisma migrate deploy` before starting the app.

**Secrets:** store values in **AWS Secrets Manager** or **SSM Parameter Store** — never in the Git repo.

---

## 8. Step-by-step: deploy the frontend

The current Nitro preset is **`node-server`** (SSR). Two options:

### Option A — Node server (matches current code)

1. Set production env and build:

   ```bash
   cd ticket-frontend
   export VITE_API_BASE_URL=https://api.example.com
   pnpm install
   pnpm build
   ```

2. Deploy `.output/` to a Node host (EC2, ECS, Render, Fly.io):

   ```bash
   node .output/server/index.mjs
   ```

3. Put the server behind ALB or a separate subdomain (`www.example.com`).

### Option B — Static hosting on S3 + CloudFront (future)

Requires switching Nitro to a **static** preset or prerendering all routes. Not configured in the repo today. Track as a future task if you want pure S3 hosting without a Node process.

**After each frontend release:** invalidate CloudFront cache (`/*`) if using CDN.

---

## 9. Optional: S3 banner uploads

Banner upload is implemented but **disabled until env vars are set**.

### AWS setup

1. Create bucket `ticket-assets-{env}`.
2. Bucket policy: public read on `events/*` (or serve via CloudFront).
3. IAM policy for the EC2 instance profile:

   ```json
   {
     "Effect": "Allow",
     "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
     "Resource": "arn:aws:s3:::ticket-assets-prod/events/*"
   }
   ```

4. Set API environment:

   ```env
   S3_BUCKET=ticket-assets-prod
   S3_PUBLIC_BASE_URL=https://ticket-assets-prod.s3.amazonaws.com
   AWS_REGION=us-east-1
   # Prefer IAM role on EC2 — leave AWS_ACCESS_KEY_ID empty in production
   ```

### Verify

```bash
# As ADMIN, upload via dashboard or:
curl -X POST http://localhost:3001/api/v1/admin/events/{id}/banner \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@banner.jpg"
```

Without `S3_BUCKET`, the API returns **503** with a clear message — the rest of the app still works.

---

## 10. CI/CD with GitHub Actions

Each repository includes `.github/workflows/ci.yml` that runs on push/PR to `main`:

| Repo | CI steps |
|------|----------|
| **ticket-api** | `pnpm install` → `prisma generate` → `build` → `test:e2e` (with Postgres service) |
| **ticket-frontend** | `pnpm install` → `build` |

### Enable CI on GitHub

1. Push both repos to GitHub (already at `HectorTorrez/ticket-api` and `HectorTorrez/ticket-frontend`).
2. Open **Actions** tab — workflows run automatically on the next push.
3. Add branch protection on `main` (optional): require CI to pass before merge.

No AWS secrets are required for CI — it only validates build and smoke tests.

---

## 11. Future CI/CD to AWS (manual today)

When you are ready to auto-deploy, extend the workflows:

### API pipeline (sketch)

```yaml
# On push to main, after CI passes:
# 1. docker build & push to ECR
# 2. Update ECS service OR trigger ASG instance refresh with new AMI
# 3. Run prisma migrate deploy (entrypoint already does this)
```

**GitHub secrets needed:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, ECR repository URL.

### Frontend pipeline (sketch)

```yaml
# On push to main:
# 1. pnpm build with VITE_API_BASE_URL secret
# 2. aws s3 sync .output/public s3://ticket-frontend-prod --delete
# 3. aws cloudfront create-invalidation ...
```

Or deploy the Nitro server image to ECS/Fargate instead of S3 sync.

---

## 12. Pre-go-live checklist

- [ ] ACM certificate validated
- [ ] RDS in private subnet; no public IP
- [ ] Secrets in SSM/Secrets Manager (not in git)
- [ ] `CORS_ORIGINS` matches frontend URL
- [ ] `VITE_API_BASE_URL` matches public API URL (set at **build time**)
- [ ] ALB health checks green on `/api/v1/health`
- [ ] Sticky sessions or Redis if ASG > 1 and using WebSockets
- [ ] RDS backup restore tested once
- [ ] S3 banner bucket + IAM (if using admin uploads)
- [ ] `pnpm run test:e2e:concurrency` against staging RDS

---

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — AWS diagram and security
- [DEPLOYMENT.md](./DEPLOYMENT.md) — EC2/ALB operational notes
- [API.md](./API.md) — HTTP/WebSocket contract
- [ticket-frontend IMPLEMENTATION.md](https://github.com/HectorTorrez/ticket-frontend/blob/main/IMPLEMENTATION.md) — frontend-specific deploy summary
