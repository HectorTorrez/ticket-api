# Ticket API — Frontend reference

Base path for HTTP: **`/api/v1`** (see `main.ts`).  
Interactive docs: **`GET /docs`** (Swagger UI; not under `/api/v1`).

---

## Authentication

### JWT (HTTP)

Protected routes expect:

```http
Authorization: Bearer <accessToken>
```

Access tokens are short-lived (configured by `JWT_ACCESS_EXPIRES`, default **15m** in code). Use **`POST /api/v1/auth/refresh`** with a refresh token to obtain new tokens.

### Roles

| Role        | Typical use                          |
| ----------- | ------------------------------------ |
| `CUSTOMER`  | Buy tickets, list own tickets        |
| `ADMIN`     | Manage events, ticket types, QR gate |

Many routes apply **`RolesGuard`**: the handler declares required role(s). If your user’s `role` does not match, the API responds with **403**.

### Public routes

Routes marked **Public** skip JWT (see `@Public()`). Everything else requires a valid access token unless noted.

---

## Enums (exact string values)

Use these literals in JSON and TypeScript types.

| Enum          | Values |
| ------------- | ------ |
| `UserRole`    | `ADMIN`, `CUSTOMER` |
| `OrderStatus` | `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED` |
| `TicketStatus`| `ACTIVE`, `USED`, `CANCELLED` |
| `TicketTier`  | `GENERAL`, `VIP`, `EARLY_BIRD` |

Mock payment outcome: `SUCCESS` | `FAILURE` (see Orders).

---

## Money and decimals

`Decimal` fields from Prisma (e.g. `price`, `totalAmount`, `unitPrice`) are serialized in JSON as **strings** (e.g. `"49.99"`). Parse with `Number()` or a decimal library if you need arithmetic.

---

## Error responses

Non-2xx responses use a common JSON shape from `HttpExceptionFilter`:

```json
{
  "statusCode": 400,
  "message": "Human readable message",
  "code": "Bad Request",
  "path": "/api/v1/...",
  "timestamp": "2026-05-07T12:00:00.000Z"
}
```

Validation errors may join multiple messages into `message`.  
Common codes: **401** (auth), **403** (role/forbidden), **404**, **409** (conflict, e.g. sold out), **410** (e.g. expired reservation).

---

## Auth

All under `POST /api/v1/auth`. These are **public** and have **stricter rate limits** than the global default.

### `POST /api/v1/auth/register`

**Body**

| Field      | Type   | Rules        |
| ---------- | ------ | ------------ |
| `email`    | string | valid email  |
| `password` | string | min length 8 |

**201/200 response** (tokens + user)

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque hex string>",
  "user": {
    "id": "<uuid>",
    "email": "buyer@example.com",
    "role": "CUSTOMER"
  }
}
```

**409** if email already registered.

### `POST /api/v1/auth/login`

**Body**

| Field      | Type   |
| ---------- | ------ |
| `email`    | string |
| `password` | string |

**Response** — same shape as register.

**401** on bad credentials.

### `POST /api/v1/auth/refresh`

**Body**

| Field            | Type   | Rules        |
| ---------------- | ------ | ------------ |
| `refreshToken`   | string | min length 10 |

**Response** — same token + user shape as register. The old refresh row is **revoked** server-side when rotation succeeds.

**401** if refresh token invalid or expired.

### `POST/api/v1/auth/logout`

**Body**

| Field          | Type   | Rules        |
| -------------- | ------ | ------------ |
| `refreshToken` | string | min length 10 |

**Response**

```json
{ "loggedOut": true }
```

(Idempotent-ish: deletes refresh token row if it exists.)

---

## Health

**Public.**

| Method & path              | Response                          |
| -------------------------- | --------------------------------- |
| `GET /api/v1/health`       | `{ "status": "ok" }`              |
| `GET /api/v1/health/ready` | `{ "status": "ready" }` (DB ping) |

---

## Events (public catalog)

**Public.**

### `GET /api/v1/events`

List events (published by default).

**Query**

| Param              | Type    | Default | Description |
| ------------------ | ------- | ------- | ----------- |
| `page`             | number  | 1       | 1–∞         |
| `limit`            | number  | 20      | 1–100       |
| `publishedOnly`    | boolean | `true`  | If `false`, can include unpublished (still not deleted) |
| `from`             | string  | —       | ISO date — filter `startsAt >= from` |
| `to`               | string  | —       | ISO date — filter `startsAt <= to` |
| `q`                | string  | —       | max 120 chars, search title/slug (case-insensitive) |

**Response**

```json
{
  "items": [ /* Event + ticketTypes summary, see below */ ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

Each **item** is an `Event` row plus `ticketTypes` **subset**:

- `id`, `tier`, `name`, `price` (string), `quantityRemaining`, `saleStartsAt`, `saleEndsAt`

Other event fields: `id`, `organizerId`, `title`, `slug`, `description`, `startsAt`, `endsAt`, `venue`, `published`, `bannerKey`, `bannerUrl`, `createdAt`, `updatedAt`, `deletedAt` (usually `null` in lists).

### `GET /api/v1/events/:slugOrId`

Single published event. `:slugOrId` is either **slug** or **UUID**.

**Response** — full `Event` with **`ticketTypes: TicketType[]`** (all columns for each type, including `quantityTotal`, `quantityRemaining`, `eventId`, etc.).

**404** if not found or not published.

---

## Events (admin)

**Auth:** Bearer **ADMIN**.

All paths: `/api/v1/events/...`

### `POST /api/v1/events`

Create draft event (`published` defaults **false** in DB).

**Body**

| Field         | Type   | Required | Rules |
| ------------- | ------ | -------- | ----- |
| `title`       | string | yes      | 2–200 chars |
| `slug`        | string | no       | max 200; if omitted, derived from title + random suffix |
| `description` | string | no     | max 5000 |
| `startsAt`    | string | yes      | ISO date string |
| `endsAt`      | string | yes      | ISO date string; must be **after** `startsAt` |
| `venue`       | string | no       | max 300 |

**Response** — created `Event` (Prisma model).

**409** if slug cannot be made unique after retries.

### `PATCH /api/v1/events/:id`

`:id` must be UUID.

**Body** — partial `CreateEventDto` (all fields optional). Same date/ordering rules if `startsAt`/`endsAt` provided.

**Response** — updated `Event`.

**404** / **409** (slug conflict).

### `DELETE /api/v1/events/:id`

Soft-delete: sets `deletedAt`, `published: false`.

**Response**

```json
{ "deleted": true }
```

### `POST /api/v1/events/:id/publish`

**Response** — updated `Event` with `published: true`.

### `POST /api/v1/events/:id/unpublish`

**Response** — updated `Event` with `published: false`.

### `POST /api/v1/events/:id/banner`

**Content-Type:** `multipart/form-data`  
**Field name:** `file` (single file)

Validation: max **5 MB**, types **JPEG / PNG / WebP**.

**Response** — updated `Event` with `bannerKey` and `bannerUrl` set.

---

## Ticket types (admin)

**Auth:** Bearer **ADMIN**.

### `POST /api/v1/events/:eventId/ticket-types`

`:eventId` = UUID.

**Body**

| Field          | Type   | Required | Rules |
| -------------- | ------ | -------- | ----- |
| `tier`         | string | yes      | `TicketTier` enum |
| `name`         | string | yes      | max 120 |
| `price`        | number | yes      | ≥ 0 |
| `quantity`     | number | yes      | integer ≥ 1 — sets both total and remaining |
| `saleStartsAt` | string | no       | ISO — optional sale window start |
| `saleEndsAt`   | string | no       | ISO — optional sale window end |

**Response** — created `TicketType`.

**409** if tier already exists for this event (`@@unique([eventId, tier])`).

### `PATCH /api/v1/ticket-types/:id`

**Body** — partial: any of `tier`, `name`, `price`, `quantity`, `saleStartsAt`, `saleEndsAt`.

- If `quantity` is sent, total updates; remaining is adjusted so it cannot go below already sold/reserved count.

**Response** — updated `TicketType`.

### `DELETE /api/v1/ticket-types/:id`

Only if no order lines reference this type.

**Response**

```json
{ "deleted": true }
```

**409** if type has orders.

---

## Orders (customer)

**Auth:** Bearer **CUSTOMER**.

### `POST /api/v1/orders`

Reserve inventory and create a **PENDING** order.

**Body**

```json
{
  "lines": [
    { "ticketTypeId": "<uuid>", "quantity": 2 }
  ]
}
```

| Field   | Type   | Rules |
| ------- | ------ | ----- |
| `lines` | array  | min 1 item |
| `lines[].ticketTypeId` | string | UUID |
| `lines[].quantity`     | number | integer ≥ 1 |

Duplicate `ticketTypeId` lines are merged server-side.

**Response** — `Order` with:

```json
{
  "id": "...",
  "userId": "...",
  "status": "PENDING",
  "currency": "USD",
  "totalAmount": "123.45",
  "expiresAt": "...",
  "paidAt": null,
  "paymentReference": null,
  "createdAt": "...",
  "updatedAt": "...",
  "lines": [
    {
      "id": "...",
      "orderId": "...",
      "ticketTypeId": "...",
      "quantity": 2,
      "unitPrice": "49.99",
      "ticketType": {
        "tier": "GENERAL",
        "name": "General admission",
        "price": "49.99"
      }
    }
  ]
}
```

**Errors:** **404** (bad ticket type), **400** (event not published, sale window), **409** (not enough `quantityRemaining`).

Reservation TTL comes from `ORDER_RESERVATION_TTL_MINUTES` (default **15** minutes).

### `POST /api/v1/orders/:id/mock-pay`

Simulate payment (MVP). `:id` = order UUID.

**Body**

```json
{ "outcome": "SUCCESS" }
```

`outcome`: **`SUCCESS`** | **`FAILURE`**

**Behavior**

- Only **PENDING** orders; must belong to current user.
- If order is past `expiresAt`, inventory is restored and status → **`EXPIRED`**.
- **FAILURE**: inventory restored, status **`FAILED`**, `paymentReference` `"mock_failed"`.
- **SUCCESS**: status **`PAID`**, `paidAt` set, `paymentReference` like `mock_<timestamp>`, **tickets issued** (one `Ticket` per seat).

**Response** — `Order` with `lines` including **full** `ticketType` objects (not just the summary from create).

### `POST /api/v1/orders/:id/cancel`

Cancel **PENDING** order (before expiry); restores inventory.

**Response**

```json
{ "cancelled": true }
```

**409** if not pending. **410** if reservation expired.

---

## Tickets

### `GET /api/v1/me/tickets`

**Auth:** Bearer **CUSTOMER**.

**Response** — array of tickets:

```json
[
  {
    "id": "...",
    "publicCode": "...",
    "orderLineId": "...",
    "userId": "...",
    "eventId": "...",
    "ticketTypeId": "...",
    "status": "ACTIVE",
    "usedAt": null,
    "validatedByUserId": null,
    "event": {
      "id": "...",
      "title": "...",
      "slug": "...",
      "startsAt": "...",
      "venue": "..."
    },
    "ticketType": {
      "tier": "GENERAL",
      "name": "General admission"
    }
  }
]
```

### `GET /api/v1/tickets/:publicCode`

**Public.** Minimal payload for wallet / share links.

**Response**

```json
{
  "publicCode": "<uuid>",
  "status": "ACTIVE",
  "event": {
    "title": "...",
    "startsAt": "...",
    "slug": "..."
  },
  "ticketType": {
    "tier": "GENERAL",
    "name": "General admission"
  }
}
```

**404** if code unknown.

### `GET /api/v1/tickets/:publicCode/qr`

**Public.** Returns **PNG** image bytes (`Content-Type: image/png`). QR encodes the **plain `publicCode`** string (what scanners should submit to validate).

---

## QR validation (admin gate)

**Auth:** Bearer **ADMIN**.

### `POST /api/v1/qr/validate`

**Body**

| Field  | Type   | Rules |
| ------ | ------ | ----- |
| `code` | string | 8–64 chars; trimmed server-side — should be `publicCode` |

**Response**

```json
{ "result": "VALID" }
```

Possible `result` values:

| Value          | Meaning |
| -------------- | ------- |
| `VALID`        | Ticket was **ACTIVE**, now marked **USED** with `usedAt` and `validatedByUserId` |
| `ALREADY_USED` | Was already **USED** — not updated |
| `INVALID`      | Unknown code, or **CANCELLED** |

---

## Dashboard (admin)

**Auth:** Bearer **ADMIN**.

### `GET /api/v1/dashboard/summary`

**Response**

```json
{
  "ticketsSold": 150,
  "totalRevenue": "12345.67",
  "activeEvents": 3,
  "remainingInventory": 890
}
```

- `activeEvents`: published, not deleted, `endsAt > now`.
- `totalRevenue`: sum of **PAID** orders’ `totalAmount` (string).

---

## WebSocket — live inventory

**Namespace:** `/inventory` (Socket.IO).

Server URL is the same host/port as the API; path follows your Socket.IO config (often clients use the API origin and `namespace: '/inventory'`).

### Connection auth

Either:

- Handshake **`auth.token`** = access JWT, or  
- Header **`Authorization: Bearer <accessToken>`**

Invalid/missing token → disconnect.

### Client → server

**Event:** `event:join`  
**Payload:** `{ "eventId": "<uuid>" }`

**Ack** (callback reply):

- `{ "ok": true, "room": "event:<eventId>" }`, or  
- `{ "ok": false, "error": "eventId required" }`

### Server → client

**Event:** `tickets:update`  
**Payload:**

```json
{
  "eventId": "<uuid>",
  "ticketTypeId": "<uuid>",
  "remaining": 42,
  "updatedAt": "2026-05-07T12:00:00.000Z"
}
```

Emitted when inventory changes (orders, mock pay, cancel, expiry pipeline, admin ticket-type create/update, etc.).

---

## Rate limiting

Global throttle (default): **200 requests per 60s** per Throttler defaults in `AppModule`.  
Auth endpoints use lower per-route limits (register/login/refresh/logout).

---

## Quick frontend checklist

1. Store **`accessToken`** and **`refreshToken`** securely; refresh before expiry.
2. Send **`Authorization: Bearer`** on all non-public HTTP calls.
3. For event detail pages, subscribe to **`/inventory`** + `event:join` with `eventId` to update “seats left” live.
4. Treat **prices** as strings from JSON; use **`publicCode`** for QR and public ticket URLs.
5. After **mock-pay SUCCESS**, poll or navigate **`GET /api/v1/me/tickets`** to show issued passes.

---

*Generated from the NestJS codebase in this repo; if behavior diverges, trust the running `/docs` Swagger and server implementation.*
