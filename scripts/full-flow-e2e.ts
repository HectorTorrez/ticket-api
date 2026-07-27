/**
 * Full purchase + QR validation against a running API (pnpm start:dev).
 * Run: pnpm test:e2e:flow
 */
import 'dotenv/config';

const API =
  process.env.PLAYWRIGHT_API_URL ??
  process.env.API_BASE_URL ??
  `http://localhost:${process.env.PORT ?? 3001}`;
const API_V1 = `${API.replace(/\/$/, '')}/api/v1`;

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ticket-api.local';
const adminPassword =
  process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!ChangeMe';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API_V1}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = (text ? JSON.parse(text) : null) as T;
  return { status: res.status, body };
}

async function main() {
  console.info(`Full-flow e2e → ${API_V1}`);

  const health = await api<{ status: string }>('/health');
  assert(
    health.status === 200 && health.body.status === 'ok',
    `API not healthy at ${API_V1}/health — start it with pnpm start:dev`,
  );

  const adminLogin = await api<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  assert(adminLogin.status < 400, `Admin login failed: ${adminLogin.status}`);
  const adminToken = adminLogin.body.accessToken;

  const ev = await api<{ id: string; slug: string }>('/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      title: 'E2E Full Flow Concert',
      slug: `e2e-flow-${Date.now()}`,
      startsAt: new Date(Date.now() + 864e5).toISOString(),
      endsAt: new Date(Date.now() + 2 * 864e5).toISOString(),
      venue: 'Test Arena',
    }),
  });
  assert(ev.status < 400, `Create event failed: ${JSON.stringify(ev.body)}`);
  const eventId = ev.body.id;
  const slug = ev.body.slug;

  const pub = await api(`/events/${eventId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(pub.status < 400, `Publish failed: ${JSON.stringify(pub.body)}`);

  const tt = await api<{ id: string }>(`/events/${eventId}/ticket-types`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      tier: 'GENERAL',
      name: 'General Admission',
      price: 25,
      quantity: 5,
    }),
  });
  assert(tt.status < 400, `Ticket type failed: ${JSON.stringify(tt.body)}`);
  const ticketTypeId = tt.body.id;

  const customerEmail = `buyer_${Date.now()}@e2e.local`;
  const register = await api<{
    accessToken: string;
    user: { role: string };
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: customerEmail,
      password: 'password123!',
    }),
  });
  assert(
    register.status < 400,
    `Register failed: ${JSON.stringify(register.body)}`,
  );
  assert(register.body.user.role === 'CUSTOMER', 'Expected CUSTOMER role');
  const customerToken = register.body.accessToken;

  const catalog = await api<{ items: Array<{ slug: string }> }>(
    `/events?publishedOnly=true&q=${encodeURIComponent(slug)}`,
  );
  assert(catalog.status === 200, 'Catalog failed');
  assert(
    catalog.body.items.some((e) => e.slug === slug),
    `Published event missing from catalog: ${JSON.stringify(catalog.body)}`,
  );

  const detail = await api(`/events/${slug}`);
  assert(detail.status === 200, `Public event detail failed: ${detail.status}`);

  const order = await api<{ id: string; status: string }>('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ lines: [{ ticketTypeId, quantity: 1 }] }),
  });
  assert(
    order.status < 400 && order.body.status === 'PENDING',
    `Order failed: ${JSON.stringify(order.body)}`,
  );

  const paid = await api<{ id: string; status: string }>(
    `/orders/${order.body.id}/mock-pay`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ outcome: 'SUCCESS' }),
    },
  );
  assert(
    paid.status < 400 && paid.body.status === 'PAID',
    `Pay failed: ${JSON.stringify(paid.body)}`,
  );

  const tickets = await api<{
    items: Array<{ publicCode: string }>;
  }>('/me/tickets', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(
    tickets.status === 200 &&
      Array.isArray(tickets.body.items) &&
      tickets.body.items.length > 0,
    `Tickets failed: ${JSON.stringify(tickets.body)}`,
  );
  const publicCode = tickets.body.items[0].publicCode;

  const publicCheck = await api(`/tickets/${publicCode}`);
  assert(publicCheck.status === 200, 'Public ticket check failed');

  const validate = await api<{ result: string }>('/qr/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      code: `http://localhost:3000/check/${publicCode}`,
    }),
  });
  assert(
    validate.status < 300 && validate.body.result === 'VALID',
    `QR validate failed (${validate.status}): ${JSON.stringify(validate.body)}`,
  );

  const again = await api<{ result: string }>('/qr/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ code: publicCode }),
  });
  assert(
    again.status < 300 && again.body.result === 'ALREADY_USED',
    `QR re-validate failed (${again.status}): ${JSON.stringify(again.body)}`,
  );

  const deny = await api('/dashboard/summary', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(
    deny.status === 403,
    `Expected 403 for customer dashboard, got ${deny.status}`,
  );

  const unauth = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({ lines: [{ ticketTypeId: 'x', quantity: 1 }] }),
  });
  assert(
    unauth.status === 401,
    `Expected 401 for anonymous order, got ${unauth.status}`,
  );

  console.info('Full flow e2e passed', { slug, publicCode });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
